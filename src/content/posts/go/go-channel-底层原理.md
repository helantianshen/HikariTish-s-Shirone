---
title: Go Channel 底层原理
published: 2026-05-22
description: 从 CSP 模型出发，解析无缓冲、有缓冲和 nil Channel 的结构、阻塞行为与调度协作机制。
tags:
  - go
  - 并发
  - 底层原理
category: Go
pinned: false
draft: false
comment: true
lang: zh_CN
---

> Go 并发编程的核心通信原语：基于 **CSP 模型**实现"通过通信共享内存"。底层由 **hchan** 结构体支撑，结合**环形缓冲区**、**等待队列**和**互斥锁**完成 goroutine 之间的同步与数据传递。

---

## 目录

1. [前置背景：CSP 模型](#1-前置背景csp-模型)
2. [Channel 的三种形态](#2-channel-的三种形态)
3. [数据结构源码剖析](#3-数据结构源码剖析)
4. [发送操作流程](#4-发送操作流程)
5. [接收操作流程](#5-接收操作流程)
6. [关闭操作与 panic 场景](#6-关闭操作与-panic-场景)
7. [select 语句的底层实现](#7-select-语句的底层实现)
8. [nil Channel 的特殊行为](#8-nil-channel-的特殊行为)
9. [常见使用模式](#9-常见使用模式)
10. [Channel vs Mutex 选型](#10-channel-vs-mutex-选型)
11. [内存模型保证](#11-内存模型保证)
12. [常见陷阱与最佳实践](#12-常见陷阱与最佳实践)
13. [常见面试问答](#13-常见面试问答)
14. [总结](#14-总结)

---

## 1. 前置背景：CSP 模型

### 1.1 CSP 简介

**CSP**（Communicating Sequential Processes，通信顺序进程）由 Tony Hoare 在 1978 年提出，核心思想是：

> **Don't communicate by sharing memory; share memory by communicating.**
> 不要通过共享内存来通信，而要通过通信来共享内存。

| 共享内存模型 | CSP 模型 |
|--------------|----------|
| 多个线程访问同一块内存 | 多个 goroutine 通过 channel 传递数据 |
| 需要锁保护临界区 | 通过通信传递所有权 |
| 容易出现竞态、死锁 | 数据流向明确，更易推理 |
| 代表：Java、C++ 多线程 | 代表：Go、Erlang |

### 1.2 Go 的实践

Go 在语言层面支持 CSP 但**并不强制**——同时也提供了 `sync.Mutex`、`atomic` 等共享内存原语。两者各有其适用场景，详见[第 10 节](#10-channel-vs-mutex-选型)。

```go
// CSP 风格：通过 channel 传递任务
tasks := make(chan Task, 10)
go worker(tasks)
tasks <- Task{...}

// 共享内存风格：通过 Mutex 保护状态
var (
    mu    sync.Mutex
    state map[string]int
)
```

---

## 2. Channel 的三种形态

| 类型 | 创建方式 | 行为特点 |
|------|----------|----------|
| **无缓冲 Channel** | `make(chan T)` | 同步通信，发送和接收必须同时就绪 |
| **有缓冲 Channel** | `make(chan T, n)` | 异步通信，缓冲区未满时发送不阻塞 |
| **nil Channel** | `var ch chan T` | 读写永久阻塞，关闭会 panic |

### 2.1 无缓冲 Channel

```go
ch := make(chan int)        // dataqsiz = 0
go func() { ch <- 1 }()    // 发送方阻塞，直到接收方到来
v := <-ch                   // 接收方到达，完成"会合"
```

**同步语义**：发送方和接收方必须**同时就绪**，类似一次"握手"，是天然的同步点。

### 2.2 有缓冲 Channel

```go
ch := make(chan int, 3)    // dataqsiz = 3
ch <- 1                     // 直接入队，不阻塞
ch <- 2
ch <- 3
ch <- 4                     // 缓冲区满，阻塞
```

**异步语义**：允许一定程度的**解耦**，生产者和消费者无需严格同步。

### 2.3 nil Channel

```go
var ch chan int             // ch == nil
ch <- 1                     // 永久阻塞
<-ch                        // 永久阻塞
close(ch)                   // panic: close of nil channel
```

nil channel 看似无用，但在 `select` 中可以作为"动态屏蔽"某个 case 的技巧（见[第 8 节](#8-nil-channel-的特殊行为)）。

---

## 3. 数据结构源码剖析

> 以下源码来自 Go 官方运行时 `src/runtime/chan.go`。

### 3.1 hchan 结构体

```go
// src/runtime/chan.go

type hchan struct {
    qcount   uint           // 当前缓冲区元素数量
    dataqsiz uint           // 缓冲区总容量
    buf      unsafe.Pointer // 指向环形缓冲区的指针
    elemsize uint16         // 元素大小（字节）
    closed   uint32         // 关闭标志：0 未关闭，1 已关闭
    elemtype *_type         // 元素类型信息
    sendx    uint           // 发送索引（环形缓冲区写入位置）
    recvx    uint           // 接收索引（环形缓冲区读取位置）
    recvq    waitq          // 接收方等待队列（被阻塞的接收 goroutine）
    sendq    waitq          // 发送方等待队列（被阻塞的发送 goroutine）

    lock mutex              // 互斥锁，保护以上所有字段
}
```

**字段语义**：

| 字段                    | 作用                                                |
| --------------------- | ------------------------------------------------- |
| `qcount` / `dataqsiz` | 配合判断缓冲区是否满（`qcount == dataqsiz`）或空（`qcount == 0`） |
| `buf`                 | 指向一段连续内存，作为**环形缓冲区**                              |
| `sendx` / `recvx`     | 索引指针，写入后递增，到达 `dataqsiz` 时回绕到 0                   |
| `recvq` / `sendq`     | 双向链表，挂载因缓冲区空/满而阻塞的 goroutine                      |
| `lock`                | 保证所有操作的并发安全                                       |

### 3.2 等待队列 waitq 与 sudog

```go
// src/runtime/chan.go

type waitq struct {
    first *sudog
    last  *sudog
}
```

```go
// src/runtime/runtime2.go

type sudog struct {
    g *g                    // 等待的 goroutine

    next *sudog             // 链表指针
    prev *sudog
    elem unsafe.Pointer     // 数据元素（指向发送/接收的值）

    acquiretime int64
    releasetime int64
    ticket      uint32

    isSelect bool           // 是否在 select 语句中
    success  bool           // 通信是否成功（false 表示 channel 已关闭）

    parent   *sudog         // semaRoot 二叉树用
    waitlink *sudog         // g.waiting 链表
    waittail *sudog
    c        *hchan         // 所属的 channel
}
```

**sudog 是 goroutine 的"等待替身"**：当 G 因 channel 阻塞时，会被包装成一个 sudog 挂入 `recvq` 或 `sendq`，G 自身则进入 `_Gwaiting` 状态让出 CPU。

### 3.3 内存布局示意

```
hchan
┌─────────────────────────────────────────┐
│ qcount=2, dataqsiz=4                    │
│ buf ──────────┐                         │
│ sendx=3       │                         │
│ recvx=1       │                         │
│ closed=0      │                         │
│ recvq ──┐     │                         │
│ sendq   │     │                         │
└─────────┼─────┼─────────────────────────┘
          │     │
          │     ↓
          │  环形缓冲区 buf[4]
          │  ┌────┬────┬────┬────┐
          │  │    │ V₁ │ V₂ │    │
          │  └────┴────┴────┴────┘
          │   [0]  [1]  [2]  [3]
          │        ↑          ↑
          │       recvx     sendx
          ↓
     接收方等待队列 recvq
     ┌─────┐  ┌─────┐
     │sudog│→│sudog│→nil
     │  G₁ │  │  G₂ │
     └─────┘  └─────┘
```

### 3.4 makechan — 创建 Channel

```go
// src/runtime/chan.go

func makechan(t *chantype, size int) *hchan {
    elem := t.elem

    // 检查元素大小、对齐等
    if elem.size >= 1<<16 {
        throw("makechan: invalid channel element type")
    }

    mem, overflow := math.MulUintptr(elem.size, uintptr(size))
    if overflow || mem > maxAlloc-hchanSize || size < 0 {
        panic(plainError("makechan: size out of range"))
    }

    var c *hchan
    switch {
    case mem == 0:
        // 无缓冲 channel 或元素为零大小
        c = (*hchan)(mallocgc(hchanSize, nil, true))
        c.buf = c.raceaddr()
    case elem.ptrdata == 0:
        // 元素不含指针，hchan 与 buf 一次性分配
        c = (*hchan)(mallocgc(hchanSize+mem, nil, true))
        c.buf = add(unsafe.Pointer(c), hchanSize)
    default:
        // 元素含指针，单独分配 buf 以便 GC 扫描
        c = new(hchan)
        c.buf = mallocgc(mem, elem, true)
    }

    c.elemsize = uint16(elem.size)
    c.elemtype = elem
    c.dataqsiz = uint(size)
    return c
}
```

**关键点**：
- 无缓冲 channel 只分配 `hchan` 头部
- 元素不含指针时，`hchan` 和 `buf` 合并成一次内存分配，提升缓存局部性
- 元素含指针时，`buf` 单独分配，便于 GC 精确扫描

---

## 4. 发送操作流程

> 编译器将 `ch <- v` 转换为 `chansend1(ch, &v)`，最终调用 `chansend`。

### 4.1 chansend 核心逻辑

```go
// src/runtime/chan.go（简化版）

func chansend(c *hchan, ep unsafe.Pointer, block bool, callerpc uintptr) bool {
    // ① nil channel：阻塞模式下永久挂起
    if c == nil {
        if !block {
            return false
        }
        gopark(nil, nil, waitReasonChanSendNilChan, traceEvGoStop, 2)
        throw("unreachable")
    }

    lock(&c.lock)

    // ② 已关闭：触发 panic
    if c.closed != 0 {
        unlock(&c.lock)
        panic(plainError("send on closed channel"))
    }

    // ③ 有等待的接收方：直接交接数据，跳过缓冲区
    if sg := c.recvq.dequeue(); sg != nil {
        send(c, sg, ep, func() { unlock(&c.lock) }, 3)
        return true
    }

    // ④ 缓冲区未满：写入缓冲区
    if c.qcount < c.dataqsiz {
        qp := chanbuf(c, c.sendx)
        typedmemmove(c.elemtype, qp, ep)
        c.sendx++
        if c.sendx == c.dataqsiz {
            c.sendx = 0          // 环形回绕
        }
        c.qcount++
        unlock(&c.lock)
        return true
    }

    // ⑤ 缓冲区满：阻塞当前 goroutine
    gp := getg()
    mysg := acquireSudog()
    mysg.elem = ep
    mysg.g = gp
    mysg.c = c
    c.sendq.enqueue(mysg)
    gopark(chanparkcommit, unsafe.Pointer(&c.lock),
        waitReasonChanSend, traceEvGoBlockSend, 2)

    // 被唤醒后的清理工作
    if mysg.success {
        releaseSudog(mysg)
        return true
    }
    // success == false 说明被唤醒时 channel 已关闭
    panic(plainError("send on closed channel"))
}
```

### 4.2 send — 直接交接的优化

```go
// src/runtime/chan.go

// send 把数据从 ep 直接拷贝到等待中的接收方 sg，
// 避免先入队再出队的两次拷贝
func send(c *hchan, sg *sudog, ep unsafe.Pointer, unlockf func(), skip int) {
    if sg.elem != nil {
        sendDirect(c.elemtype, sg, ep)   // 直接拷贝到接收方栈上
        sg.elem = nil
    }
    gp := sg.g
    unlockf()
    gp.param = unsafe.Pointer(sg)
    sg.success = true
    goready(gp, skip+1)                  // 唤醒接收方
}
```

**这是 Go channel 的一个重要优化**：当存在等待的接收方时，发送方**直接将数据拷贝到接收方的栈空间**，跳过缓冲区，节省一次内存拷贝。

### 4.3 发送决策流程图

```
chansend(ch, v)
    │
    ├── ch == nil ? ──→ 永久 park（或非阻塞返回 false）
    │
    ├── 加锁 c.lock
    │
    ├── ch.closed ? ──→ panic("send on closed channel")
    │
    ├── recvq 非空? ──→ send() 直接交接 → 唤醒接收方 → 返回
    │
    ├── 缓冲区未满? ──→ 写入 buf[sendx]，sendx++，qcount++ → 返回
    │
    └── 缓冲区已满
          │
          ├── 包装为 sudog，挂入 sendq
          ├── gopark()，G → _Gwaiting
          │
          └── (被唤醒后)
                ├── success → 数据已被接收方取走 → 返回
                └── !success → channel 被关闭 → panic
```

---

## 5. 接收操作流程

> 编译器将 `v := <-ch` 转换为 `chanrecv1`；`v, ok := <-ch` 转换为 `chanrecv2`，两者最终都调用 `chanrecv`。

### 5.1 chanrecv 核心逻辑

```go
// src/runtime/chan.go（简化版）

func chanrecv(c *hchan, ep unsafe.Pointer, block bool) (selected, received bool) {
    // ① nil channel：阻塞模式下永久挂起
    if c == nil {
        if !block {
            return
        }
        gopark(nil, nil, waitReasonChanReceiveNilChan, traceEvGoStop, 2)
        throw("unreachable")
    }

    lock(&c.lock)

    // ② channel 已关闭且缓冲区为空：返回零值 + ok=false
    if c.closed != 0 && c.qcount == 0 {
        unlock(&c.lock)
        if ep != nil {
            typedmemclr(c.elemtype, ep)   // 写入零值
        }
        return true, false
    }

    // ③ 有等待的发送方
    if sg := c.sendq.dequeue(); sg != nil {
        recv(c, sg, ep, func() { unlock(&c.lock) }, 3)
        return true, true
    }

    // ④ 缓冲区有数据：从 buf[recvx] 读取
    if c.qcount > 0 {
        qp := chanbuf(c, c.recvx)
        if ep != nil {
            typedmemmove(c.elemtype, ep, qp)
        }
        typedmemclr(c.elemtype, qp)
        c.recvx++
        if c.recvx == c.dataqsiz {
            c.recvx = 0          // 环形回绕
        }
        c.qcount--
        unlock(&c.lock)
        return true, true
    }

    // ⑤ 缓冲区空且无发送方：阻塞当前 goroutine
    gp := getg()
    mysg := acquireSudog()
    mysg.elem = ep
    mysg.g = gp
    mysg.c = c
    c.recvq.enqueue(mysg)
    gopark(chanparkcommit, unsafe.Pointer(&c.lock),
        waitReasonChanReceive, traceEvGoBlockRecv, 2)

    // 被唤醒后
    success := mysg.success
    releaseSudog(mysg)
    return true, success
}
```

### 5.2 recv — 处理等待中的发送方

```go
// src/runtime/chan.go

func recv(c *hchan, sg *sudog, ep unsafe.Pointer, unlockf func(), skip int) {
    if c.dataqsiz == 0 {
        // 无缓冲：发送方数据直接拷贝到接收方
        if ep != nil {
            recvDirect(c.elemtype, sg, ep)
        }
    } else {
        // 有缓冲：缓冲区已满，但发送方在等待
        // 取出缓冲区头部的数据给接收方，并把发送方的数据填入缓冲区尾部
        qp := chanbuf(c, c.recvx)
        if ep != nil {
            typedmemmove(c.elemtype, ep, qp)
        }
        typedmemmove(c.elemtype, qp, sg.elem)
        c.recvx++
        if c.recvx == c.dataqsiz {
            c.recvx = 0
        }
        c.sendx = c.recvx          // sendx == recvx 因为缓冲区仍然满
    }
    sg.elem = nil
    gp := sg.g
    unlockf()
    gp.param = unsafe.Pointer(sg)
    sg.success = true
    goready(gp, skip+1)
}
```

### 5.3 接收决策流程图

```
chanrecv(ch)
    │
    ├── ch == nil ? ──→ 永久 park（或非阻塞返回）
    │
    ├── 加锁 c.lock
    │
    ├── ch.closed && qcount == 0 ? ──→ 返回 (零值, false)
    │
    ├── sendq 非空?
    │     ├── 无缓冲：直接从发送方拷贝
    │     └── 有缓冲：取缓冲区头，把发送方数据填入尾部
    │     → 唤醒发送方 → 返回 (值, true)
    │
    ├── 缓冲区有数据? ──→ 从 buf[recvx] 读取，recvx++，qcount-- → 返回
    │
    └── 缓冲区空且无发送方
          │
          ├── 包装为 sudog，挂入 recvq
          ├── gopark()，G → _Gwaiting
          │
          └── (被唤醒后)
                ├── success → 收到发送方数据 → 返回 (值, true)
                └── !success → channel 被关闭 → 返回 (零值, false)
```

---

## 6. 关闭操作与 panic 场景

### 6.1 closechan 源码

```go
// src/runtime/chan.go

func closechan(c *hchan) {
    // ① 关闭 nil channel：panic
    if c == nil {
        panic(plainError("close of nil channel"))
    }

    lock(&c.lock)

    // ② 重复关闭：panic
    if c.closed != 0 {
        unlock(&c.lock)
        panic(plainError("close of closed channel"))
    }

    c.closed = 1                 // 设置关闭标志

    var glist gList

    // ③ 释放所有等待的接收方（success=false，会收到零值）
    for {
        sg := c.recvq.dequeue()
        if sg == nil {
            break
        }
        if sg.elem != nil {
            typedmemclr(c.elemtype, sg.elem)   // 写入零值
            sg.elem = nil
        }
        gp := sg.g
        gp.param = unsafe.Pointer(sg)
        sg.success = false                      // 标记为非正常通信
        glist.push(gp)
    }

    // ④ 释放所有等待的发送方（它们将在被唤醒后 panic）
    for {
        sg := c.sendq.dequeue()
        if sg == nil {
            break
        }
        sg.elem = nil
        gp := sg.g
        gp.param = unsafe.Pointer(sg)
        sg.success = false
        glist.push(gp)
    }
    unlock(&c.lock)

    // ⑤ 批量唤醒
    for !glist.empty() {
        gp := glist.pop()
        gp.schedlink = 0
        goready(gp, 3)
    }
}
```

### 6.2 三种 panic 场景

| 场景 | 代码 | 触发位置 |
|------|------|----------|
| **向已关闭的 channel 发送** | `ch <- v` 当 `ch.closed == 1` | `chansend` 中检测 |
| **重复关闭 channel** | `close(ch)` 两次 | `closechan` 中检测 |
| **关闭 nil channel** | `close(nilCh)` | `closechan` 入口检测 |

### 6.3 从已关闭的 channel 接收

**不会 panic**，行为如下：

```go
ch := make(chan int, 2)
ch <- 1
ch <- 2
close(ch)

v1, ok1 := <-ch    // v1=1, ok1=true（缓冲区还有数据）
v2, ok2 := <-ch    // v2=2, ok2=true
v3, ok3 := <-ch    // v3=0, ok3=false（已关闭且缓冲区为空，返回零值）
```

**最佳实践**：用 `v, ok := <-ch` 形式，通过 `ok` 判断是否仍有有效数据。

### 6.4 关闭原则

> **不要从接收端关闭，也不要在多个发送方的情况下关闭同一个 channel。**

| 场景 | 关闭责任 |
|------|----------|
| 1 发送方 + 1 接收方 | 发送方关闭 |
| 1 发送方 + N 接收方 | 发送方关闭 |
| N 发送方 + 1 接收方 | **不直接关闭**，由接收方通过 `done` channel 通知所有发送方退出 |
| N 发送方 + M 接收方 | 引入"协调者"或使用 `sync.Once` 配合 done channel |

---

## 7. select 语句的底层实现

### 7.1 select 的语义

```go
select {
case v := <-ch1:
    // 从 ch1 接收
case ch2 <- x:
    // 向 ch2 发送
case <-time.After(time.Second):
    // 超时
default:
    // 所有 case 都未就绪
}
```

**核心特性**：
- 多路复用：同时监听多个 channel 操作
- **随机选择**：多个 case 同时就绪时，**随机**选一个执行（避免饥饿）
- 有 `default` 时变为非阻塞操作

### 7.2 编译器转换

select 在编译期被转换为对 `runtime.selectgo` 的调用：

```go
// src/runtime/select.go

func selectgo(cas0 *scase, order0 *uint16, pc0 *uintptr, nsends, nrecvs int, block bool) (int, bool) {
    // ① 生成两个随机顺序：
    //    pollorder：决定 case 的检查顺序（随机化避免饥饿）
    //    lockorder：按 channel 地址排序，统一加锁顺序避免死锁
    pollorder := order0[:ncases:ncases]
    lockorder := order0[ncases:][:ncases:ncases]

    norder := 0
    for i := range cases {
        // Fisher-Yates 洗牌
        j := fastrandn(uint32(norder + 1))
        pollorder[norder] = pollorder[j]
        pollorder[j] = uint16(i)
        norder++
    }

    // 按 channel 地址排序 lockorder
    for i := 1; i < ncases; i++ {
        // ... 堆排序
    }

    // ② 按 lockorder 加锁所有 channel
    sellock(scases, lockorder)

    // ③ 按 pollorder 遍历 case，看是否有立即可执行的
    var casi int
    var cas *scase
    for _, casei := range pollorder {
        casi = int(casei)
        cas = &scases[casi]
        c := cas.c

        if casi >= nsends {
            // 接收 case
            if sg := c.sendq.dequeue(); sg != nil {
                goto recv
            }
            if c.qcount > 0 {
                goto bufrecv
            }
            if c.closed != 0 {
                goto rclose
            }
        } else {
            // 发送 case
            if c.closed != 0 {
                goto sclose
            }
            if sg := c.recvq.dequeue(); sg != nil {
                goto send
            }
            if c.qcount < c.dataqsiz {
                goto bufsend
            }
        }
    }

    if !block {
        // 有 default：直接返回
        selunlock(scases, lockorder)
        casi = -1
        goto retc
    }

    // ④ 没有就绪的 case：把当前 G 挂到所有 channel 的等待队列
    gp = getg()
    nextp = &gp.waiting
    for _, casei := range lockorder {
        // ... 入队
    }

    gp.param = nil
    gopark(selparkcommit, nil, waitReasonSelect, traceEvGoBlockSelect, 1)

    // ⑤ 被某个 channel 唤醒，从其他 channel 的等待队列中清除自己
    // ... 清理工作
}
```

### 7.3 select 的关键机制

| 机制 | 作用 |
|------|------|
| **pollorder** | 通过 Fisher-Yates 洗牌生成随机顺序，保证多个 case 就绪时**公平选择** |
| **lockorder** | 按 channel 地址排序加锁，**避免不同 select 之间的死锁** |
| **挂入多个 sendq/recvq** | 阻塞时 G 同时挂在多个 channel 的等待队列上，任一 channel 就绪即可被唤醒 |
| **唤醒后清理** | 被唤醒的 case 执行后，需要从其他 channel 的等待队列中移除自己 |

---

## 8. nil Channel 的特殊行为

### 8.1 行为表

| 操作 | nil channel | 已关闭 channel |
|------|-------------|----------------|
| 发送 `ch <- v` | **永久阻塞** | **panic** |
| 接收 `<-ch` | **永久阻塞** | 返回零值 + ok=false |
| 关闭 `close(ch)` | **panic** | **panic** |
| `len(ch)` / `cap(ch)` | 返回 0 | 正常返回 |

### 8.2 nil channel 在 select 中的妙用

> 在 `select` 中，**nil channel 对应的 case 永远不会被选中**（因为永久阻塞）。

```go
// 动态启用/禁用某个 case
func process(in <-chan int, done <-chan struct{}) {
    for {
        select {
        case v, ok := <-in:
            if !ok {
                in = nil           // 关闭后将其置 nil，禁用该 case
                continue
            }
            handle(v)
        case <-done:
            return
        }
    }
}
```

当 `in` 被关闭后，将其置为 `nil`，下次循环时该 case 不会再被选中，避免不断收到零值。

---

## 9. 常见使用模式

### 9.1 Pipeline（流水线）

```go
func gen(nums ...int) <-chan int {
    out := make(chan int)
    go func() {
        defer close(out)
        for _, n := range nums {
            out <- n
        }
    }()
    return out
}

func sq(in <-chan int) <-chan int {
    out := make(chan int)
    go func() {
        defer close(out)
        for n := range in {
            out <- n * n
        }
    }()
    return out
}

// 使用：gen → sq → main
for v := range sq(gen(1, 2, 3, 4)) {
    fmt.Println(v)   // 1, 4, 9, 16
}
```

### 9.2 Fan-out / Fan-in

```go
// Fan-out：一个 channel 喂多个 worker
func fanOut(in <-chan int, n int) []<-chan int {
    outs := make([]<-chan int, n)
    for i := 0; i < n; i++ {
        outs[i] = sq(in)   // 多个 worker 共享同一个输入
    }
    return outs
}

// Fan-in：多个 channel 合并到一个
func fanIn(chans ...<-chan int) <-chan int {
    out := make(chan int)
    var wg sync.WaitGroup
    for _, c := range chans {
        wg.Add(1)
        go func(c <-chan int) {
            defer wg.Done()
            for v := range c {
                out <- v
            }
        }(c)
    }
    go func() {
        wg.Wait()
        close(out)
    }()
    return out
}
```

### 9.3 Done Channel（取消通知）

```go
func worker(done <-chan struct{}) {
    for {
        select {
        case <-done:
            return            // 收到取消信号，退出
        default:
            // 正常工作
        }
    }
}

done := make(chan struct{})
go worker(done)
// ...
close(done)                   // 广播取消（所有接收方都会收到零值）
```

**关键点**：`close(done)` 比 `done <- struct{}{}` 更优——关闭操作会唤醒**所有**等待的接收方，是一种天然的**广播**机制。

### 9.4 Timeout（超时控制）

```go
select {
case res := <-ch:
    handle(res)
case <-time.After(2 * time.Second):
    fmt.Println("timeout")
}
```

更推荐使用 `context.WithTimeout`，因为它能向下游传播取消信号：

```go
ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
defer cancel()

select {
case res := <-ch:
    handle(res)
case <-ctx.Done():
    fmt.Println(ctx.Err())
}
```

### 9.5 Channel 作为信号量

```go
// 用容量为 N 的 channel 限制并发数
sem := make(chan struct{}, 3)   // 最多 3 个并发

for _, task := range tasks {
    sem <- struct{}{}            // 获取"许可"
    go func(t Task) {
        defer func() { <-sem }() // 释放"许可"
        process(t)
    }(task)
}
```

---

## 10. Channel vs Mutex 选型

### 10.1 适用场景对比

| 场景 | 推荐方案 | 原因 |
|------|----------|------|
| **传递数据所有权** | Channel | 符合 CSP 思想，数据流向清晰 |
| **任务分发 / 流水线** | Channel | 天然的解耦与缓冲 |
| **协调多个 goroutine** | Channel | select 多路复用、广播取消 |
| **保护共享状态** | Mutex | 直接，无需通过通信"绕一圈" |
| **简单的计数器** | atomic | 无锁，性能最高 |
| **读多写少** | RWMutex | 读并发，写互斥 |
| **一次性初始化** | sync.Once | 语义清晰 |

### 10.2 简单判断原则

> **传递数据用 Channel，保护状态用 Mutex。**

如果你发现自己在 channel 里传一个指针，让接收方去修改"共享对象"——那其实你想要的是 Mutex。

### 10.3 性能考量

```
原子操作 < Mutex < Channel
（开销从低到高）
```

- **atomic**：单条 CPU 指令级别
- **Mutex**：无竞争时几乎为零，有竞争时涉及 futex 系统调用
- **Channel**：每次操作都要加锁、可能唤醒 goroutine，开销最大

但 channel 提供了**更高的抽象层次**——别为了性能在不该用锁的地方用锁。

---

## 11. 内存模型保证

> Go Memory Model 对 channel 操作给出了明确的 happens-before 关系。

### 11.1 关键规则

| 规则 | 说明 |
|------|------|
| **发送 happens-before 接收完成** | `ch <- v` 之前的写操作，对接收到 `v` 之后的代码可见 |
| **关闭 happens-before 接收到零值** | `close(ch)` 之前的写操作，对接收到关闭信号之后的代码可见 |
| **无缓冲 channel 的接收 happens-before 发送返回** | 接收方先就绪时，接收完成后发送方才返回 |
| **缓冲区第 k 次接收 happens-before 第 (k+C) 次发送** | C 为缓冲区容量；用于推理有缓冲 channel 的同步关系 |

### 11.2 经典例子

```go
var data int
done := make(chan struct{})

go func() {
    data = 42                    // ① 写入数据
    close(done)                  // ② 关闭 channel
}()

<-done                           // ③ 接收到零值
fmt.Println(data)                // ④ 一定能读到 42（① happens-before ④）
```

如果把 `done` 换成普通的 `bool` 变量，**没有同步保证**，`data` 的写入可能被重排或不可见。

---

## 12. 常见陷阱与最佳实践

### 12.1 常见陷阱

| 陷阱 | 后果 | 解决 |
|------|------|------|
| 向已关闭的 channel 发送 | panic | 由发送方关闭；多发送方场景用 done channel |
| 重复关闭 channel | panic | `sync.Once` 包装 close |
| 关闭 nil channel | panic | 关闭前检查 |
| 忘记关闭导致 goroutine 泄漏 | 内存泄漏 | `defer close(ch)`、引入 done channel |
| 无缓冲 channel 死锁 | 永久阻塞 | 确保发送/接收方都启动 |
| select 所有 case 都阻塞且无 default | 永久阻塞 | 配合 timeout 或 done channel |
| range 已关闭 channel 取剩余值 | 易混淆 | 牢记：range 会取完缓冲区再退出 |

### 12.2 最佳实践

```go
// ✓ 总是由发送方关闭
func producer(out chan<- int) {
    defer close(out)             // 确保关闭
    for i := 0; i < 10; i++ {
        out <- i
    }
}

// ✓ 用方向限定参数类型，让编译器帮你检查
func consumer(in <-chan int) {   // 只读
    for v := range in {
        fmt.Println(v)
    }
}

// ✓ 用 sync.Once 防止重复关闭
type SafeChan struct {
    ch   chan int
    once sync.Once
}

func (s *SafeChan) Close() {
    s.once.Do(func() { close(s.ch) })
}

// ✓ 使用 context 而非裸 done channel
func worker(ctx context.Context) {
    for {
        select {
        case <-ctx.Done():
            return
        case <-time.After(time.Second):
            doWork()
        }
    }
}
```

### 12.3 Goroutine 泄漏检测

```go
// 使用 runtime.NumGoroutine() 在测试前后对比
before := runtime.NumGoroutine()
runMyCode()
runtime.GC()
time.Sleep(100 * time.Millisecond)
after := runtime.NumGoroutine()
if after > before {
    t.Errorf("goroutine leak: %d -> %d", before, after)
}
```

也可使用 [`go.uber.org/goleak`](https://github.com/uber-go/goleak) 在测试中自动检测。

---

## 13. 常见面试问答

### Q1：无缓冲 Channel 和有缓冲 Channel 在调度行为上有什么区别？

**A1**：

- **无缓冲 channel**：发送方必须等到接收方到来才能完成发送。底层流程是：发送方将数据**直接拷贝**到接收方栈上，然后唤醒接收方。两者构成一次同步"会合点"。
- **有缓冲 channel**：缓冲区未满时，发送方直接写入 `buf[sendx]` 并立即返回，不阻塞；只有缓冲区满时才会挂入 `sendq`。

**本质区别**在于**同步点**：无缓冲强制发送/接收同时就绪，有缓冲允许一定的**异步解耦**。

### Q2：从已关闭的 Channel 接收数据会 panic 吗？

**A2**：**不会**，这是 Go 的设计决策。

- 如果缓冲区还有数据，正常返回剩余数据
- 缓冲区为空时，返回该类型的**零值** + `ok=false`

```go
v, ok := <-ch
if !ok {
    // channel 已关闭且缓冲区为空
}
```

**为什么这样设计**：让"广播取消"模式（`close(done)`）成为可能——所有接收方都能收到信号。

### Q3：Channel 和 Mutex 分别适合什么场景？

**A3**：

- **Channel** 适合 goroutine 之间**传递数据和所有权**，如任务分发、结果收集、流水线处理，符合 CSP "通信共享内存"思想
- **Mutex** 适合**保护共享状态**，如多个 goroutine 并发读写同一个 map 或计数器，直接加锁比通过 channel 绕一圈更简洁高效

**判断原则**：传递数据用 Channel，保护状态用 Mutex。

### Q4：select 是如何避免死锁的？

**A4**：select 在底层会做两件事：

1. **lockorder**：把所有涉及的 channel **按地址排序**后依次加锁。两个 select 操作同样的 channel 时，加锁顺序一致，**避免了 ABBA 类型的死锁**。
2. **pollorder**：检查 case 的顺序是**随机**的（Fisher-Yates 洗牌），避免某个 case 总被优先选中导致饥饿。

### Q5：Channel 的发送/接收为什么不需要二次入队？

**A5**：这是 Go 的一个性能优化。

当发送方到来且 `recvq` 中有等待的接收方时，发送方**直接将数据拷贝到接收方栈空间**（`sendDirect`），跳过缓冲区，省去一次"入队再出队"的拷贝。接收方同理。

### Q6：为什么 hchan 内部要加锁？看起来不像无锁数据结构。

**A6**：channel 的设计**没有追求无锁**，而是用**细粒度的互斥锁**保护整个 hchan。

原因：
- channel 的语义复杂（缓冲区 + 等待队列 + 关闭状态），无锁实现会非常复杂
- channel 通常用于**协调而非高频读写**，锁的开销在合理范围内
- Go 调度器配合 channel：锁竞争时 G 直接 park，不会自旋浪费 CPU

如果需要高并发的无锁场景，应该用 `sync/atomic` 或专用的无锁数据结构。

---

## 14. 总结

### 14.1 Channel 核心模型

```
┌─────────────────────────────────────────────────────────────┐
│                      Channel 总览                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│              ┌──────────── hchan ────────────┐              │
│              │ qcount, dataqsiz              │              │
│              │ sendx, recvx, closed          │              │
│              │ lock                          │              │
│              └─────┬───────┬───────┬─────────┘              │
│                    │       │       │                        │
│         ┌──────────┘       │       └──────────┐             │
│         ↓                  ↓                  ↓             │
│    环形缓冲区          sendq (waitq)      recvq (waitq)     │
│    ┌─┬─┬─┬─┐         ┌──────┐            ┌──────┐           │
│    │V│V│ │ │         │sudog │→...        │sudog │→...       │
│    └─┴─┴─┴─┘         │  G   │            │  G   │           │
│     ↑   ↑            └──────┘            └──────┘           │
│   recvx sendx        阻塞的发送方         阻塞的接收方        │
│                                                             │
│   send 优化：sendq 中有接收方时，直接拷贝到接收方栈           │
│   close 广播：唤醒所有 recvq 和 sendq 中的 goroutine          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 14.2 关键设计原则

| 原则 | 说明 |
|------|------|
| **CSP 哲学** | 通过通信共享内存，而非通过共享内存通信 |
| **同步原语** | hchan 用互斥锁保护全部状态，简洁可靠 |
| **直接交接** | 有等待方时跳过缓冲区，节省一次拷贝 |
| **环形缓冲区** | 固定大小，无动态扩容，避免内存抖动 |
| **关闭即广播** | close 一次性唤醒所有等待方，天然支持取消传播 |
| **select 公平性** | 随机选 case 避免饥饿，地址排序加锁避免死锁 |
| **内存模型保证** | 发送 happens-before 接收，提供明确的同步语义 |

### 14.3 三类 panic 速查

| 操作 | 触发条件 |
|------|----------|
| `ch <- v` | `ch.closed == 1` |
| `close(ch)` | `ch.closed == 1`（重复关闭） |
| `close(ch)` | `ch == nil` |

### 14.4 核心源码文件

| 文件 | 内容 |
|------|------|
| `src/runtime/chan.go` | hchan 结构、发送/接收/关闭核心逻辑 |
| `src/runtime/select.go` | select 语句的 selectgo 实现 |
| `src/runtime/runtime2.go` | sudog、waitq 等关联结构定义 |
| `src/runtime/proc.go` | gopark / goready 调度协作 |

### 14.5 进一步阅读

- [Go Memory Model](https://go.dev/ref/mem)
- [Effective Go - Channels](https://go.dev/doc/effective_go#channels)
- [Go GMP 调度算法](/posts/go/go-gmp-调度算法/)
- Go 并发编程
- Go 内存模型

---

*本文档基于 Go 1.21+ 源码编写，源码片段取自 `src/runtime/chan.go` 和 `src/runtime/select.go`。*
