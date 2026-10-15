---
title: "Rust 学习笔记 · 同步原语（2）：原子计数、Barrier 与 Condvar"
published: 2026-10-13
tags:
  - Rust
  - 同步原语
description: "分别练习单值原子更新、阶段到齐和围绕状态等待三种同步需求。"
category: Rust
series: rust
seriesOrder: 8
draft: false
lang: zh_CN
---

# 同步原语（2）：原子计数、Barrier 与 Condvar

分别练习单值原子更新、阶段到齐和围绕状态等待三种同步需求。

学习日期：2026-10-13。本篇与同日的「同步原语」其他篇章合计为一个模块、一天学习量。

文中的完整代码保留当前示例的有效语句，省去原文件中的注释与已注释实验行；实验变体另行说明。运行命令在项目根目录执行，示例名称由 `Cargo.toml` 注册。

## AtomicUsize：原子读改写

两个线程各执行 1000 次 `fetch_add(1, Ordering::Relaxed)`，每次将读取旧值、加一、写回作为一个原子读改写操作。作用域等待完成后读取结果为 2000。

`fetch_add` 返回加一前的旧值，本例没有使用该返回值。

```rust
use std::sync::atomic::{AtomicUsize, Ordering};
use std::thread;

fn main() {
    let counter = AtomicUsize::new(0);

    thread::scope(|scope| {
        for _ in 0..2 {
            let shared = &counter;

            scope.spawn(move || {
                for _ in 0..1000 {
                    shared.fetch_add(1, Ordering::Relaxed);
                }
            });
        }
    });

    let result = counter.load(Ordering::Relaxed);

    println!("最终结果: {}", result);
    assert_eq!(result, 2000);
}
```

运行：

```bash
cargo run --example atomic_basic
```

本次本地运行的标准输出如下。并发日志只代表这次运行，先后关系以正文说明为准。

```text
最终结果: 2000
```

### 理解与实验

将它替换成独立的 `load` 和 `store`，即使两次操作各自原子，组合也不是不可分割的。两个线程可能读取同一个旧值并相互覆盖增量；结果不保证每次都低于 2000，但正确性保证已经丢失。

`Relaxed` 保证该原子操作的原子性，不用它发布其他普通内存数据。这里的最终读取发生在作用域线程全部结束后，不能推广为它能同步任意共享状态。

## Barrier：等待参与者到齐

屏障创建为 `Barrier::new(3)`，三个线程分别完成准备后调用 `wait()`。本轮三次到达完成之前，任何线程都不能越过屏障打印“开始工作”。

准备日志内部、工作日志内部的线程编号顺序都不固定；屏障保证的是阶段关系。

```rust
use std::sync::Barrier;
use std::thread;
use std::thread::scope;

fn main() {
    let barrier = Barrier::new(3);

    thread::scope(|scope| {
        for id in 1..=3 {
            let shared = &barrier;

            scope.spawn(move || {
                println!("线程 {} 准备完成", id);

                shared.wait();

                println!("线程 {} 开始工作", id);
            });
        }
    });
}
```

运行：

```bash
cargo run --example barrier_basic
```

本次本地运行的标准输出如下。并发日志只代表这次运行，先后关系以正文说明为准。

```text
线程 1 准备完成
线程 2 准备完成
线程 3 准备完成
线程 3 开始工作
线程 1 开始工作
线程 2 开始工作
```

### 理解与实验

屏障不等于数据锁，也不保证越过后任务同时在 CPU 上执行。它适合表达多参与者的阶段同步。

如果改成 4，却仍只有三个线程调用 `wait()`，本例会一直等不到第四次到达。这个实验可能挂起，应有超时保护或手动终止。

## Condvar：围绕条件状态等待

`Mutex<bool>` 保存是否准备好的事实，`Condvar` 负责等待和通知。子线程持锁检查条件，不满足时调用 `wait()`；它在等待时释放锁，被唤醒后重新获取锁，返回新的守卫。

主线程持锁把状态改成 `true`，释放锁后通知。子线程通过检查后释放守卫，开始工作。

```rust
use std::sync::{Condvar, Mutex};
use std::thread;

fn main() {
    let ready = Mutex::new(false);
    let signal = Condvar::new();

    thread::scope(|scope| {
        scope.spawn(|| {
            let mut guard = ready.lock().unwrap();

            while !*guard {
                guard = signal.wait(guard).unwrap();
            }

            drop(guard);
            println!("子线程开始工作");
        });

        {
            let mut guard = ready.lock().unwrap();
            *guard = true;
        }

        signal.notify_one();
    });

    println!("全部结束");
}
```

运行：

```bash
cargo run --example condvar_basic
```

本次本地运行的标准输出如下。并发日志只代表这次运行，先后关系以正文说明为准。

```text
子线程开始工作
全部结束
```

### 理解与实验

必须使用 `while` 重新检查条件，原因包括虚假唤醒，以及被唤醒后条件可能又被其他线程改变。通知本身不等于条件已经成立。

如果主线程先更新状态、通知，然后子线程才开始检查，它能看到 `true` 并直接继续。通知不会为未来的等待保存一条消息，但受锁保护的状态会保留。删除赋值而只通知，不能让 `false` 自动变成 `true`。

## 同模块笔记

- [同步原语（1）：Mutex 与 RwLock](/posts/rust/synchronization-1/)
- [同步原语（3）：Mutex 中毒与恢复边界](/posts/rust/synchronization-3/)

## 标准库参考

- [Mutex 与中毒机制](https://doc.rust-lang.org/std/sync/struct.Mutex.html)
- [标准库同步原语](https://doc.rust-lang.org/std/sync/index.html)
- [原子内存顺序](https://doc.rust-lang.org/std/sync/atomic/enum.Ordering.html)
