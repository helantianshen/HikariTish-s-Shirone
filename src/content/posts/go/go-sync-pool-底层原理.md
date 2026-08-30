---
title: Go sync.Pool 底层原理
published: 2026-06-04
description: 关于「Go sync.Pool 底层原理」的技术笔记。
tags:
  - go
  - 并发
  - 内存管理
category: Go
pinned: false
draft: false
comment: true
lang: zh_CN
---

> `sync.Pool` 是 Go 标准库中的**临时对象缓存池**，用于复用高频创建销毁的临时对象以降低 GC 压力。其核心设计基于 **Per-P 本地池 + 无锁存取 + 工作窃取 + Victim Cache 二级缓存**，在 Go 1.13 经历史诗级重构后，解决了 GC 清空池子导致的性能毛刺问题。

---

## 目录

1. [核心架构：Per-P 本地池模型](#1-核心架构per-p-本地池模型)
2. [关键机制：工作窃取](#2-关键机制工作窃取)
3. [Victim Cache：避免 GC 悬崖](#3-victim-cache避免-gc-悬崖)
4. [Get 与 Put 执行流](#4-get-与-put-执行流)
5. [数据结构源码剖析](#5-数据结构源码剖析)
6. [生命周期与 GC 交互](#6-生命周期与-gc-交互)
7. [生产环境避坑指南](#7-生产环境避坑指南)
8. [适用场景与反模式](#8-适用场景与反模式)
9. [总结](#9-总结)

---

## 1. 核心架构：Per-P 本地池模型

### 1.1 为什么需要 sync.Pool

在高并发场景下，频繁创建和销毁临时对象（如缓冲区、临时切片）会给 GC 带来巨大压力。`sync.Pool` 通过**对象复用**减少堆分配次数，从而降低 GC 标记和清扫的工作量。

### 1.2 Per-P 架构

从 Go 1.13 开始，`sync.Pool` 彻底重构为**基于 GMP 中 P（Processor）的本地化设计**：

```
┌─────────────────────────────────────────────────────────┐
│                    sync.Pool 全局结构                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  全局 Pool 对象                                          │
│  ┌──────────────────────────────────────┐               │
│  │  local     → poolChain (双向链表)      │               │
│  │  localSize                          │               │
│  │  victim     → 上一轮的 poolChain      │               │
│  │  victimSize                         │               │
│  │  New        → func() interface{}     │               │
│  └──────────────────────────────────────┘               │
│       │                                                  │
│       ▼                                                  │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                 │
│  │   P₀    │  │   P₁    │  │   P₂    │  ...             │
│  │ ┌─────┐ │  │ ┌─────┐ │  │ ┌─────┐ │                 │
│  │ │private│  │ │private│  │ │private│  ← 无锁，最快路径  │
│  │ ├─────┤ │  │ ├─────┤ │  │ ├─────┤ │                 │
│  │ │shared│ │  │ │shared│ │  │ │shared│  ← 无锁双端队列   │
│  │ │[ ] [ ]│  │ │[ ] [ ]│  │ │[ ] [ ]│                 │
│  │ └─────┘ │  │ └─────┘ │  │ └─────┘ │                 │
│  └─────────┘  └─────────┘  └─────────┘                 │
│                                                         │
│  Victim Cache (GC 淘汰暂存区)                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                 │
│  │   P₀    │  │   P₁    │  │   P₂    │  ...             │
│  │ (上轮GC)│  │ (上轮GC)│  │ (上轮GC)│                  │
│  └─────────┘  └─────────┘  └─────────┘                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**核心设计理念**：

| 设计点 | 说明 |
|--------|------|
| **Per-P 本地池** | 每个 P 拥有独立的 `poolLocal`，Goroutine 操作本地池时**无需加锁** |
| **P 级绑定** | Goroutine 在执行 `Get`/`Put` 时被"钉"在当前 P 上，同一时刻一个 P 只运行一个 G |
| **无锁 Fast Path** | Private 槽位和 Shared 队头操作完全无锁，保证极速存取 |
| **惰性创建** | P 的本地池在第一次使用时才分配，避免闲置 P 的内存浪费 |

### 1.3 Private 与 Shared 分级存储

```
poolLocal (每个 P 一个)
┌─────────────────────────────────────────────┐
│                                             │
│  private     →  单一对象槽位                  │
│                存取最快，绝对无竞争            │
│                                             │
│  shared      →  无锁双端队列 (Lock-free Deque)│
│  ┌─────┬─────┬─────┬─────┐                  │
│  │ obj │ obj │ obj │ ... │  ← P 自己从头取    │
│  └─────┴─────┴─────┴─────┘   其他 P 从尾偷    │
│    head                   tail               │
│                                             │
└─────────────────────────────────────────────┘
```

| 存储层级 | 容量 | 竞争程度 | 存取速度 | 说明 |
|----------|------|----------|----------|------|
| **Private** | 1 个对象 | 零竞争 | 最快 | 每个 P 的专属槽位 |
| **Shared（头部）** | 无限制（链表） | 无竞争（仅本 P 操作） | 快 | 本 P 存取，无锁 |
| **Shared（尾部）** | 同上 | 低竞争（其他 P 偷取） | 较快 | 原子操作保证安全 |

---

## 2. 关键机制：工作窃取

### 2.1 窃取策略

当当前 P 的 Private 和 Shared 均为空时，不会立即调用 `New()` 创建新对象，而是尝试**从其他 P 偷取**：

```
当前 P 的 poolLocal 为空
        │
        ▼
┌───────────────────────────────────────────┐
│  随机选择一个其他 P                         │
│         │                                  │
│         ▼                                  │
│  从该 P 的 Shared 队列 尾部 偷取            │
│  (该 P 自己从头部取，减少竞争)               │
│         │                                  │
│     ┌───┴───┐                              │
│     │ 偷到？ │                              │
│     └───┬───┘                              │
│    Yes  │  No                              │
│     ↓   │   ↓                              │
│   返回   │  尝试下一个 P                     │
│         │  (最多遍历所有 P 一次)             │
│         │         │                        │
│         │     ┌───┴───┐                    │
│         │     │ 偷到？ │                    │
│         │     └───┬───┘                    │
│         │    Yes  │  No                    │
│         │     ↓   │   ↓                    │
│         │   返回   │  检查 Victim Cache     │
└───────────────────────────────────────────┘
```

### 2.2 为什么从尾部偷

```
本 P 操作方向:  head → [obj1] [obj2] [obj3] ← tail  其他 P 偷取方向

本 P 从 head 取 / 向 head 放  →   ←  其他 P 从 tail 偷

两个方向互不干扰，将原子操作的竞争降到最低
```

**设计亮点**：
- 本 P 的 `Get`/`Put` 操作 Shared 队列**头部**，无需原子操作
- 其他 P 偷取时操作**尾部**，与头部操作不冲突
- 仅在偷取时需要 CAS 原子操作，最小化竞争

---

## 3. Victim Cache：避免 GC 悬崖

### 3.1 问题背景

Go 1.13 之前，每次 GC 都会**彻底清空** `sync.Pool` 中的所有对象。如果程序恰好在 GC 后需要大量对象，就会引发**分配风暴**——大量 `New()` 调用导致堆分配激增和 GC 压力反弹。

```
Go 1.13 之前:
  GC 发生 → 池子全空 → 分配风暴 → 大量 New() → GC 压力增大 → 恶性循环

Go 1.13 之后:
  GC 发生 → 对象移入 Victim → 下次 Get 可赎回 → 仅两次 GC 无人用才真正清理
```

### 3.2 Victim Cache 机制

```
第一轮 GC                   第二轮 GC
    │                           │
    ▼                           ▼
┌─────────┐               ┌─────────┐
│ 活跃对象 │ ──淘汰──→  ┌─────────┐ │
│(primary)│            │ Victim  │ │
└─────────┘            │ (免死金牌)│ │
                       └────┬────┘ │
                            │      │
                    Get 赎回 │      │ 无人 Get
                            │      │
                            ▼      ▼
                        复活回    真正
                        primary   清理
```

### 3.3 关键结论

| 阶段 | 对象状态 | 说明 |
|------|----------|------|
| **Put 入池** | 存入 primary poolLocal | 随时可被 Get 取出 |
| **第一次 GC** | primary → Victim | 被"淘汰"但未销毁 |
| **GC 后 Get** | Victim → primary（复活） | 只要被使用就复活 |
| **第二次 GC** | Victim 被清理 | 两次 GC 无人用，彻底回收 |

> **放入 `sync.Pool` 的对象，最多可以存活两次 GC 循环。**这提供了宝贵的缓冲窗口，避免了 GC 后的分配风暴。

---

## 4. Get 与 Put 执行流

### 4.1 Get 查找顺序

```
Get() 调用
    │
    ├── ① 当前 P 的 Private 槽位
    │      （最快，无锁，命中率高）
    │      └── 命中 → 返回，清空 private
    │
    ├── ② 当前 P 的 Shared 队列头部
    │      （无锁，环形缓冲区 popHead）
    │      └── 命中 → 返回
    │
    ├── ③ 从其他 P 的 Shared 队列尾部偷取
    │      （需要原子操作 CAS，遍历所有 P）
    │      └── 命中 → 返回
    │
    ├── ④ 当前 P 的 Victim Cache
    │      （上轮 GC 淘汰的对象，赎回即复活）
    │      └── 命中 → 返回（对象升级回 primary）
    │
    └── ⑤ 调用 New() 函数创建新对象
           （池子完全空，只能分配新的）
           └── 如果没有设置 New → 返回 nil
```

### 4.2 Put 放置顺序

```
Put(obj)
    │
    ├── ① 当前 P 的 Private 槽位为空？
    │      是 → 存入 private（最快路径）
    │      否 → 继续
    │
    └── ② 压入当前 P 的 Shared 队列头部
           （无锁操作，环形缓冲区 pushHead）
```

### 4.3 完整状态机

```
                    ┌─────────┐
       New()创建     │         │  Put()
    ┌──────────────→│  池外   │←──────────────┐
    │               │ (堆上)  │               │
    │               └─────────┘               │
    │                                         │
    │  Get() 未命中                          │
    │                                         │
    ▼                                         │
┌─────────┐  Get()命中  ┌─────────┐          │
│         │←───────────│         │          │
│ primary │            │ Victim  │          │
│(poolLocal)│──GC淘汰──→│(回收缓存)│          │
│         │            │         │          │
└─────────┘  两次GC后  └─────────┘          │
                 清理       │               │
                    ┌───────┘               │
                    ▼                       │
              ┌─────────┐                  │
              │  GC回收  │                  │
              │ (真正释放)│                  │
              └─────────┘                  │
```

---

## 5. 数据结构源码剖析

> 以下源码来自 Go 官方运行时 `src/sync/pool.go`（Go 1.21+）。

### 5.1 Pool 结构体

```go
// src/sync/pool.go

type Pool struct {
    noCopy noCopy          // 防止拷贝的占位符

    local     unsafe.Pointer // 指向 [P]poolLocal 数组的指针
    localSize uintptr        // local 数组的大小

    victim     unsafe.Pointer // 上一轮 GC 淘汰的 local 数组
    victimSize uintptr        // victim 数组的大小

    New func() any           // 用户提供的对象创建函数
}
```

### 5.2 poolLocal — 每个 P 的本地池

```go
// src/sync/pool.go

type poolLocal struct {
    poolLocalInternal

    // 防止 false sharing（伪共享）
    // 将 poolLocal 填充到 cache line 大小的倍数
    pad [128 - unsafe.Sizeof(poolLocalInternal{})%128]byte
}

type poolLocalInternal struct {
    private any        // 只能被对应的 P 访问（无锁）
    shared  poolChain  // 无锁双端队列，head 本地访问，tail 可被其他 P 偷取
}
```

### 5.3 poolChain — 无锁双端队列

```go
// src/sync/poolqueue.go

type poolChain struct {
    head *poolChainElt  // 仅生产者（本 P）操作，POP 方向
    tail *poolChainElt  // 消费者（其他 P 偷取）操作，需要原子操作
}

type poolChainElt struct {
    poolDequeue                    // 环形缓冲区
    next, prev *poolChainElt       // 双向链表
}

type poolDequeue struct {
    headTail atomic.Uint64         // 高 32 位 = head，低 32 位 = tail
    vals []eface                   // 存储对象的环形缓冲区
}
```

**poolDequeue 作为环形缓冲区**：
- `head` → 本地 P 从头部 push/pop（无锁）
- `tail` → 其他 P 从尾部 pop（使用 CAS 原子操作）
- 容量动态增长：当缓冲区满时，新增一个 `poolChainElt` 链接到链表

### 5.4 Pool 的内存布局

```
Pool
┌──────────────────────────────────────────┐
│ local ──────→ [P]poolLocal 数组           │
│ localSize = GOMAXPROCS                   │
│                                          │
│ victim ─────→ 上一轮的 [P]poolLocal 数组   │
│ victimSize                               │
│                                          │
│ New()                                    │
└──────────────────────────────────────────┘

poolLocal[0]   poolLocal[1]   poolLocal[2]
┌──────────┐   ┌──────────┐   ┌──────────┐
│ private  │   │ private  │   │ private  │
│ (1个对象) │   │ (1个对象) │   │ (1个对象) │
├──────────┤   ├──────────┤   ├──────────┤
│ shared   │   │ shared   │   │ shared   │
│ poolChain│   │ poolChain│   │ poolChain│
│  ↓       │   │  ↓       │   │  ↓       │
│ [Elt]──→ │   │ [Elt]──→ │   │ [Elt]    │
│ 环形buf  │   │ 环形buf  │   │ 环形buf  │
└──────────┘   └──────────┘   └──────────┘
```

### 5.5 核心操作源码

**Get 实现（简化）**：

```go
// src/sync/pool.go

func (p *Pool) Get() any {
    // 将当前 G 固定在 P 上，防止被抢占
    l, pid := p.pin()

    // ① 优先取 private
    x := l.private
    l.private = nil
    if x == nil {
        // ② 从 shared 头部取
        x, _ = l.shared.popHead()

        if x == nil {
            // ③ 从其他 P 偷取 + ④ 检查 victim
            x = p.getSlow(pid)
        }
    }
    runtime_procUnpin()

    // ⑤ 都没有则调用 New
    if x == nil && p.New != nil {
        x = p.New()
    }
    return x
}
```

**Put 实现（简化）**：

```go
// src/sync/pool.go

func (p *Pool) Put(x any) {
    if x == nil {
        return
    }
    l, _ := p.pin()

    // ① 优先塞入 private
    if l.private == nil {
        l.private = x
    } else {
        // ② private 已有，压入 shared 头部
        l.shared.pushHead(x)
    }
    runtime_procUnpin()
}
```

**getSlow（偷取 + victim 兜底）**：

```go
// src/sync/pool.go

func (p *Pool) getSlow(pid int) any {
    size := runtime_LoadAcquintptr(&p.localSize)
    locals := p.local

    // ③ 尝试从其他 P 偷取
    for i := 0; i < int(size); i++ {
        l := indexLocal(locals, (pid+i+1)%int(size))
        if x, _ := l.shared.popTail(); x != nil {
            return x
        }
    }

    // ④ 尝试从 victim cache 取
    size = atomic.LoadUintptr(&p.victimSize)
    if uintptr(pid) >= size {
        return nil
    }
    locals = p.victim
    l := indexLocal(locals, pid)
    if x := l.private; x != nil {
        l.private = nil
        return x
    }
    for i := 0; i < int(size); i++ {
        l := indexLocal(locals, (pid+i)%int(size))
        if x, _ := l.shared.popTail(); x != nil {
            return x
        }
    }

    // 标记 victim cache 已空，下次 GC 时完全清理
    atomic.StoreUintptr(&p.victimSize, 0)
    return nil
}
```

---

## 6. 生命周期与 GC 交互

### 6.1 GC 时的 poolCleanup

```go
// src/sync/pool.go

func poolCleanup() {
    // 该函数在每次 GC 开始时的 STW 阶段被调用

    for _, p := range allPools {
        // ① 丢弃旧的 victim
        p.victim = nil
        p.victimSize = 0

        // ② 将当前的 local 降级为 victim
        p.victim = p.local
        p.victimSize = p.localSize

        // ③ 创建新的空 local
        p.local = nil
        p.localSize = 0
    }
}
```

### 6.2 完整生命周期时间线

```
时间 →
─────────────────────────────────────────────────────────────────────
         │                    │                    │
    GC#1 开始             GC#2 开始            GC#3 开始
         │                    │                    │
         ▼                    ▼                    ▼
    ┌─────────┐          ┌─────────┐          ┌─────────┐
    │ primary │          │   new   │          │   new   │
    │ (有对象)│          │ primary │          │ primary │
    └────┬────┘          │ (重建)  │          │ (重建)  │
         │               └────┬────┘          └────┬────┘
         │ 降级               │                    │
         ▼                    │ 降级               │ 降级
    ┌─────────┐               ▼                    ▼
    │ Victim  │          ┌─────────┐          ┌─────────┐
    │(原primary)         │  Victim │          │  Victim │
    │         │          │(原primary)         │(原primary)
    └─────────┘          └────┬────┘          └────┬────┘
                              │                    │
                              │ 真正回收            │ 真正回收
                              ▼                    ▼
                         ┌─────────┐          ┌─────────┐
                         │  GC回收  │          │  GC回收  │
                         └─────────┘          └─────────┘
```

> **关键**：每个对象从 `Put` 入池到真正被 GC 回收，必定存活**至少一轮 GC**，最多存活**两轮 GC**。

### 6.3 与常规 GC 的区别

| 对比维度 | 常规堆对象 | sync.Pool 中的对象 |
|----------|-----------|-------------------|
| **回收方式** | 不可达后 GC 回收 | 两次 GC 无人用才回收 |
| **存活保证** | 取决于引用 | Victim Cache 保底一轮 GC |
| **对 GC 的影响** | 增加 GC 标记负担 | 复用减少堆分配，降低 GC 压力 |
| **可控性** | 完全由 GC 控制 | 用户可控制 Put/Get 时机 |

---

## 7. 生产环境避坑指南

### 7.1 坑一：严重的内存泄漏（放回大切片）

**场景**：把一个动态扩容后底层数组巨大的对象放回池子，永久占据大量内存。

```go
// ❌ 错误做法：大对象直接放回池
func process(pool *sync.Pool) {
    buf := pool.Get().([]byte)
    buf = doWork(buf)        // buf 可能扩容到 1GB
    pool.Put(buf)            // 1GB 永远不会被释放！
}

// ✓ 正确做法：太大就丢弃
func process(pool *sync.Pool) {
    buf := pool.Get().([]byte)
    buf = doWork(buf)

    const maxCap = 64 * 1024 // 64KB 阈值
    if cap(buf) > maxCap {
        return               // 丢弃让 GC 回收
    }
    pool.Put(buf[:0])        // 重置长度
}
```

**调优原则**：`Put` 前设置容量阈值检查，太大的对象直接丢弃。

### 7.2 坑二：拿到脏数据

**场景**：`sync.Pool` **不会**自动清空对象里的历史数据，直接使用可能导致数据串扰。

```go
// ❌ 错误做法：不重置直接使用
buf := pool.Get().([]byte)
data := parseData()
buf = append(buf, data...)   // buf 可能残留上一个请求的数据！
process(buf)

// ✓ 正确做法：获取或放回时重置
buf := pool.Get().([]byte)
buf = buf[:0]                // 重置长度，不清零但不可见
buf = append(buf, data...)
process(buf)
pool.Put(buf[:0])            // 放回前再次重置
```

**最佳实践**：

| 时机 | 操作 | 原因 |
|------|------|------|
| **Get 后** | 重置对象字段/长度 | 防止读到上一个使用者的数据 |
| **Put 前** | 重置对象并清理引用 | 提前释放对象内部引用的其他指针，帮助 GC |

```go
// 结构体类型的重置模板
type MyStruct struct {
    Name   string
    Buffer []byte
    Items  []*Item
}

func (m *MyStruct) Reset() {
    m.Name = ""
    m.Buffer = m.Buffer[:0]
    for i := range m.Items {
        m.Items[i] = nil  // 释放引用，帮助 GC
    }
    m.Items = m.Items[:0]
}
```

### 7.3 坑三：不能假设对象的生命周期或地址

**核心误区**：把 `sync.Pool` 当持久化存储或连接池使用。

```go
// ❌ 严重错误：把连接放入 Pool
type ConnPool struct {
    pool sync.Pool
}
func (p *ConnPool) Get() *sql.DB {
    return p.pool.Get().(*sql.DB)
}
// 问题：连接随时可能在 2 次 GC 后被销毁！

// ❌ 严重错误：取对象的地址做身份标识
obj1 := pool.Get().(*MyStruct)
saveAddress(unsafe.Pointer(obj1))
pool.Put(obj1)
obj2 := pool.Get().(*MyStruct)
// obj2 可能 == obj1，但你不能依赖！
```

| 错误假设 | 正确认知 |
|----------|----------|
| Pool 中的对象会一直存在 | 最多存活 2 次 GC 循环 |
| 可以从 Pool 取对象做"注册" | 对象随时可能被 GC 回收 |
| 适合存数据库连接 | 请用专用的连接池库 |
| 适合存带状态的对象 | 仅适合**无状态的内存块**复用 |

> `sync.Pool` 的设计目的：**无状态的临时内存块复用**。连接池、缓存、注册表等场景请使用专用方案。

---

## 8. 适用场景与反模式

### 8.1 适用场景

| 场景 | 典型例子 | 收益 |
|------|----------|------|
| **高频临时对象复用** | JSON 编解码的 `bytes.Buffer`、字符串拼接 | 大幅减少堆分配 |
| **协议解析缓冲区** | 网络包读取缓冲区 | 避免每包分配一次 |
| **goroutine 局部对象** | 每个请求的临时切片/token | 减少 GC 压力 |
| **fmt 格式化缓冲** | `fmt.Sprintf` 内部使用 `sync.Pool` | 标准库已验证的模式 |

### 8.2 反模式

| 反模式 | 问题 |
|--------|------|
| 作为连接池 | GC 会清空，连接泄漏 |
| 作为全局缓存 | 无法控制失效时间 |
| 存储有状态对象 | 状态不确定，行为不可预测 |
| 存放超大对象不放回限制 | 内存泄漏 |
| 不经重置直接使用 | 脏数据串扰 |

### 8.3 标准库中的使用模式

```go
// fmt 包内部使用 sync.Pool 复用 pp 结构体
// src/fmt/print.go
var ppFree = sync.Pool{
    New: func() any { return new(pp) },
}

func newPrinter() *pp {
    p := ppFree.Get().(*pp)
    p.panicking = false
    p.erroring = false
    p.wrapErrs = false
    p.fmt.init(&p.buf)       // 重置内部缓冲区
    return p
}

func (p *pp) free() {
    // 确保不持有外部引用
    p.buf = p.buf[:0]
    p.arg = nil
    p.value = reflect.Value{}
    p.wrappedErrs = nil
    ppFree.Put(p)
}
```

---

## 9. 总结

### 9.1 sync.Pool 核心架构总览

```
┌─────────────────────────────────────────────────────────────────┐
│                      sync.Pool 总览                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Get() 查找顺序:                                                │
│   ① Private → ② Shared(head) → ③ Steal(tail) → ④ Victim → ⑤ New│
│                                                                 │
│   Put() 放置顺序:                                                │
│   ① Private → ② Shared(head)                                    │
│                                                                 │
│   GC 淘汰策略:                                                   │
│   GC#1: primary → Victim (免死金牌)                              │
│   GC#2: Victim → 真正回收                                       │
│                                                                 │
│   并发安全:                                                      │
│   Private/Shared(head): 单 P 独占，无锁                         │
│   Shared(tail): 多 P 竞争，CAS 原子操作                         │
│   poolCleanup: STW 阶段执行，无竞争                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 9.2 关键设计原则

| 原则 | 说明 |
|------|------|
| **Per-P 本地化** | 每个 P 独立 poolLocal，本 P 操作无锁，最大化并发性能 |
| **分级存储** | Private → Shared，逐级降速但增加容量 |
| **工作窃取** | 本 P 空时从其他 P 偷取，自适应负载均衡 |
| **方向分离** | 本 P 操作头部，其他 P 偷尾部，最小化 CAS 竞争 |
| **二级缓存** | Victim Cache 避免 GC 清空导致的分配风暴 |
| **惰性分配** | P 的 poolLocal 仅在首次使用时创建 |
| **无状态假设** | 对象不保证持续存在，使用者负责重置 |
| **false sharing 防护** | `poolLocal` 填充到 cache line 边界 |

### 9.3 三大避坑速查

| 坑 | 后果 | 解决 |
|----|------|------|
| 大切片放回池子 | 内存泄漏 | `Put` 前检查 `cap`，超阈值丢弃 |
| 不重置就使用 | 脏数据串扰 | `Get` 后 / `Put` 前强制重置 |
| 当连接池用 | 连接被 GC 销毁 | 连接池用专用库 |

### 9.4 核心源码文件

| 文件 | 内容 |
|------|------|
| `src/sync/pool.go` | Pool 结构体、Get/Put 核心逻辑、poolCleanup |
| `src/sync/poolqueue.go` | poolChain、poolDequeue（无锁双端队列） |
| `src/runtime/mgc.go` | GC 主流程，触发 poolCleanup |
| `src/runtime/proc.go` | procPin/procUnpin（绑定/解绑 P） |

### 9.5 进一步阅读

- [Go 官方 sync.Pool 文档](https://pkg.go.dev/sync#Pool)
- [Go 1.13 sync.Pool 设计文档](https://github.com/golang/go/issues/22950)
- [Go GMP 调度算法](/posts/go/go-gmp-调度算法/) — 理解 Per-P 模型的前提
- [Go GC 三色标记法与混合写屏障](/posts/go/go-gc-三色标记法与混合写屏障/) — 理解 Victim Cache 的 GC 交互
- [GC调优](/posts/go/go-gc-调优实践/) — GC 调优实践

---

*本文档基于 Go 1.21+ 源码编写。sync.Pool 在 Go 1.13（2019 年 9 月）经历史诗级重构，引入 Per-P 本地池和 Victim Cache 机制，彻底解决了 GC 清空导致的性能毛刺问题。*
