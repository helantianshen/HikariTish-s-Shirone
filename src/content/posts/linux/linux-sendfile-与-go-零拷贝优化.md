---
title: Linux sendfile 与 Go 零拷贝优化
published: 2026-05-16
description: 分析传统文件发送与 sendfile 的拷贝路径，并说明 Go 的 io.Copy 如何触发零拷贝优化。
tags:
  - linux
  - go
  - 零拷贝
category: Linux
pinned: false
draft: false
comment: true
lang: zh_CN
---

> `sendfile` 是 Linux 提供的高性能系统调用，在内核态直接将文件数据传输到 socket，避免用户态参与，实现"零拷贝"。Go 标准库在 `io.Copy`、`http.ServeFile`、`net.TCPConn.ReadFrom` 等路径中自动使用 `sendfile`，使得静态文件服务的性能接近 Nginx 水平。

---

## 目录

1. [sendfile 系统调用原理](#1-sendfile-系统调用原理)
2. [Go 中隐式使用 sendfile](#2-go-中隐式使用-sendfile)
3. [手动调用 unix.Sendfile](#3-手动调用-unixsendfile)
4. [生产场景](#4-生产场景)
5. [限制与不适用场景](#5-限制与不适用场景)
6. [Go 各版本差异](#6-go-各版本差异)
7. [Linux 高性能 IO 全景](#7-linux-高性能-io-全景)

---

## 1. sendfile 系统调用原理

### 1.1 传统文件发送路径

```
磁盘 → 内核 buffer → 用户 buffer → socket buffer → 网卡
```

涉及两次 syscall（`read` + `write`）和两次跨态拷贝（`kernel → user` + `user → kernel`）。

### 1.2 sendfile 路径

```
磁盘/Page Cache → socket → 网卡
```

用户态不接触数据，全程在内核态完成。

### 1.3 关于"零拷贝"

严格来说，现代 Linux 的 `sendfile` 更多是**减少拷贝**而非绝对零拷贝——部分场景仍可能经过 DMA buffer 或 socket buffer。但效果等价：**用户态不持有数据，CPU 不参与搬运**。

### 1.4 sendfile 函数签名

```c
#include <sys/sendfile.h>

ssize_t sendfile(int out_fd, int in_fd, off_t *offset, size_t count);
```

| 参数 | 含义 |
|------|------|
| `out_fd` | 目标文件描述符（必须是 socket） |
| `in_fd` | 源文件描述符（必须是能 mmap 的文件，即普通文件） |
| `offset` | 从文件哪个位置开始读，`NULL` 表示从当前偏移开始 |
| `count` | 传输字节数 |
| **返回值** | 成功传输的字节数，`-1` 表示出错 |

> **限制**：Linux 2.6.33 之前 `out_fd` 必须是 socket；之后该限制放宽，但实际使用场景几乎都是 `file → socket`。

---

## 2. Go 中隐式使用 sendfile

> 很多人以为 `io.Copy` 就是 `read/write` 循环，实际上在 Linux 下，Go runtime 会自动将符合条件的场景优化为 `sendfile`。

### 2.1 io.Copy 的自动优化

```go
file, _ := os.Open("video.mp4")
conn, _ := net.Dial("tcp", "127.0.0.1:8080")

io.Copy(conn, file) // ← 底层自动调用 sendfile()
```

**触发条件**：
- 源是 `*os.File`
- 目标是 `*net.TCPConn`（Go 1.4+）
- 操作系统为 Linux（macOS 使用类似的 `sendfile` 系统调用）

内部实现位于 `src/net/sendfile_linux.go`，`io.Copy` 会检测 `ReaderFrom` / `WriterTo` 接口——`net.TCPConn` 实现了 `ReadFrom`，而 `ReadFrom` 内部检测到源是 `*os.File` 后，直接走 `sendfile` 路径。

### 2.2 http.ServeFile 路径

```go
http.HandleFunc("/download", func(w http.ResponseWriter, r *http.Request) {
    http.ServeFile(w, r, "large_file.zip")
})
```

`http.ServeFile` 内部调用 `io.CopyN(w, f, size)` → 最终走到 `sendfile`。这也是 Go 静态文件服务性能不低的根本原因。

### 2.3 net.TCPConn.ReadFrom

```go
// net.TCPConn.ReadFrom 是 sendfile 的直接入口
func (c *TCPConn) ReadFrom(r io.Reader) (int64, error)
```

当 `r` 是 `*os.File` 时，直接进入 `src/net/sendfile_linux.go` 的快速路径。即使 `r` 不是 `*os.File`，Go 也会尝试通过 `io.LimitedReader` 等方式适配。

### 2.4 内部实现摘要

```go
// src/net/sendfile_linux.go (Go 1.23+)

func sendFile(c *netFD, r io.Reader) (written int64, err error, handled bool) {
    // 1. 确认源是 *os.File
    f, ok := r.(*os.File)
    if !ok {
        return 0, nil, false // 回退到普通 read/write
    }

    // 2. 获取底层 fd
    sc, err := f.SyscallConn()
    // ...

    // 3. 循环调用 sendfile syscall
    for {
        n, err := syscall.Sendfile(c.fd.Sysfd, int(f.Fd()), &remain, maxChunk)
        // ...
    }
}
```

> **关键点**：如果 `sendfile` 某次调用只传输了部分数据（例如被信号中断），Go 会**自动重试剩余部分**，对调用方透明。

---

## 3. 手动调用 unix.Sendfile

在需要精确控制场景下，可以通过 `golang.org/x/sys/unix` 直接调用。

```go
package main

import (
    "net"
    "os"

    "golang.org/x/sys/unix"
)

func main() {
    file, _ := os.Open("test.mp4")
    defer file.Close()

    conn, _ := net.Dial("tcp", "127.0.0.1:8080")
    defer conn.Close()

    // 获取 socket fd
    raw, _ := conn.(*net.TCPConn).SyscallConn()

    raw.Control(func(fd uintptr) {
        offset := int64(0)

        // 直接调用 sendfile(2)
        unix.Sendfile(
            int(fd),          // socket fd (out_fd)
            int(file.Fd()),   // file fd (in_fd)
            &offset,          // 文件偏移量
            1<<20,            // 传输 1MB
        )
    })
}
```

### 3.1 手动调用 vs 自动优化

| 方式 | 适用场景 |
|------|---------|
| `io.Copy` / `http.ServeFile` | **首选**，零侵入，Go runtime 自动处理重试和回退 |
| `net.TCPConn.ReadFrom` | 需要更细粒度控制但仍依赖标准库 |
| `unix.Sendfile` | 需要精确控制偏移量、与非标准源/目标 fd 交互 |
| 自己封装 syscall | 极度定制场景（如自定义协议封装） |

> **推荐**：绝大多数场景直接用 `io.Copy` 即可。手动调用只在性能分析（pprof）显示 `io.Copy` 路径不够时才考虑。

---

## 4. 生产场景

### 4.1 经典用例

| 场景 | 说明 |
|------|------|
| 静态资源服务 | 图片、CSS、JS 文件的 HTTP 分发 |
| 视频/音频流 | 大文件的流式传输 |
| 文件下载服务 | 对象存储网关、CDN 边缘节点 |
| Kafka 消息消费 | 消费者拉取消息时，`磁盘文件 → socket` 直接 sendfile |

### 4.2 Kafka 如何利用 sendfile

> Kafka 的经典之处：消息写入是顺序写磁盘（segment 文件），消费者拉取时直接 `sendfile`，**消息数据从不进入用户态**。

```
Producer → Broker (顺序写 segment 文件)
                          ↓
Consumer ← Broker (sendfile: segment → socket)
```

所以 Kafka 即使吞吐极高，CPU 占用仍然很低——数据搬运完全在内核态完成。

### 4.3 Nginx 与 sendfile

Nginx 配置中有：

```nginx
sendfile on;
tcp_nopush on;
```

这同样是直接调用 `sendfile(2)`，Go 的 `http.ServeFile` 在 Linux 上走的是同一条内核路径。

---

## 5. 限制与不适用场景

### 5.1 数据不可修改

因为数据不进入用户态，**任何需要处理数据的场景都不适用**：

| 不适用                  | 原因                    |
| -------------------- | --------------------- |
| `gzip` / `brotli` 压缩 | 需要在用户态读取、压缩、再写出       |
| TLS 加密               | 必须在用户态加密（除非 kTLS，见下文） |
| Protobuf / JSON 编码   | 需要序列化处理               |
| 数据校验/签名              | 需要读取数据进行摘要计算          |

### 5.2 TLS 对 sendfile 的影响

```
纯 HTTP:   文件 → sendfile → socket → 网卡        ✅ 零拷贝
HTTPS:     文件 → 用户态 TLS 加密 → socket → 网卡   ❌ 必须经过用户态
```

HTTPS 场景下 `sendfile` 效果大幅下降，因为 TLS 加密必须在用户态完成。

### 5.3 kTLS（Kernel TLS）

| Linux 版本 | 能力 |
|-----------|------|
| 4.13+ | kTLS 基础支持（发送方向） |
| 4.17+ | kTLS 接收方向支持 |
| 5.x+ | 逐步成熟 |

**kTLS 原理**：将 TLS 会话密钥传入内核，由内核完成加密后直接 `sendfile`，从而在 HTTPS 场景下恢复零拷贝能力。

> **Go 与 kTLS**：Go 1.23 时标准库尚未默认启用 kTLS（Go 使用自己的 crypto/tls 实现，不依赖 OpenSSL）。如果你需要 kTLS + sendfile 的 HTTPS 零拷贝，可以考虑 Caddy（使用 Go 但通过其他方式集成），或使用 Envoy/Nginx 做 TLS 终止。

### 5.4 sendfile 失败的常见原因

| 错误 | 原因 |
|------|------|
| `EINVAL` | `out_fd` 不是 socket，或 `in_fd` 不是普通文件 |
| `ENOSYS` | 内核不支持 sendfile（极老内核） |
| `EAGAIN` | socket 缓冲区满，需等待（Go runtime 自动处理） |
| `EIO` | 文件系统 I/O 错误 |

Go 在 sendfile 失败时会**自动回退到 `read/write` 循环**，对调用方透明。

---

## 6. Go 各版本差异

### 6.1 版本演进总览

| Go 版本 | 变化 | 影响 |
|---------|------|------|
| **Go 1.4** | `net.TCPConn.ReadFrom` 首次集成 sendfile | Linux 上 TCP 文件传输自动零拷贝 |
| **Go 1.5** | 扩展到更多 io.Copy 路径 | 更多隐式场景受益 |
| **Go 1.17** | 改进 `ReadFrom` 的部分 sendfile 重试逻辑 | 大文件传输更稳定 |
| **Go 1.19** | `net/http` 中 Range 请求的 sendfile 优化 | 断点续传/分段下载受益 |
| **Go 1.23** | `net.TCPConn.ReadFrom` 重构，更激进地使用 sendfile | 更多边缘场景覆盖 |
| **Go 1.24** | 继续打磨 sendfile 回调路径，减少分配 | 性能微调 |
| **Go 1.26** | 当前最稳定版本，sendfile 集成成熟度最高 | 生产首选 |

### 6.2 低版本注意事项

#### Go 1.21 及之前

```go
// ⚠️ Go 1.21 及之前：某些边缘场景可能不会触发 sendfile
// 例如：通过 io.LimitedReader 包装的 *os.File
// 建议做性能验证，必要时通过 pprof 确认是否走 sendfile 路径
```

#### Go 1.19 及之前

```go
// ⚠️ Go 1.19 之前：HTTP Range 请求可能不会走 sendfile 优化
// 如果你的服务大量处理分段下载，建议升级到 1.19+
```

#### Go 1.16 及之前（已 EOL）

```go
// ⚠️ 这些版本已停止维护，sendfile 相关优化相比新版有显著差距
// 强烈建议升级到 Go 1.23+
```

### 6.3 验证 sendfile 是否生效

```bash
# 方法一：strace 观察
strace -e sendfile -f go run main.go 2>&1 | grep sendfile

# 方法二：pprof CPU profile
# 如果 sendfile 生效，read/write 的 CPU 消耗应该极低
go tool pprof http://localhost:6060/debug/pprof/profile

# 方法三：查看 Go 内部追踪
GODEBUG=schedtrace=1000 ./server
```

### 6.4 跨平台差异

| 平台 | 零拷贝机制 | Go 支持 |
|------|-----------|---------|
| Linux | `sendfile(2)` | ✅ 完整支持 |
| macOS | `sendfile(2)` (BSD 语义不同) | ✅ 通过 `syscall.Sendfile` 适配 |
| FreeBSD | `sendfile(2)` | ✅ |
| Windows | `TransmitFile` | ✅ 通过内部适配 |
| Docker (Linux) | 同宿主机 Linux | ✅ |

---

## 7. Linux 高性能 IO 全景

`sendfile` 是 Linux 高性能 IO 工具箱中的一环，与之配套的技术包括：

| 技术 | 解决的问题 | Go 集成 |
|------|-----------|---------|
| **`sendfile`** | 文件传输零拷贝 | `io.Copy` / `http.ServeFile` |
| **`splice`** | 两个 fd 间零拷贝（不限 socket） | 需手动通过 `unix.Splice` |
| **`writev`** | 小包合并，减少 syscall 次数 | `net` 包内部使用 |
| **`mmap`** | 大文件随机访问、减少拷贝 | `golang.org/x/exp/mmap` |
| **`epoll`** | 高并发连接管理 | Go netpoller 内部使用 |
| **`io_uring`** | 新一代异步 IO，更低延迟 | Go 1.23+ 实验性支持 |

### 7.1 技术栈组合

```
             ┌──────────┐
             │  Nginx   │
             │  Kafka   │
             │  Envoy   │
             │  Go 网关  │
             └────┬─────┘
                  │
    ┌─────────────┼─────────────┐
    │             │             │
    ▼             ▼             ▼
 epoll       sendfile       mmap
(连接管理)   (文件传输)    (大文件随机访问)
    │             │             │
    └─────────────┼─────────────┘
                  │
            io_uring (下一代)
```

### 7.2 你可能会用到的组合

做 Go 网关 / IM / netpoll 方向时，这套技术栈会逐步接触：

- **`bufio`** → 用户态缓冲，减少小读小写
- **`sendfile`** → 静态文件传输零拷贝
- **`writev`** → HTTP 响应头 + body 的 scatter/gather IO
- **`splice`** → 代理场景（客户端 ↔ 后端）的零拷贝转发
- **`mmap`** → 日志文件、索引文件的高效访问
- **`epoll`** → Go runtime 的 netpoller 底层
- **`io_uring`** → 未来替代 epoll + 更多能力

---

## 总结

> `sendfile` 的核心价值就一句话：**让内核直接搬运数据，用户态不参与**。Go 从 1.4 开始就在 `io.Copy` 和 `http.ServeFile` 中自动利用 `sendfile`，开发者无需手动优化即可获得接近 Nginx 的静态文件服务性能。
>
> 三条关键认知：
> 1. **隐式使用**：`io.Copy(*os.File, *net.TCPConn)` 自动走 sendfile，不需要你做任何事
> 2. **TLS 打断**：HTTPS 需要在用户态加密，sendfile 失效（除非引入 kTLS）
> 3. **不可修改数据**：sendfile 的数据不进用户态，所以无法做压缩、编码、校验

---

## 相关链接

- [Go GMP 调度算法](/posts/go/go-gmp-调度算法/)
- [time.After 内存泄漏](/posts/go-performance/time-after-内存泄漏陷阱/)
- Linux manual — sendfile(2): https://man7.org/linux/man-pages/man2/sendfile.2.html
- Go 源码 — sendfile_linux.go: https://github.com/golang/go/blob/master/src/net/sendfile_linux.go

---

*本文基于 Go 1.23 ~ 1.26 编写。Go 1.4 首次引入 sendfile 优化，Go 1.23 做了重要重构，Go 1.26 为当前最稳定版本。低版本差异见第 6 节。*
