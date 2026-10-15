---
title: "Rust 学习笔记 · 通道（1）：消息所有权、多生产者与有界通道"
published: 2026-10-14
tags:
  - Rust
  - 通道
description: "通过发送与接收组织线程协作，理解通道结束条件和容量带来的等待。"
category: Rust
series: rust
seriesOrder: 10
draft: false
lang: zh_CN
---

# 通道（1）：消息所有权、多生产者与有界通道

通过发送与接收组织线程协作，理解通道结束条件和容量带来的等待。

学习日期：2026-10-14。本篇与同日的「通道」其他篇章合计为一个模块、一天学习量。

文中的完整代码保留当前示例的有效语句，省去原文件中的注释与已注释实验行；实验变体另行说明。运行命令在项目根目录执行，示例名称由 `Cargo.toml` 注册。

## mpsc::channel：通过消息转移所有权

`mpsc::channel::<String>()` 创建发送端和接收端。子线程将 `String` 传给 `send`，接收方通过 `recv()` 得到消息的所有权，发送方不能继续使用已移动的字符串。

`recv()` 会在暂时没有消息时等待。所有发送端释放且缓冲区没有剩余消息时，接收才返回断开错误。

示例源文件：`examples/channels/channel_basic.rs`。

```rust
use std::sync::mpsc;
use std::thread;

fn main() {
    let (sender, reciver) = mpsc::channel::<String>();

    let handle = thread::spawn(move || {
        let message = String::from("hello");

        sender.send(message).unwrap();

        println!("子线程发送完成");
    });

    match reciver.recv() {
        Ok(message) => println!("收到: {}", message),
        Err(error) => println!("接收失败: {}", error),
    }

    handle.join().unwrap();
}
```

运行：

```bash
cargo run --example channel_basic
```

本次本地运行的标准输出如下。并发日志只代表这次运行，先后关系以正文说明为准。

```text
子线程发送完成
收到: hello
```

### 理解与实验

发送完成的日志和接收日志先后不固定。普通无界通道发送成功，不代表消费者已经处理完消息，也不替代等待线程退出。

示例中变量 `reciver` 只是接收端的变量名。显式类型参数也有实验价值：删除发送语句后，通道仍知道消息类型，不会先遇到类型无法推断的问题。

## 多个生产者：结束条件包含所有发送端

克隆发送端，让两个线程往同一个接收端发送消息。这里每个生产者只发送一条，不同线程之间的接收顺序没有固定保证。

`for message in receiver` 会不断接收，直到所有发送端消失且剩余消息处理完。本例两个发送端分别随子线程结束而释放，因此循环能够退出。

示例源文件：`examples/channels/channel_multi.rs`。

```rust
use std::sync::mpsc;
use std::thread;

fn main() {
    let (sender, receiver) = mpsc::channel();
    let second_sender = sender.clone();

    let first = thread::spawn(move || {
        sender.send(String::from("来自线程一")).unwrap();
    });

    let second = thread::spawn(move || {
        second_sender.send(String::from("来自线程二")).unwrap();
    });

    for message in receiver {
        println!("收到: {}", message);
    }

    first.join().unwrap();
    second.join().unwrap();

    println!("接收结束");
}
```

运行：

```bash
cargo run --example channel_multi
```

本次本地运行的标准输出如下。并发日志只代表这次运行，先后关系以正文说明为准。

```text
收到: 来自线程一
收到: 来自线程二
接收结束
```

### 理解与实验

如果在主线程保留 `spare_sender`，即使它从不发送消息，接收循环仍然会等待，因为还有发送端存活。应在进入循环前释放不再使用的发送端。

`mpsc` 的含义是多个生产者、单个消费者；不要把发送端可以克隆理解为同一个标准库接收端也可任意克隆。

## sync_channel：容量限制与背压

容量为 1 时，通道最多缓存一条待接收消息。缓存满时，后续 `send()` 会阻塞，直到有空位，或者接收端断开。

背压让生产者感知消费者的处理节奏。不过“第二条发送完成”和接收日志的先后仍不固定，因为日志语句与消息交接不是同一个操作。

示例源文件：`examples/channels/channel_bounded.rs`。

```rust
use std::sync::mpsc;
use std::thread;

fn main() {
    let (sender, reciver) = mpsc::sync_channel(1);

    let handle = thread::spawn(move || {
        sender.send("第一条").unwrap();
        println!("第一条发送完成");

        sender.send("第二条").unwrap();
        println!("第二条发送完成");
    });

    for message in reciver {
        println!("收到: {}", message);
    }

    handle.join().unwrap();
}
```

运行：

```bash
cargo run --example channel_bounded
```

本次本地运行的标准输出如下。并发日志只代表这次运行，先后关系以正文说明为准。

```text
第一条发送完成
收到: 第一条
收到: 第二条
第二条发送完成
```

### 理解与实验

容量 0 也合法，表示不缓存：发送与接收必须直接交接，`send` 才能成功返回。

本例先接收，再 `join()`。若主线程先等待生产者退出，生产者又因缓冲已满而等待主线程接收，就可能互相等待形成死锁；通道不会自动将这种等待转换成 panic。

## 同模块笔记

- [通道（2）：接收超时与工作线程退出](/posts/rust/channels-2/)

## 标准库参考

- [mpsc](https://doc.rust-lang.org/std/sync/mpsc/index.html)
- [sync_channel](https://doc.rust-lang.org/std/sync/mpsc/fn.sync_channel.html)
- [recv_timeout](https://doc.rust-lang.org/std/sync/mpsc/struct.Receiver.html#method.recv_timeout)
