---
title: "Rust 学习笔记 · 智能指针（2）：RefCell、Weak 与循环引用"
published: 2026-10-11
tags:
  - Rust
  - 智能指针
description: "共享之后如何修改，以及如何避免引用关系让数据永远无法释放。"
category: Rust
series: rust
seriesOrder: 2
draft: false
lang: zh_CN
---

# 智能指针（2）：RefCell、Weak 与循环引用

共享之后如何修改，以及如何避免引用关系让数据永远无法释放。

学习日期：2026-10-11。本篇与同日的「智能指针」其他篇章合计为一个模块、一天学习量。

文中的完整代码保留当前示例的有效语句，省去原文件中的注释与已注释实验行；实验变体另行说明。运行命令在项目根目录执行，示例名称由 `Cargo.toml` 注册。

## Rc<RefCell<T>>：单线程共享可变状态

`Rc` 管理共享所有权，`RefCell` 提供内部可变性，并把借用冲突检查放在运行时。两者组合后，多个句柄能观察到同一次修改。

`borrow_mut()` 返回可变借用守卫 `RefMut`，通过解引用将 10 改为 15。内层作用域结束后守卫释放，随后 `borrow()` 才能安全获取不可变借用。

```rust
use std::cell::RefCell;
use std::rc::Rc;

fn main() {
    let first = Rc::new(RefCell::new(10));
    let second = Rc::clone(&first);

    {
        let mut value = second.borrow_mut();

        *value += 5;
    }

    println!("first: {}", *first.borrow());
    println!("second: {}", *second.borrow());
}
```

运行：

```bash
cargo run --example rc_refcell
```

本次本地运行的标准输出如下。并发日志只代表这次运行，先后关系以正文说明为准。

```text
first: 15
second: 15
```

### 理解与实验

运行时仍遵守“多个不可变借用，或一个可变借用”的规则。如果在 `value` 尚未释放时执行 `first.borrow()`，会触发 panic；`Rc` 不会绕过这条规则。

`Rc<RefCell<T>>` 用于单线程。跨线程共享可变状态可以参考后续的 `Arc<Mutex<T>>`，不能只把外层改成 `Arc` 就认为安全。

## Weak：观察数据，但不延长值的生命周期

`Rc::downgrade(&owner)` 创建弱引用，不增加强引用计数。`upgrade()` 返回 `Option<Rc<T>>`：值仍存活时得到一个新的强引用，否则返回 `None`。

当前示例在释放 `owner` 前，先将升级结果保存到 `keeper`。因此 `drop(owner)` 后仍然打印 `释放后: hello`，不是 `数据已经释放`。

```rust
use std::rc::Rc;

fn main() {
    let owner = Rc::new(String::from("hello"));
    let observer = Rc::downgrade(&owner);

    println!("强引用: {}", Rc::strong_count(&owner));
    println!("弱引用: {}", Rc::weak_count(&owner));

    if let Some(value) = observer.upgrade() {
        println!("释放前: {}", value);
    }

    let keeper = observer.upgrade().unwrap();
    drop(owner);

    match observer.upgrade() {
        Some(value) => println!("释放后: {}", value),
        None => println!("数据已经释放")
    }

    println!("keeper: {}", keeper);

}
```

运行：

```bash
cargo run --example weak_basic
```

本次本地运行的标准输出如下。并发日志只代表这次运行，先后关系以正文说明为准。

```text
强引用: 1
弱引用: 1
释放前: hello
释放后: hello
keeper: hello
```

### 理解与实验

`keeper` 是真正的强引用，会继续拥有数据。可以在 `match observer.upgrade()` 之前插入 `drop(keeper)`，同时删去末尾对 `keeper` 的打印，再观察 `None`。

弱引用不保活内部值，但会让相关分配的管理信息继续存在，直到弱引用也释放；“值已销毁”不等于所有关联分配已经回收。

## 强引用环：先成环，再手动断开

