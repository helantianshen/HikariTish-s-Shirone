---
title: Go GMP 调度算法
published: 2026-05-09
description: 解释 Goroutine、线程与逻辑处理器的协作关系，以及本地队列、工作窃取和抢占调度机制。
tags:
  - go
  - 并发
  - 底层原理
category: Go
pinned: false
draft: false
comment: true
lang: zh_CN
image: ../../../assets/images/posts/go-gmp-cover.png
---

> Go 运行时调度器的核心：**G**（Goroutine）、**M**（Machine / OS 线程）、**P**（Processor / 逻辑处理器）三者协作的调度模型。

> [!tip] 面试回答
> Go 的 GMP 调度模型可以理解为：G 是待执行的 Goroutine，M 是真正执行代码的操作系统线程，P 是调度所需的逻辑处理器，M 必须拿到 P 才能运行 G。每个 P 都有本地运行队列，新建的 G 通常会优先进入本地队列；本地没有任务时，P 会从全局队列获取任务，或者通过工作窃取从其他 P 的本地队列拿走一部分 G，实现负载均衡。当 G 因 channel、锁或网络 I/O 阻塞时，它会被挂起，M 可以继续执行其他 G；当 G 进入阻塞式系统调用时，M 可能与 P 解绑，让 P 交给其他 M，避免执行资源被长期占用。另外，Go 1.2 开始支持基于函数调用安全点的协作式抢占，Go 1.14 又引入了基于信号的异步抢占，解决了没有函数调用的紧密循环难以及时让出 CPU 的问题，防止单个 G 长时间独占线程。总体来说，GMP 的目标是用少量 OS 线程高效调度大量 Goroutine，同时兼顾吞吐量、延迟和调度公平性。

---

## 目录

