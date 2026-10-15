---
title: "Rust 学习笔记 · 线程（1）：spawn、join 与 Send / Sync"
published: 2026-10-12
tags:
  - Rust
  - 线程
description: "先分清线程何时启动、数据如何进入线程，再理解类型的跨线程约束。"
category: Rust
series: rust
seriesOrder: 4
draft: false
lang: zh_CN
---

# 线程（1）：spawn、join 与 Send / Sync

先分清线程何时启动、数据如何进入线程，再理解类型的跨线程约束。

学习日期：2026-10-12。本篇与同日的「线程」其他篇章合计为一个模块、一天学习量。

文中的完整代码保留当前示例的有效语句，省去原文件中的注释与已注释实验行；实验变体另行说明。运行命令在项目根目录执行，示例名称由 `Cargo.toml` 注册。

## spawn、move 与 join：启动、捕获和等待

`thread::spawn` 创建线程并返回 `JoinHandle`。`move` 让闭包按值捕获使用到的变量；这里 `String` 的所有权进入闭包，主线程随后不能再使用 `message`。

子线程打印字符串并返回长度，`join()` 等待线程结束，`unwrap()` 从成功结果中取出 5。源码最后一行虽然写着 `子线程收到`，打印的实际是返回的长度。

示例源文件：`examples/threads/thread_basic.rs`。

```rust
use std::thread;

fn main() {
    let message = String::from("hello");

    let handle = thread::spawn(move || {
        println!("子线程收到: {}", message);
        message.len()
    });

    println!("主线程继续执行");

    let length = handle.join().unwrap();

    println!("子线程收到: {}", length);
}
```

运行：

```bash
cargo run --example thread_basic
```

本次本地运行的标准输出如下。并发日志只代表这次运行，先后关系以正文说明为准。

```text
主线程继续执行
子线程收到: hello
子线程收到: 5
```

### 理解与实验

普通 `spawn` 的闭包需要满足 `Send + 'static` 等约束。这里的 `'static` 并不要求线程永远运行，而是不能依赖可能提前失效的局部借用；拥有 `String` 的闭包可以满足这一要求。

主线程的“继续执行”和子线程的字符串日志没有固定先后。`spawn` 已启动线程，`join` 负责等待和收集结果。

## 没有 join 时，主线程可能先结束

当前源码将 `handle.join().unwrap()` 注释掉了，所以主线程只是创建子线程，随后打印并退出。丢弃句柄不会等待线程结束；当主线程结束，进程退出，其他线程也会终止。

本次运行只看到主线程的两条日志，但这不是固定输出：子线程可能来得及开始执行。不能把某次未打印子线程日志理解为 `spawn` 没有启动线程。

示例源文件：`examples/threads/thread_join.rs`。

```rust
use std::thread;
use std::time::Duration;

fn main() {
    let handle = thread::spawn(|| {
        println!("子线程开始");

        thread::sleep(Duration::from_secs(1));

        println!("子线程结束");
    });

    println!("主线程等待");
    println!("主线程结束");
}
```

运行：

```bash
cargo run --example thread_join
```

本次本地运行的标准输出如下。并发日志只代表这次运行，先后关系以正文说明为准。

```text
主线程等待
主线程结束
```

### 理解与实验

要观察等待行为，在 `println!("主线程结束")` 之前添加 `handle.join().unwrap();`。这时子线程的一秒休眠会影响主线程的结束时机，“子线程结束”会先于“主线程结束”。

`thread::sleep` 只是暂停当前线程，不负责协调其他线程。不要用猜测休眠时长代替需要的等待关系。

## Send：把值交给另一个线程

`Send` 表示一个类型的值可以安全转移到另一个线程。这里整个 `RefCell<i32>` 被 `move` 到子线程，子线程独占它，修改后使用 `into_inner()` 消耗容器并返回内部值 15。

此处没有跨线程同时访问同一个 `RefCell`，因此它不需要具备 `Sync`。

示例源文件：`examples/threads/send_basic.rs`。

```rust
use std::cell::RefCell;
use std::thread;

fn main() {
    let value = RefCell::new(10);

    let handle = thread::spawn(move || {
        *value.borrow_mut() += 5;
        value.into_inner()
    });

    let result = handle.join().unwrap();

    println!("结果: {}", result);
}
```

运行：

```bash
cargo run --example send_basic
```

本次本地运行的标准输出如下。并发日志只代表这次运行，先后关系以正文说明为准。

```text
结果: 15
```

### 理解与实验

`RefCell<T>` 在 `T: Send` 时可以是 `Send`，但它不是 `Sync`。值可以交给另一个线程，不能据此推导出它的共享引用也能被多个线程安全使用。

这两个问题必须分开看：谁拥有这个值，以及哪些线程可能同时访问它。

## Sync：共享引用也要满足线程安全

`T: Sync` 的含义是 `&T: Send`。示例用空泛型函数给编译器施加约束，验证 `RefCell<i32>` 可以转移，而 `Mutex<i32>`、`Arc<Mutex<i32>>` 满足相应的共享约束。

这些函数没有运行时输出，重点是类型检查能否通过。

示例源文件：`examples/threads/send_sync.rs`。

```rust
use std::cell::RefCell;
use std::sync::{Arc, Mutex};

fn require_send<T: Send>() {}
fn require_sync<T: Sync>() {}

fn main() {
    require_send::<RefCell<i32>>();
    require_sync::<Mutex<i32>>();
    require_send::<Arc<Mutex<i32>>>();
    require_sync::<Arc<Mutex<i32>>>();
}
```

运行：

```bash
cargo run --example send_sync
```

本例没有标准输出；通过编译与正常退出验证当前启用的类型约束。

### 理解与实验

原文件中注释的 `require_sync::<RefCell<i32>>()` 与 `require_send::<Arc<RefCell<i32>>>()` 是失败实验。逐行取消注释可观察编译错误，不要将它们与正常运行版本混为一谈。

外层引用计数是原子的，并不能让内层借用管理自动线程安全。选择 `Arc` 时仍需检查内部类型的 `Send` / `Sync` 条件。

## 同模块笔记

- [线程（2）：作用域线程、切片拆分与结果合并](/posts/rust/threads-2/)
- [线程（3）：业务 Result 与 panic](/posts/rust/threads-3/)

## 标准库参考

- [thread::spawn](https://doc.rust-lang.org/std/thread/fn.spawn.html)
- [thread::scope](https://doc.rust-lang.org/std/thread/fn.scope.html)
- [Send](https://doc.rust-lang.org/std/marker/trait.Send.html)
- [Sync](https://doc.rust-lang.org/std/marker/trait.Sync.html)
