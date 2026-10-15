---
title: "Rust 学习笔记 · 通道（2）：接收超时与工作线程退出"
published: 2026-10-14
tags:
  - Rust
  - 通道
description: "区分接收超时、通道断开和业务停止，并通过返回值收集工作结果。"
category: Rust
series: rust
seriesOrder: 11
draft: false
lang: zh_CN
---

# 通道（2）：接收超时与工作线程退出

区分接收超时、通道断开和业务停止，并通过返回值收集工作结果。

学习日期：2026-10-14。本篇与同日的「通道」其他篇章合计为一个模块、一天学习量。

文中的完整代码保留当前示例的有效语句，省去原文件中的注释与已注释实验行；实验变体另行说明。运行命令在项目根目录执行，示例名称由 `Cargo.toml` 注册。

## recv_timeout：超时、断开与剩余消息

第一次接收等待 100 毫秒，发送端仍存活但没有消息，所以返回 `Timeout`。随后发送 `hello` 并成功接收，说明一次接收超时不会关闭通道。

最后发送 `最后一条` 再释放发送端。由于缓冲里还有消息，这次 `recv_timeout` 返回 `Ok("最后一条")`，不会立即报告断开。

```rust
use std::sync::mpsc;
use std::sync::mpsc::RecvTimeoutError;
use std::time::Duration;

fn main() {
    let (sender, receiver) = mpsc::channel::<String>();
    let timeout = Duration::from_millis(100);

    match receiver.recv_timeout(timeout) {
        Ok(message) => println!("收到: {}", message),
        Err(RecvTimeoutError::Timeout) => println!("等待超时"),
        Err(RecvTimeoutError::Disconnected) => println!("通道已断开"),
    }

    sender.send(String::from("hello")).unwrap();
    println!("超时后仍可接收: {}", receiver.recv().unwrap());

    sender.send(String::from("最后一条")).unwrap();
    drop(sender);

    println!("释放发送端后: {:?}", receiver.recv_timeout(timeout));
}
```

运行：

```bash
cargo run --example channel_timeout
```

本次本地运行的标准输出如下。并发日志只代表这次运行，先后关系以正文说明为准。

```text
等待超时
超时后仍可接收: hello
释放发送端后: Ok("最后一条")
```

### 理解与实验

想观察 `Disconnected`，可以在最后一次接收后再调用一次 `recv_timeout(timeout)`。此时没有发送端，也没有待接收消息，才会进入断开分支。

超时是某次等待的结果，断开是端点生命周期导致的状态。100 毫秒是等待参数，不应将程序实际总耗时写成精确的 100 毫秒。

## 工作线程：用枚举表达任务和停止

`Message::Add(i32)` 表示累加任务，`Message::Stop` 表示业务停止请求。工作线程独占 `total`，依次处理 10 和 20，遇到 `Stop` 后退出循环，返回 30。

同一个发送端按顺序发送，所以本例的两个累加先于停止被接收。这个顺序不代表来自不同发送线程的所有消息有预定的全局顺序。

```rust
use std::sync::mpsc;
use std::thread;

enum Message {
    Add(i32),
    Stop,
}

fn main() {
    let (sender, reciver) = mpsc::channel();

    let handle = thread::spawn(move || {
        let mut total = 0;

        for message in reciver {
            match message {
                Message::Add(value) => total += value,
                Message::Stop => break,
            }
        }

        total
    });

    sender.send(Message::Add(10)).unwrap();
    sender.send(Message::Add(20)).unwrap();

    sender.send(Message::Stop).unwrap();

    let total = handle.join().unwrap();

    println!("处理结果：{}", total);
    assert_eq!(total, 30);
}
```

运行：

```bash
cargo run --example worker_basic
```

本次本地运行的标准输出如下。并发日志只代表这次运行，先后关系以正文说明为准。

```text
处理结果：30
```

### 理解与实验

`Stop` 是自己定义的业务协议，通道并不识别它；真正让工作线程退出的是 `break`。发送成功也不表示线程已处理停止消息，仍需 `join()` 等待实际结束。

另一种结束方式是释放所有发送端，让工作线程处理完剩余消息后自然结束接收循环。这里状态只由工作线程访问，无需再引入共享可变计数器。

## 同模块笔记

- [通道（1）：消息所有权、多生产者与有界通道](/posts/rust/channels-1/)

## 标准库参考

- [mpsc](https://doc.rust-lang.org/std/sync/mpsc/index.html)
- [sync_channel](https://doc.rust-lang.org/std/sync/mpsc/fn.sync_channel.html)
- [recv_timeout](https://doc.rust-lang.org/std/sync/mpsc/struct.Receiver.html#method.recv_timeout)