节点内部的 `next` 存入 `Rc::clone(&node)` 后，节点强引用自己，计数变成 2：局部变量持有一个，字段持有一个。

当前代码随后执行 `*node.next.borrow_mut() = None`，先移除内部强引用，再 `drop(node)`。因此本次运行会打印 `Node 已释放`，不会留下循环引用泄漏。

```rust
use std::cell::RefCell;
use std::rc::Rc;

struct Node {
    next: RefCell<Option<Rc<Node>>>,
}

impl Drop for Node {
    fn drop(&mut self) {
        println!("Node 已释放");
    }
}

fn main() {
    let node = Rc::new(Node {
        next: RefCell::new(None),
    });

    *node.next.borrow_mut() = Some(Rc::clone(&node));

    println!("强引用: {}", Rc::strong_count(&node));

    *node.next.borrow_mut() = None;
    drop(node);

    println!("main 结束");
}
```

运行：

```bash
cargo run --example rc_cycle
```

本次本地运行的标准输出如下。并发日志只代表这次运行，先后关系以正文说明为准。

```text
强引用: 2
Node 已释放
main 结束
```

### 理解与实验

如果仅删除断环语句，`drop(node)` 只能将计数从 2 减到 1，内部的 `Node::drop()` 不会执行。节点不能释放，内部强引用也无法随节点释放，形成内存泄漏。

释放 `Rc` 句柄与销毁内部 `Node` 是两件事。安全 Rust 可以避免许多非法内存访问，但仍然可能发生引用环导致的泄漏。

## 弱引用环：销毁时机仍由强引用决定

这里 `next` 保存 `Weak<Node>`，节点指向自己时只增加弱引用计数。单纯存在这条反向引用，不会阻止内部值释放。

不过代码又通过 `upgrade()` 创建了 `keeper`，所以 `drop(node)` 后节点仍然存在；直到 `drop(keeper)` 才打印 `Node 已释放`。

```rust
use std::cell::RefCell;
use std::rc::{Rc, Weak};

struct Node {
    next: RefCell<Option<Weak<Node>>>,
}

impl Drop for Node {
    fn drop(&mut self) {
        println!("Node 已释放");
    }
}

fn main() {
    let node = Rc::new(Node {
        next: RefCell::new(None),
    });

    *node.next.borrow_mut() = Some(Rc::downgrade(&node));

    println!("强引用: {}", Rc::strong_count(&node));
    println!("弱引用: {}", Rc::weak_count(&node));

    let keeper = node
        .next
        .borrow()
        .as_ref()
        .unwrap()
        .upgrade()
        .unwrap();
    drop(node);

    println!("main 结束");

    println!("准备释放 keeper");
    drop(keeper);
}
```

运行：

```bash
cargo run --example weak_cycle
```

本次本地运行的标准输出如下。并发日志只代表这次运行，先后关系以正文说明为准。

```text
强引用: 1
弱引用: 1
main 结束
准备释放 keeper
Node 已释放
```

### 理解与实验

链式调用依次完成：`borrow()` 借用 `Option`，`as_ref()` 得到其中元素的引用，第一个 `unwrap()` 取出 `&Weak<Node>`，`upgrade()` 尝试生成强引用，第二个 `unwrap()` 取出这个 `Rc<Node>`。

常见父子结构可以让父节点用 `Rc` 拥有子节点，子节点用 `Weak` 指回父节点。反向链接仍可导航，但不承担保活父节点的责任。

## 同模块笔记

- [智能指针（1）：Box、Rc 与独占修改](/posts/rust/smart-pointers-1/)
- [智能指针（3）：Arc 与跨线程共享](/posts/rust/smart-pointers-3/)

## 标准库参考

- [Box](https://doc.rust-lang.org/std/boxed/index.html)
- [Rc 与 get_mut](https://doc.rust-lang.org/std/rc/struct.Rc.html)
- [RefCell](https://doc.rust-lang.org/std/cell/struct.RefCell.html)
- [Arc](https://doc.rust-lang.org/std/sync/struct.Arc.html)
