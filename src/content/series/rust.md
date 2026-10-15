---
title: Rust 学习笔记
status: ongoing
defaultCategory: Rust
---

从智能指针开始，逐步学习线程、同步原语、通道与一次性初始化。当前收录 12 篇笔记，保留完整示例、运行命令、实际输出与理解练习，按学习依赖顺序阅读。

笔记日期为 2026 年 10 月 11 日至 15 日，同一模块的多篇文章使用同一天日期。本阶段覆盖标准库示例，不包含 Tokio。

示例基于 `learn-rust` 项目，使用 Rust edition 2024。文中的 `cargo run --example <name>` 需要项目在 `Cargo.toml` 中注册对应示例；自行练习时，也可以将单个示例保存为新项目的 `src/main.rs`，使用 `cargo run` 运行。

1. 智能指针：Box、Rc、RefCell、Weak 与 Arc
2. 线程：spawn、join、Send / Sync、作用域线程与错误处理
3. 同步原语：Mutex、RwLock、原子计数、Barrier、Condvar 与中毒恢复
4. 通道：消息所有权、多生产者、有界通道、接收超时与工作线程退出
5. 一次性初始化：OnceLock 与 LazyLock
