---
title: for...range 遍历切片/数组时的值拷贝陷阱
published: 2026-05-16
description: 解释 for range 的值拷贝语义，以及修改副本、获取循环变量地址和遍历大结构体时的常见问题。
tags:
  - go
  - 性能优化
  - 数据结构
category: Go语言性能陷阱
pinned: false
draft: false
comment: true
lang: zh_CN
---

> Go 语言的 `for...range` 在遍历切片或数组时，**每次迭代都会将元素值拷贝到一个固定的临时变量中**。理解这个机制，才能避免修改元素失败、取地址错误、大结构体拷贝等常见陷阱。

---

## 目录

1. [核心机制：值拷贝](#1-核心机制值拷贝)
2. [陷阱一：修改 value 不会影响原数据](#2-陷阱一修改-value-不会影响原数据)
3. [陷阱二：value 的地址始终不变](#3-陷阱二value-的地址始终不变)
4. [陷阱三：遍历的是原切片的副本](#4-陷阱三遍历的是原切片的副本)
5. [陷阱四：大结构体的拷贝开销](#5-陷阱四大结构体的拷贝开销)
6. [正确写法总结](#6-正确写法总结)
7. [Go 1.22 变化：循环变量语义变更](#7-go-122-变化循环变量语义变更)

---

## 1. 核心机制：值拷贝

### 1.1 语法回顾

Go 的 `for...range` 有两种常见形式：

```go
// 形式一：同时获取索引和值
for index, value := range sliceOrArray {
    // index: 当前元素的索引
    // value: 当前元素的副本
}

// 形式二：只获取索引
for index := range sliceOrArray {
    // 不复制值，直接通过索引访问
}
```

### 1.2 底层发生了什么

```go
// 你写的代码：
for i, v := range items {
    fmt.Println(v)
}

// Go 编译器的等效展开（伪代码）：
for i := 0; i < len(items); i++ {
    v := items[i]     // ← 每次迭代，将元素拷贝到临时变量 v
    fmt.Println(v)
}
```

关键事实：

| 事实 | 说明 |
|------|------|
| `v` 是临时变量 | 整个循环期间只有**一块内存**，每次迭代覆盖写入 |
| `v` 是元素副本 | 修改 `v` 不会影响 `items[i]`（基本类型和结构体） |
| `&v` 始终相同 | 取 `v` 的地址得到的是**同一个临时变量的地址** |
| 仅遍历索引不拷贝 | `for i := range items` 不会创建值副本 |

---

## 2. 陷阱一：修改 value 不会影响原数据

### 问题代码

```go
package main

import "fmt"

type User struct {
    Name string
    Age  int
}

func main() {
    users := []User{
        {Name: "Alice", Age: 20},
        {Name: "Bob",   Age: 25},
        {Name: "Carol", Age: 30},
    }

    // ❌ 错误：修改的是副本，原切片不变
    for _, u := range users {
        u.Age += 1
    }
    fmt.Println(users)
    // 输出: [{Alice 20} {Bob 25} {Carol 30}]  ← 没变
}
```

### 正确写法

```go
// ✅ 方法一：通过索引直接修改原数据
for i := range users {
    users[i].Age += 1
}
fmt.Println(users)
// 输出: [{Alice 21} {Bob 26} {Carol 31}]

// ✅ 方法二：存储指针切片
userPtrs := []*User{
    {Name: "Alice", Age: 20},
    {Name: "Bob",   Age: 25},
}
for _, u := range userPtrs {
    u.Age += 1          // u 是指针，修改指向的值
}
```

> **建议**：需要修改元素时，优先使用 `for i := range slice` + `slice[i]` 的方式。

---

## 3. 陷阱二：value 的地址始终不变

### 问题代码

```go
package main

import "fmt"

func main() {
    nums := []int{10, 20, 30, 40, 50}

    var ptrs []*int

    // ❌ 错误：每次取到的都是同一个临时变量 v 的地址
    for _, v := range nums {
        ptrs = append(ptrs, &v)
    }

    for _, p := range ptrs {
        fmt.Print(*p, " ")
    }
    // 输出: 50 50 50 50 50  ← 全部是最后一个值！
}
```

### 原理图解

```
第 1 次迭代:  v ← 10   →  &v = 0xc00001a080
第 2 次迭代:  v ← 20   →  &v = 0xc00001a080   ← 同一地址！
第 3 次迭代:  v ← 30   →  &v = 0xc00001a080
...
循环结束后:  v = 50     →  所有指针都指向 50
```

### 正确写法

```go
// ✅ 方法一：通过索引取原元素地址
for i := range nums {
    ptrs = append(ptrs, &nums[i])
}
// 输出: 10 20 30 40 50

// ✅ 方法二：在循环体内创建局部变量再取地址
for _, v := range nums {
    v := v              // 创建新的局部变量(1.21及之前需要此步骤)
    ptrs = append(ptrs, &v)
}
```

---

## 4. 陷阱三：遍历的是原切片的副本

### 4.1 `for...range` 的求值时机

```go
// for...range 在循环开始前就对表达式求值，生成一个副本
for i, v := range expr { ... }
//               ~~~~
//               这个表达式只求值一次（循环开始前）
```

这意味着：

```go
package main

import "fmt"

func main() {
    nums := []int{1, 2, 3, 4, 5}

    for i, v := range nums {
        if i == 0 {
            nums = append(nums, 6, 7, 8) // 可能触发扩容，指向新底层数组
        }
        fmt.Println(v)
        // v 仍然取自旧切片的副本
    }
    // 输出: 1 2 3 4 5
    // 不会输出 6 7 8，因为 range 使用的是循环开始前的切片副本
}
```

### 4.2 何时需要关注

| 场景 | 是否有影响 |
|------|-----------|
| 遍历中 `append` 且扩容 | `v` 仍取自旧切片副本 |
| 遍历中修改元素值（通过切片） | 不受影响，切片头副本共享底层数组 |
| 遍历中修改切片长度（重新切片） | `v` 仍取自旧副本 |

---

## 5. 陷阱四：大结构体的拷贝开销

### 问题场景

```go
type LargeRecord struct {
    ID        int64
    Data      [4096]byte     // 4KB 数据
    Timestamp int64
    Metadata  [256]byte
    // ... 更多字段，假设总计 5KB
}

records := make([]LargeRecord, 100000)

// ❌ 差：每次迭代拷贝 5KB，总计 500MB 内存拷贝！
for _, r := range records {
    process(r)      // r 是 LargeRecord 的副本
}
```

### 正确写法

```go
// ✅ 方法一：使用索引，避免值拷贝
for i := range records {
    process(records[i])
}

// ✅ 方法二：使用指针切片
recordPtrs := []*LargeRecord{...}
for _, r := range recordPtrs {
    process(*r)    // r 是指针，只拷贝 8 字节
}

// ✅ 方法三：取地址（如果能直接操作原切片）
for i := range records {
    process(&records[i])
}
```

### Benchmark 验证

```go
package main

import "testing"

type BigStruct struct {
    data [4096]byte
    id   int64
}

var bigSlice = make([]BigStruct, 10000)

// ❌ 值拷贝
func BenchmarkRangeValue(b *testing.B) {
    for b.Loop() {
        for _, v := range bigSlice {
            _ = v.id
        }
    }
}

// ✅ 只用索引
func BenchmarkRangeIndex(b *testing.B) {
    for b.Loop() {
        for i := range bigSlice {
            _ = bigSlice[i].id
        }
    }
}
```

---

## 6. 正确写法总结

### 速查表

| 需求 | 推荐写法 | 避免写法 |
|------|---------|---------|
| 只读遍历 | `for _, v := range s` | — |
| 修改元素值 | `for i := range s { s[i].Field = x }` | `for _, v := range s { v.Field = x }` |
| 取元素地址 | `for i := range s { p = &s[i] }` | `for _, v := range s { p = &v }` |
| Goroutine 闭包 | `for _, v := range s { v := v; go fn(v) }` | `for _, v := range s { go fn(v) }` |
| 大结构体遍历 | `for i := range s { fn(s[i]) }` | `for _, v := range s { fn(v) }` |
| 指针切片 | `for _, v := range s { v.Field = x }` ✅ | （指针切片直接用 value 即可） |

### 决策流程

```
                    使用 for...range 遍历切片/数组
                              │
                    ┌─────────┴─────────┐
                    │ 需要修改元素值？    │
                    └─────────┬─────────┘
                    Yes │          │ No
              ┌─────────┘          └─────────┐
              │ 用 for i := range           │ 用 for _, v := range
              │ s[i] 直接修改               │ 只读，代码简洁
              └─────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │ v 要用在闭包里？    │
                    └─────────┬─────────┘
                    Yes │          │ No
              ┌─────────┘          └──────┐
              │ v := v 创建局部副本        │ 直接使用
              └───────────────────────────┘
```

---

## 7. Go 1.22 变化：循环变量语义变更

> **Go 1.22（2024年2月发布）改变了 `for` 循环变量的语义**：每次迭代都会创建**新的变量**，而非复用同一个变量。

### 变更对比

```go
// Go 1.21 及之前：v 是同一个变量
for _, v := range nums {
    go func() {
        fmt.Print(v)  // 所有 goroutine 都打印最后一个值
    }()
}
// 输出（不确定顺序）: 50 50 50 50 50

// Go 1.22+：每次迭代创建新 v
for _, v := range nums {
    go func() {
        fmt.Print(v)  // 每个 goroutine 捕获各自的 v
    }()
}
// 输出（不确定顺序）: 10 20 30 40 50
```

### 哪些变，哪些没变

| 行为 | Go 1.21 | Go 1.22 |
|------|---------|---------|
| 每次迭代的 `v` 是新变量 | ❌ | ✅ |
| `&v` 在每次迭代中不同 | ❌ | ✅ |
| `v` 仍是元素**值的副本** | ✅ | ✅ |
| 修改 `v` 不影响原切片 | ✅ | ✅ |
| `for i := range s` 不拷贝值 | ✅ | ✅ |

### ⚠️ 仍需注意的点

即使 Go 1.22 修复了闭包问题，以下陷阱**依然存在**：

```go
// ❌ 即使在 Go 1.22，修改 v 依然不影响原数据
for _, v := range users {
    v.Age += 1  // v 是副本，原数据不变（和 Go 1.21 一样）
}

// ❌ 即使在 Go 1.22，大结构体依然每次拷贝
for _, v := range bigStructSlice {
    process(v)  // 很重的值拷贝
}
```

---

## 总结

> `for...range` 的 `value` 永远是**元素值的拷贝**——这是 Go 语言保证的安全语义。记住三条核心原则：
>
> 1. **改值用索引**：`for i := range s { s[i] = ... }`
> 2. **取址用索引**：`for i := range s { p = &s[i] }`
> 3. **大结构体用索引**：`for i := range s { fn(s[i]) }`

---

## 相关链接

- [Go GMP 调度算法](/posts/go/go-gmp-调度算法/)
- Go 语言规范 — For statements: https://go.dev/ref/spec#For_range
- Go 1.22 Release Notes — Loop variable change: https://go.dev/blog/go1.22

---

*本文基于 Go 1.21+ 编写，所有示例在 Go 1.21 ~ 1.24 均可运行。Go 1.22 闭包行为变化已在第 7 节说明。*
