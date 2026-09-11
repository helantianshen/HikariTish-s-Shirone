---
title: 从 Channel 到 Future：用 Go 实现 Async/Await 模型
published: 2026-09-12
description: 用泛型、Channel 与 goroutine 封装 Future/Await 模型，解释异步任务启动、结果等待、错误处理和并发执行边界。
tags:
  - go
  - 并发
  - 工程实践
category: Go
pinned: false
draft: false
comment: true
lang: zh_CN
---

完整示例代码如下：

```go
package main

import (
	"fmt"
	"time"
)

// Result 是异步任务最终产生的结果
// Value 保存正常返回值，Err 保存错误
type Result[T any] struct {
	Value T
	Err   error
}

// Future 可以理解为“未来会返回一个结果的通道”
// <-chan 表示这是一个只读 Channel，外部只能等待结果，不能向里面写数据
//
// Async 启动任务后会立即返回 Future
// 调用 Await(future) 时，会阻塞当前 goroutine
// 直到 Future 对应的异步任务产生结果
type Future[T any] <-chan Result[T]

// Async 用于最标准的：
//
//	func() (T, error)
//
// 这是整个异步模型的核心函数
// 其他不同返回值形式，本质上都可以转换成这种形式
func Async[T any](fn func() (T, error)) Future[T] {
	// 缓冲区为 1：
	// 即使调用方暂时没有 Await，异步任务也可以把结果写入 Channel 后直接结束
	ch := make(chan Result[T], 1)

	// Async 被调用时，任务立即通过 goroutine 开始执行
	go func() {
		defer close(ch)

		value, err := fn()

		// 一个 Future 只产生一次结果
		ch <- Result[T]{
			Value: value,
			Err:   err,
		}
	}()

	return ch
}

// AsyncValue 用于：
//
//	func() T
//
// 没有 error 的函数统一转换成 (T, error)
// error 永远返回 nil
func AsyncValue[T any](fn func() T) Future[T] {
	return Async(func() (T, error) {
		return fn(), nil
	})
}

// AsyncErr 用于：
//
//	func() error
//
// 因为没有正常返回值，所以使用 struct{} 作为占位值
// struct{} 本身不占用实际数据空间
func AsyncErr(fn func() error) Future[struct{}] {
	return Async(func() (struct{}, error) {
		return struct{}{}, fn()
	})
}

// AsyncVoid 用于：
//
//	func()
//
// 既没有返回值，也没有 error，同样使用 struct{} 占位
func AsyncVoid(fn func()) Future[struct{}] {
	return Async(func() (struct{}, error) {
		fn()
		return struct{}{}, nil
	})
}

// Await 等待 Future 返回结果
//
// 如果异步任务还没有完成，这里会阻塞当前 goroutine
// 注意：阻塞的是 goroutine，而不是占住 OS 线程进行忙等
// Go runtime 可以让当前线程继续执行其他 runnable goroutine
func Await[T any](future Future[T]) (T, error) {
	result := <-future
	return result.Value, result.Err
}

// ------------------------------------------------------------
// 以下模拟实际业务中的各种函数签名
// ------------------------------------------------------------

// 1. 有参数 + 返回值 + error
func QueryUser(id int) (string, error) {
	time.Sleep(3 * time.Second)
	return fmt.Sprintf("user_%v", id), nil
}

// 2. 只有返回值
func GetServerName() string {
	time.Sleep(1 * time.Second)
	return "server-01"
}

// 3. 只有 error
func WriteLog(message string) error {
	time.Sleep(2 * time.Second)
	fmt.Println("write log:", message)
	return nil
}

// 4. 没有任何返回值
func WarmupCache() {
	time.Sleep(1 * time.Second)
	fmt.Println("cache warmup completed")
}

// 5. 多返回值 + error
//
// Go 泛型没有 Tuple，因此推荐将多个返回值包装成一个 struct
func QueryUserDetail(id int) (string, int, string, error) {
	time.Sleep(2 * time.Second)

	return fmt.Sprintf("user_%v", id),
		20,
		"Singapore",
		nil
}

// UserDetailResult 用来包装 QueryUserDetail 的多个正常返回值
type UserDetailResult struct {
	Name string
	Age  int
	City string
}

func main() {
	id := 4

	// --------------------------------------------------------
	// 先创建所有 Future
	//
	// 注意：
	// Async 在这里就已经启动 goroutine
	// 所以下面的几个任务实际上是在并发执行
	// --------------------------------------------------------

	// 1. 有参数 + 返回值 + error
	//
	// Async 本身不关心参数
	// 需要的参数直接通过闭包捕获即可
	userFuture := Async(func() (string, error) {
		return QueryUser(id)
	})

	// 2. 只有返回值
	serverFuture := AsyncValue(func() string {
		return GetServerName()
	})

	// 3. 只有 error
	logFuture := AsyncErr(func() error {
		return WriteLog("query user")
	})

	// 4. 无返回值
	cacheFuture := AsyncVoid(func() {
		WarmupCache()
	})

	// 5. 多返回值
	//
	// 将原来的多个返回值：
	//
	//	string, int, string, error
	//
	// 转换成：
	//
	//	UserDetailResult, error
	detailFuture := Async(func() (UserDetailResult, error) {
		name, age, city, err := QueryUserDetail(id)

		return UserDetailResult{
			Name: name,
			Age:  age,
			City: city,
		}, err
	})

	fmt.Println("所有异步任务已经启动")
	fmt.Println("main goroutine 可以先执行其他逻辑")

	// --------------------------------------------------------
	// Await
	// --------------------------------------------------------

	// Await 可以理解成：
	//
	// “等待这个返回值 Channel 中出现结果”
	//
	// 如果结果已经准备好，则立即返回
	// 如果结果还没准备好，则当前 goroutine 挂起等待

	userQuery, err := Await(userFuture)
	if err != nil {
		fmt.Println("query user error:", err)
		return
	}
	fmt.Println("userQuery:", userQuery)

	serverName, err := Await(serverFuture)
	if err != nil {
		fmt.Println("get server error:", err)
		return
	}
	fmt.Println("serverName:", serverName)

	// 只有 error 的任务，不关心 struct{} 占位返回值
	_, err = Await(logFuture)
	if err != nil {
		fmt.Println("write log error:", err)
	}

	// 无返回值任务，Value 和 error 都可以忽略
	_, _ = Await(cacheFuture)

	// 多返回值统一包装成结构体
	detail, err := Await(detailFuture)
	if err != nil {
		fmt.Println("query detail error:", err)
		return
	}

	fmt.Printf(
		"user detail: name=%s age=%d city=%s\n",
		detail.Name,
		detail.Age,
		detail.City,
	)
}
```

