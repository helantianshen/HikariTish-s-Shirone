---
title: MySQL 日志与调优
published: 2026-05-27
description: 串联 Undo、Redo、Binlog 和慢查询日志的作用，说明事务恢复、复制与性能排查的关键路径。
tags:
  - mysql
  - 日志
  - 底层原理
category: Mysql
pinned: false
draft: false
comment: true
lang: zh_CN
---

> MySQL InnoDB 依赖三大日志协同工作：**Undo Log** 负责回滚和 MVCC 旧版本，**Redo Log** 负责崩溃恢复与持久性，**Binlog** 负责主从复制与数据归档。三者的核心矛盾——Redo Log 与 Binlog 的一致性——通过 **两阶段提交（2PC）** 解决。理解 2PC 的执行流程和宕机自救机制，是面试中区别于"背八股"和"真正懂原理"的分水岭。

---

## 目录

1. [三大日志全景概览](#1-三大日志全景概览)
2. [Undo Log：回滚与 MVCC 的基石](#2-undo-log回滚与-mvcc-的基石)
   - [2.1 核心作用](#21-核心作用)
   - [2.2 存储结构](#22-存储结构)
   - [2.3 生命周期与 Purge](#23-生命周期与-purge)
3. [Redo Log：崩溃恢复的保障](#3-redo-log崩溃恢复的保障)
   - [3.1 核心作用与 WAL](#31-核心作用与-wal)
   - [3.2 循环写结构](#32-循环写结构)
   - [3.3 刷盘策略](#33-刷盘策略)
4. [Binlog：主从复制的命脉](#4-binlog主从复制的命脉)
   - [4.1 核心作用](#41-核心作用)
   - [4.2 三种格式](#42-三种格式)
   - [4.3 sync_binlog 参数](#43-sync_binlog-参数)
5. [Undo Log / Redo Log / Binlog 全面对比](#5-undo-log--redo-log--binlog-全面对比)
   - [5.1 多维度对比表](#51-多维度对比表)
   - [5.2 缺一不可的原因](#52-缺一不可的原因)
6. [两阶段提交 (2PC)](#6-两阶段提交-2pc)
   - [6.1 为什么需要 2PC](#61-为什么需要-2pc)
   - [6.2 2PC 执行过程](#62-2pc-执行过程)
   - [6.3 数据不一致的后果](#63-数据不一致的后果)
7. [宕机重启时 2PC 如何自救](#7-宕机重启时-2pc-如何自救)
   - [7.1 场景一：宕机发生在写 Binlog 之前](#71-场景一宕机发生在写-binlog-之前)
   - [7.2 场景二：宕机发生在写 Binlog 之后](#72-场景二宕机发生在写-binlog-之后)
   - [7.3 自救的本质：XID 对账](#73-自救的本质xid-对账)
8. [常见面试题](#8-常见面试题)
9. [总结](#9-总结)

---

## 1. 三大日志全景概览

在深入每个日志之前，先建立全局视角：

| 维度 | Undo Log | Redo Log | Binlog |
|------|----------|----------|--------|
| **所属层** | InnoDB（引擎层） | InnoDB（引擎层） | Server 层 |
| **日志类型** | 逻辑日志 | 物理日志 | 逻辑日志 |
| **写入方式** | 事务执行中写入 | 事务执行中写入 | 提交时一次性写入 |
| **存储方式** | Undo 表空间 | 循环写（固定大小） | 追加写（无上限） |
| **核心使命** | 回滚 + MVCC | 崩溃恢复 | 主从复制 + 数据归档 |

---

## 2. Undo Log：回滚与 MVCC 的基石

### 2.1 核心作用

Undo Log 是 **逻辑日志**，记录的是"如何把数据还原回去"，而不是物理页的二进制快照。它有两个核心使命：

| 作用 | 说明 | 典型场景 |
|------|------|----------|
| **事务回滚（原子性）** | 记录修改前的旧值，`ROLLBACK` 时按 Undo Log 反向操作恢复 | `UPDATE balance = 500 → 400`，Undo Log 记录"把 400 改回 500" |
| **MVCC 旧版本读（隔离性）** | 其他事务的快照读需要看到数据的历史版本，这些旧版本靠 Undo Log 保留 | RR 级别下 `SELECT` 读到事务开始时的数据快照 |

```
事务 T1: UPDATE account SET balance = balance - 100 WHERE id = 1;

① 修改前：将 balance 旧值 (500) 写入 Undo Log
② 修改 Buffer Pool 中的数据：balance = 400
③ 在数据行的 roll_ptr 隐藏列记录 Undo Log 指针 → 构成版本链
④ 其他事务的快照读：沿 roll_ptr 回溯版本链，找到自己可见的旧版本
⑤ 提交后：Undo Log 标记为可 Purge（但不会立即删除，MVCC 可能还在用）
⑥ 回滚时：按 Undo Log 记录的旧值逐条反向操作
```

> **关键认知**：Undo Log 是"先写 Undo，再改数据"——如果 Undo 写入失败，数据不会被修改，不存在"改了数据却回滚不了"的情况。

### 2.2 存储结构

```
InnoDB 表空间
├── 系统表空间 (ibdata1)
├── 用户表空间 (.ibd)
└── Undo 表空间 (undo_001, undo_002, ...)
    ├── undo segment
    │   └── undo slot
    │       └── undo log page (16KB)
    │           ├── Undo Log Header
    │           ├── Undo Log Record 1  ← 记录: "把 col_a 改回旧值 xxx"
    │           ├── Undo Log Record 2
    │           └── ...
    └── (MySQL 8.0 默认 2 个 Undo 表空间，可自动扩展)
```

- 每个事务在执行第一条 `INSERT` / `UPDATE` / `DELETE` 时分配一个 Undo Segment
- 同一事务的所有 Undo Log 记录在同一个 Undo Segment 中
- **INSERT 和 UPDATE/DELETE 的 Undo 分开管理**：INSERT 的 Undo 在事务提交后可以立即删除（因为新插入的行对其他事务不可见），而 UPDATE/DELETE 的 Undo 需要等 MVCC 不再需要

### 2.3 生命周期与 Purge

```
创建                   使用中                   可Purge                 已Purge
  │                      │                        │                       │
  ▼                      ▼                        ▼                       ▼
┌──────┐   事务执行    ┌──────┐   事务提交    ┌──────┐   Purge线程    ┌──────┐
│ 生成  │ ──────────→ │ 活跃  │ ──────────→ │ 标记  │ ──────────→ │ 回收  │
│ Undo  │             │ Undo  │             │ 删除  │             │ 空间  │
└──────┘             └──────┘             └──────┘             └──────┘
                                                ▲
                                                │
                                        前提：所有需要读这个旧版本
                                        的 Read View 都已关闭
```

> **长事务的危害**：一个长时间未提交的事务，会阻止 Undo Log 被 Purge，导致 Undo 表空间不断膨胀。这就是为什么线上要监控 `information_schema.INNODB_TRX` 中长时间 RUNNING 的事务。

---

## 3. Redo Log：崩溃恢复的保障

### 3.1 核心作用与 WAL

Redo Log 是 **物理日志**，记录的是"数据页上哪个位置改成了什么"，它的唯一使命是 **崩溃恢复（Crash Recovery）**，保证持久性（Durability）。

Redo Log 的底层思想是 **WAL（Write-Ahead Logging，先写日志再写磁盘）**：

```
普通写入（无 WAL）：                     WAL 写入：
                                         
UPDATE → 找到数据页(磁盘)                UPDATE → 修改 Buffer Pool(内存)
   → 读入内存                              → 写 Redo Log(顺序写，很快)
   → 修改                                    → 返回提交成功 ✓
   → 写回磁盘 ← 随机写，很慢！              → (后台异步刷脏页到磁盘)
   → 返回提交成功
```

| | 无 WAL | 有 WAL（Redo Log） |
|---|---|---|
| **磁盘 I/O 类型** | 随机写（找数据页） | 顺序写（追加日志） |
| **性能** | 慢，每次修改都要刷盘 | 快，日志顺序写，数据页异步刷 |
| **崩溃后** | 无保障 | 用 Redo Log 重放恢复已提交数据 |
| **空间** | 无需额外空间 | 需预留固定大小的 Redo Log 文件 |

### 3.2 循环写结构

Redo Log 是固定大小的循环写，由两个指针控制：

```
Redo Log 文件组（假设 4 个文件，每个 1GB，共 4GB）

┌────────┬────────┬────────┬────────┐
│ File 1 │ File 2 │ File 3 │ File 4 │
└────────┴────────┴────────┴────────┘
     ▲                           ▲
     │                           │
  checkpoint                write pos

write pos        ← 当前写入位置，事务产生 Redo Log，write pos 向前推进
checkpoint       ← 已刷盘位置，checkpoint 之前的数据页都已安全写入磁盘
write pos 与 checkpoint 之间的空间 ← 可写入的新日志区域（空闲空间）
```

- **如果 write pos 追上 checkpoint**：说明 Redo Log 满了，此时 InnoDB 必须暂停所有更新操作，强制将 checkpoint 向前推进（刷脏页），这就是"脏页刷盘风暴"，性能急剧下降
- **Redo Log 大小设置**：太小 → 频繁 checkpoint 刷盘；太大 → 崩溃恢复时间长。一般建议单文件 1GB，组大小 2~4GB

### 3.3 刷盘策略

`innodb_flush_log_at_trx_commit` 控制 Redo Log 的刷盘时机，是 **性能与安全的经典权衡**：

| 值 | 行为 | 持久性 | 性能 | 适用场景 |
|----|------|--------|------|----------|
| **1**（默认） | 每次事务提交都将 Redo Log 刷到磁盘 | ✅ 保证不丢数据 | 中等 | 金融、订单等核心业务 |
| **0** | 每秒将 Redo Log Buffer 刷到磁盘一次，不依赖事务提交 | ❌ 崩溃可能丢失 1 秒数据 | 最快 | 日志、统计分析等允许少量丢失 |
| **2** | 每次事务提交将 Redo Log 写 OS 缓存（不 fsync），每秒刷盘 | ⚠️ MySQL 崩溃不丢，OS 崩溃丢 1 秒 | 较快 | 折中方案 |

```
innodb_flush_log_at_trx_commit = 1 的写入路径：

事务提交
    │
    ▼
Redo Log Buffer (内存)
    │  write
    ▼
OS Buffer (Page Cache)
    │  fsync  ← 这一步是性能瓶颈
    ▼
磁盘 (Redo Log File)

innodb_flush_log_at_trx_commit = 2：
只到 OS Buffer，fsync 交给后台每秒线程 → 少一次磁盘 fsync
```

> **面试要点**：说 `innodb_flush_log_at_trx_commit = 1` 保证"不丢数据"时，指的是已提交事务的数据。如果事务还没提交就宕机了，Redo Log 本身不保证未提交事务的恢复——那是 Undo Log 的活。

---

## 4. Binlog：主从复制的命脉

### 4.1 核心作用

Binlog（Binary Log，二进制日志）是 **Server 层**的日志，所有存储引擎共用。它的核心使命：

| 作用 | 说明 |
|------|------|
| **主从复制** | Master 将 Binlog 发给 Slave，Slave 重放 Binlog 实现数据同步 |
| **数据恢复（PITR）** | 基于全量备份 + Binlog 增量，可以恢复到任意时间点 |
| **数据审计** | 通过 `mysqlbinlog` 工具解析，追踪数据变更历史 |
| **异构同步** | Canal、Maxwell 等工具监听 Binlog，同步到 Kafka/ES/Redis |

**Binlog 与 Redo Log 的根本区别**：

```
Redo Log：InnoDB 专属，"我怎么改的数据页"（物理层面）→ 崩溃恢复
Binlog  ：Server 层通用，"我执行了什么 SQL / 改了哪些行"（逻辑层面）→ 主从同步
```

### 4.2 三种格式

`binlog_format` 决定 Binlog 记录的内容形式：

| 格式 | 记录内容 | 优点 | 缺点 |
|------|----------|------|------|
| **STATEMENT** | 原始 SQL 语句 | 日志量小 | 函数如 `NOW()`、`UUID()` 在主从库执行结果不同 → 数据不一致 |
| **ROW**（推荐） | 每一行数据的具体变化（前镜像 + 后镜像） | 精确，不会出现主从不一致 | 日志量大（批量 UPDATE 可能产生大量日志） |
| **MIXED** | 大多数用 STATEMENT，特殊操作用 ROW | 折中 | 仍有用 STATEMENT 导致不一致的风险 |

```
ROW 格式示例：
UPDATE account SET balance = balance - 100 WHERE id = 1;

Binlog 记录：
### UPDATE `mydb`.`account`
### WHERE
###   @1=1              ← id
###   @2=500            ← balance 旧值（前镜像）
### SET
###   @1=1
###   @2=400            ← balance 新值（后镜像）
```

> **生产环境建议**：使用 **ROW 格式**。虽然日志量大，但绝对避免主从数据不一致，且支持 Flashback（通过 `mysqlbinlog` 将 ROW 格式 Binlog 解析为反向 SQL）。

### 4.3 sync_binlog 参数

| 值 | 行为 | 说明 |
|----|------|------|
| **1**（推荐） | 每次事务提交都将 Binlog 刷到磁盘 | 保证 Binlog 不丢失，与 `innodb_flush_log_at_trx_commit=1` 组成"双 1"配置 |
| 0 | 由 OS 决定何时刷盘 | 高性能，但崩溃可能丢失 Binlog |
| N | 每 N 次事务提交刷一次 | 折中 |

---

## 5. Undo Log / Redo Log / Binlog 全面对比

### 5.1 多维度对比表

| 维度 | Undo Log | Redo Log | Binlog |
|------|----------|----------|--------|
| **所属层级** | InnoDB 引擎层 | InnoDB 引擎层 | MySQL Server 层 |
| **日志类型** | 逻辑日志 | 物理日志 | 逻辑日志（ROW 模式下偏向物理） |
| **记录内容** | "如何还原"（反向操作，如把 400 改回 500） | "数据页哪个位置改成了什么"（页级变更） | "执行了什么 SQL / 改了哪些行" |
| **核心使命** | 事务回滚 + MVCC 旧版本 | 崩溃恢复（Crash Recovery） | 主从复制 + PITR 数据恢复 |
| **写入时机** | 修改数据之前（先写 Undo） | 事务执行过程中持续写入 | 事务提交时一次性写入 |
| **存储结构** | Undo 表空间（可自动扩展） | Redo Log 文件组（循环写，固定大小） | Binlog 文件序列（追加写，无上限） |
| **空间管理** | 自动扩展 + Purge 回收 | 循环覆盖，checkpoint ≦ write pos | 手动清理或按过期时间自动删除 |
| **关键参数** | — | `innodb_flush_log_at_trx_commit` | `sync_binlog` + `binlog_format` |
| **崩溃恢复角色** | 回滚未提交事务 | 重放已提交事务 | 不直接参与崩溃恢复 |
| **是否可关闭** | ❌ 不可关闭 | ❌ 不可关闭 | ✅ 可关闭（`skip-log-bin`），但失去复制能力 |
| **对性能的影响** | 写入开销小（逻辑操作） | 写入开销中等（顺序写） | ROW 格式下日志量大，影响较明显 |

### 5.2 缺一不可的原因

面试常问："能不能只用其中一个或两个？"——答案是 **缺一不可**，各有不可替代的使命：

| 日志 | 如果缺失 | 后果 |
|------|----------|------|
| **Undo Log** | 只用 Redo Log + Binlog | ① 事务无法回滚，`ROLLBACK` 失效；② MVCC 无法工作（没有旧版本链），所有读都变成当前读 → 快照读语义崩溃；③ RR 隔离级别名存实亡 |
| **Redo Log** | 只用 Undo Log + Binlog | ① 崩溃后无法恢复已提交事务的数据（Buffer Pool 中的脏页丢失）→ **持久性被打破**；② 即使 Binlog 有记录，InnoDB 没有重放机制也恢复不了 |
| **Binlog** | 只用 Undo Log + Redo Log | ① 无法做主从复制（Slave 没有数据来源）；② 无法做基于时间点的数据恢复（PITR）；③ 数据审计、异构数据同步全部失效 |

```
三者关系可视化：

    Undo Log                Redo Log                Binlog
    ════════                ════════                ══════
    提供"过去"               保证"未来"               连接"外部"
    回滚看旧值               崩溃可恢复              主从要同步
    MVCC 靠它活              宕机不怕丢              备份靠它追

    纵向：已提交/未提交        纵向：已提交持久化         横向：跨机器同步
```

> **一句话**：**Undo 管"悔棋"，Redo 管"续命"，Binlog 管"克隆"。** 三者缺一不可，各自守护数据安全的不同维度。

---

## 6. 两阶段提交 (2PC)

### 6.1 为什么需要 2PC

这是面试中的核心问题。先看反例——**如果没有 2PC，会发生什么**：

#### 情况 A：先写 Redo Log，再写 Binlog

```
时间线：
① UPDATE 执行 → 写 Redo Log（提交标记） ✓
② 准备写 Binlog → 💥 宕机！

结果：
  Master（重启后）：用 Redo Log 恢复，数据已更新 ✓
  Slave（重放 Binlog）：Binlog 中没有这条记录，数据未更新 ✗
  
  → 主从数据不一致！Master 有这条数据，Slave 没有
```

#### 情况 B：先写 Binlog，再写 Redo Log

```
时间线：
① UPDATE 执行 → 写 Binlog ✓  
② 准备写 Redo Log（提交标记）→ 💥 宕机！

结果：
  Master（重启后）：Redo Log 中没有提交标记，事务回滚，数据未更新 ✗
  Slave（重放 Binlog）：Binlog 中有这条记录，数据已更新 ✓
  
  → 主从数据依旧不一致！Slave 有这条数据，Master 没有
```

**两种顺序都不行，根源在于：Redo Log 和 Binlog 是两个独立系统，它们的写入天然不是原子操作。** 2PC 就是来解决这个原子性问题的。

> **核心矛盾**：Redo Log（InnoDB 引擎层）和 Binlog（Server 层）分属两层，事务提交时必须保证两者"要么都写成功，要么都不写"，否则主从数据必然分裂。

### 6.2 2PC 执行过程

两阶段提交将 Redo Log 的写入拆成两段，把写 Binlog 夹在中间：

```
                    事务提交：2PC 完整流程

    ┌─────────────────────────────────────────────────────┐
    │                                                     │
    │  Phase 1: Prepare 阶段                              │
    │  ┌─────────────────────────────────────────────┐    │
    │  │  InnoDB 将 Redo Log 写入磁盘                  │    │
    │  │  状态标记为 "prepare"（未提交）               │    │
    │  │  ← 此时事务尚未提交，其他事务看不到修改        │    │
    │  └─────────────────────────────────────────────┘    │
    │         │                                            │
    │         ▼                                            │
    │  写入 Binlog                                         │
    │  ┌─────────────────────────────────────────────┐    │
    │  │  Server 层将 Binlog 写入磁盘                  │    │
    │  │  ← Binlog 是"对账"的关键依据                  │    │
    │  └─────────────────────────────────────────────┘    │
    │         │                                            │
    │         ▼                                            │
    │  Phase 2: Commit 阶段                                │
    │  ┌─────────────────────────────────────────────┐    │
    │  │  InnoDB 将 Redo Log 状态改为 "commit"         │    │
    │  │  事务正式提交，释放锁，数据对其他事务可见      │    │
    │  └─────────────────────────────────────────────┘    │
    │                                                     │
    └─────────────────────────────────────────────────────┘
```

用 XID 串联整个流程：

```
Prepare  ───→  写 Binlog  ───→  Commit
   │               │               │
   └── XID ────────┴─────── XID ───┘

XID（Transaction ID）同时存在于 Redo Log 和 Binlog 中，
是崩溃恢复时"对账"的唯一凭证。
```

更详细的步骤拆解：

```
① InnoDB 执行 UPDATE，写 Undo Log（回滚保障）
② 修改 Buffer Pool 中的数据页
③ 生成 Redo Log，写入 Redo Log Buffer
④ 事务提交：Redo Log Buffer → 刷盘，状态 = prepare（写 XID）
⑤ Server 层写 Binlog（含 XID）
⑥ InnoDB 将 Redo Log 状态更新为 commit
⑦ 事务完成，返回客户端 "OK"
```

### 6.3 数据不一致的后果

如果 2PC 失效导致主从数据不一致，后果远比看起来严重：

| 后果 | 严重程度 | 说明 |
|------|----------|------|
| **主从数据分裂** | 🔴 严重 | `SELECT` 在 Master 和 Slave 上返回不同结果，用户刷新页面数据来回跳 |
| **主从切换灾难** | 🔴 严重 | Master 宕机后 Slave 升主，之前不一致的数据变成"新标准"，原先 Master 的数据永久丢失 |
| **PITR 恢复错误** | 🔴 严重 | 基于 Binlog 的增量恢复产生与原始 Master 不同的状态，备份形同虚设 |
| **缓存与数据库不一致** | 🟡 中等 | Canal 等 Binlog 监听工具消费到错误数据，Redis/ES 同步数据与 DB 对不上 |
| **审计与合规问题** | 🟡 中等 | 金融、交易系统要求精确的数据审计轨迹，不一致会引发合规风险 |

> **实际案例**：若 Master 执行了扣款 UPDATE 并提交，但 Binlog 中没有这条记录 → Slave 余额未扣 → Master 宕机后 Slave 升主 → 用户余额"回到"扣款前。这就是 **2PC 要防止的典型灾难**。

---

## 7. 宕机重启时 2PC 如何自救

崩溃恢复的核心逻辑：**重启时扫描 Redo Log 中状态为 prepare 的事务，拿着 XID 去 Binlog 里"对账"，根据 Binlog 有没有这条记录来决定提交还是回滚。**

### 7.1 场景一：宕机发生在写 Binlog 之前

```
时间线：
    Redo Log 写 prepare ───→ 💥 宕机（Binlog 未写）
    
重启后恢复过程：
    
    ① 扫描 Redo Log，发现事务 T1：状态 = prepare，XID = 1001
    ② 去 Binlog 中搜索 XID = 1001 → 未找到
    ③ 判定：Binlog 缺失，Master 上没有完整提交记录
    ④ 决策：回滚 T1（利用 Undo Log 恢复数据到修改前）
    ⑤ Slave 侧：Binlog 中没有 T1，自然不会重放
    ⑥ 结果：主从都不包含 T1 的修改 → 一致 ✓
```

```
┌─────────────────────────────────────────────────────────┐
│         场景一：写 Binlog 前宕机 → 回滚                    │
│                                                         │
│   Redo Log:  [prepare, XID=1001] ← 有记录                │
│   Binlog  :  (无对应记录)        ← 找不到                 │
│                                                         │
│   结论：Binlog 缺失 → 回滚事务                            │
│   结果：主从都不包含该事务 ✓                               │
└─────────────────────────────────────────────────────────┘
```

### 7.2 场景二：宕机发生在写 Binlog 之后

```
时间线：
    Redo Log 写 prepare ───→ 写 Binlog ───→ 💥 宕机（Commit 未写）
    
重启后恢复过程：

    ① 扫描 Redo Log，发现事务 T1：状态 = prepare，XID = 1001
    ② 去 Binlog 中搜索 XID = 1001 → 找到了！
    ③ 判定：Binlog 完整，Slave 将来会重放这条记录
    ④ 决策：提交 T1（将 Redo Log 状态从 prepare 改为 commit）
    ⑤ Slave 侧：Binlog 中有 T1，重放后数据与 Master 一致
    ⑥ 结果：主从都包含 T1 的修改 → 一致 ✓
```

```
┌─────────────────────────────────────────────────────────┐
│         场景二：写 Binlog 后宕机 → 提交                    │
│                                                         │
│   Redo Log:  [prepare, XID=1001] ← 有记录                │
│   Binlog  :  [XID=1001, UPDATE...] ← 找到了！             │
│                                                         │
│   结论：Binlog 完整 → 提交事务                            │
│   结果：主从都包含该事务 ✓                                 │
└─────────────────────────────────────────────────────────┘
```

### 7.3 自救的本质：XID 对账

```
重启时的决策树：

扫描 Redo Log 中的 prepare 事务
          │
          ▼
   拿着 XID 查 Binlog
          │
    ┌─────┴─────┐
    ▼           ▼
 找到了       没找到
    │           │
    ▼           ▼
 提交事务     回滚事务
(场景二)     (场景一)
    │           │
    ▼           ▼
┌───────────────────────┐
│  主从数据最终一致 ✓     │
└───────────────────────┘
```

> **一句话总结自救逻辑**：**Binlog 有 → 必须提交（否则 Slave 有、Master 无）；Binlog 无 → 必须回滚（否则 Master 有、Slave 无）。** XID 就是连接两个日志的"对账凭证"。

---

## 8. 常见面试题

### Q1：两阶段提交是什么？为什么要用它？

**A1**：MySQL 为了保证 Redo Log（InnoDB 引擎层）和 Binlog（Server 层）的原子性，采用了两阶段提交。它将 Redo Log 的落盘分为 **prepare** 和 **commit** 两个阶段，把**写 Binlog 夹在中间**。

如果宕机发生在写 Binlog 之前，重启后由于 Binlog 缺失，事务会被回滚；如果宕机发生在写 Binlog 之后，重启后只要 Binlog 完整，事务就会被提交。通过这种 XID 对账机制，完美保证了**主从库的数据一致性**。

### Q2：Undo Log 和 Redo Log 的区别？

**A2**：

| | Undo Log | Redo Log |
|---|---|---|
| **类型** | 逻辑日志 | 物理日志 |
| **记录内容** | "如何还原"（旧值回写） | "页上改了什么"（物理变更） |
| **核心使命** | 事务回滚 + MVCC 旧版本 | 崩溃恢复（持久性） |
| **写入时机** | 修改数据前 | 事务执行过程中 |
| **崩溃恢复角色** | 回滚未提交事务 | 重放已提交事务 |

> **关键区别**：Undo Log 保证"可以反悔"，Redo Log 保证"不怕宕机"。崩溃恢复时，Redo Log 把已提交的重做，Undo Log 把未提交的撤销。

### Q3：Redo Log 和 Binlog 的区别？

**A3**：

| | Redo Log | Binlog |
|---|---|---|
| **层级** | InnoDB 引擎层 | Server 层 |
| **类型** | 物理日志 | 逻辑日志（ROW/STATEMENT） |
| **写入方式** | 循环写（固定大小） | 追加写（无限增长） |
| **产生时机** | 事务执行中持续写 | 事务提交时一次性写 |
| **用途** | 崩溃恢复 | 主从复制 + PITR |

> **关键**：Redo Log 是 InnoDB 独有的，Binlog 是所有引擎共用的。这就是为什么需要 2PC 来协调两者——它们分属不同层，天然不是原子操作。

### Q4：如果不用 2PC，先写 Redo Log 再写 Binlog 会怎样？

**A4**：会发生典型的 **主从不一致**。如果 Redo Log 写完、Binlog 还没写的时候宕机了：

- Master 重启后用 Redo Log 恢复，事务已提交，数据已更新
- Slave 靠 Binlog 同步，但 Binlog 中没有这条记录，数据未更新
- 结果：Master 有数据，Slave 没有 → 主从分裂

反之，如果先写 Binlog 再写 Redo Log，宕机后 Slave 有数据而 Master 没有，问题同样严重。2PC 正是为了杜绝这两种情况的原子性方案。

### Q5：崩溃恢复时，处于 prepare 状态的事务一定需要 Binlog 来决策吗？

**A5**：是的。处于 prepare 状态的 Redo Log，说明事务走到了 2PC 的中间状态——Redo Log 已刷盘，但不确定 Binlog 是否写入成功。重启时唯一的判断依据就是去 Binlog 中查 XID：

- **有对应 XID** → Binlog 写成功了，提交事务（让 Master 和 Slave 一致）
- **没有对应 XID** → Binlog 没写成功，回滚事务（让 Master 和 Slave 一致）

这个机制保证了 **无论何时宕机，重启后主从数据都一致**。

---

## 9. 总结

### 9.1 日志与 2PC 全景图

```
┌─────────────────────────────────────────────────────────────────────┐
│                    MySQL InnoDB 日志与 2PC 全景                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌──────────────────────────────────────────────────────┐         │
│   │                   三大日志各司其职                      │         │
│   │                                                      │         │
│   │   Undo Log        Redo Log        Binlog             │         │
│   │   回滚 + MVCC     崩溃恢复        主从复制 + PITR      │         │
│   │   "悔棋"          "续命"          "克隆"              │         │
│   └──────────────────────────────────────────────────────┘         │
│                                                                     │
│   ┌──────────────────────────────────────────────────────┐         │
│   │              两阶段提交 (2PC) 保证一致性                │         │
│   │                                                      │         │
│   │   Prepare ────→ Write Binlog ────→ Commit            │         │
│   │   (Redo Log                                     │         │
│   │    标记 prepare)    ▲  对账凭证: XID              │         │
│   │                     │                            │         │
│   │              宕机自救：XID 对账                    │         │
│   │    Binlog 有 → 提交    Binlog 无 → 回滚           │         │
│   └──────────────────────────────────────────────────────┘         │
│                                                                     │
│   ┌──────────────────────────────────────────────────────┐         │
│   │                "双 1" 配置：生产环境铁律               │         │
│   │                                                      │         │
│   │   sync_binlog = 1                                    │         │
│   │   innodb_flush_log_at_trx_commit = 1                 │         │
│   │   binlog_format = ROW                                │         │
│   └──────────────────────────────────────────────────────┘         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 9.2 关键设计原则

| 原则 | 说明 |
|------|------|
| **WAL 先写日志** | Redo Log 顺序写替代随机写，性能与持久性兼得 |
| **Undo 先于数据修改** | 确保任何时刻都有回滚路径，不存在"改了回不去" |
| **2PC 夹心模式** | Redo Log prepare → Binlog → Redo Log commit，Binlog 是对账的关键 |
| **XID 串联两层** | 引擎层和 Server 层共享 XID，崩溃恢复的唯一对账凭证 |
| **Binlog 决定最终状态** | 重启时以 Binlog 为准——因为 Slave 只能看到 Binlog |
| **双 1 配置** | `sync_binlog=1` + `innodb_flush_log_at_trx_commit=1`，保证"双写不丢" |
| **ROW 格式优先** | 避免 STATEMENT 格式下主从不一致，日志量大的代价值得 |

### 9.3 快速排查清单

| 排查点 | 看什么 | 工具/命令 |
|--------|--------|-----------|
| Redo Log 大小 | `innodb_log_file_size` × `innodb_log_files_in_group` | `SHOW VARIABLES LIKE '%innodb_log%'` |
| Redo Log 刷盘策略 | `innodb_flush_log_at_trx_commit` | `SHOW VARIABLES LIKE '%flush_log%'` |
| Binlog 格式 | `binlog_format` | `SHOW VARIABLES LIKE 'binlog_format'` |
| Binlog 刷盘策略 | `sync_binlog` | `SHOW VARIABLES LIKE 'sync_binlog'` |
| Binlog 文件列表 | 当前 Binlog 文件及大小 | `SHOW BINARY LOGS` |
| 当前 Binlog 位置 | 正在写入的文件和偏移 | `SHOW MASTER STATUS` |
| Undo 表空间状态 | Undo 使用量与膨胀情况 | `SELECT * FROM information_schema.INNODB_TABLESPACES WHERE NAME LIKE 'innodb_undo%'` |
| 长事务监控 | 活跃事务的运行时间 | `SELECT * FROM information_schema.INNODB_TRX WHERE trx_state='RUNNING'` |

### 9.4 一句口诀

> **Undo 悔棋 MVCC，Redo 续命 WAL 记；Binlog 同步靠追加，两段提交 XID 对账不分裂。**

---

## 相关链接

- [MySQL 索引底层与优化](/posts/mysql/mysql-索引底层与优化/)
- [MySQL 事务、MVCC 与锁](/posts/mysql/mysql-事务-mvcc-与锁/)
- [MySQL 官方文档 — Redo Log](https://dev.mysql.com/doc/refman/8.0/en/innodb-redo-log.html)
- [MySQL 官方文档 — Binary Log](https://dev.mysql.com/doc/refman/8.0/en/binary-log.html)
- [MySQL 官方文档 — Two-Phase Commit](https://dev.mysql.com/doc/refman/8.0/en/innodb-two-phase-commit.html)
- MySQL 锁机制 (待创建)

---

*本文基于 MySQL 8.0 / InnoDB 引擎编写，2PC 机制与 XID 对账逻辑在所有 5.6+ 版本中通用。*
