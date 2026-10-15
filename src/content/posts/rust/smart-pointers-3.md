---
title: "Rust 学习笔记 · 智能指针（3）：Arc 与跨线程共享"
published: 2026-10-11
tags:
  - Rust
  - 智能指针
description: "把共享所有权扩展到线程之间，并区分原子引用计数与内部数据同步。"
category: Rust
series: rust
seriesOrder: 3
draft: false
lang: zh_CN
---

# 智能指针（3）：Arc 与跨线程共享

把共享所有权扩展到线程之间，并区分原子引用计数与内部数据同步。

学习日期：2026-10-11。本篇与同日的「智能指针」其他篇章合计为一个模块、一天学习量。

文中的完整代码保留当前示例的有效语句，省去原文件中的注释与已注释实验行；实验变体另行说明。运行命令在项目根目录执行，示例名称由 `Cargo.toml` 注册。

## Arc：跨线程共享所有权

`Arc<T>` 使用原子引用计数。在内部类型满足约束时，多个线程可以通过不同的 `Arc` 句柄共享同一个值。

子线程获得 `worker_message`，主线程保留 `message`。两边都能读取同一字符串；`join()` 得到子线程返回的长度 5。等待结束后子线程句柄已释放，剩余强引用为 1。

```rust
use std::sync::Arc;
use std::thread;

fn main() {
    let message = Arc::new(String::from("hello"));
    let worker_message = Arc::clone(&message);

    let handle = thread::spawn(move || {
        println!("子线程: {}", worker_message);
        worker_message.len()
    });

    println!("主线程: {}", message);
    let length = handle.join().unwrap();

    println!("子线程返回: {}", length);
    println!("剩余强引用: {}", Arc::strong_count(&message));
}
```

运行：

```bash
cargo run --example arc_basic
```

本次本地运行的标准输出如下。并发日志只代表这次运行，先后关系以正文说明为准。

```text
主线程: hello
子线程: hello
子线程返回: 5
剩余强引用: 1
```

### 理解与实验

主线程与子线程的两条读取日志可能交换顺序，但获取返回值的日志发生在 `join()` 成功之后。

`Arc` 解决的是所有权和引用计数安全，不会自动允许修改任意内部数据。共享修改仍需 `Mutex`、`RwLock`、原子类型等机制，具体取决于数据与访问方式。

## 同模块笔记

- [智能指针（1）：Box、Rc 与独占修改](/posts/rust/smart-pointers-1/)
- [智能指针（2）：RefCell、Weak 与循环引用](/posts/rust/smart-pointers-2/)

## 标准库参考

- [Box](https://doc.rust-lang.org/std/boxed/index.html)
- [Rc 与 get_mut](https://doc.rust-lang.org/std/rc/struct.Rc.html)
- [RefCell](https://doc.rust-lang.org/std/cell/struct.RefCell.html)
- [Arc](https://doc.rust-lang.org/std/sync/struct.Arc.html)