## 一、为什么想在 Go 里实现 Async/Await

- Go 本身没有 `async/await` 关键字
- goroutine 已经提供了并发能力
- channel 可以承担"异步返回值"的传递

因此可以尝试封装一套 Future/Await 模型。

## 二、最简单的异步返回值

在抽象之前，先看 Go 里最原始的写法：

```go
result := make(chan string, 1)

go func() {
    result <- QueryUser(4)
}()

user := <-result
```

先说明一个核心事实：

> **Channel 本身就可以看作一个异步返回值容器。**

`go func()` 启动任务，`<-result` 等待结果——这两步其实就是 `async` 和 `await` 的雏形。我们要做的只是把它们封装成统一、优雅的 API。

## 三、抽象 Result 和 Future

```go
type Result[T any] struct {
    Value T
    Err   error
}

type Future[T any] <-chan Result[T]
```

这里重点解释 `Future[T]`：

- 它可以理解成一个 **"未来会产生 `Result[T]` 的只读 Channel"**
- `<-chan` 只读方向很关键：调用方只能等待结果，不能向里面写数据，类型系统直接保证了这一点
- `Result[T]` 把"正常返回值"和"错误"打包到一起，这样任意 `(T, error)` 的函数都能统一放进一个 Channel

## 四、实现 Async

```go
func Async[T any](fn func() (T, error)) Future[T] {
    ch := make(chan Result[T], 1)

    go func() {
        defer close(ch)

        value, err := fn()
        ch <- Result[T]{Value: value, Err: err}
    }()

    return ch
}
```

几个设计要点：

**1. 为什么统一函数签名是 `func() (T, error)`？**

这是 Go 中最完整的函数形态（有值、有错误）。其他形式（只有值、只有 error、都没有）都可以退化转换成它，所以它作为核心签名最合适。

**2. 为什么缓冲区为 1？**

即使调用方暂时没有 `Await`，异步任务也能把结果写入 Channel 后直接结束，不会因为无人接收而泄漏 goroutine。

**3. Async 是立即启动（eager）的**

`Async` 被调用的那一刻 goroutine 就开始跑了，返回的只是"取结果的凭证"。这一点后面会反复用到。

## 五、实现 Await

```go
func Await[T any](future Future[T]) (T, error) {
    result := <-future
    return result.Value, result.Err
}
```

重点讲一句：

> **Await 并没有什么魔法，本质就是从 Channel 中等待结果。**

如果结果已经准备好，立即返回；如果还没准备好，当前 goroutine 挂起等待。注意阻塞的是 goroutine，而不是占住 OS 线程忙等——Go runtime 会让当前线程继续调度其他 runnable 的 goroutine。

## 六、现实中的函数签名并不统一

现实中函数长各种样子，一共四种：

| 签名 | 封装函数 |
| --- | --- |
| `func() (T, error)` | `Async` |
| `func() T` | `AsyncValue` |
| `func() error` | `AsyncErr` |
| `func()` | `AsyncVoid` |