1. [前置背景：为什么需要调度器](#1-前置背景为什么需要调度器)
2. [核心概念：G、M、P 三元组](#2-核心概念gmp-三元组)
3. [数据结构源码剖析](#3-数据结构源码剖析)
4. [Goroutine 生命周期](#4-goroutine-生命周期)
5. [调度核心流程：schedule() 函数](#5-调度核心流程schedule-函数)
6. [调度策略](#6-调度策略)
7. [抢占式调度](#7-抢占式调度)
8. [系统调用处理](#8-系统调用处理)
9. [网络轮询器（Netpoller）](#9-网络轮询器netpoller)
10. [垃圾回收与调度](#10-垃圾回收与调度)
11. [特殊 Goroutine：g0 与 sysmon](#11-特殊-goroutineg0-与-sysmon)
12. [调试与可视化工具](#12-调试与可视化工具)
13. [总结](#13-总结)

---

## 1. 前置背景：为什么需要调度器

### 1.1 线程模型的困境

传统的 1:1 线程模型（一个用户线程对应一个内核线程）存在几个问题：

| 问题 | 说明 |
|------|------|
| **内存开销** | 每个内核线程约占用 1~8MB 栈空间 |
| **创建/销毁成本** | 内核线程的创建和销毁需要系统调用，开销大 |
| **上下文切换成本** | 内核态线程切换涉及寄存器、TLB 刷新等，延迟高 |
| **调度器全局锁** | 大量线程争抢全局 runqueue 会产生锁竞争 |

Go 的目标是支持**百万级并发**，1:1 线程模型显然不可行。

### 1.2 Go 的答案：M:N 调度

Go 实现了 **M:N 调度模型**：M 个 Goroutine 映射到 N 个 OS 线程上。

```
┌───────────────────────────────────────────────────┐
│                  Go Runtime Scheduler              │
│                                                   │
│   G₁  G₂  G₃  G₄  G₅  ...  Gₙ (百万 Goroutine)   │
│             ↓ (GMP 调度器)                         │
│   M₁ ← P₁    M₂ ← P₂    ...    Mₖ ← Pₖ            │
│             ↓ (OS 线程)                            │
│       CPU Core₁    CPU Core₂    ...  CPU Coreₖ     │
└───────────────────────────────────────────────────┘
```

- **G** 切换成本 ≈ 几十纳秒（仅切换几个寄存器 + 栈指针）
- **G** 初始栈仅 **2KB**，按需增长
- **G** 创建只需 `go` 关键字，极低成本

---

## 2. 核心概念：G、M、P 三元组

### 2.1 G — Goroutine

> **G 是 Go 调度器的基本调度单位**，代表一个 goroutine。

```
┌──────────────────────────┐
│         G (Goroutine)     │
├──────────────────────────┤
│  Stack (2KB ~ 1GB)       │  ← 执行栈，按需增长
│  sched (gobuf)           │  ← 调度上下文（SP/PC/BP）
│  atomicstatus            │  ← 状态：_Gidle/_Grunnable/_Grunning/_Gsyscall/_Gwaiting/_Gdead
│  goid                    │  ← 唯一 ID
│  m                       │  ← 当前绑定的 M（运行时）
│  lockedm                 │  ← 锁定到的 M（LockOSThread）
│  gopc                    │  ← 创建此 G 的 go 指令的 PC
│  waitreason              │  ← 等待原因（channel/select/sleep 等）
│  preempt                 │  ← 抢占标志
│  timer                   │  ← 关联的定时器
└──────────────────────────┘
```

**G 的状态转换**：

```
         ┌────────┐
         │ _Gidle │  ← 刚分配，未初始化
         └───┬────┘
             ↓
      ┌──────────┐
      │_Grunnable│  ← 在 P 的 runq 中等待调度
      └────┬─────┘
           ↓  (被 M 获取)
      ┌──────────┐
      │_Grunning │  ← 正在 M 上执行
      └────┬─────┘
     ┌─────┼──────────┐
     ↓     ↓           ↓
┌────────┐ ┌────────┐ ┌──────────┐
│_Gsyscall│ │_Gwaiting│ │_Gdead   │
│(系统调用)│ │(阻塞等待)│ │(已结束) │
└───┬────┘ └────┬────┘ └──────────┘
    ↓           ↓
 ┌──────┐   ┌───────┐
 │重新加入│   │被唤醒 │
 │runq   │   │→runq  │
 └──────┘   └───────┘
```

### 2.2 M — Machine（OS 线程）

> **M 是操作系统线程**，是真正执行计算资源的实体。

```
┌─────────────────────────────────┐
│         M (Machine)              │
├─────────────────────────────────┤
│  g0           ← 调度栈 Goroutine │
│  curg         ← 当前运行的 G    │
│  p            ← 绑定的 P        │
│  nextp        ← 暂存的 P（过渡态）│
│  spinning     ← 是否在自旋找 G  │
│  blocked      ← 是否阻塞        │
│  locks        ← 锁计数          │
│  mOS          ← OS 特定字段     │
│  schedlink    ← 调度器链表      │
└─────────────────────────────────┘
```

**M 的关键职责**：
- **执行 G**：每个 M 执行一个 G（通过 `curg` 字段）
- **陷入调度**：当 G 阻塞时，M 会释放 P，将当前 G 状态设为等待态
- **创建新 M**：当有空闲 P 而没有空闲 M 时，系统会创建新的 M

### 2.3 P — Processor（逻辑处理器）

> **P 是 G 和 M 之间的桥梁**，代表执行资源（类似 CPU 核心的抽象）。

```
┌──────────────────────────────────┐
│           P (Processor)           │
├──────────────────────────────────┤
│  id           ← P 的唯一 ID      │
│  m            ← 绑定的 M         │
│  status       ← _Pidle/_Prunning/│
│                 _Psyscall/_Pgcstop│
│               /_Pdead            │
│  runq [256]   ← 本地 runqueue   │
│  runqhead     ← runq 头部        │
│  runqtail     ← runq 尾部        │
│  runnext      ← 下一个优先运行的G│
│  gFree        ← 已完成的 G 列表  │
│  preempt      ← 是否被抢占       │
│  schedtick    ← 调度计数         │
│  syscalltick  ← 系统调用计数     │
│  timer0       ← 定时器堆         │
└──────────────────────────────────┘
```

**P 的数量**：默认等于 `runtime.GOMAXPROCS()`，通常 = CPU 核心数。

**P 的状态**：

```
_Pidle ──→ _Prunning ──→ _Psyscall
   ↑            │              │
   └────────────┴──────────────┘
              (回到)
         _Pgcstop (GC 时暂停)
         _Pdead   (P 死亡/不再使用)
```

---

## 3. 数据结构源码剖析

> 以下源码来自 Go 官方运行时 `src/runtime/runtime2.go`（Go 1.21+）。

### 3.1 G 结构体

```go
// src/runtime/runtime2.go

type g struct {
	// Stack parameters.
	stack       stack   // 描述当前栈的范围 [stack.lo, stack.hi)
	stackguard0 uintptr // 用于栈溢出检测，通常 stack.lo + StackGuard
	stackguard1 uintptr // 用于 C 代码中的栈溢出检测

	_panic       *_panic // 最内层的 panic
	_defer       *_defer // 最内层的 defer

	m            *m       // 当前绑定的 M；可能临时为空（如阻塞时）
	sched        gobuf    // 保存调度上下文
	syscallsp    uintptr  // 系统调用时的 SP（如果需要）
	syscallpc    uintptr  // 系统调用时的 PC
	stktopsp    uintptr  // 期望的栈顶，用于回溯检查
	param        unsafe.Pointer // 传递的参数（如 channel 发送的值、等待的结果）
	atomicstatus atomic.Uint32   // G 的状态
	stackLock    uint32          // 栈增长时的锁
	goid         uint64          // 全局唯一的 Goroutine ID
	schedlink    guintptr        // 链表指针，用于将 G 放入全局队列
	waitsince    int64           // G 进入等待状态的近似时间
	waitreason   waitReason      // 等待原因（如 channel、select、time.Sleep）

	preempt       bool          // 抢占信号（栈抢占）
	preemptStop   bool          // 抢占时是否转换到 _Gpreempted
	preemptShrink bool          // 在同步安全点进行抢占

	lockedm       muintptr      // LockOSThread 锁定的 M

	// ... 更多字段
}
```

### 3.2 M 结构体

```go
// src/runtime/runtime2.go

type m struct {
	g0      *g           // 拥有调度栈的 Goroutine
	morebuf gobuf        // gobuf 传给更高级别的调用
	divmod  uint32       // 除法/取模的分母

	// Fields not protected by anything
	procid        uint64        // 调试用的处理器 ID
	gsignal       *g            // 处理信号的 G
	goSigStack    gsignalStack  // 信号处理栈
	sigmask       sigset        // 信号掩码
	tls           [tlsSlots]uintptr // 线程本地存储
	mstartfn      func()        // M 启动时执行的函数
	curg          *g            // 当前正在运行的 G
	caughtsig     guintptr      // 捕获信号的 G 的指针
	p             puintptr      // 绑定的 P
	nextp         puintptr      // 将要绑定的 P
	oldp          puintptr      // 系统调用前的 P
	id            int64         // M 的唯一 ID
	mallocing     int32         // 是否正在分配内存
	throwing      throwType     // 是否正在 throw
	preemptoff    string        // 如果 != "" 则禁止抢占
	locks         int32         // 持有的锁计数
	dying         int32         // 是否正在退出
	profilehz     int32         // 性能分析的频率
	spinning      bool          // M 是否处于自旋状态（没有工作，正在找工作）
	blocked       bool          // M 是否阻塞（在 note 上）
	newSigstack   bool          // C 线程调用了 Go 的 sigaltstack
	printlock     int8          // 打印锁
	incgo         bool          // M 是否正在执行 cgo 调用
	isExtra       bool          // M 是否为一个 "extra" M（由 needm 创建）
	freeWait      atomic.Uint32
	needextram    bool
	traceback     uint8
	ncgocall      uint64     // cgo 调用总数
	ncgo          int32      // 当前 cgo 调用数量

	// ... 更多字段
}
```

### 3.3 P 结构体

```go
// src/runtime/runtime2.go

type p struct {
	id          int32
	status      uint32    // p 的状态: _Pidle, _Prunning, _Psyscall, _Pgcstop, _Pdead
	link        puintptr  // 下一个空闲 P
	m           muintptr  // 反向链接到关联的 M（如果有）
	mcache      *mcache   // 每个 P 的内存缓存
	pcache      pageCache // 每个 P 的页缓存
	deferpool   []*_defer // 可复用的 defer 结构池

	racectx     uintptr

	// G 的可运行队列，无锁访问
	runqhead uint32    // 队列头
	runqtail uint32    // 队列尾
	runq     [256]guintptr // 最多存 256 个 G（环形缓冲区）
	runnext  guintptr  // 下一个可运行的 G（高优先级）

	// 已完成的 G（这些 G 可以复用）
	gFree struct {
		gList
		n int32
	}

	// 调度器追踪
	sudogcache []*sudog   // sudog 缓存池
	sudogbuf   [128]*sudog

	// 用于性能分析
	palloc persistentAlloc

	timer0When        atomic.Int64
	timerModifiedEarliest atomic.Int64

	// GC 相关
	gcAssistTime         int64 // 协助 GC 的时间
	gcFractionalMarkTime int64 // 部分标记时间
	gcMarkWorkerMode     gcMarkWorkerMode
	gcMarkWorkerStartTime int64

	// ... 更多字段
}
```

### 3.4 调度上下文 gobuf

```go
// src/runtime/runtime2.go

type gobuf struct {
	sp   uintptr  // 栈指针 (Stack Pointer)
	pc   uintptr  // 程序计数器 (Program Counter)
	g    guintptr // 持有 gobuf 的 G
	ctxt unsafe.Pointer // 闭包的上下文
	ret  uintptr  // 系统调用的返回值
	lr   uintptr  // 链接寄存器 (ARM)
	bp   uintptr  // 基址指针 (x86 frame pointer)
}
```

**gobuf 是调度的核心**：当 G 被切换出去时，CPU 寄存器的关键值保存在 `gobuf` 中；当下次被调度时，从 `gobuf` 恢复这些寄存器。

### 3.5 全局调度器 schedt

```go
// src/runtime/runtime2.go

type schedt struct {
	goidgen   atomic.Uint64  // 全局 G ID 生成器
	lastpoll  atomic.Int64   // 上次轮询网络的时间

	lock mutex  // 全局调度器锁

	midle        muintptr    // 空闲 M 链表
	nmidle       int32       // 空闲 M 数量
	nmidlelocked int32       // 锁定的空闲 M 数量
	mnext        int64       // 下一个 M 的 ID
	maxmcount    int32       // M 的最大数量限制
	nM sys32                 // 死掉的 M 数量

	pidle        puintptr    // 空闲 P 链表
	npidle       atomic.Int32 // 空闲 P 数量

	// 全局可运行 G 队列
	runq     gQueue    // 全局 run queue
	runqsize int32     // 全局 run queue 大小

	// 全局已死 G 的缓存
	gFree struct {
		lock    mutex
		stack   gList  // 包含栈的 G
		noStack gList  // 不包含栈的 G
		n       int32
	}

	// 等待释放的 M
	mfreedefer struct {
		lock  mutex
		stack gList
	}

	// sysmon 触发的 GC 次数
	ngsys atomic.Int32

	// 调度器终止标志
	schedtick atomic.Int64
}
```

---

## 4. Goroutine 生命周期

### 4.1 创建 Goroutine

```go
// src/runtime/proc.go

// Create a new g running fn.
// Put it on the queue of g's waiting to run.
// The compiler turns a go statement into a call to this.
func newproc(fn *funcval) {
	gp := getg()            // 获取当前 G
	pc := getcallerpc()     // 获取调用者的 PC（即 "go" 语句的地址）
	systemstack(func() {    // 切换到 g0 栈执行
		newg := newproc1(fn, gp, pc)

		pp := getg().m.p.ptr()
		runqput(pp, newg, true) // 将新 G 放入 P 的本地队列

		if mainStarted {
			wakep()            // 唤醒一个空闲的 P 或创建新的 M
		}
	})
}
```

**核心流程**：
1. 获取当前 G 和调用者的 PC
2. 切换到 **g0 栈**执行（因为调度器操作必须在系统栈上进行）
3. `newproc1` 实际创建 G 并初始化
4. 将新 G 放入**当前 P 的本地队列**
5. 如果可能，唤醒一个空闲的 P/M 来执行

### 4.2 newproc1 — 真正的创建逻辑

```go
// src/runtime/proc.go

func newproc1(fn *funcval, callergp *g, callerpc uintptr) *g {
	// ... 省略错误处理

	_g_ := getg()
	acquirem()                // 禁止被抢占
	pp := _g_.m.p.ptr()

	// 尝试从 P 的 gFree 列表获取一个已死亡的 G 来复用
	newg := gfget(pp)
	if newg == nil {
		// 创建一个新的 G，分配 2KB 栈
		newg = malg(_StackMin) // _StackMin = 2048
		casgstatus(newg, _Gidle, _Gdead)
		allgadd(newg)
	}

	// 初始化 G 的栈
	totalSize := uintptr(4*goarch.PtrSize + sys.MinFrameSize)
	totalSize += -totalSize & (sys.SpAlign - 1)
	sp := newg.stack.hi - totalSize
	spArg := sp

	// 设置退出函数（确保 goroutine 结束时清理）
	memclrNoHeapPointers(unsafe.Pointer(&newg.sched), unsafe.Sizeof(newg.sched))
	newg.sched.sp = sp
	newg.stktopsp = sp
	newg.sched.pc = abi.FuncPCABI0(goexit)     // 设置为 goexit 使 G 能退出
	newg.sched.g = guintptr(unsafe.Pointer(newg))
	gostartcallfn(&newg.sched, fn)               // 将 fn 压入栈帧
	newg.gopc = callerpc
	newg.startpc = fn.fn
	casgstatus(newg, _Gdead, _Grunnable)

	// 分配 goid
	if pp.goidcache == pp.goidcacheend {
		pp.goidcache = sched.goidgen.Add(64)
		pp.goidcacheend = pp.goidcache + 64
	}
	newg.goid = pp.goidcache
	pp.goidcache++

	releasem(_g_.m)
	return newg
}
```

关键点：
- G 初始栈大小为 **2048 字节（2KB）**
- 尽量从 P 的 `gFree` 列表中**复用**已死亡的 G
- 设置 `sched.pc = abi.FuncPCABI0(goexit)` 确保 G 的函数返回后能正确退出
- 初始状态设为 `_Grunnable`

---

## 5. 调度核心流程：schedule() 函数

> `schedule()` 是整个调度器的**心脏**。它的核心逻辑是：找一个可运行的 G，然后执行它。

### 5.1 完整源码

```go
// src/runtime/proc.go

// One round of scheduler: find a runnable goroutine and execute it.
// Never returns.
func schedule() {
	mp := getg().m

	if mp.locks != 0 {
		throw("schedule: holding locks")
	}

	if mp.lockedg != 0 {
		stoplockedm()
		execute(mp.lockedg.ptr(), false) // Never returns.
	}

	// We should not schedule away from a g that is executing a cgo call,
	// since the cgo call is using the m's g0 stack.
	if mp.incgo {
		throw("schedule: in cgo")
	}

top:
	pp := mp.p.ptr()
	pp.preempt = false

	// Safety check: 如果有 GC 等待则不应该调度
	if gcBlackenEnabled != 0 {
		gcBlackenEnabled = 0
	}

	// 定时器检查：检查第一个定时器是否到期
	checkTimers(pp, 0)

	var gp *g

	// ======== 步骤 1: 每 61 次调度，从全局队列取一个 G ========
	// 这个机制确保全局队列中的 G 不会被饿死
	if pp.schedtick%61 == 0 && sched.runqsize > 0 {
		lock(&sched.lock)
		gp = globrunqget(pp, 1) // 从全局队列拿 1 个 G
		unlock(&sched.lock)
	}

	// ======== 步骤 2: 从本地队列获取 ========
	if gp == nil {
		gp, inheritTime = runqget(pp)
	}

	// ======== 步骤 3: 从别处找可运行的 G ========
	if gp == nil {
		gp, inheritTime = findRunnable() // blocks until work is available
	}

	// ======== 步骤 4: 执行找到的 G ========
	// 这个函数永不返回（它会通过 mcall 切回 schedule）
	execute(gp, inheritTime)
}
```

### 5.2 调度流程图

```
schedule()
    │
    ├── 是否有锁定的 G？──→ execute(lockedg)
    │
    ├── 步骤 1: schedtick%61==0? ──→ 从全局队列取 G
    │                    ↓ (拿到 G) → execute(gp)
    │
    ├── 步骤 2: runqget(pp) ──→ 从本地队列取 G
    │              ↓ (拿到 G) → execute(gp)
    │
    ├── 步骤 3: findRunnable()
    │         │
    │         ├── 再检查本地队列
    │         ├── 再检查全局队列
    │         ├── 检查网络轮询器 (netpoll)
    │         ├── 工作窃取 (work stealing)
    │         │       └── 从其他 P 偷一半 G
    │         ├── 检查就绪的定时器
    │         │
    │         └── 实在找不到 → stopm() (M 休眠)
    │
    └── 步骤 4: execute(gp)
              │
              └── gogo(&gp.sched) → 汇编恢复寄存器，跳转到 G 的代码
```

### 5.3 findRunnable() — 从哪里找 G

```go
// src/runtime/proc.go

// Finds a runnable goroutine to execute.
// Tries to steal from other P's, get from global queue, poll network.
func findRunnable() (gp *g, inheritTime bool) {
	mp := getg().m

top:
	pp := mp.p.ptr()

	// 检查 GC 是否在等待
	if sched.gcwaiting.Load() {
		gcstopm()
		goto top
	}

	// 检查定时器
	now, pollUntil, changed := checkTimers(pp, 0)

	// 1. 检查本地 runq
	if gp, inheritTime := runqget(pp); gp != nil {
		return gp, inheritTime
	}

	// 2. 检查全局 runq
	if sched.runqsize != 0 {
		lock(&sched.lock)
		gp := globrunqget(pp, 0) // 获取一批 G（最多 n = sched.runqsize/gomaxprocs + 1）
		unlock(&sched.lock)
		if gp != nil {
			return gp, false
		}
	}

	// 3. 非阻塞地轮询网络
	if netpollinited() && netpollAnyWaiters() {
		if list := netpoll(0); !list.empty() {
			gp := list.pop()
			injectglist(&list) // 将剩余的 G 放入全局队列
			casgstatus(gp, _Gwaiting, _Grunnable)
			return gp, false
		}
	}

	// 4. 工作窃取：尝试从其他 P 偷一半可运行的 G
	//    (4 次尝试，每次从随机 P 偷)
	if mp.spinning {
		mp.spinning = false
	}
	procs := gomaxprocs
	if procs > 1 {
		for i := 0; i < int(procs); i++ {
			pp := allp[cheaprand()%procs]
			if pp == nil || pp == _p_ {
				continue
			}
			//
			// Steal half of pp's run queue.
			//
			if gp := runqsteal(_p_, pp, stealRunNextG); gp != nil {
				return gp, true
			}
		}
	}

	// ... 后续：再次检查各种来源，包括阻塞等待的 netpoll
	// 如果多次尝试都找不到，最终 stopm() 休眠 M
	stopm()
	goto top
}
```

---

## 6. 调度策略

### 6.1 本地队列优先

每个 P 有自己的 **runq[256]**（环形缓冲区），存取无锁。新创建的 G 优先放入本地队列。

```go
// src/runtime/proc.go

// runqput 将 G 放入 P 的本地队列
func runqput(pp *p, gp *g, next bool) {
	if randomizeScheduler && next && fastrandn(2) == 0 {
		next = false
	}

	if next {
		// 如果 runnext 为空，直接放入 runnext（高优先级）
		oldnext := pp.runnext
		if !pp.runnext.cas(oldnext, guintptr(unsafe.Pointer(gp))) {
			goto retryNext
		}
		if oldnext == 0 {
			return
		}
		// 原来的 runnext 放入队列
		gp = oldnext.ptr()
	}

retry:
	h := atomic.LoadAcq(&pp.runqhead)
	t := pp.runqtail
	if t-h < uint32(len(pp.runq)) {
		// 队列未满，直接放入
		pp.runq[t%uint32(len(pp.runq))].set(gp)
		atomic.StoreRel(&pp.runqtail, t+1)
		return
	}
	// 本地队列满了，将一半放入全局队列
	if runqputslow(pp, gp) {
		return
	}
	goto retry
}
```

**流程**：
1. 如果 `next=true`（新创建的 G），放入 `runnext` 插槽（最高优先级）
2. 如果队列未满，直接追加到尾部
3. 如果队列已满，调用 `runqputslow` 将**本地队列的一半 + gp** 批量迁移到全局队列

### 6.2 runqget — 从本地队列取 G

```go
// src/runtime/proc.go

func runqget(pp *p) (gp *g, inheritTime bool) {
	// 优先获取 runnext（高优先级）
	for {
		next := pp.runnext
		if next == 0 {
			break
		}
		if pp.runnext.cas(next, 0) {
			return next.ptr(), true
		}
	}

	// 从 runq 头部取
	for {
		h := atomic.LoadAcq(&pp.runqhead)
		t := pp.runqtail
		if t == h {
			return nil, false
		}
		gp := pp.runq[h%uint32(len(pp.runq))].ptr()
		if atomic.CasRel(&pp.runqhead, h, h+1) {
			return gp, false
		}
	}
}
```

**优先级**：`runnext > runq[head]`

### 6.3 工作窃取（Work Stealing）

> Go 调度器最经典的调度策略。当一个 P 的本地队列为空时，它会尝试从**其他 P** 偷一半可运行的 G。

```go
// src/runtime/proc.go

// Steal half of items from runq of p2 and put onto runq of p.
// Returns the stolen goroutine, which may be nil.
func runqsteal(pp, p2 *p, stealRunNextG bool) *g {
	t := pp.runqtail
	n := runqgrab(p2, &pp.runq, t, stealRunNextG)
	if n == 0 {
		return nil
	}
	// 返还一个 G 给自己
	n--
	gp := pp.runq[(t+n)%uint32(len(pp.runq))].ptr()
	if n == 0 {
		return gp
	}
	h := atomic.LoadAcq(&pp.runqhead)
	if t-h+n >= uint32(len(pp.runq)) {
		throw("runqsteal: runq overflow")
	}
	atomic.StoreRel(&pp.runqtail, t+n)
	return gp
}

// runqgrab 从 p2 的队列中抓取一批 G
func runqgrab(pp *p, batch *[256]guintptr, batchHead uint32, stealRunNextG bool) uint32 {
	for {
		h := atomic.LoadAcq(&pp.runqhead)
		t := atomic.LoadAcq(&pp.runqtail)
		n := t - h                // 队列中 G 的数量
		n = n - n/2               // 取一半
		if n == 0 {
			return 0
		}
		// 将 G 从 p2 复制到 batch
		for i := uint32(0); i < n; i++ {
			g := pp.runq[(h+i)%uint32(len(pp.runq))].ptr()
			batch[(batchHead+i)%uint32(len(batch))].set(g)
		}
		if atomic.CasRel(&pp.runqhead, h, h+n) {
			return n
		}
	}
}
```

**窃取顺序**（在 `findRunnable` 中）：
1. 先尝试从 `runnext` 偷
2. 再偷 `runq` 的一半

### 6.4 全局队列平衡

```go
// src/runtime/proc.go

// 每 61 次调度，强制从全局队列取一次
if pp.schedtick%61 == 0 && sched.runqsize > 0 {
	lock(&sched.lock)
	gp = globrunqget(pp, 1) // 取 1 个
	unlock(&sched.lock)
}
```

为什么是 **61**？
- 这是一个质数，避免与常见的周期性模式重叠
- 需要在"让本地队列优先"和"不让全局队列饿死"之间平衡
- 经验值，经过大量测试调优

### 6.5 旋转线程（Spinning）

```go
// src/runtime/proc.go

// 当自旋的 M 在找工作时，它不释放 P
// 这样当真正的 G 到来时能立即执行，避免 M 唤醒的延迟

func stopm() {
	_g_ := getg()

	if _g_.m.spinning {
		_g_.m.spinning = false
		nmspinning := sched.nmspinning.Add(-1)
		// ...
	}
	lock(&sched.lock)
	mput(_g_.m)    // 将 M 放入空闲列表
	unlock(&sched.lock)
	mPark()
	// ... 被唤醒后继续执行
}
```

**自旋的约束**：
- 最多 `GOMAXPROCS` 个 M 同时自旋
- 自旋的 M 占用 CPU 但不持有 P
- 自旋的主要目的是**减少调度延迟**

---

## 7. 抢占式调度

### 7.1 协作式抢占（Go 1.13 及之前）

```go
// 在函数序言中插入栈检查，超过 stackguard0 则触发 morestack
// morestack 中会调用 schedule()

// 编译器在每个函数调用前生成类似这样的代码：
//   CMP SP, g.stackguard0
//   JLS morestack
```

局限性：如果在**没有函数调用的紧循环**中，永远不会检查 `stackguard0`，导致无法抢占（例如 `for { i++ }`）。

### 7.2 基于信号的异步抢占（Go 1.14+）

```go
// src/runtime/signal_unix.go

// doSigPreempt 处理通过信号发送的抢占请求
func doSigPreempt(gp *g, ctxt *sigctxt) {
	// 检查 G 是否可以被安全地抢占
	if wantAsyncPreempt(gp) {
		if ok, newpc := isAsyncSafePoint(gp, ctxt.pc(), ctxt.sp(), ctxt.lr()); ok {
			// 调整 PC 使其进入 asyncPreempt
			ctxt.pushCall(abi.FuncPCABI0(asyncPreempt), newpc)
		}
	}
}
```

```go
// src/runtime/preempt.go

// isAsyncSafePoint 检查当前代码位置是否可以作为异步抢占的安全点
// 安全点要求：
// - 不在编译器的写屏障中
// - 不在运行时关键区域
// - 不在系统调用中
func isAsyncSafePoint(gp *g, pc, sp, lr uintptr) (bool, uintptr) {
	// ... 安全检查
	return true, pc
}
```

**基于信号的抢占流程**：

```
sysmon 线程
    │
    ├── 检测到 P 运行同一 G 超过 10ms
    │
    ├── 发送 SIGURG 信号给对应的 M
    │
    └── M 收到信号
          │
          ├── 信号处理函数检查安全点
          │     ├── 安全 → 修改 PC 跳转到 asyncPreempt
          │     │         → mcall → gopreempt_m → goschedImpl → schedule()
          │     └── 不安全 → 标记 preempt，等待下一个安全点
          │
          └── G 被切换出去，让出 CPU
```

```go
// src/runtime/proc.go

// asyncPreempt 由信号处理函数跳转进入
// 功能：保存现场，切换到 g0，调用 schedule
func asyncPreempt() {
	// 由汇编实现，在 runtime/asm_amd64.s
	// 核心：保存当前 G 的寄存器 → 设置 preemptStop/preempt → mcall(gopreempt_m)
}
```

---

## 8. 系统调用处理

### 8.1 进入系统调用

```go
// src/runtime/proc.go

// reentersyscall 在进入系统调用前调用
func reentersyscall(pc, sp uintptr) {
	_g_ := getg()

	// 禁止抢占
	_g_.m.locks++

	// 保存调度上下文
	_g_.syscallsp = sp
	_g_.syscallpc = pc
	casgstatus(_g_, _Grunning, _Gsyscall)

	// P 的状态转换
	pp := _g_.m.p.ptr()
	pp.m = 0                           // 解绑 M
	pp.oldm = _g_.m                    // 记录旧的 M（用于快速恢复）
	atomic.Store(&pp.status, _Psyscall)

	_g_.m.locks--
}
```

**关键操作**：
- G 状态：`_Grunning` → `_Gsyscall`
- **P 与 M 解绑**（因为系统调用可能阻塞很久）
- P 可以被**其他 M** 接管（通过 handoffp）

### 8.2 Hand Off（交接）

```go
// src/runtime/proc.go

// 当进入阻塞式系统调用时调用，将 P 转交给其他 M
func entersyscallblock() {
	_g_ := getg()

	_g_.m.locks++
	_g_.syscallsp = _g_.sched.sp
	_g_.syscallpc = _g_.sched.pc
	casgstatus(_g_, _Grunning, _Gsyscall)

	systemstack(func() {
		entersyscallblock_handoff(_g_.syscallsp, _g_.syscallpc)
	})

	_g_.m.locks--
}

func entersyscallblock_handoff(sp, pc uintptr) {
	_g_ := getg()
	pp := _g_.m.p.ptr()
	pp.m = 0
	_g_.m.oldp.set(pp)
	_g_.m.p = 0
	atomic.Store(&pp.status, _Psyscall)

	// 将 P 交给其他能用的 M
	handoffp(pp)
}
```

```go
// src/runtime/proc.go

func handoffp(pp *p) {
	// 1. 如果本地队列或全局队列中有可运行的 G，直接启动一个 M
	if !runqempty(pp) || sched.runqsize != 0 {
		startm(pp, false, false)
		return
	}

	// 2. 如果有自旋的 M，它会把 P 捡起来
	if sched.nmspinning.Load()+sched.npidle.Load() == 0 &&
		sched.nmspinning.CompareAndSwap(0, 1) {
		startm(pp, true, false)
		return
	}

	// 3. 否则把 P 放入全局空闲列表
	lock(&sched.lock)
	pidleput(pp, 0)
	unlock(&sched.lock)
}
```

### 8.3 退出系统调用

```go
// src/runtime/proc.go

func exitsyscall() {
	_g_ := getg()

	// 尝试快速路径：重新绑定原来的 P
	oldp := _g_.m.oldp.ptr()
	_g_.m.oldp = 0
	if exitsyscallfast(oldp) {
		// 成功！恢复执行
		casgstatus(_g_, _Gsyscall, _Grunning)
		return
	}

	// 慢速路径：需要重新获取 P
	mcall(exitsyscall0) // 切换到 g0 栈执行
}

func exitsyscallfast(oldp *p) bool {
	// 快速路径：如果原来的 P 仍然空闲且状态是 _Psyscall
	if oldp != nil && oldp.status == _Psyscall &&
		oldp.runqhead == oldp.runqtail &&
		atomic.Cas(&oldp.status, _Psyscall, _Pidle) {
		// 重新绑定
		wirep(oldp)
		exitsyscallfast_reacquired(oldp)
		return true
	}
	return false
}

func exitsyscall0(gp *g) {
	casgstatus(gp, _Gsyscall, _Grunnable)

	// 获取一个空闲 P
	pp, _ := pidleget(0)
	if pp == nil {
		// 没有空闲 P，将 G 放入全局队列
		globrunqput(gp)
		stopm()
	}

	// 有 P，绑定并继续调度
	acquirep(pp)
	execute(gp, false)
}
```

**完整系统调用流程**：

```
G                         M                         P
│                         │                         │
├─ entersyscall ──────────┤                         │
│  (G→_Gsyscall)          │                         │
│                         ├─ handoffp ─────────────→│
│                         │  (M 解绑 P)             │ (P→_Psyscall)
│                         │                         │
│                         │                         ├── 有 runq? → startm
│                         │                         ├── 有自旋 M? → 被捡起
│                         │                         └── 都没有 → pidleput
│                         │                         │
├── 系统调用完成 ─────────┤                         │
│                         │                         │
├─ exitsyscallfast ───────┤                         │
│  (尝试重新绑定 oldp)    │  ← 快速路径成功           │
│                         │                         │
│  OR                     │                         │
│                         │                         │
├─ exitsyscall0 ──────────┤                         │
│  (G→_Grunnable)        │                         │
│  (获取新 P)            │                         │
│  execute(gp) ───────────┤                         │
```

---

## 9. 网络轮询器（Netpoller）

### 9.1 概述

Go 使用 **epoll/kqueue/IOCP** 实现异步网络 I/O。当 G 在网络 I/O 上阻塞时，会被置于网络轮询器中，不占用 M。

```go
// src/runtime/netpoll.go

// netpoll 检查网络连接的就绪情况
// mode: 0 = 非阻塞，1 = 阻塞直到有就绪的连接
func netpoll(mode int32) gList {
	pollUntil := int64(-1)
	if mode != 0 {
		pollUntil = 0
	}

	// 调用平台特定的轮询
	events, delta := netpollcheck(0, pollUntil)
	if len(events) == 0 {
		return gList{}
	}

	// 将就绪的 G 从等待态转为可运行态
	var toRun gList
	for i := range events {
		ev := &events[i]
		gp := ev.g()
		netpollready(&toRun, gp, ev.mode)
	}
	return toRun
}
```

### 9.2 Netpoller 在调度中的位置

在 `findRunnable()` 中：

```go
// 非阻塞快速检查
if netpollinited() && netpollAnyWaiters() {
	if list := netpoll(0); !list.empty() {
		gp := list.pop()
		injectglist(&list)     // 其余 G 放到全局队列
		casgstatus(gp, _Gwaiting, _Grunnable)
		return gp, false
	}
}
```

当所有 M 都找不到可运行的 G 时：

```go
// 阻塞等待网络事件
if netpollinited() && (netpollAnyWaiters() || pollUntil != 0) {
	list := netpoll(pollUntil - now)
	// ...
}
```

### 9.3 完整 netpoller 时序

```
G1: conn.Read()
    │
    ├── fd.Register() ──→ netpoll 注册 fd
    │
    ├── gopark() ──→ G1 → _Gwaiting, 放入 netpoll 等待列表
    │               M 继续执行其他 G
    │
    │   ... (时间流逝，M 执行 G2, G3...) ...
    │
    ├── netpoll() 检测到 fd 就绪
    │         │
    │         ├── netpollready(G1)
    │         │
    │         └── G1 → _Grunnable → runq
    │
    └── G1 被调度 → Read 返回数据
```

---

## 10. 垃圾回收与调度

### 10.1 GC 状态与 P

```go
// GC 的 STW (Stop The World) 需要所有 P 进入 _Pgcstop 状态

func gcstopm() {
	_g_ := getg()
	pp := _g_.m.p.ptr()
	pp.status = _Pgcstop
	// ... M 被暂停，等待 GC 完成
}
```

### 10.2 GC Mark Assist

```go
// 当 G 分配内存时，如果发现 GC 标记落后于分配速度
// 该 G 会被要求协助标记（"mark assist"）

func gcAssistAlloc(gp *g) {
	// 计算需要协助的工作量
	assistWork := gp.gcAssistBytes.Load()
	// 执行标记工作...
	// 然后才能继续分配
}
```

---

## 11. 特殊 Goroutine：g0 与 sysmon

### 11.1 g0 — 每个 M 的调度栈

> 每个 M 都有一个特殊的 goroutine **g0**，它运行在**系统栈**上，负责调度逻辑。

```go
// 为什么需要 g0？
// 普通 G 的栈可能很小（2KB），但调度逻辑可能需要较大的栈空间
// g0 有较大的栈（~8KB 起），专门用于执行调度、GC 等运行时逻辑

// 切换到 g0 栈
func systemstack(fn func()) {
	gp := getg()
	mp := gp.m
	if gp == mp.g0 {
		fn()
		return
	}
	// 保存当前 G 的上下文，切换到 g0
	mcall(func(gp *g) {
		fn()
	})
}
```

**g0 的栈更大且不可抢占**，确保调度逻辑不会因为栈溢出或抢占而中断。

### 11.2 sysmon — 系统监控线程

```go
// src/runtime/proc.go

// sysmon 是一个独立的 M（不需要 P），用于系统监控
func sysmon() {
	// 运行在一个死循环中
	for {
		// 如果已有 50µs 空闲，则无需 P
		usleep(delay)

		// === 1. 抢占长时间运行的 G ===
		if preemptlongrunning(delay) {
			// 检查是否有 P 运行同一 G 超过 10ms
			preemptone(pp)  // 发送信号抢占
		}

		// === 2. 网络轮询 ===
		lastpoll := sched.lastpoll.Load()
		if netpollinited() && lastpoll != 0 && lastpoll+10*1000*1000 < now {
			list := netpoll(0) // 非阻塞轮询
			// 将就绪的 G 放入全局队列
			injectglist(&list)
		}

		// === 3. 抢夺阻塞在系统调用上的 P ===
		if retake(now) != 0 {
			// ...
		}

		// === 4. 触发 GC ===
		if gcShouldStart() {
			// ...
		}
	}
}
```

**sysmon 的关键职责**：

| 职责 | 说明 | 检测周期 |
|------|------|----------|
| **抢占** | 检测运行超过 10ms 的 G，发送信号抢占 | ~20µs |
| **网络轮询** | 将就绪的网络连接对应的 G 激活 | ~10ms |
| **P 抢夺** | 抢回被长时间系统调用占用的 P | ~20µs |
| **GC 触发** | 检查是否应该启动 GC | ~2min |
| **定时器** | 处理就绪的定时器 | 持续 |

### 11.3 retake — 抢夺阻塞的 P

```go
// src/runtime/proc.go

func retake(now int64) uint32 {
	n := 0
	// 防止 allp 被改变
	lock(&allpLock)
	for i := 0; i < len(allp); i++ {
		pp := allp[i]
		if pp == nil {
			continue
		}
		pd := &pp.sysmontick
		s := pp.status

		if s == _Prunning || s == _Psyscall {
			// Preempt G if it's running for too long.
			t := int64(pp.schedtick) // 调度计数
			if int64(pd.schedtick) != t {
				pd.schedtick = uint32(t)
				pd.schedwhen = now
			} else if pd.schedwhen+forcePreemptNS <= now {
				preemptone(pp)
			}
		}

		if s == _Psyscall {
			// Retake P from syscall if it's been there for too long.
			t := int64(pp.syscalltick)
			if pd.syscalltick != t {
				pd.syscalltick = uint32(t)
				pd.syscallwhen = now
				continue
			}
			// 如果 runq 中有工作或全局队列不为空，且已经过了一段时间
			if runqempty(pp) &&
				atomic.Load(&sched.npidle) > 0 &&
				pd.syscallwhen+10*1000*1000 <= now {
				handoffp(pp)
			}
		}
	}
	unlock(&allpLock)
	return uint32(n)
}
```

---

## 12. 调试与可视化工具

### 12.1 GODEBUG 环境变量

```bash
# 启用调度器追踪
GODEBUG=schedtrace=1000 ./your-program

# 输出示例：
# SCHED 0ms: gomaxprocs=8 idleprocs=6 threads=5 spinningthreads=1
#            idlethreads=3 runqueue=0 [0 0 0 0 0 0 0 0]
```

```bash
# 详细调度信息
GODEBUG=scheddetail=1,schedtrace=1000 ./your-program

# 输出包括每个 P 的状态、每个 M 的状态
```

### 12.2 runtime/trace

```go
package main

import (
	"os"
	"runtime/trace"
)

func main() {
	f, _ := os.Create("trace.out")
	defer f.Close()

	trace.Start(f)
	defer trace.Stop()

	// ... 你的程序
}
```

```bash
# 可视化
go tool trace trace.out
```

### 12.3 获取调度统计

```go
package main

import (
	"fmt"
	"runtime"
	"runtime/debug"
)

func main() {
	// 获取 GOMAXPROCS
	fmt.Println("GOMAXPROCS:", runtime.GOMAXPROCS(0))

	// 获取当前 Goroutine 数量
	fmt.Println("NumGoroutine:", runtime.NumGoroutine())

	// 获取操作系统线程数
	debug.SetMaxThreads(10000)
	fmt.Println("NumCPU:", runtime.NumCPU())

	// 获取内存统计
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	fmt.Printf("Alloc = %v MB\n", m.Alloc/1024/1024)

	// 手动触发 GC
	runtime.GC()

	// 让出处理器
	runtime.Gosched()

	// 锁定当前 G 到当前 OS 线程
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
}
```

### 12.4 pprof 分析调度性能

```bash
# 采集 CPU profile
go tool pprof http://localhost:6060/debug/pprof/profile

# 采集阻塞 profile
go tool pprof http://localhost:6060/debug/pprof/block

# 采集 mutex 竞争
go tool pprof http://localhost:6060/debug/pprof/mutex

# 采集 goroutine 堆栈
go tool pprof http://localhost:6060/debug/pprof/goroutine
```

---

## 13. 总结

### 13.1 GMP 调度模型的精华

```
┌─────────────────────────────────────────────────────────────┐
│                      GMP 调度器总览                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   全局队列 (Global Run Queue)                               │
│   ┌───┬───┬───┬───┬───┐                                    │
│   │ G │ G │ G │ G │ G │...                                  │
│   └───┴───┴───┴───┴───┘                                    │
│                    │ (全局队列负载均衡)                       │
│       ┌────────────┼────────────┐                           │
│       ↓            ↓            ↓                           │
│   ┌───────┐   ┌───────┐   ┌───────┐                        │
│   │  P₀   │   │  P₁   │   │  P₂   │                        │
│   │ runq  │   │ runq  │   │ runq  │  ← 本地队列（无锁）      │
│   │[G][G] │   │[G][G] │   │[G][G] │                        │
│   │       │   │       │   │       │                        │
│   │  M₀ ←─┤   │  M₁ ←─┤   │  M₂ ←─┤  ← OS 线程             │
│   └───┬───┘   └───┬───┘   └───┬───┘                        │
│       │            │            │                           │
│   ┌───┴───┐   ┌───┴───┐   ┌───┴───┐                        │
│   │CPU Core│   │CPU Core│   │CPU Core│                      │
│   └───────┘   └───────┘   └───────┘                        │
│                                                             │
│   网络轮询器 ←── G 在 net I/O 上阻塞时挂载                   │
│   sysmon     ←── 独立线程，不绑定 P                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 13.2 关键设计原则

| 原则 | 说明 |
|------|------|
| **本地化优先** | G 优先在本地 P 的 runq 中调度，减少锁竞争 |
| **工作窃取** | 空闲的 P 从忙碌的 P 偷取 G，实现负载均衡 |
| **Hand Off** | 系统调用时 P 与 M 分离，P 继续为其他 G 服务 |
| **减少阻塞** | 网络 I/O 使用 netpoller 异步处理，不阻塞 M |
| **抢占调度** | 10ms 抢占阈值，避免单一 G 独占 CPU |
| **自旋线程** | M 自旋等待工作，减少线程创建/唤醒开销 |
| **G 复用** | 使用 gFree 缓存池复用已死亡的 G，减少内存分配 |

### 13.3 调度相关的核心文件

| 文件 | 内容 |
|------|------|
| `src/runtime/runtime2.go` | G、M、P 结构体定义 |
| `src/runtime/proc.go` | 调度器核心逻辑（`schedule`, `findRunnable`, `newproc` 等） |
| `src/runtime/netpoll.go` | 网络轮询器 |
| `src/runtime/preempt.go` | 抢占逻辑 |
| `src/runtime/signal_unix.go` | 基于信号的抢占实现（Unix） |
| `src/runtime/stack.go` | 栈管理与扩缩容 |
| `src/runtime/asm_amd64.s` | 汇编实现（gogo, mcall, morestack 等） |

### 13.4 进一步阅读

- [Go 调度器官方设计文档](https://golang.org/s/go11sched)
- Go 并发编程
- Go 内存模型
- Go GC 机制

---

*本文档基于 Go 1.21+ 源码编写，源码片段取自 `src/runtime/runtime2.go` 和 `src/runtime/proc.go`。*
