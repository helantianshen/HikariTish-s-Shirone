---
title: "Rust 学习笔记 · 线程（3）：业务 Result 与 panic"
published: 2026-10-12
tags:
  - Rust
  - 线程
description: "线程成功结束，不代表业务计算一定成功；两层 Result 分别表达这两个维度。"
category: Rust
series: rust
seriesOrder: 6
draft: false
lang: zh_CN
---

# 线程（3）：业务 Result 与 panic

线程成功结束，不代表业务计算一定成功；两层 Result 分别表达这两个维度。

学习日期：2026-10-12。本篇与同日的「线程」其他篇章合计为一个模块、一天学习量。

文中的完整代码保留当前示例的有效语句，省去原文件中的注释与已注释实验行；实验变体另行说明。运行命令在项目根目录执行，示例名称由 `Cargo.toml` 注册。

## 区分业务错误与线程 panic

闭包返回 `Result<i32, &'static str>`，而 `join()` 自身也返回一个 `Result`，两层分别表示业务计算状态和线程结束状态。

当前 `divisor = 0` 时闭包正常返回 `Err("除数不能为零")`，最终进入 `Ok(Err(error))` 分支，线程本身没有 panic。

```rust
use std::thread;

fn main() {
    let divisor = 0;

    let handle = thread::spawn(move || -> Result<i32, &'static str> {
        if divisor == 0 {
            return Err("除数不能为零");
        }

        Ok(100 / divisor)
    });

    match handle.join() {
        Ok(Ok(value)) => println!("计算成功: {}", value),
        Ok(Err(error)) => println!("计算失败: {}", error),
        Err(_) => println!("子线程发生 panic"),
    }
}
```

运行：

```bash
cargo run --example thread_result
```

本次本地运行的标准输出如下。并发日志只代表这次运行，先后关系以正文说明为准。

```text
计算失败: 除数不能为零
```

### 理解与实验

三条路径分别是：`Ok(Ok(value))` 表示线程正常结束且计算成功；`Ok(Err(error))` 表示线程正常结束但业务失败；`Err(_)` 表示子线程 panic。

将除数改为 4 会打印 25。要验证 panic 分支，应将原 `return Err(...)` 替换为 `panic!(...)`，而不是把 panic 放在已经返回的语句之后。

## 同模块笔记

- [线程（1）：spawn、join 与 Send / Sync](/posts/rust/threads-1/)
- [线程（2）：作用域线程、切片拆分与结果合并](/posts/rust/threads-2/)

## 标准库参考

- [thread::spawn](https://doc.rust-lang.org/std/thread/fn.spawn.html)
- [thread::scope](https://doc.rust-lang.org/std/thread/fn.scope.html)
- [Send](https://doc.rust-lang.org/std/marker/trait.Send.html)
- [Sync](https://doc.rust-lang.org/std/marker/trait.Sync.html)
