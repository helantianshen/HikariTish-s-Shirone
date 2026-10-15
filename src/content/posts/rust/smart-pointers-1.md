---
title: "Rust 学习笔记 · 智能指针（1）：Box、Rc 与独占修改"
published: 2026-10-11
tags:
  - Rust
  - 智能指针
description: "从独占所有权出发，观察堆上间接存储、引用计数与可变访问之间的关系。"
category: Rust
series: rust
seriesOrder: 1
draft: false
lang: zh_CN
---

# 智能指针（1）：Box、Rc 与独占修改

从独占所有权出发，观察堆上间接存储、引用计数与可变访问之间的关系。

学习日期：2026-10-11。本篇与同日的「智能指针」其他篇章合计为一个模块、一天学习量。

文中的完整代码保留当前示例的有效语句，省去原文件中的注释与已注释实验行；实验变体另行说明。运行命令在项目根目录执行，示例名称由 `Cargo.toml` 注册。

## Box：用间接存储表达递归结构

`Node` 中的 `next` 表示下一个节点：`None` 是链尾，`Some(Box<Node>)` 指向堆上的后继节点。若直接写成 `Option<Node>`，类型会无限递归，编译器无法确定大小；`Box` 提供大小确定的间接层。

这里第一个 `Node` 是局部值，第二个节点由 `Box` 管理。`Box` 不等于共享所有权：将它赋给另一个变量通常会移动所有权，原变量不能继续使用。离开作用域时，节点和其拥有的后继节点会被依次释放。

示例源文件：`examples/smart_pointers/box_basic.rs`。

```rust
struct Node {
    value: i32,
    next: Option<Box<Node>>,
}

fn main() {
    let first = Node {
        value: 10,
        next: Some(Box::new(Node {
            value: 20,
            next: None,
        })),
    };

    println!("第一个节点: {}", first.value);

    if let Some(second) = &first.next {
        println!("第二个节点: {}", second.value);
    }
}
```

运行：

```bash
cargo run --example box_basic
```

本次本地运行的标准输出如下。并发日志只代表这次运行，先后关系以正文说明为准。

```text
第一个节点: 10
第二个节点: 20
```

### 理解与实验

`if let Some(second) = &first.next` 借用后继节点，没有把 `Box` 从 `first` 中移走。这里借用足以读取，没必要克隆或转移节点。

小练习：将节点扩展为 10 → 20 → 30，沿着 `next` 借用读取，观察链尾如何表示。

## Rc：多个所有者共享同一份数据

`Rc<T>` 适合单线程共享所有权。`Rc::clone(&first)` 增加强引用计数，两个句柄指向同一个 `String`，不会深拷贝字符串内容。

本例依次展示计数 1 → 2 → 1。`drop(first)` 消耗的是一个句柄；`second` 仍然持有强引用，所以数据还在。最后一个强引用消失时，内部值才会释放。

示例源文件：`examples/smart_pointers/rc_basic.rs`。

```rust
use std::rc::Rc;

fn main() {
    let first = Rc::new(String::from("hello"));

    println!("创建后: {}", Rc::strong_count(&first));

    let second = Rc::clone(&first);

    println!("克隆后: {}", Rc::strong_count(&first));
    println!("first: {}", first);
    println!("second: {}", second);

    drop(first);

    println!("释放 first 后: {}", Rc::strong_count(&second));
}
```

运行：

```bash
cargo run --example rc_basic
```

本次本地运行的标准输出如下。并发日志只代表这次运行，先后关系以正文说明为准。

```text
创建后: 1
克隆后: 2
first: hello
second: hello
释放 first 后: 1
```

### 理解与实验

不要把 `Rc::clone` 与内部值的 `clone` 混淆：前者复制共享句柄，后者可能复制数据。`Rc` 也不允许通过多个共享句柄直接获得 `&mut T`。

小练习：使用 `Rc::ptr_eq(&first, &second)` 检查两个句柄是否指向同一份分配；这行应放在 `drop(first)` 之前。

## Rc::get_mut：独占时直接修改

`let mut text` 只允许可变借用或重新赋值这个句柄，不会让共享数据自动可变。`Rc::get_mut(&mut text)` 返回 `Option<&mut String>`，由它判断当前是否能独占内部值。

第一次没有其他引用，得到 `Some`，追加 ` rust`；创建 `other` 后得到 `None`；释放 `other` 后又能追加 `!`。

示例源文件：`examples/smart_pointers/rc_get_mut.rs`。

```rust
use std::rc::Rc;

fn main() {
    let mut text = Rc::new(String::from("hello"));

    if let Some(value) = Rc::get_mut(&mut text) {
        value.push_str(" rust");
    }

    println!("第一次修改：{}", text);

    let other = Rc::clone(&text);

    println!("共享时可修改：{}", Rc::get_mut(&mut text).is_some());

    drop(other);

    if let Some(value) = Rc::get_mut(&mut text) {
        value.push('!');
    }

    println!("第二次修改：{}", text);
}
```

运行：

```bash
cargo run --example rc_get_mut
```

本次本地运行的标准输出如下。并发日志只代表这次运行，先后关系以正文说明为准。

```text
第一次修改：hello rust
共享时可修改：false
第二次修改：hello rust!
```

### 理解与实验

独占条件还包括弱引用：只要有其他 `Rc` 或 `Weak` 指向同一分配，`get_mut` 就会返回 `None`。可以在 `drop(other)` 后创建 `let observer = Rc::downgrade(&text);` 验证，此时最后的 `!` 不会追加。

这与 `RefCell` 的定位不同：`get_mut` 依赖当前确实没有其他引用，不能作为一般的共享可变方案。

## 同模块笔记

- [智能指针（2）：RefCell、Weak 与循环引用](/posts/rust/smart-pointers-2/)
- [智能指针（3）：Arc 与跨线程共享](/posts/rust/smart-pointers-3/)

## 标准库参考

- [Box](https://doc.rust-lang.org/std/boxed/index.html)
- [Rc 与 get_mut](https://doc.rust-lang.org/std/rc/struct.Rc.html)
- [RefCell](https://doc.rust-lang.org/std/cell/struct.RefCell.html)
- [Arc](https://doc.rust-lang.org/std/sync/struct.Arc.html)
