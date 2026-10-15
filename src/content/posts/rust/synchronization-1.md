---
title: "Rust 学习笔记 · 同步原语（1）：Mutex 与 RwLock"
published: 2026-10-13
tags:
  - Rust
  - 同步原语
description: "需要共享修改时，用守卫的生命周期理解互斥访问与读写访问。"
category: Rust
series: rust
seriesOrder: 7
draft: false
lang: zh_CN
---

# 同步原语（1）：Mutex 与 RwLock

需要共享修改时，用守卫的生命周期理解互斥访问与读写访问。

学习日期：2026-10-13。本篇与同日的「同步原语」其他篇章合计为一个模块、一天学习量。

文中的完整代码保留当前示例的有效语句，省去原文件中的注释与已注释实验行；实验变体另行说明。运行命令在项目根目录执行，示例名称由 `Cargo.toml` 注册。

## Arc<Mutex<T>>：共享计数器

`Arc` 让主线程和子线程共同拥有计数器，`Mutex` 让对同一数值的修改互斥。两边各累加 1000 次，等待子线程结束后，读取结果为 2000。

`lock()` 成功时返回 `MutexGuard`；通过守卫访问数据，守卫释放时自动解锁。本例每次循环结束都会释放这次取得的守卫。

示例源文件：`examples/synchronization/arc_mutex.rs`。

```rust
use std::sync::{Arc, Mutex};
use std::thread;

fn main() {
    let counter = Arc::new(Mutex::new(0));
    let worker_counter = Arc::clone(&counter);

    let handle = thread::spawn(move || {
        for _ in 0..1000 {
            let mut value = worker_counter.lock().unwrap();
            *value += 1;
        }
    });

    for _ in 0..1000 {
        let mut value = counter.lock().unwrap();
        *value += 1;
    }

    handle.join().unwrap();

    println!("最终结果: {}", *counter.lock().unwrap());
}
```

运行：

```bash
cargo run --example arc_mutex
```

本次本地运行的标准输出如下。并发日志只代表这次运行，先后关系以正文说明为准。

```text
最终结果: 2000
```

### 理解与实验

锁只负责访问协调，不负责等待工作全部完成。若删除 `join()`，最终读取发生时子线程可能尚未完成，结果可能不足 2000，也可能恰好已经达到 2000。

持锁范围应服务于数据约束。不要持有同一把锁等待一个必须获取它才能结束的线程，否则会造成死锁。

## RwLock：多个读者与独占写者

`RwLock` 允许多个读锁同时存在，写锁与其他读写锁互斥。示例先让两个线程读取 10，作用域结束后再独占写入 15。

后半段刻意持有 `reader`，调用非阻塞的 `try_write()`。当前无法独占，因此返回 `WouldBlock`；释放读守卫后再尝试即可成功。

示例源文件：`examples/synchronization/rwlock_basic.rs`。

```rust
use std::sync::RwLock;
use std::thread;

fn main() {
    let number = RwLock::new(10);

    thread::scope(|scope| {
        for id in 1..=2 {
            let shared = &number;

            scope.spawn(move || {
                let value = shared.read().unwrap();
                println!("线程 {} 读取: {}", id, *value);
            });
        }
    });

    {
        let mut value = number.write().unwrap();
        *value += 5;
    }

    println!("修改后: {}", *number.read().unwrap());

    let reader = number.read().unwrap();

    println!("尝试获取写锁: {:?}", number.try_write());

    drop(reader);

    println!("释放读锁后: {:?}", number.try_write());
}
```

运行：

```bash
cargo run --example rwlock_basic
```

本次本地运行的标准输出如下。并发日志只代表这次运行，先后关系以正文说明为准。

```text
线程 1 读取: 10
线程 2 读取: 10
修改后: 15
尝试获取写锁: Err("WouldBlock")
释放读锁后: Ok(15)
```

### 理解与实验

即使读写请求来自同一个线程，也不能忽略仍然存活的读锁。这里使用 `try_write()` 是为了观察失败；不能把它替换成阻塞获取，再期待后面的 `drop(reader)` 有机会执行。

读写锁的公平性与性能不能仅由“读多写少”推导。这个示例验证访问规则，没有进行性能比较。

## 同模块笔记

- [同步原语（2）：原子计数、Barrier 与 Condvar](/posts/rust/synchronization-2/)
- [同步原语（3）：Mutex 中毒与恢复边界](/posts/rust/synchronization-3/)

## 标准库参考

- [Mutex 与中毒机制](https://doc.rust-lang.org/std/sync/struct.Mutex.html)
- [标准库同步原语](https://doc.rust-lang.org/std/sync/index.html)
- [原子内存顺序](https://doc.rust-lang.org/std/sync/atomic/enum.Ordering.html)
