---
title: "Rust 学习笔记 · 一次性初始化（1）：OnceLock 与 LazyLock"
published: 2026-10-15
tags:
  - Rust
  - 一次性初始化
description: "比较先创建空容器再初始化，与在声明时确定初始化函数的两种方式。"
category: Rust
series: rust
seriesOrder: 12
draft: false
lang: zh_CN
---

# 一次性初始化（1）：OnceLock 与 LazyLock

比较先创建空容器再初始化，与在声明时确定初始化函数的两种方式。

学习日期：2026-10-15。本篇与同日的「一次性初始化」其他篇章合计为一个模块、一天学习量。

文中的完整代码保留当前示例的有效语句，省去原文件中的注释与已注释实验行；实验变体另行说明。运行命令在项目根目录执行，示例名称由 `Cargo.toml` 注册。

## OnceLock 与 LazyLock：初始化值的两种时机

`OnceLock` 可以先创建空容器，再通过 `get_or_init()` 提供初始化函数。第一次 `get()` 返回 `None`；第一次初始化写入 `Rust`；第二次传入返回 `Tokio` 的闭包不会执行，仍得到 `Rust`。

这里 `Tokio` 只是字符串内容，这个例子没有使用 Tokio 运行时，属于标准库初始化模块。

示例源文件：`examples/initialization/once_lazy.rs`。

```rust
use std::sync::{LazyLock, OnceLock};

static NAME: OnceLock<String> = OnceLock::new();

static GREETING: LazyLock<String> = LazyLock::new(|| {
    println!("正在初始化 GREETING");
    String::from("hello")
});

fn main() {
    println!("NAME 初始化前：{:?}", NAME.get());

    let first = NAME.get_or_init(|| String::from("Rust"));
    println!("第一次获取：{}", first);

    let second = NAME.get_or_init(|| String::from("Tokio"));
    println!("第二次获取：{}", second);

    println!("准备访问 GREETING");
    println!("第一次访问：{}", GREETING.as_str());
    println!("第二次访问：{}", GREETING.as_str());
}
```

运行：

```bash
cargo run --example once_lazy
```

本次本地运行的标准输出如下。并发日志只代表这次运行，先后关系以正文说明为准。

```text
NAME 初始化前：None
第一次获取：Rust
第二次获取：Rust
准备访问 GREETING
正在初始化 GREETING
第一次访问：hello
第二次访问：hello
```

### 理解与实验

`LazyLock` 在声明时已经确定初始化闭包，第一次真正访问内部值时才执行。两次 `GREETING.as_str()` 只触发一次“正在初始化”日志。

它们适合可延迟建立的共享值，不是可反复更新的配置容器。一次性初始化也不代表内部任意可变状态都自动具备线程安全性。

## 标准库参考

- [OnceLock](https://doc.rust-lang.org/std/sync/struct.OnceLock.html)
- [LazyLock](https://doc.rust-lang.org/std/sync/struct.LazyLock.html)
