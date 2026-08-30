---
title: MySQL Using filesort 调优
published: 2026-05-27
description: 关于「MySQL Using filesort 调优」的技术笔记。
tags:
  - mysql
  - SQL 优化
  - 性能优化
category: Mysql
pinned: false
draft: false
comment: true
lang: zh_CN
---

> `EXPLAIN` 的 `Extra` 字段中出现 `Using filesort` **并不意味着一定发生了磁盘文件排序**。它的真正含义是：MySQL 无法利用索引的有序性直接返回结果，必须在内存（`sort_buffer`）或磁盘中**额外执行一次排序操作**。理解 filesort 的触发条件、内存/磁盘两条路径、以及如何通过索引消除它，是日常 SQL 调优的基本功。

---

## 目录

1. [什么是 Using filesort](#1-什么是-using-filesort)
2. [filesort 的两种执行路径](#2-filesort-的两种执行路径)
3. [filesort 的触发场景](#3-filesort-的触发场景)
4. [实战调优：如何消灭 Using filesort](#4-实战调优如何消灭-using-filesort)
   - [4.1 方案 1：让索引天然有序](#41-方案-1让索引天然有序)
   - [4.2 方案 2：缩小排序数据集](#42-方案-2缩小排序数据集)
1. [sort_buffer_size 的调优权衡](#5-sort_buffer_size-的调优权衡)
2. [常见面试题](#6-常见面试题)
3. [总结](#7-总结)

---

## 1. 什么是 Using filesort

### 1.1 破除望文生义

在 `EXPLAIN` 的结果中，如果在 `Extra` 字段看到 `Using filesort`，**它不等于"使用了磁盘文件"**。这个名字是 MySQL 内部的一个历史遗留术语，无数开发者在面试和排查中在这里栽过跟头。

它的真正含义：

> **MySQL 无法利用索引的天然有序性直接返回结果，必须在 `sort_buffer` 中重新对结果集执行一次排序。**

```
有索引排序（理想）：
  ORDER BY age
  → idx_age 的 B+ 树叶子节点天然按 age 有序
  → 顺着链表读就行，零排序成本 ✅
  → EXPLAIN Extra: Using index

无索引排序（filesort）：
  ORDER BY age
  → age 上没有索引，全表扫描出所有行
  → 把数据扔进 sort_buffer，执行快速排序
  → EXPLAIN Extra: Using filesort ❌
```

### 1.2 为什么叫 "filesort"

MySQL 早期的排序实现中，如果排序数据超过了内存限制，确实会把数据写到磁盘临时文件，再用归并排序处理。这个词就此沿用至今。但现在即便排序全程在内存中完成，也会显示 `Using filesort`。

| 字面暗示 | 实际含义 |
|----------|----------|
| 文件排序 | 无法利用索引排序 → 需要"手动"排序 |
| 一定用到磁盘 | **不一定**——数据量小则在内存完成 |
| 排序一定慢 | 小数据集内存排序很快，大数据集磁盘排序才慢 |

---

## 2. filesort 的两种执行路径

MySQL 为每个线程分配了一块专用的排序内存 —— `sort_buffer_size`。filesort 具体走哪条路，取决于要排序的数据量是否超出这块内存。

### 2.1 路径 A：全内存排序（快速排序）

```
数据量 ≤ sort_buffer_size 时：

  ① 全表扫描 → 把需要的字段读入 sort_buffer
  ② 在内存中执行快速排序（Quicksort）
  ③ 返回排好序的结果

  全程无磁盘 I/O，纯 CPU 操作，相对较快
```

**特点**：不产生磁盘临时文件，但仍然需要额外的 CPU 用于排序计算。对于几万行的小数据集，开销可控。

### 2.2 路径 B：磁盘临时文件排序（归并排序）

```
数据量 > sort_buffer_size 时：

  ① 全表扫描 → 数据分批读入 sort_buffer
  ② 每批在内存中排序后写入磁盘临时文件
  ③ 对所有临时文件执行归并排序（Merge Sort）
  ④ 返回排好序的结果

  此时"file sort"名副其实——产生了大量磁盘 I/O，性能跳水
```

**这是真正的性能灾难**：假设千万级大表中捞出 50 万行，`sort_buffer_size` 默认只有 256KB，数据会被切成几百个临时文件，磁盘 I/O 激增。

### 2.3 如何判断走了哪条路径

MySQL 提供了 `optimizer_trace` 来精准定位：

```sql
-- 开启 optimizer trace
SET optimizer_trace = 'enabled=on';

-- 执行你的 SQL
SELECT * FROM orders ORDER BY create_time;

-- 查看排序详情
SELECT * FROM information_schema.OPTIMIZER_TRACE\G

-- 关闭
SET optimizer_trace = 'enabled=off';
```

输出中查看 `filesort_priority_queue_optimization` 和 `number_of_tmp_files`：

```
"filesort_summary": {
  "rows": 150000,
  "examined_rows": 150000,
  "number_of_tmp_files": 0,      ← 0 → 全内存排序 ✅
  "sort_buffer_size": 262144,
  "sort_mode": "<sort_key, packed_additional_fields>"
}

"filesort_summary": {
  "rows": 150000,
  "examined_rows": 150000,
  "number_of_tmp_files": 28,     ← 28 个临时文件 → 磁盘排序 ❌
  "sort_buffer_size": 262144,
  "sort_mode": "<sort_key, packed_additional_fields>"
}
```

**关键字段**：

| 字段 | 含义 |
|------|------|
| `number_of_tmp_files` | **值为 0** → 全内存排序；**大于 0** → 磁盘归并排序，数字越大越糟糕 |
| `sort_buffer_size` | 当前分配到的 sort_buffer 大小 |
| `sort_mode` | 排序模式（是否包含 rowid、是否打包字段等） |
| `rows` | 参与排序的行数 |

也可以通过状态变量监控：

```sql
SHOW GLOBAL STATUS LIKE '%sort%';
```

| 变量 | 含义 |
|------|------|
| `Sort_merge_passes` | 归并排序的趟数，值越大说明磁盘排序越频繁 |
| `Sort_range` | 通过索引范围扫描引发的排序次数 |
| `Sort_scan` | 通过全表扫描引发的排序次数 |
| `Sort_rows` | 累计参与排序的行数 |

---

## 3. filesort 的触发场景

并非只有 `ORDER BY` 会触发 filesort。以下操作在没有合适索引时，都会产生排序需求：

| SQL 操作 | 示例 | 触发原因 |
|----------|------|----------|
| `ORDER BY` | `ORDER BY age` | age 列没有索引，无法利用 B+ 树的有序性 |
| `GROUP BY` | `GROUP BY city` | MySQL 默认通过排序实现分组（除非有索引直接按组返回） |
| `DISTINCT` | `SELECT DISTINCT city` | MySQL 通过排序去重（除非利用索引的有序性） |
| `UNION`（无 ALL） | `SELECT ... UNION SELECT ...` | UNION 默认去重，需要排序去重 → `Using temporary; Using filesort` |
| 窗口函数 | `ROW_NUMBER() OVER (ORDER BY ...)` | 排序是窗口函数执行的前提 |
| 多字段混合排序 | `ORDER BY a ASC, b DESC` | 如果索引是 `(a ASC, b ASC)`，b 降序与索引方向相反 → filesort |

### 3.1 GROUP BY 与 filesort

```sql
-- 假设 city 上没有索引

-- 这条 SQL 会触发 filesort（通过排序实现分组）
SELECT city, COUNT(*) FROM users GROUP BY city;
-- Extra: Using filesort

-- 这条也一样（DISTINCT 靠排序去重）
SELECT DISTINCT city FROM users;
-- Extra: Using filesort
```

如果 `city` 上有索引，MySQL 可以直接利用 B+ 树的顺序来遍历每个唯一值，文件和临时表都不需要：

```sql
ALTER TABLE users ADD INDEX idx_city(city);

SELECT city, COUNT(*) FROM users GROUP BY city;
-- Extra: Using index  ← 完美
```

### 3.2 混排方向导致的 filesort

```sql
INDEX idx_a_b ON t(a ASC, b ASC)  -- 索引中 a 升序，b 升序

-- ✅ 排序方向与索引一致 → 不走 filesort
SELECT * FROM t ORDER BY a ASC, b ASC;

-- ❌ b 降序与索引方向冲突 → filesort！
SELECT * FROM t ORDER BY a ASC, b DESC;
```

MySQL 8.0 引入了**降序索引**（`INDEX idx ON t(a ASC, b DESC)`），可以让 `ORDER BY a ASC, b DESC` 完美走索引。但 5.7 及以前不支持，混排方向必然 filesort。

### 3.3 未满足最左前缀

```sql
INDEX idx_a_b_c ON t(a, b, c)

-- ✅ ORDER BY 满足最左前缀 → 不走 filesort
SELECT * FROM t WHERE a = 1 ORDER BY b, c;

-- ❌ 跳过了 a → filesort
SELECT * FROM t ORDER BY b, c;

-- ⚠️ a 是范围查询，b 的排序信息失效 → filesort
SELECT * FROM t WHERE a > 1 ORDER BY b;
```

---

## 4. 实战调优：如何消灭 Using filesort

### 4.1 方案 1：让索引天然有序

**这是釜底抽薪的最高效解法**。核心思路：利用 B+ 树叶子节点天然有序（且用双向链表相连）的特性，让 SQL 直接顺着索引读，免去任何排序计算。

```
没有索引时：
  SELECT id, name, age FROM users ORDER BY age;
  → 全表扫描 → 把 age、name、id 全部读入 sort_buffer → 排序 → 返回
  → Using filesort ❌

加了索引后：
  ALTER TABLE users ADD INDEX idx_age(age);
  SELECT id, name, age FROM users ORDER BY age;
  → 顺着 idx_age 的 B+ 树叶子节点从左往右读
  → 拿到的数据天然按 age 升序排好 → 零排序成本
  → Using filesort 消失 ✅
```

**最佳实践：将 `WHERE` 和 `ORDER BY` 的列建在同一联合索引里**

```sql
-- ❌ 低效：单列索引只能解决一部分
SELECT * FROM orders WHERE user_id = 100 ORDER BY create_time;
-- INDEX idx_user ON orders(user_id);     ← 只解决 WHERE
-- INDEX idx_time ON orders(create_time);  ← 只解决 ORDER BY
-- MySQL 一次查询只用一棵索引，filesort 逃不掉

-- ✅ 高效：联合索引一步到位
ALTER TABLE orders ADD INDEX idx_user_time(user_id, create_time);
-- 先按 user_id 定位 → 组内 create_time 天然有序 → 零排序
-- EXPLAIN Extra: Using index condition（无 filesort）
```

**索引排序有效性速查**：

| 索引 `(a, b, c)` | ORDER BY 子句 | 是否走索引排序 |
|-------------------|--------------|--------------|
| ✅ | `ORDER BY a` | 满足最左前缀 |
| ✅ | `ORDER BY a, b` | 满足最左前缀 |
| ✅ | `ORDER BY a, b, c` | 完全匹配 |
| ✅ | `WHERE a = 1 ORDER BY b, c` | a 等值后，b, c 仍有序 |
| ❌ | `ORDER BY b` | 跳过 a，B+ 树无全局 b 排序 |
| ❌ | `ORDER BY b, c` | 同上 |
| ❌ | `WHERE a > 1 ORDER BY b` | a 是范围，b 的排序跨 a 值无序 |

### 4.2 方案 2：缩小排序数据集

当你因为多字段混排、复杂计算列排序等场景**无法利用索引排序**时，filesort 无法根除，那就必须**防止排序溢出到磁盘**。核心思路是减少 `sort_buffer` 的压力。

#### 4.2.1 坚决抵制 `SELECT *`

```sql
-- ❌ 灾难：一百个字段全拉出来，每行 > 1KB
SELECT * FROM orders ORDER BY create_time LIMIT 100;
-- sort_buffer 塞不下几行 → 频繁写磁盘临时文件

-- ✅ 只查业务必须的字段，每行 < 50B
SELECT id, order_no, amount FROM orders ORDER BY create_time LIMIT 100;
-- sort_buffer 能塞下更多行 → 大概率走全内存排序
```

**原理**：`sort_buffer` 中存放的是整行（或部分行），单行越小，内存里能放的行数越多，触发磁盘排序的阈值就越高。

#### 4.2.2 强制分页（LIMIT）

```sql
-- ❌ 排序 50 万行再取前 100 条
SELECT * FROM orders ORDER BY create_time;

-- ✅ 必要时分批取
SELECT * FROM orders ORDER BY create_time LIMIT 100;
SELECT * FROM orders ORDER BY create_time LIMIT 100 OFFSET 100;
```

排序 100 条和排序 50 万条的 CPU + 内存开销是天壤之别。即使 filesort 无法消灭，也要严格控制参与排序的行数。

---

## 5. sort_buffer_size 的调优权衡

`sort_buffer_size` 是每个线程可以使用的排序内存，默认值在 MySQL 8.0 中通常是 256KB。许多开发者第一反应是"把它调大不就好了"——但这里有个重要的**乘法陷阱**。

### 5.1 为什么不能盲目调大

```
sort_buffer_size = 256KB：
  100 个并发连接同时排序 → 100 × 256KB = 25MB  ← 可控

sort_buffer_size = 32MB：
  100 个并发连接同时排序 → 100 × 32MB = 3.2GB  ← 危险！
```

`sort_buffer_size` 是**按需分配**的：连接需要排序时才分配，但**高并发时可能同时有大量连接在执行排序**，总内存占用是单线程大小的 N 倍。

### 5.2 调优建议

| 场景 | 建议值 | 理由 |
|------|--------|------|
| 低并发、大数据量排序（后台报表） | 4MB ~ 16MB | 优先让排序在内存完成 |
| 高并发 OLTP（用户接口） | 256KB ~ 1MB | 避免内存被大量连接耗尽 |
| 默认 | 256KB | MySQL 8.0 默认值，适合大多数场景 |

### 5.3 根本之道

> **调大 `sort_buffer_size` 是止痛药，给排序字段建索引才是治病。** 通过索引让 filesort 消失，远好过跟 sort_buffer 内存博弈。

```
排查优先级：
  ① EXPLAIN 看有没有 filesort → 加索引消灭它（根治）
  ② 确定 filesort 不可避免 → 缩小 SELECT 列 + 加 LIMIT（缓解）
  ③ 仍有磁盘排序 → 监控 Sort_merge_passes → 适当调大 sort_buffer_size（兜底）
```

---

## 6. 常见面试题

### Q1：EXPLAIN 中看到 Using filesort，是否一定意味着发生了磁盘排序？

**A1**：**不一定**。`Using filesort` 只表示 MySQL 无法利用索引的有序性，需要自己做排序——排序可能在内存（`sort_buffer`）中完成，也可能溢出到磁盘。判断是否用了磁盘临时文件，需要查看 `optimizer_trace` 中的 `number_of_tmp_files` 字段：

- `number_of_tmp_files = 0` → 全内存排序
- `number_of_tmp_files > 0` → 发生了磁盘归并排序

### Q2：哪些 SQL 操作会触发 Using filesort？

**A2**：

| 操作 | 条件 |
|------|------|
| `ORDER BY` | 排序列没有索引，或索引顺序不匹配 |
| `GROUP BY` | 分组列没有索引（MySQL 默认用排序实现分组） |
| `DISTINCT` | 去重列没有索引（MySQL 通过排序去重） |
| `UNION`（无 ALL） | 去重操作需要排序 → `Using temporary; Using filesort` |
| 窗口函数 | `ROW_NUMBER() OVER (ORDER BY ...)` |
| 混排方向 | `ORDER BY a ASC, b DESC` 且索引是 `(a ASC, b ASC)` |

### Q3：如何消灭 Using filesort？

**A3**：核心思路是**让索引来提供有序性**：

1. **首选——给 `ORDER BY` 列加索引**，最好是跟 `WHERE` 条件一起建联合索引
2. **次选——缩小排序数据集**：只查需要的列（杜绝 `SELECT *`）、加 `LIMIT` 限制行数
3. **兜底——调大 `sort_buffer_size`**：当 filesort 无法避免时，尽量让排序在内存中完成

### Q4：GROUP BY 和 ORDER BY 的索引优化有什么异同？

**A4**：

- **相同点**：都依赖索引的有序性来避免 filesort，联合索引需满足最左前缀
- **不同点**：`GROUP BY` 可以用 **Loose Index Scan（松散索引扫描）** 直接跳读每个分组的第一个值，不一定需要全索引扫描；`ORDER BY` 需要 Tight Index Scan 从头到尾遍历

### Q5：sort_buffer_size 是不是越大越好？

**A5**：**不是**。`sort_buffer_size` 是每个线程独立分配的，高并发场景下总内存 = 单线程大小 × 并发连接数。盲目调大会导致 OOM。正确的优化路径是：**索引 > 缩小数据集成 > 调大 sort_buffer_size**。

---

## 7. 总结

### 7.1 filesort 全景

```
┌──────────────────────────────────────────────────────────────┐
│                   Using filesort 全景                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   Using filesort ≠ 一定用磁盘                                 │
│              ↓                                               │
│   ┌──────────────────────────────────────┐                   │
│   │   排序数据量 ≤ sort_buffer_size?       │                   │
│   └─────┬────────────────────┬───────────┘                   │
│      YES ↓              NO ↓                                 │
│   全内存排序             磁盘归并排序                           │
│   (Quicksort)          (Merge Sort)                          │
│   较快，CPU开销        大量磁盘I/O，性能跳水                     │
│                                                              │
│   排查工具：                                                   │
│     EXPLAIN → Extra: Using filesort                          │
│     optimizer_trace → number_of_tmp_files                    │
│     SHOW STATUS → Sort_merge_passes                          │
│                                                              │
│   消灭策略（优先级从高到低）：                                   │
│     ① 给 ORDER BY / GROUP BY 列建索引（尤其是联合索引）         │
│     ② 杜绝 SELECT *，只查必要字段                              │
│     ③ 加 LIMIT，限制排序行数                                   │
│     ④ 适当调大 sort_buffer_size（注意并发 × 内存的乘法陷阱）    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 7.2 关键设计原则

| 原则 | 说明 |
|------|------|
| **索引即有序** | B+ 树叶子节点天然有序 + 双向链表，加索引是消灭 filesort 的最高效手段 |
| **联合索引覆盖 WHERE + ORDER BY** | 一个联合索引同时解决定位和排序，一次查询只走一棵树 |
| **不满足最左前缀 → filesort** | ORDER BY 跳过了联合索引的最左列，B+ 树的排序信息不可用 |
| **filesort ≠ 磁盘** | 数据量小 → 内存排序；数据量 > `sort_buffer_size` → 磁盘排序 |
| **sort_buffer_size 有乘法陷阱** | 单线程 × N 个并发连接 = 真实内存占用 |
| **根治 > 缓解** | 索引消灭 filesort >> 调大 sort_buffer 兜底 |

### 7.3 快速排查清单

| 排查点 | 看什么 | 工具/命令 |
|--------|--------|-----------|
| 是否有 filesort | `EXPLAIN` 的 `Extra` 字段 | `EXPLAIN <SQL>` |
| 是否触发磁盘排序 | `number_of_tmp_files` | `SET optimizer_trace='enabled=on'` → 执行 SQL → 查 `OPTIMIZER_TRACE` |
| sort_buffer 大小 | `sort_buffer_size` | `SHOW VARIABLES LIKE 'sort_buffer_size'` |
| 全局排序统计 | `Sort_merge_passes` | `SHOW GLOBAL STATUS LIKE '%sort%'` |
| 排序是否走索引 | `EXPLAIN` 的 `key` + `Extra` | `Extra: Using index` 表示覆盖索引，filesort 消失 |

### 7.4 一句口诀

> **filesort 不是文件错，索引有序是解药；杜绝星号限行数，缓冲调大最后招。**

---

## 相关链接

- [MySQL 索引底层与优化](/posts/mysql/mysql-索引底层与优化/) — B+ 树为什么天生适合排序
- [MySQL 事务、MVCC 与锁](/posts/mysql/mysql-事务-mvcc-与锁/)
- [MySQL 日志与调优](/posts/mysql/mysql-日志与调优/)
- [MySQL 官方文档 — ORDER BY Optimization](https://dev.mysql.com/doc/refman/8.0/en/order-by-optimization.html)
- [MySQL 官方文档 — Internal Temporary Table Use](https://dev.mysql.com/doc/refman/8.0/en/internal-temporary-tables.html)

---

*本文基于 MySQL 8.0 / InnoDB 引擎编写，filesort 触发逻辑与 `sort_buffer_size` 行为在所有 5.6+ 版本中通用。*