处理思路只有一句话：

> **把其他三种签名全部包一层闭包，退化转换成核心的 `func() (T, error)`，再交给 `Async` 处理。**

- `func() T`：没有 error，转换成 `(T, error)`，error 恒为 nil

```go
func AsyncValue[T any](fn func() T) Future[T] {
    return Async(func() (T, error) {
        return fn(), nil
    })
}
```

- `func() error`：没有正常返回值，用 `struct{}` 占位（不占用实际数据空间）

```go
func AsyncErr(fn func() error) Future[struct{}] {
    return Async(func() (struct{}, error) {
        return struct{}{}, fn()
    })
}
```

- `func()`：既没有返回值也没有 error，同样 `struct{}` 占位

```go
func AsyncVoid(fn func()) Future[struct{}] {
    return Async(func() (struct{}, error) {
        fn()
        return struct{}{}, nil
    })
}
```

可以看到，后三个都只是对 `Async` 的薄封装——这也验证了 `func() (T, error)` 作为核心签名的选择是对的。

不过在实际使用中，我更推荐直接使用 `Async` + 闭包，而不是这些薄封装：在 Go 中，函数闭包是非常常见的写法，与其为每种签名提供一个变体函数，不如统一用一个 `Async`，剩下的交给闭包表达，API 面更小，风格也更 Go。

## 七、有参数怎么办

重点讲**闭包**：

```go
id := 4

future := Async(func() (string, error) {
    return QueryUser(id)
})
```

可以总结成：

> **Async 不需要关心参数，参数交给 Go 闭包捕获即可。**

不需要设计 `Async1(fn, arg1)`、`Async2(fn, arg1, arg2)` 这种按参数个数膨胀的 API（很多语言/库确实这么干）。闭包天然解决了参数传递问题。

## 八、多返回值怎么办

Go 泛型没有 Tuple，硬模拟 Tuple 反而不 Go。惯用做法是用 struct 包起来：

```go
type UserDetailResult struct {
    Name string
    Age  int
    City string
}

detailFuture := Async(func() (UserDetailResult, error) {
    name, age, city, err := QueryUserDetail(id)
    return UserDetailResult{Name: name, Age: age, City: city}, err
})

detail, err := Await(detailFuture)
```

这里顺便体现了 Go 风格：**与其模拟别的语言的语法，不如顺着 Go 的习惯——多返回值就定义一个结果 struct**，字段名即文档。

## 九、多个 Future 是串行还是并发

这是本文最值得强调的一节，因为**非常容易误解**：

```go
userFuture := Async(...)
configFuture := Async(...)
logFuture := Async(...)

user, _ := Await(userFuture)
config, _ := Await(configFuture)
_, _ = Await(logFuture)
```

表面上 `Await` 是顺序写的，但别忘了 `Async` 被调用时就立即启动了 goroutine，三个任务早已在并发执行。时间线大致是：

```
QueryUser   ────────────────►
LoadConfig  ───────►
WriteLog    ───────────►

main        ───── Await user ─ Await config ─ Await log
```

结论：

> **Await 是顺序调用的，但 Future 对应的任务仍然是并发执行的。**

这和 JavaScript 中 `await` 逐行等待导致的"伪串行"陷阱正好相反：Go 这里 `Async` 阶段就已经"点火"了，`Await` 只是收结果。

## 十、和 Rust async/await 的区别

简单带一下即可，不要喧宾夺主：

| | Go 这套实现 | Rust |
| --- | --- | --- |
| 启动时机 | `Async()` 调用后立即创建 goroutine，属于 **eager** | Future 通常是 **lazy**，需要被 poll / await / spawn 才执行 |
| 等待机制 | 等待本质是 runtime 挂起**有栈 goroutine** | await 本质是编译器生成的**状态机**让出执行权 |

## 十一、这个实现的局限

一定要清楚这套代码的边界，否则容易产生"造了个真正 Future 框架"的错觉：

- Future 当前**只能消费一次**（结果写进缓冲为 1 的 Channel 后就没了）
- 没有 Context 取消
- 没有 timeout
- 没有 panic recovery
- 没有 `AwaitAll` / `AwaitAny`（虽然靠循环 + select 也不难加）
- goroutine 一旦启动，就无法依靠 Future 本身取消

生产环境中，多数时候直接用原生 goroutine / channel / `errgroup` 更符合 Go 习惯。

## 十二、总结

这套代码的价值并不是让 Go 变成 Rust、C# 或 JavaScript，而是通过**几十行代码**理解三件事之间的关系：

- **goroutine** 提供并发执行
- **channel** 承载异步结果
- **泛型** 让结果容器对任意类型通用

理解了这三点，也就理解了 Future/Await 模型的本质：**异步 = 提前启动 + 事后取值**，剩下的都只是封装。
