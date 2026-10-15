---
title: "Rust 学习笔记 · 线程（2）：作用域线程、切片拆分与结果合并"
published: 2026-10-12
tags:
  - Rust
  - 线程
description: "用生命周期和数据划分组织并发，练习不依赖共享可变状态的实现。"
category: Rust
series: rust
seriesOrder: 5
draft: false
lang: zh_CN
---

# 线程（2）：作用域线程、切片拆分与结果合并

用生命周期和数据划分组织并发，练习不依赖共享可变状态的实现。

学习日期：2026-10-12。本篇与同日的「线程」其他篇章合计为一个模块、一天学习量。

文中的完整代码保留当前示例的有效语句，省去原文件中的注释与已注释实验行；实验变体另行说明。运行命令在项目根目录执行，示例名称由 `Cargo.toml` 注册。

## 作用域线程：借用局部数据

`thread::scope` 允许子线程借用外部局部数据，因为它保证作用域返回之前，其中的线程已经结束。

第一个线程借用 `numbers` 读取，第二个线程读取 `numbers` 并独占借用 `total` 写入总和。离开 `scope` 后，可以继续使用这些局部变量，结果为 60。

示例源文件：`examples/threads/thread_scope.rs`。

```rust
use std::thread;

fn main() {
    let numbers = vec![10, 20, 30];
    let mut total = 0;

    thread::scope(|scope| {
        scope.spawn(|| {
            println!("第一个数字: {}", numbers[0]);
        });

        scope.spawn(|| {
            total = numbers.iter().sum::<i32>();
        });
    });

    println!("原始数据: {:?}", numbers);
    println!("总和: {}", total);
}
```

运行：

```bash
cargo run --example thread_scope
```

本次本地运行的标准输出如下。并发日志只代表这次运行，先后关系以正文说明为准。

```text
第一个数字: 10
原始数据: [10, 20, 30]
总和: 60
```

### 理解与实验

作用域只约束生命周期，不会放宽借用规则。若两个线程都尝试获得 `total` 的可变借用，仍会被编译器拒绝。

作用域内的主线程代码可与子线程并发执行；只有离开作用域才有全部结束的保证。线程耗时长会使退出等待，并不意味着会 panic。

## split_at_mut：拆分互不重叠的可变借用

`numbers.split_at_mut(2)` 返回 `[1, 2]` 与 `[3, 4]` 的两个可变切片。它们借用同一个数组中的不同区域，没有复制元素。

两个线程分别修改两段数据：左段乘 10，右段乘 100。由于写入区域互不重叠，可以依靠借用规则证明安全，无需互斥锁。

示例源文件：`examples/threads/thread_split.rs`。

```rust
use std::thread;

fn main() {
    let mut numbers = [1, 2, 3, 4];

    let (left, right) = numbers.split_at_mut(2);

    thread::scope(|scope| {
        scope.spawn(move || {
            for value in left {
                *value *= 10;
            }
        });

        scope.spawn(move || {
            for value in right {
                *value *= 100;
            }
        });
    });

    println!("结果: {:?}", numbers);

    assert_eq!(numbers, [10, 20, 300, 400]);
}
```

运行：

```bash
cargo run --example thread_split
```

本次本地运行的标准输出如下。并发日志只代表这次运行，先后关系以正文说明为准。

```text
结果: [10, 20, 300, 400]
```

### 理解与实验

`move` 将切片借用交给线程，并没有转移整个数组的所有权。作用域结束后借用结束，主线程读取原数组，得到 `[10, 20, 300, 400]`。

这适用于任务可按不重叠数据区间划分的情况。若线程需要同时修改同一元素，就不能仅靠这次切片拆分解决。

## 拆分计算，通过返回值合并结果

两个作用域线程分别计算前半段与后半段的和，返回 3 和 7。主线程对两个句柄执行 `join()`，再合并成 10。

这里只有共享读取，每个线程的局部计算独立，最终通过返回值汇总，没有共享可变计数器。

示例源文件：`examples/threads/thread_sum.rs`。

```rust
use std::thread;

fn main() {
    let numbers = [1, 2, 3, 4];
    let middle = numbers.len() / 2;

    let total = thread::scope(|scope| {
        let first = scope.spawn(|| {
            numbers[..middle].iter().sum::<i32>()
        });

        let second = scope.spawn(|| {
            numbers[middle..].iter().sum::<i32>()
        });

        let left_sum = first.join().unwrap();
        let right_sum = second.join().unwrap();

        left_sum + right_sum
    });

    println!("总和: {}", total);
    assert_eq!(total, 10);
}
```

运行：

```bash
cargo run --example thread_sum
```

本次本地运行的标准输出如下。并发日志只代表这次运行，先后关系以正文说明为准。

```text
总和: 10
```

### 理解与实验

两次 `spawn` 都发生在第一次 `join` 之前，因此两个任务都已经启动。先等待第一个句柄，不代表第二个线程要等它结束才开始。

这个小数组用于练习任务划分，不能据此得出并行更快的性能结论。线程创建、调度和等待都存在成本。

## 同模块笔记

- [线程（1）：spawn、join 与 Send / Sync](/posts/rust/threads-1/)
- [线程（3）：业务 Result 与 panic](/posts/rust/threads-3/)

## 标准库参考

- [thread::spawn](https://doc.rust-lang.org/std/thread/fn.spawn.html)
- [thread::scope](https://doc.rust-lang.org/std/thread/fn.scope.html)
- [Send](https://doc.rust-lang.org/std/marker/trait.Send.html)
- [Sync](https://doc.rust-lang.org/std/marker/trait.Sync.html)
