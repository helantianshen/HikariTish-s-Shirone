---
title: Linux mmap 与 Go 内存映射优化
published: 2026-05-16
description: 关于「Linux mmap 与 Go 内存映射优化」的技术笔记。
tags:
  - linux
  - go
  - 内存管理
category: Linux
pinned: false
draft: false
comment: true
lang: zh_CN
---

> `mmap`（memory map）是 Linux 提供的文件映射到虚拟内存的机制，让程序**像访问内存一样访问文件**，消除传统 `read/write` 的用户态-内核态数据拷贝。Go 通过 `golang.org/x/sys/unix` 和 `golang.org/x/exp/mmap` 两个包提供 mmap 支持，广泛应用于 BoltDB、LMDB 等嵌入式存储引擎，是实现高性能随机文件访问的关键技术。

---

## 目录

1. [mmap 系统调用原理](#1-mmap-系统调用原理)
2. [Go 中使用 mmap](#2-go-中使用-mmap)
3. [典型应用场景](#3-典型应用场景)
4. [mmap 与 Go GC 的交互与风险](#4-mmap-与-go-gc-的交互与风险)
5. [mmap vs 传统 I/O vs sendfile](#5-mmap-vs-传统-io-vs-sendfile)
6. [性能优化与最佳实践](#6-性能优化与最佳实践)
7. [Go 各版本差异](#7-go-各版本差异)
8. [Linux 高性能 IO 全景](#8-linux-高性能-io-全景)

---

## 1. mmap 系统调用原理

### 1.1 传统文件读取路径

```
磁盘 → Page Cache → copy_to_user → 用户 buffer → 程序处理
```

```go
// 传统 read：两次跨态拷贝
buf := make([]byte, 4096)
file.Read(buf) // syscall → 内核 copy → 用户 buf
```

每次 `read` 涉及：

| 开销项 | 说明 |
|--------|------|
| **syscall** | `read(2)` 用户态 → 内核态切换 |
| **数据拷贝** | Page Cache → 用户 buffer（DMA 拷贝） |
| **多次调用** | 大文件需要循环 read，syscall 开销线性增长 |

### 1.2 mmap 路径

```
磁盘 → Page Cache ──→ 用户虚拟地址空间（直接映射）
                         ↓
                    data[i] 即可访问
```

核心变化：

```text
用户虚拟地址直接映射到 Page Cache 的物理页框
读取时若页未加载 → 缺页中断 → 内核自动加载 → 继续执行
```

**mmap 的零拷贝本质**：数据从磁盘到 Page Cache 只有一次 DMA 拷贝，Page Cache 直接映射进用户空间，没有 `kernel → user` 的 CPU 拷贝。

### 1.3 mmap 函数签名

```c
#include <sys/mman.h>

void *mmap(void *addr, size_t length, int prot, int flags,
           int fd, off_t offset);
```

|    参数    |             含义              |                       常用值                        |
| :------: | :-------------------------: | :----------------------------------------------: |
|  `addr`  |   建议映射地址，通常传 `NULL` 由内核决定   |                      `NULL`                      |
| `length` |          映射长度（字节）           |                       文件大小                       |
|  `prot`  |           内存保护标志            | `PROT_READ`、`PROT_WRITE`、`PROT_READ\|PROT_WRITE` |
| `flags`  |            映射类型             |      `MAP_SHARED`（写回文件）、`MAP_PRIVATE`（COW）       |
|   `fd`   |            文件描述符            |                   `file.Fd()`                    |
| `offset` |        文件偏移（必须是页对齐的）        |                    `0` 或页对齐偏移                    |
| **返回值**  | 映射区域的起始地址，失败返回 `MAP_FAILED` |                        —                         |

> **关键限制**：`offset` 必须是系统页大小（通常 4096 字节）的整数倍，`length` 不足一页时映射整页。

### 1.4 缺页中断与按需加载

mmap 建立映射时**不会立即加载数据**，而是在实际访问时触发缺页中断（page fault）：

```
1. 程序访问 data[4096]
2. CPU 触发缺页中断
3. 内核将文件对应页加载到 Page Cache
4. 建立虚拟地址到物理页框的映射
5. 程序继续执行（感知不到中断）
```

> 这意味着 mmap 天然支持**懒加载**：访问哪页才加载哪页，大文件随机访问性能极佳。

### 1.5 页面淘汰

Page Cache 中的页面由 Linux 的**页回收机制**（LRU + 双链表）管理：

```text
活跃链表 (active list) ←→ 非活跃链表 (inactive list)
                            ↓ 内存紧张时
                         页面回收 (page reclaim)
```

对于 `MAP_SHARED` 映射：
- **脏页**（被修改过的页）：写回文件后回收
- **干净页**：直接丢弃（下次访问重新从磁盘加载）

**这是 mmap 的最大不确定性**：你无法精确控制哪些页在内存中、哪些被回收了，性能完全依赖内核的页回收策略。

---

## 2. Go 中使用 mmap

### 2.1 `unix.Mmap` — 最常用的底层方式

Go 标准库没有直接提供 mmap，生产环境使用 `golang.org/x/sys/unix`：

```go
package main

import (
    "fmt"
    "os"

    "golang.org/x/sys/unix"
)

func main() {
    file, err := os.Open("test.txt")
    if err != nil {
        panic(err)
    }
    defer file.Close()

    stat, _ := file.Stat()
    size := int(stat.Size())

    // 建立只读映射
    data, err := unix.Mmap(
        int(file.Fd()),    // fd
        0,                 // offset（页对齐）
        size,              // length
        unix.PROT_READ,    // 只读
        unix.MAP_SHARED,   // 共享映射
    )
    if err != nil {
        panic(err)
    }
    // ⚠️ 必须手动 Munmap
    defer unix.Munmap(data)

    // data 是 []byte，可以像普通切片一样访问
    fmt.Println(string(data))
}
```

**Mmap 返回值说明**：

```go
func Mmap(fd int, offset int64, length int, prot int, flags int) (data []byte, err error)
```

返回的 `[]byte` 是**直接映射到 Page Cache 的虚拟内存**，不是 Go heap 内存。

### 2.2 读写映射

```go
// 可读写映射（修改会写回文件）
data, err := unix.Mmap(
    int(file.Fd()),
    0,
    size,
    unix.PROT_READ|unix.PROT_WRITE, // 可读可写
    unix.MAP_SHARED,                 // 修改写回文件
)

// 修改文件内容
data[0] = 'H'    // 直接修改，最终会写回磁盘
data[100] = '!'  // 内核负责将脏页刷盘
```

### 2.3 `golang.org/x/exp/mmap` — 更友好的高阶封装

Go 1.21 引入了实验性的 `x/exp/mmap` 包，提供更符合 Go 习惯的 API：

```go
package main

import (
    "fmt"

    "golang.org/x/exp/mmap"
)

func main() {
    // 打开只读内存映射
    reader, err := mmap.Open("large_file.bin")
    if err != nil {
        panic(err)
    }
    defer reader.Close()

    // 按偏移量读取（避免将整个文件映射到内存）
    buf := make([]byte, 4096)
    n, err := reader.ReadAt(buf, 1024*1024*100) // 从 100MB 处读取
    if err != nil {
        panic(err)
    }
    fmt.Printf("读取 %d 字节: %x\n", n, buf[:n])
}
```

**`mmap.ReaderAt` 接口**：

```go
type ReaderAt interface {
    ReadAt(p []byte, off int64) (n int, err error)
    Close() error
    Len() int64
}
```

### 2.4 两种方式的对比

| 维度 | `unix.Mmap` | `x/exp/mmap` |
|------|-------------|--------------|
| **API 风格** | 接近 C 系统调用 | Go 风格 `io.ReaderAt` |
| **内存管理** | 手动 `Munmap` | `Close()` 自动清理 |
| **返回值** | `[]byte`（直接映射） | `ReaderAt` 接口（内部分块映射） |
| **写支持** | ✅ `PROT_WRITE` + `MAP_SHARED` | ❌ 只读 |
| **大文件支持** | 一次映射整个文件（受虚拟地址空间限制） | 内部分块映射，无大小限制 |
| **Go 版本要求** | Go 1.x（`x/sys/unix`） | Go 1.21+ |
| **稳定性** | 生产可用 | 实验性（`x/exp`） |
| **适用场景** | 数据库、KV 存储 | 大文件随机读取 |

### 2.5 Fsync 与数据持久化

mmap 的修改在 Page Cache 中，需要显式刷盘：

```go
// 1. 确保修改对映射区域可见
//    （在 MAP_SHARED 下通常自动同步，但保险起见）

// 2. 刷盘：将脏页写回磁盘
unix.Msync(data, unix.MS_SYNC) // 同步等待刷盘完成

// 或异步刷盘
unix.Msync(data, unix.MS_ASYNC) // 异步，不等待

// 3. 也可以直接 fsync fd
file.Sync()
```

| 刷盘方式 | 函数 | 行为 |
|----------|------|------|
| **同步** | `unix.Msync(data, unix.MS_SYNC)` | 阻塞，直到数据写入磁盘 |
| **异步** | `unix.Msync(data, unix.MS_ASYNC)` | 发起写操作，立即返回 |
| **文件级** | `file.Sync()` | 通过 fd 刷盘，等价于 `fsync(2)` |

---

## 3. 典型应用场景

### 3.1 嵌入式 KV 存储

这是 mmap 在 Go 生态中最经典的应用：

```go
// 简化的 KV 存储模型
type KVStore struct {
    data   []byte          // mmap 映射的文件内容
    index  map[string]int64 // key → offset
    mu     sync.RWMutex
}

func (kv *KVStore) Get(key string) ([]byte, error) {
    kv.mu.RLock()
    defer kv.mu.RUnlock()

    offset, ok := kv.index[key]
    if !ok {
        return nil, ErrNotFound
    }

    // 直接从 mmap 内存中读取 value，零拷贝
    length := binary.LittleEndian.Uint32(kv.data[offset:])
    value := kv.data[offset+4 : offset+4+int64(length)]
    
    // ⚠️ 如果外部需要持有 value，必须 copy
    result := make([]byte, len(value))
    copy(result, value)
    return result, nil
}
```

**关键点**：

```text
key → offset (内存索引)
      ↓
直接 data[offset:n] 读取
      ↓
零 syscall，零拷贝
```

> **注意**：返回给调用者的数据必须 **copy**，因为 mmap 区域可能随时被 OS 换出或文件被 truncate。

### 3.2 使用 mmap 的知名 Go 项目

| 项目 | 用途 | mmap 角色 |
|------|------|-----------|
| **BoltDB** (bbolt) | 嵌入式 KV 数据库 | 将整个数据文件映射到内存，读写都通过 mmap |
| **Badger** | LSM-tree KV 存储 | vlog 文件使用 mmap 读取 |
| **leveldb** | Google KV 库 | SSTable 文件通过 mmap 访问 |
| **BLEVE** | 全文搜索引擎 | 索引文件通过 mmap 加载 |
| **RoaringBitmap** | 压缩位图 | 可选 mmap 加载大位图文件 |

### 3.3 为什么数据库偏爱 mmap

```
数据库需求          mmap 能力
──────────         ──────────
大文件             按需加载，不占物理内存
高频随机读         缺页中断自动加载，offset → 虚拟地址 O(1)
减少拷贝           数据直接可读，无 read buffer
多进程共享          MAP_SHARED 允许多进程访问同一文件
简化代码            像访问内存一样读文件，无需 seek → read 循环
```

### 3.4 对顺序读的适用性

对于**顺序读**（如日志解析），mmap 也有价值，但需要注意：

```go
// 顺序读场景：mmap vs bufio
//
// mmap 优点：
//   - 减少 syscall（缺页中断由内核批量处理）
//   - 内核可以预读（readahead），比你手动 read 更智能
//
// mmap 缺点：
//   - 预热成本：首次访问每页都触发缺页中断
//   - 内核的预读策略不一定适合你的访问模式
//   - 用 madvise 可以影响内核行为
```

```go
// madvise 给内核访问提示
import "golang.org/x/sys/unix"

// 告诉内核：我将要顺序访问这段数据
unix.Madvise(data, unix.MADV_SEQUENTIAL)

// 告诉内核：我需要这些页尽快加载
unix.Madvise(data, unix.MADV_WILLNEED)

// 告诉内核：这些页不需要了，可以优先回收
unix.Madvise(data[oldOffset:], unix.MADV_DONTNEED)
```

| madvise 标志 | 含义 | 适用场景 |
|-------------|------|----------|
| `MADV_SEQUENTIAL` | 顺序访问，预读激进 | 日志文件、批量导出 |
| `MADV_RANDOM` | 随机访问，预读保守 | 数据库查询 |
| `MADV_WILLNEED` | 即将需要，立即加载 | 预热索引文件 |
| `MADV_DONTNEED` | 不再需要，优先回收 | 释放冷数据页面 |

---

## 4. mmap 与 Go GC 的交互与风险

### 4.1 mmap 内存不受 GC 管理

这是最核心的风险点：

```text
┌─────────────────────────────────────────┐
│            Go 进程虚拟地址空间             │
├─────────────────┬───────────────────────┤
│   Go Heap       │   mmap 映射区域         │
│   (GC 管理)     │   (不受 GC 管理)        │
│                 │                       │
│  GC 扫描 → ✅   │   GC 扫描 → ❌ 跳过    │
│  自动回收 → ✅   │   必须手动 Munmap      │
│  panic 安全 → ✅ │   SIGSEGV 风险        │
└─────────────────┴───────────────────────┘
```

### 4.2 三大致命风险

#### 风险一：忘记 Munmap → 内存泄漏 + fd 泄漏

```go
// ❌ 危险：data 脱离 GC 管理，永不释放
func readConfig() []byte {
    file, _ := os.Open("config.json")
    stat, _ := file.Stat()

    data, _ := unix.Mmap(int(file.Fd()), 0, int(stat.Size()),
        unix.PROT_READ, unix.MAP_SHARED)

    file.Close() // fd 关了，但映射还在
    return data   // ⚠️ 调用者不知道要 Munmap
}
```

```go
// ✅ 正确：确保 Munmap 被调用
type MmapFile struct {
    data []byte
    size int
}

func OpenMmap(path string) (*MmapFile, error) {
    file, err := os.Open(path)
    if err != nil {
        return nil, err
    }
    defer file.Close() // fd 在 mmap 后可以关闭（Linux 行为）

    stat, _ := file.Stat()
    data, err := unix.Mmap(int(file.Fd()), 0, int(stat.Size()),
        unix.PROT_READ, unix.MAP_SHARED)
    if err != nil {
        return nil, err
    }

    return &MmapFile{data: data, size: int(stat.Size())}, nil
}

func (m *MmapFile) Close() error {
    return unix.Munmap(m.data)
}
```

#### 风险二：越界访问 → SIGSEGV（不是 panic）

```go
// ❌ 这不会 panic，而是直接 crash 整个进程！
data, _ := unix.Mmap(fd, 0, 4096, unix.PROT_READ, unix.MAP_SHARED)
_ = data[5000] // ← SIGSEGV: segmentation violation
```

```go
// ✅ 防御性编程：始终检查边界
func safeRead(data []byte, offset, length int) ([]byte, error) {
    if offset < 0 || length < 0 || offset+length > len(data) {
        return nil, fmt.Errorf("out of bounds: offset=%d len=%d cap=%d",
            offset, length, len(data))
    }
    return data[offset : offset+length], nil
}
```

#### 风险三：文件 truncate → SIGBUS

```go
// 场景：文件被外部进程或本进程 truncate 缩小
data, _ := unix.Mmap(fd, 0, 1<<30, unix.PROT_READ, unix.MAP_SHARED) // 1GB

// ... 另一个 goroutine truncate 文件到 512MB ...

_ = data[600<<20] // ← SIGBUS: 访问已不存在的文件页
```

> **SIGSEGV vs SIGBUS**：SIGSEGV 是访问无效地址，SIGBUS 是访问有效地址但底层映射失效（硬件总线错误）。两者都无法被 `recover()` 捕获。

### 4.3 安全封装模式

```go
type SafeMmap struct {
    data   []byte
    file   *os.File
    closed atomic.Bool
}

func NewSafeMmap(path string) (*SafeMmap, error) {
    file, err := os.OpenFile(path, os.O_RDWR, 0644)
    if err != nil {
        return nil, err
    }

    stat, err := file.Stat()
    if err != nil {
        file.Close()
        return nil, err
    }

    size := int(stat.Size())
    data, err := unix.Mmap(int(file.Fd()), 0, size,
        unix.PROT_READ|unix.PROT_WRITE, unix.MAP_SHARED)
    if err != nil {
        file.Close()
        return nil, fmt.Errorf("mmap: %w", err)
    }

    return &SafeMmap{data: data, file: file}, nil
}

func (m *SafeMmap) ReadAt(buf []byte, offset int64) (int, error) {
    if m.closed.Load() {
        return 0, fmt.Errorf("already closed")
    }
    if offset < 0 || offset+int64(len(buf)) > int64(len(m.data)) {
        return 0, fmt.Errorf("read out of bounds: offset=%d len=%d mmap_len=%d",
            offset, len(buf), len(m.data))
    }
    // 使用 recover 作为最后防线（注：SIGSEGV 无法被 recover 捕获，
    // 但某些平台上的边界错误可能表现为 panic）
    return copy(buf, m.data[offset:]), nil
}

func (m *SafeMmap) Close() error {
    if m.closed.Swap(true) {
        return nil // 幂等
    }
    err1 := unix.Munmap(m.data)
    err2 := m.file.Close()
    if err1 != nil {
        return err1
    }
    return err2
}
```

---

## 5. mmap vs 传统 I/O vs sendfile

### 5.1 核心区别

```text
传统 read/write:
  磁盘 → Page Cache → 用户 buffer → 程序处理
  特点：数据进入用户态，可自由修改

mmap:
  磁盘 → Page Cache ──→ 用户虚拟地址（直接映射）
  特点：像访问内存一样访问文件，随机访问极快

sendfile:
  磁盘 → Page Cache → socket buffer → 网卡
  特点：数据不进入用户态，纯内核态传输
```

### 5.2 选型矩阵

| 维度 | 传统 read/write | mmap | sendfile |
|------|-----------------|------|----------|
| **数据到用户态** | ✅ | ✅ | ❌ |
| **随机访问** | 需要 seek + read | ⭐ 天然支持 | ❌ 不支持 |
| **拷贝次数** | 2 次（DMA + CPU） | 1 次（DMA） | 0~1 次 |
| **syscall 开销** | 每次 read/write | 缺页时一次 | 一次 |
| **内存可控性** | ⭐ 完全可控 | ❌ 内核控制 | ❌ 内核控制 |
| **写回文件** | 手动 write | 自动（MAP_SHARED） | ❌ |
| **错误处理** | errno，安全 | SIGSEGV/SIGBUS | errno，安全 |
| **适用场景** | 通用 I/O | 数据库、存储 | 静态文件传输 |

### 5.3 具体场景选择

```text
场景                         推荐方案
────                         ────────
HTTP 静态文件下载             sendfile (io.Copy 自动)
日志文件顺序读取              bufio + Read
数据库索引随机查询            mmap
KV 存储读写                   mmap
JSON/Protobuf 反序列化        read + unmarshal
文件内容需要修改后写出         read → 修改 → write
大文件拷贝                    sendfile / splice
代理转发（不变内容）           splice
```

---

## 6. 性能优化与最佳实践

### 6.1 页对齐

```go
// ❌ 非对齐 offset 会导致 mmap 失败
offset := int64(1000) // 不是页大小整数倍

// ✅ 页对齐
pageSize := int64(os.Getpagesize()) // 通常 4096
alignedOffset := (offset / pageSize) * pageSize
diff := offset - alignedOffset

data, _ := unix.Mmap(fd, alignedOffset, size+int(diff), ...)
actualData := data[diff:] // 调整回真实内容
```

### 6.2 避免将整个大文件映射

```go
// ❌ 差：100GB 文件全部映射（在 64 位系统上可行但浪费虚拟地址空间）
data, _ := unix.Mmap(fd, 0, 100<<30, ...) // 不建议

// ✅ 好：分段映射，只保留热区
const chunkSize = 1 << 30 // 1GB per mapping
type ChunkedMmap struct {
    file   *os.File
    chunks map[int64][]byte // offset → mapped chunk
}

func (c *ChunkedMmap) ReadAt(buf []byte, offset int64) error {
    chunkOffset := (offset / chunkSize) * chunkSize
    chunk, ok := c.chunks[chunkOffset]
    if !ok {
        // 建立新映射
        var err error
        chunk, err = unix.Mmap(int(c.file.Fd()), chunkOffset, chunkSize,
            unix.PROT_READ, unix.MAP_SHARED)
        if err != nil {
            return err
        }
        c.chunks[chunkOffset] = chunk
    }
    local := int(offset - chunkOffset)
    copy(buf, chunk[local:])
    return nil
}
```

### 6.3 使用 madvise 优化访问模式

```go
// 批量顺序读取
unix.Madvise(data, unix.MADV_SEQUENTIAL)

// 已知即将访问的页（预热）
unix.Madvise(data[hotOffset:hotOffset+hotLen], unix.MADV_WILLNEED)

// 释放不再需要的页（避免挤占 Page Cache）
unix.Madvise(data[coldOffset:coldOffset+coldLen], unix.MADV_DONTNEED)
```

### 6.4 避免将 mmap 数据暴露给外部

```go
// ❌ 危险：返回 mmap 切片给调用者
func (kv *KVStore) Get(key string) []byte {
    offset := kv.index[key]
    return kv.data[offset : offset+length] // 调用者可能长期持有
}

// ✅ 安全：拷贝一份
func (kv *KVStore) Get(key string) ([]byte, error) {
    offset, ok := kv.index[key]
    if !ok {
        return nil, ErrNotFound
    }
    result := make([]byte, length)
    copy(result, kv.data[offset:offset+length])
    return result, nil
}

// ✅ 高效：如果调用者承诺短时间使用，可以用闭包
func (kv *KVStore) GetWith(key string, fn func([]byte) error) error {
    offset := kv.index[key]
    return fn(kv.data[offset : offset+length])
    // 函数返回后，data 切片不再被外部引用
}
```

### 6.5 并发安全

```go
// mmap 区域本身是并发安全的（物理内存）
// 但需要注意：
//
// 1. 并发写：MAP_SHARED 的多个映射者看到相同内容
// 2. 原子性：单个字节读写是原子的，但多字节操作需要上层加锁
// 3. 不可依赖 Go 的 race detector 检测 mmap 区域的竞争

type SyncedKVStore struct {
    data  []byte
    index map[string]int64
    mu    sync.RWMutex // 保护 index 和 data 的逻辑一致性
}
```

---

## 7. Go 各版本差异

### 7.1 版本演进总览

| Go 版本 | 变化 | 影响 |
|---------|------|------|
| **Go 1.4** | `syscall.Mmap` 基础支持 | 可通过 `syscall` 包直接调用 |
| **Go 1.17** | `syscall.Mmap` 行为调整 | 在 macOS/ARM64 平台上的兼容性修复 |
| **Go 1.20** | `golang.org/x/sys/unix.Mmap` 成熟 | 跨平台 mmap 的推荐方式 |
| **Go 1.21** | `golang.org/x/exp/mmap` 包引入 | 首次提供高阶 `ReaderAt` 接口 |
| **Go 1.22** | `x/exp/mmap` 改进 | 更好的错误处理和大文件支持 |
| **Go 1.23** | runtime 与 mmap 交互优化 | GC 处理非堆内存的效率提升 |
| **Go 1.24** | 继续打磨，无重大变更 | 稳定性提升 |
| **Go 1.26** | 当前最稳定版本 | 生产首选，所有 mmap 路径成熟 |

### 7.2 低版本注意事项

#### Go 1.20 及之前

```go
// ⚠️ Go 1.20 之前：直接使用 syscall.Mmap
// 错误处理不统一，跨平台差异大
import "syscall"

data, err := syscall.Mmap(fd, 0, size,
    syscall.PROT_READ, syscall.MAP_SHARED)
// 问题：
// - 各平台 prot/flags 常量不同
// - 返回类型不一致（有些返回 unsafe.Pointer）
```

#### Go 1.21 ~ 1.22

```go
// ⚠️ Go 1.21+: x/exp/mmap 实验性引入
// 功能不完整，可能变动 API
import "golang.org/x/exp/mmap"

reader, _ := mmap.Open("file.bin")
// 注意：
// - 仅支持只读
// - API 可能在未来版本变化
// - 不适合生产关键路径（除非你接受 API 变更风险）
```

#### Go 1.23+

```go
// ✅ Go 1.23+: GC 与非堆内存交互改善
// mmap 区域在 GC 标记阶段处理更高效
// 减少因大量 mmap 页面导致的 GC STW 延迟

// 推荐：
// - 生产环境：优先使用 golang.org/x/sys/unix.Mmap（稳定）
// - 实验/简单场景：可尝试 x/exp/mmap
```

### 7.3 Go 1.26 最佳实践

```go
// Go 1.26 推荐的 mmap 使用模式
//
// 1. 优先选择 x/sys/unix 用于生产
// 2. x/exp/mmap 用于简单只读场景
// 3. 始终封装 Close 语义

import "golang.org/x/sys/unix"

type MmapRegion struct {
    data []byte
}

func NewMmapRegion(fd, offset, length int, writable bool) (*MmapRegion, error) {
    prot := unix.PROT_READ
    if writable {
        prot |= unix.PROT_WRITE
    }
    data, err := unix.Mmap(fd, int64(offset), length, prot, unix.MAP_SHARED)
    if err != nil {
        return nil, err
    }
    return &MmapRegion{data: data}, nil
}

func (r *MmapRegion) Bytes() []byte { return r.data }
func (r *MmapRegion) Close() error  { return unix.Munmap(r.data) }
```

### 7.4 验证 mmap 行为

```bash
# 方法一：strace 观察 mmap 和缺页中断
strace -e mmap,mprotect,munmap -f go run main.go

# 方法二：/proc 查看内存映射
go run main.go &
cat /proc/$!/maps | grep -E "rw-p|r--p"

# 方法三：查看缺页统计
ps -o min_flt,maj_flt,cmd -p $!

# 方法四：Go trace 分析 GC 与 mmap 的交互
# 在代码中启用 trace，观察 GC 阶段是否因大量 mmap 页面而延迟
```

---

## 8. Linux 高性能 IO 全景

### 8.1 技术栈图谱

```text
                    ┌─────────────────────────────┐
                    │     Linux 高性能 IO 体系       │
                    └─────────────┬───────────────┘
                                  │
        ┌─────────────┬───────────┼───────────┬─────────────┐
        │             │           │           │             │
        ▼             ▼           ▼           ▼             ▼
    ┌───────┐   ┌───────┐   ┌───────┐   ┌───────┐   ┌──────────┐
    │ epoll │   │ mmap  │   │sendfile│  │splice │   │ io_uring │
    │       │   │       │   │       │   │       │   │          │
    │连接管理│   │存储访问│   │文件传输│  │管道转发│   │ 下一代IO │
    └──┬────┘   └───┬───┘   └───┬───┘   └───┬───┘   └────┬─────┘
       │            │           │           │            │
       ▼            ▼           ▼           ▼            ▼
   netpoller    BoltDB      io.Copy    代理转发     实验性
   (Go runtime)  LMDB       HTTP文件    tee 拼接     Go 1.23+
                Lucene      CDN节点
```

### 8.2 mmap 在体系中的定位

```text
mmap 的定位不是"高性能网络传输"，而是"高性能存储访问"

适用领域：
  ✓ 数据库存储引擎（索引、数据文件）
  ✓ 大文件随机读（日志查询、数据分析）
  ✓ 共享内存（跨进程通信）
  ✓ 零拷贝文件解析（直接读 mmap 区域）

不适用领域：
  ✗ 网络 IO（用 sendfile / splice / epoll）
  ✗ 流式处理（用 bufio）
  ✗ 需要改动的数据传输（用 read/write）
```

### 8.3 技术组合参考

| 场景 | 技术组合 | 说明 |
|------|---------|------|
| **Go 网关** | `epoll` + `sendfile` + `writev` | netpoller + 文件传输 + 小包合并 |
| **IM 服务** | `epoll` + `bufio` | 长连接管理 + 用户态缓冲 |
| **消息队列** | `mmap` + `sendfile` | 存储用 mmap，消费用 sendfile（类似 Kafka） |
| **日志平台** | `mmap` + `MADV_SEQUENTIAL` | 大日志文件高效检索 |
| **对象存储** | `sendfile` + `splice` | 零拷贝转发 |

---

## 总结

> `mmap` 的核心价值就一句话：**让程序像访问内存一样访问文件，消除内核态到用户态的数据拷贝**。三条关键认知：
>
> 1. **内存不受 GC 管理**：mmap 区域在 Go heap 之外，忘记 `Munmap` 就是永久泄漏，越界直接 SIGSEGV
> 2. **性能依赖内核行为**：页面何时加载、何时淘汰全由 OS 决定，`madvise` 是唯一的影响手段
> 3. **数据库是核心场景**：BoltDB、LMDB 等存储引擎大量使用 mmap，因为它天然适合 `offset → 虚拟地址` 的随机读取模式
>
> 选型建议：**存储用 mmap，传输用 sendfile，网络用 epoll** — 它们各司其职，构成 Linux 高性能 IO 的完整拼图。

---

## 相关链接

- [Linux sendfile 与 Go 零拷贝优化](/posts/linux/linux-sendfile-与-go-零拷贝优化/)
- [Go GMP 调度算法](/posts/go/go-gmp-调度算法/)
- Linux manual — mmap(2): https://man7.org/linux/man-pages/man2/mmap.2.html
- Linux manual — madvise(2): https://man7.org/linux/man-pages/man2/madvise.2.html
- Go 包文档 — unix.Mmap: https://pkg.go.dev/golang.org/x/sys/unix#Mmap
- Go 包文档 — x/exp/mmap: https://pkg.go.dev/golang.org/x/exp/mmap
- BoltDB (bbolt) 源码: https://github.com/etcd-io/bbolt

---

*本文基于 Go 1.21 ~ 1.26 编写。Go 1.21 引入 `x/exp/mmap` 实验性包，Go 1.23 改进了 GC 与非堆内存的交互，Go 1.26 为当前最稳定版本。低版本差异见第 7 节。*
