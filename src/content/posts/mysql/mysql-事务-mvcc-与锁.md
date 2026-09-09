---
title: MySQL 事务、MVCC 与锁
published: 2026-05-24
description: 从 ACID 和隔离级别展开，解析 Undo/Redo、Read View、版本链以及行锁和间隙锁机制。
tags:
  - mysql
  - 事务
  - 底层原理
category: Mysql
pinned: false
draft: false
comment: true
lang: zh_CN
---

> MySQL InnoDB 的事务机制围绕 **ACID** 展开，底层通过 **Undo Log**（原子性）、**Redo Log**（持久性）、**MVCC + 锁**（隔离性）三者协同实现。理解 MVCC 的 Read View 可见性规则和 Next-Key Lock 的加锁策略，是掌握 InnoDB 并发控制的核心。

---

## 目录

1. [事务的基石：ACID](#1-事务的基石acid)
2. [并发问题与隔离级别](#2-并发问题与隔离级别)
   - [2.1 三种并发乱象](#21-三种并发乱象)
   - [2.2 四大隔离级别](#22-四大隔离级别)
3. [MVCC 底层原理](#3-mvcc-底层原理)
   - [3.1 隐藏列](#31-隐藏列)
   - [3.2 Undo Log 版本链](#32-undo-log-版本链)
   - [3.3 Read View 一致性视图](#33-read-view-一致性视图)
   - [3.4 RC 与 RR 的 Read View 生成策略](#34-rc-与-rr-的-read-view-生成策略)
4. [锁的艺术](#4-锁的艺术)
   - [4.1 快照读 vs 当前读](#41-快照读-vs-当前读)
   - [4.2 行锁 (Record Lock)](#42-行锁-record-lock)
   - [4.3 间隙锁 (Gap Lock)](#43-间隙锁-gap-lock)
   - [4.4 临键锁 (Next-Key Lock)](#44-临键锁-next-key-lock)
   - [4.5 加锁规则实战](#45-加锁规则实战)
5. [常见面试题](#5-常见面试题)
6. [总结](#6-总结)

---

## 1. 事务的基石：ACID

面试时千万别只背概念，要结合 MySQL 的底层实现来答：

| 特性 | 含义 | 底层实现 |
|------|------|----------|
| **A — Atomicity（原子性）** | 要么全成功，要么全失败 | **Undo Log**（回滚日志）：记录修改前的旧值，事务回滚时按 Undo Log 恢复数据 |
| **C — Consistency（一致性）** | 数据库从一种正确状态迁移到另一种正确状态 | 由 A、I、D + 业务代码共同保证 |
| **I — Isolation（隔离性）** | 事务间互不干扰，并发执行的效果等同于串行 | **锁机制** + **MVCC**（多版本并发控制） |
| **D — Durability（持久性）** | 事务提交后，数据永久保存，宕机不丢 | **Redo Log**（重做日志）：先写日志再写磁盘，崩溃恢复时通过 Redo Log 重放已提交事务 |

### 1.1 Undo Log 与原子性

```
事务 T1: UPDATE account SET balance = balance - 100 WHERE id = 1;

① 执行前：将 balance 旧值 (500) 写入 Undo Log
② 修改数据：balance = 400
③ 提交：标记 Undo Log 可回收
④ 回滚：用 Undo Log 中的旧值 (500) 覆盖 → balance 恢复为 500
```

- **Undo Log 是逻辑日志**：记录的是"如何还原"，而非物理页的二进制快照
- **MVCC 也依赖 Undo Log**：旧版本数据通过 Undo Log 保留，供其他事务的快照读访问

### 1.2 Redo Log 与持久性

```
事务 T1: UPDATE account SET balance = balance - 100 WHERE id = 1;

① 修改 Buffer Pool 中的数据页（内存）
② 生成 Redo Log 并写入 Redo Log Buffer
③ 事务提交时，Redo Log 刷盘（fsync）
④ 数据页由后台线程异步刷盘（Checkpoint）

┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ 修改内存页     │ → │ 写 Redo Log   │ → │ Redo Log 刷盘 │ → 事务提交成功
│  (Buffer Pool) │    │  (顺序写)    │    │  (持久化保证) │
└──────────────┘    └──────────────┘    └──────────────┘
                                               │
                                     ┌─────────┴─────────┐
                                     │ 后台线程异步刷脏页   │
                                     │ (Checkpoint 机制) │
                                     └───────────────────┘
```

**WAL（Write-Ahead Logging）**：先写日志，再写数据。Redo Log 是顺序写，速度快；数据页是随机写，速度慢。WAL 将随机写转为顺序写。

---

## 2. 并发问题与隔离级别

### 2.1 三种并发乱象

| 乱象 | 现象 | 侧重点 | 严重程度 |
|------|------|--------|----------|
| **脏读 (Dirty Read)** | 读到别人**未提交**的数据 | 可能读到最终被回滚的脏数据 | 🔴 最严重，绝对不允许 |
| **不可重复读 (Non-Repeatable Read)** | 同一事务内两次读同一行，**内容不同** | 侧重 `UPDATE` / `DELETE` 导致的数据内容变化 | 🟡 部分场景可接受 |
| **幻读 (Phantom Read)** | 同一事务内两次范围查询，**行数不同** | 侧重 `INSERT` 导致的数据条数变化 | 🟡 InnoDB 在 RR 级别已解决 |

```
脏读场景：
  事务 A: UPDATE ... SET age=20 (未提交)
  事务 B: SELECT → age=20  ← 读到未提交的脏数据
  事务 A: ROLLBACK → age 回到 18
  事务 B: 基于 age=20 做了错误决策 ❌

不可重复读场景：
  事务 B: SELECT age → 18
  事务 A: UPDATE SET age=20 AND COMMIT
  事务 B: SELECT age → 20 ← 同一事务内两次读到不同值

幻读场景：
  事务 B: SELECT COUNT(*) WHERE age>18 → 3
  事务 A: INSERT INTO ... age=25 AND COMMIT
  事务 B: SELECT COUNT(*) WHERE age>18 → 4 ← 多了一行"幻影"
```

### 2.2 四大隔离级别

| 隔离级别 | 脏读 | 不可重复读 | 幻读 | 默认使用 |
|----------|------|-----------|------|----------|
| **Read Uncommitted (RU)** | ❌ 允许 | ❌ 允许 | ❌ 允许 | 几乎不用 |
| **Read Committed (RC)** | ✅ 解决 | ❌ 允许 | ❌ 允许 | 阿里等大厂线上默认（高并发场景） |
| **Repeatable Read (RR)** | ✅ 解决 | ✅ 解决 | ✅ 解决 | **InnoDB 默认级别** |
| **Serializable** | ✅ 解决 | ✅ 解决 | ✅ 解决 | 性能极差，靠强制加锁 |

> **注意**：InnoDB 在 RR 级别下**已解决幻读**——快照读靠 MVCC，当前读靠 Next-Key Lock。别再说"RR 无法解决幻读"了。

---

## 3. MVCC 底层原理

MVCC（Multi-Version Concurrency Control）是 InnoDB 实现非锁定一致性读的核心机制。它的三个关键组件：

### 3.1 隐藏列

InnoDB 表中**每行记录**都会自动附加三个隐藏字段：

| 隐藏列 | 大小 | 说明 |
|--------|------|------|
| `DB_TRX_ID` | 6 字节 | 最后修改该行的**事务 ID**（单调递增） |
| `DB_ROLL_PTR` | 7 字节 | **回滚指针**，指向 Undo Log 中该行的上一个版本 |
| `DB_ROW_ID` | 6 字节 | 隐藏主键（仅当无主键且无唯一非空索引时存在） |

```
一行数据的实际结构：
┌──────────┬──────────┬──────────┬──────────────┬───────────────┐
│  id (PK) │   name   │   age    │  DB_TRX_ID   │ DB_ROLL_PTR   │
├──────────┼──────────┼──────────┼──────────────┼───────────────┤
│    1     │  张三    │    25    │    108       │  → Undo Log   │
└──────────┴──────────┴──────────┴──────────────┴───────────────┘
  用户定义列                         系统隐藏列
```

### 3.2 Undo Log 版本链

每次修改记录时，旧版本不会立刻被覆盖，而是被写入 Undo Log，通过 `DB_ROLL_PTR` 串联成**历史版本链表**。

```
事务 T1 (trx_id=100)：INSERT → name='张三', age=20
事务 T2 (trx_id=101)：UPDATE → age=25
事务 T3 (trx_id=102)：UPDATE → age=30
事务 T4 (trx_id=103)：UPDATE → name='张三疯'

Undo Log 版本链：
                                Undo Log
  当前记录 (聚簇索引)          ←──旧版本链──
 ┌─────────────────────┐    ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
 │ name='张三疯'        │    │ name='张三'       │    │ name='张三'       │    │ name='张三'       │
 │ age=30              │    │ age=30           │    │ age=25           │    │ age=20           │
 │ trx_id=103          │──→ │ trx_id=102       │──→ │ trx_id=101       │──→ │ trx_id=100       │
 │ roll_ptr ───────────┘    │ roll_ptr ────────┘    │ roll_ptr ────────┘    │ roll_ptr = NULL  │
 └─────────────────────┘    └──────────────────┘    └──────────────────┘    └──────────────────┘
    最新版本 (事务103)         历史版本 (事务102)       历史版本 (事务101)       最老版本 (事务100)
```

**关键点**：
- 版本链方向：最新 → 最老（`roll_ptr` 从新指向旧）
- Undo Log 中的版本**可能被多个事务同时读取**（不同快照看到不同版本）
- Undo Log 不会被立即删除，直到没有事务需要该版本时才由 Purge 线程清理

### 3.3 Read View 一致性视图

事务执行查询时生成一个**快照（Read View）**，用于判断版本链中哪些版本对当前事务可见。

**Read View 包含的关键属性**：

| 属性 | 含义 |
|------|------|
| `m_ids` | 生成快照时，系统中**活跃（未提交）的事务 ID 列表** |
| `min_trx_id` | `m_ids` 中的最小值 |
| `max_trx_id` | 系统下一个即将分配的事务 ID（= 已分配的最大 trx_id + 1） |
| `creator_trx_id` | 创建该 Read View 的事务 ID |

**可见性判断规则**（遍历版本链，从最新版本开始）：

```
对于版本链中的每个版本，设其 trx_id = V：

① 如果 V == creator_trx_id
   → 当前事务自己修改的版本，可见 ✅

② 如果 V < min_trx_id
   → 修改该版本的事务在快照生成前已提交，可见 ✅

③ 如果 V >= max_trx_id
   → 修改该版本的事务在快照生成后才开始，不可见 ❌ → 沿 roll_ptr 找上一版本

④ 如果 min_trx_id <= V < max_trx_id
   → 检查 V 是否在 m_ids 中：
     - 在 m_ids 中：事务在快照时刻仍未提交，不可见 ❌
     - 不在 m_ids 中：事务在快照时刻已提交，可见 ✅
```

```
可见性判断流程图：

                  拿到一个版本 (trx_id = V)
                          │
              ┌───────────┴───────────┐
              │ V == creator_trx_id?  │
              └───────────┬───────────┘
                  Yes ↓         ↓ No
                ✅ 可见    ┌───────────────┐
                          │ V < min_trx_id?│
                          └───────┬───────┘
                          Yes ↓       ↓ No
                        ✅ 可见   ┌───────────────┐
                                 │ V >= max_trx_id│
                                 │     ?           │
                                 └───────┬─────────┘
                                 Yes ↓       ↓ No
                               ❌ 不可见  ┌──────────────────┐
                               (找上一版本)│ V 在 m_ids 中?    │
                                         └────┬─────────────┘
                                         Yes ↓        ↓ No
                                       ❌ 不可见    ✅ 可见
                                       (未提交)    (已提交)
```

### 3.4 RC 与 RR 的 Read View 生成策略

RC 和 RR 在快照读上的唯一区别就是 **Read View 的生成时机**：

| 隔离级别 | Read View 生成策略 | 效果 |
|----------|-------------------|------|
| **RC (Read Committed)** | **每次 SELECT 都生成新的 Read View** | 每次都能看到最新已提交的数据 → 不可重复读 |
| **RR (Repeatable Read)** | **事务中第一次 SELECT 时生成 Read View，之后复用** | 整个事务期间看到的数据一致 → 可重复读 |

```
同一个场景，RC vs RR 看到的不同结果：

  时间线：T1 开始 → T1 第一次 SELECT → T2 UPDATE 并 COMMIT → T1 第二次 SELECT

  RC 下：
    T1 第一次 SELECT → ReadView₁ (m_ids: [T2])
    T2 COMMIT → 更新数据
    T1 第二次 SELECT → ReadView₂ (m_ids: [])  ← 重新生成，T2 已提交 → 可见
    T1 两次读到不同值 ❌ (不可重复读)

  RR 下：
    T1 第一次 SELECT → ReadView₁ (m_ids: [T2]) ← 生成 ReadView
    T2 COMMIT → 更新数据
    T1 第二次 SELECT → 复用 ReadView₁ (m_ids: [T2])  ← T2 仍在 m_ids 中 → 不可见
    T1 两次读到相同值 ✅ (可重复读)
```

---

## 4. 锁的艺术

InnoDB 在 RR 级别下，**彻底解决幻读**的两条路径：

### 4.1 快照读 vs 当前读

| 读类型 | SQL 示例 | 解决幻读的机制 |
|--------|----------|--------------|
| **快照读（Snapshot Read）** | 普通 `SELECT` | **MVCC**：读的是历史版本，别人插了新数据也看不见 |
| **当前读（Current Read）** | `SELECT ... FOR UPDATE`、`UPDATE`、`DELETE`、`INSERT` | **Next-Key Lock**：锁住记录 + 间隙，阻止插入 |

```
同一个 SQL 的不同"读"类型：

  SELECT * FROM users WHERE age = 25;
  → 快照读（无锁，基于 MVCC，读到的是事务开始时的快照）

  SELECT * FROM users WHERE age = 25 FOR UPDATE;
  → 当前读（加锁，读到的是最新的已提交数据 + 对数据加排他锁）

  UPDATE users SET name = '李四' WHERE age = 25;
  → 当前读（UPDATE 内部先执行当前读找到行，再修改）
```

#### 实战场景：抢购接口中的超卖问题

> 假设你正在写一个抢购接口，库存表中当前只有 **1 件**商品。

**❌ 错误写法：快照读导致的灾难**

```
-- 初始状态：goods 表，id=1，stock=1

事务 A                              事务 B
──────────────────────────────────────────────────────────
BEGIN;
SELECT stock FROM goods            BEGIN;
WHERE id = 1;                      SELECT stock FROM goods
→ 快照读，拿到 stock = 1           WHERE id = 1;
                                   → 快照读，也拿到 stock = 1

-- A 觉得库存够，扣减：
UPDATE goods SET stock =
stock - 1 WHERE id = 1;

                                   -- B 也觉得库存够，扣减：
                                   UPDATE goods SET stock =
                                   stock - 1 WHERE id = 1;

COMMIT;                            COMMIT;

-- 结果：stock 变成了 -1，超卖发生！ 💥
```

**问题根因**：普通 `SELECT` 是快照读，基于 MVCC 读历史版本，**无锁**。两个事务同时读到 `stock=1`，都认为自己可以扣减。`UPDATE` 内部的当前读虽然会加锁，但为时已晚——逻辑判断已经做完了。

**✅ 正确写法：当前读的威力**

```
-- 初始状态：goods 表，id=1，stock=1

事务 A                              事务 B
──────────────────────────────────────────────────────────
BEGIN;
SELECT stock FROM goods            BEGIN;
WHERE id = 1 FOR UPDATE;           SELECT stock FROM goods
→ 当前读，拿到 stock = 1           WHERE id = 1 FOR UPDATE;
→ 对 id=1 加 X 锁 🔒               → 🚫 被阻塞！等待锁...

-- A 放心扣减：
UPDATE goods SET stock =
stock - 1 WHERE id = 1;

COMMIT;  -- 释放锁 🔓
                                   → 🔓 终于拿到锁
                                   → 当前读，拿到最新的 stock = 0
                                   → 判断库存不足，抛异常！

-- 结果：stock = 0，完美防住超卖 ✅
```

**核心要点**：

| 对比维度 | 快照读 `SELECT` | 当前读 `SELECT ... FOR UPDATE` |
|----------|----------------|-------------------------------|
| 是否加锁 | ❌ 无锁 | ✅ 加 X 锁（排他锁） |
| 读到什么 | MVCC 历史快照 | 最新已提交数据 |
| 并发安全 | 不安全，会超卖 | 安全，串行化访问 |
| 性能影响 | 高并发、无阻塞 | 并发下降，但数据正确 |

> **一句话总结**：在需要"先读后写"且读写之间有逻辑判断的场景（如库存扣减、余额变更），**必须用当前读加锁**，普通快照读只是"看个热闹"。

### 4.2 行锁 (Record Lock)

**锁住单条索引记录**，阻止其他事务对该行的修改。

```
表：users (id PRIMARY KEY, name, age)
数据：id ∈ {5, 10, 15, 20}

事务 A: SELECT * FROM users WHERE id = 10 FOR UPDATE;
        → 对 id=10 这条记录加 X 锁
        → 事务 B 的 UPDATE users SET ... WHERE id = 10 被阻塞

        [5]   [10]🔒   [15]   [20]
               ↑
          Record Lock：只锁 id=10 这一条
```

### 4.3 间隙锁 (Gap Lock)

**锁住索引记录之间的间隙**，阻止其他事务往这个间隙里 `INSERT`。

```
表：id ∈ {5, 10, 15, 20}
间隙：( -∞, 5 )、( 5, 10 )、( 10, 15 )、( 15, 20 )、( 20, +∞ )

事务 A: SELECT * FROM users WHERE id BETWEEN 10 AND 15 FOR UPDATE;
        → 对间隙 (5, 10)、(10, 15)、(15, 20) 加 Gap Lock

        [5]  ──[gap]──  [10]🔒  ──[gap]──  [15]🔒  ──[gap]──  [20]
         ↑              ↑                  ↑                  ↑
    间隙锁不锁行，只锁区间。事务 B 不能在这些间隙中 INSERT
    但可以 UPDATE id=5 或 id=20（这些行没被行锁锁住）
```

**关键特性**：
- 间隙锁**不互斥**：两个事务可以同时持有同一个间隙的 Gap Lock
- 间隙锁只阻止 `INSERT`，不阻止 `SELECT` 或其他间隙上的 Gap Lock
- 目的是**防止幻读**——新行只能插入到不被锁住的间隙中

### 4.4 临键锁 (Next-Key Lock)

**Next-Key Lock = Record Lock + Gap Lock**（前开后闭区间）

```
表：id ∈ {5, 10, 15}

Next-Key Lock 锁住的区间：
  ( -∞, 5 ]  ( 5, 10 ]  ( 10, 15 ]  ( 15, +∞ )
  左开右闭

事务 A: SELECT * FROM users WHERE id > 8 AND id < 15 FOR UPDATE;
        → Next-Key Lock 锁住 (5, 10] + (10, 15]
        → 阻止：
          - 修改 id=10、id=15 的记录（Record Lock）
          - 在 (5,10)、(10,15) 区间插入新记录（Gap Lock）

         -∞ ···  [5]  ──(5,10]──  [10]🔒  ──(10,15]──  [15]🔒  ──(15,+∞)──  ...
                    ↑               ↑                   ↑
                 锁住 id=5        锁住 (5,10]          锁住 (10,15]
               (前开后闭：        (前开后闭：           (前开后闭：
                间隙+记录)         间隙+记录)            间隙+记录)
```

### 4.5 加锁规则实战

等值查询和范围查询的加锁行为不同：

| 查询类型 | 命中情况 | 加的锁 |
|----------|---------|--------|
| **等值查询命中** | 命中存在的记录 | 命中记录的 Record Lock + **两边间隙各一个 Gap Lock**（退化为两个 Gap Lock） |
| **等值查询未命中** | 没找到记录 | 所在间隙的 Gap Lock |
| **范围查询** | — | 范围内的 Next-Key Lock |

```sql
-- 表数据：id ∈ {5, 10, 15, 20}，主键索引

-- ① 等值查询命中
SELECT * FROM t WHERE id = 10 FOR UPDATE;
-- 加锁：(5, 10] Next-Key → 退化为 (5,10) Gap + id=10 Record + (10,15) Gap

-- ② 等值查询未命中
SELECT * FROM t WHERE id = 12 FOR UPDATE;
-- 加锁：(10, 15) Gap Lock ← 阻止插入 11~14

-- ③ 范围查询
SELECT * FROM t WHERE id >= 10 AND id < 15 FOR UPDATE;
-- 加锁：(5, 10] Next-Key + (10, 15] Next-Key
```

> **小提示**：唯一索引等值查询命中时，Next-Key Lock 会**退化为 Record Lock**。但间隙锁部分保留，仍然防止幻读。

---

## 5. 常见面试题

### Q1：MVCC 是如何解决不可重复读的？

**A1**：在 RR 隔离级别下，事务**第一次 SELECT** 时生成 Read View，之后复用同一个 Read View。版本链中只有 `trx_id < min_trx_id`（快照前已提交）或 `trx_id == creator_trx_id`（自己修改）的版本可见。后续其他事务即使提交了修改，其 `trx_id` 要么 `>= max_trx_id`，要么在 `m_ids` 中——对当前事务不可见。因此同一事务内多次读取看到的数据始终一致。

### Q2：RR 级别下如何彻底解决幻读？

**A2**：分场景作答：

1. **快照读（普通 SELECT）**：靠 **MVCC**——读的是快照生成时的数据版本，别人 INSERT 的新行对当前事务不可见
2. **当前读（SELECT FOR UPDATE / UPDATE / DELETE）**：靠 **Next-Key Lock**——锁住记录 + 间隙，阻止其他事务在间隙中 INSERT

两者结合，RR 级别下的幻读被**彻底解决**。

### Q3：RC 和 RR 的区别，以及各自适用场景？

**A3**：

| 维度 | RC | RR |
|------|-----|-----|
| Read View 生成 | 每次 SELECT 都生成新的 | 事务内首次 SELECT 生成，之后复用 |
| 不可重复读 | 存在 | 解决 |
| 幻读 | 存在 | 解决 |
| 间隙锁 | **不使用** | 使用（可能增大死锁概率） |
| 并发性能 | 更高（锁少） | 较低（间隙锁影响并发插入） |
| 适用场景 | 高并发 OLTP，读写频繁 | 需要事务内数据一致性（如对账、报表） |
| 大厂实践 | 阿里等将默认隔离级别设为 RC | MySQL InnoDB 默认 |

### Q4：什么是快照读？什么是当前读？

**A4**：

```sql
-- 快照读：基于 MVCC，无锁，读历史快照
SELECT * FROM users WHERE age = 25;

-- 当前读：加锁，读最新已提交版本
SELECT * FROM users WHERE age = 25 FOR UPDATE;  -- 加 X 锁
SELECT * FROM users WHERE age = 25 LOCK IN SHARE MODE;  -- 加 S 锁
UPDATE users SET name = 'x' WHERE age = 25;  -- 内部用当前读
DELETE FROM users WHERE age = 25;  -- 内部用当前读
```

### Q5：Undo Log 和 Redo Log 的区别是什么？

**A5**：

| 维度 | Undo Log | Redo Log |
|------|----------|----------|
| **目的** | 回滚事务 + MVCC 版本链 | 崩溃恢复，确保持久性 |
| **记录内容** | 修改前的旧值（逻辑日志） | 修改后的新值（物理日志） |
| **写入时机** | 修改数据前 | 修改数据后（事务提交时刷盘） |
| **是否可删除** | Purge 线程在无事务需要时清理 | Checkpoint 后覆盖 |
| **对应 ACID** | A（原子性）+ I（MVCC 基础） | D（持久性） |

---

## 6. 总结

### 6.1 事务机制全景

```
┌─────────────────────────────────────────────────────────────┐
│                  InnoDB 事务机制全景                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ACID                                                      │
│   ├── 原子性 (A) ←── Undo Log                               │
│   ├── 一致性 (C) ←── A + I + D + 业务约束                    │
│   ├── 隔离性 (I) ←── MVCC (快照读) + 锁 (当前读)              │
│   └── 持久性 (D) ←── Redo Log (WAL)                         │
│                                                             │
│   ┌─────────────────────────────────────────┐               │
│   │              MVCC 架构                    │               │
│   │                                         │               │
│   │   隐藏列 (trx_id, roll_ptr)             │               │
│   │         ↓                               │               │
│   │   Undo Log 版本链 (旧版本链表)           │               │
│   │         ↓                               │               │
│   │   Read View (一致性视图快照)             │               │
│   │   ┌─────────────────────────┐           │               │
│   │   │ m_ids, min/max_trx_id   │           │               │
│   │   │ 可见性规则判断           │           │               │
│   │   └─────────────────────────┘           │               │
│   └─────────────────────────────────────────┘               │
│                                                             │
│   ┌─────────────────────────────────────────┐               │
│   │              锁体系                       │               │
│   │                                         │               │
│   │   Record Lock ── 锁单行                  │               │
│   │   Gap Lock    ── 锁间隙，阻止 INSERT      │               │
│   │   Next-Key Lock ── Record + Gap          │               │
│   └─────────────────────────────────────────┘               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 关键设计原则

| 原则 | 说明 |
|------|------|
| **MVCC 无锁读** | 快照读基于版本链 + Read View，完全无锁，写不阻塞读 |
| **Read View 时机决定隔离级别** | RC 每次重新生成，RR 复用同一个——同一个 MVCC 机制，不同策略表现不同行为 |
| **当前读靠锁** | `FOR UPDATE`、`UPDATE`、`DELETE` 必须加锁，读到最新数据 |
| **Next-Key Lock = 行锁 + 间隙锁** | 当前读防止幻读的终极武器 |
| **WAL 先写日志** | Redo Log 顺序写，将随机写转为顺序写，保证持久性 + 高性能 |
| **Undo Log 多重使命** | 既支持回滚（原子性），又支撑 MVCC（隔离性） |

### 6.3 快速排查清单

| 排查点 | 看什么 | 工具/命令 |
|--------|--------|-----------|
| 当前事务隔离级别 | `transaction_isolation` 变量 | `SHOW VARIABLES LIKE '%isolation%'` |
| 是否有长时间未提交的事务 | `trx_state`、`trx_started` | `SELECT * FROM information_schema.INNODB_TRX` |
| 锁等待/死锁 | `lock_mode`、`lock_type` | `SHOW ENGINE INNODB STATUS`、`INNODB_LOCKS`、`INNODB_LOCK_WAITS` |
| Undo Log 膨胀 | `history_list_length` | `SHOW ENGINE INNODB STATUS`（长事务导致 Undo 无法 Purge） |
| Redo Log 刷盘策略 | `innodb_flush_log_at_trx_commit` | `SHOW VARIABLES LIKE '%flush_log%'` |

### 6.4 一句口诀

> **Undo 回滚 MVCC，Redo 持久 WAL 提；快照无锁读旧版，当前加锁防幻欺。**

---

## 相关链接

- [MySQL 索引底层与优化](/posts/mysql/mysql-索引底层与优化/)
- [MySQL 官方文档 — InnoDB Multi-Versioning](https://dev.mysql.com/doc/refman/8.0/en/innodb-multi-versioning.html)
- [MySQL 官方文档 — InnoDB Locking](https://dev.mysql.com/doc/refman/8.0/en/innodb-locking.html)

---

*本文基于 MySQL 8.0 / InnoDB 引擎编写，核心概念（MVCC 版本链、Read View 可见性规则、Next-Key Lock）在所有 5.6+ 版本中通用。*
