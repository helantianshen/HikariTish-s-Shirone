---
title: "Rust 学习笔记 · 同步原语（3）：Mutex 中毒与恢复边界"
published: 2026-10-13
tags:
  - Rust
  - 同步原语
description: "从 panic 时守卫是否仍然存活出发，区分线程失败、锁释放和中毒标记。"
category: Rust
series: rust
seriesOrder: 9
draft: false
lang: zh_CN
---

# 同步原语（3）：Mutex 中毒与恢复边界

从 panic 时守卫是否仍然存活出发，区分线程失败、锁释放和中毒标记。

学习日期：2026-10-13。本篇与同日的「同步原语」其他篇章合计为一个模块、一天学习量。

文中的完整代码保留当前示例的有效语句，省去原文件中的注释与已注释实验行；实验变体另行说明。运行命令在项目根目录执行，示例名称由 `Cargo.toml` 注册。

## Mutex 中毒：看清 panic 时是否仍持锁

当前代码在 `panic!` 之前显式 `drop(value)`，已经释放锁。因此子线程确实 panic，但这次执行不会让锁中毒；主线程正常获取到 20，最后输出 `仍然中毒: false`。

源码保留了“持锁 panic”的实验说明和 panic 文本，不能只按文字推断结果。这里观察的关键是守卫实际何时释放。

```rust
use std::sync::{Arc, Mutex};
use std::thread;
use log::error;

fn main() {
    let number = Arc::new(Mutex::new(10));
    let worker_number = Arc::clone(&number);

    let handle = thread::spawn(move || {
        let mut value = worker_number.lock().unwrap();
        *value = 20;

        drop(value);

        panic!("模拟持锁时发生错误");
    });

    println!("子线程发生 panic: {}", handle.join().is_err());

    let guard = match number.lock() {
        Ok(value) => {
            println!("正常获取锁: {}", *value);
            value
        },
        Err(error) => {
            println!("锁已中毒，需要检查数据状态");
            let mut guard = error.into_inner();
            *guard = 10;
            number.clear_poison();
            guard
        },
    };

    println!("当前值: {}", *guard);
    drop(guard);

    println!("仍然中毒: {}", number.is_poisoned());
}
```

运行：

```bash
cargo run --example mutex_poison
```

本次本地运行的标准输出如下。并发日志只代表这次运行，先后关系以正文说明为准。

```text
子线程发生 panic: true
正常获取锁: 20
当前值: 20
仍然中毒: false
```

子线程还会向标准错误输出 panic 信息。主线程通过 `join()` 接住线程失败并继续执行，因此本例进程退出码仍为 0。代码中的 `use log::error` 未被使用；在这个项目中可直接编译，复制到仅使用标准库的新项目时可删去这条导入。

### 理解与实验

若要验证中毒路径，可以仅在实验副本中删除 `drop(value);`，让守卫在 panic 展开时释放。此时匹配进入 `Err` 分支，通过 `into_inner()` 取得守卫，将值恢复为 10，再调用 `clear_poison()`。

中毒是提示数据约束可能被破坏的辅助机制，不是数据损坏的证明，也不是完整性保证。清除标记不会自动修复数据；本例的恢复规则只适用于这个简单数字示例。标准库对相关边界有进一步说明，见文末链接。

## 同模块笔记

- [同步原语（1）：Mutex 与 RwLock](/posts/rust/synchronization-1/)
- [同步原语（2）：原子计数、Barrier 与 Condvar](/posts/rust/synchronization-2/)

## 标准库参考

- [Mutex 与中毒机制](https://doc.rust-lang.org/std/sync/struct.Mutex.html)
- [标准库同步原语](https://doc.rust-lang.org/std/sync/index.html)
- [原子内存顺序](https://doc.rust-lang.org/std/sync/atomic/enum.Ordering.html)
