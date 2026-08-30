---
title: 原生SQL与Scopes
published: 2026-07-30
description: 关于「原生SQL与Scopes」的技术笔记。
tags:
  - gorm
  - 数据库
category: Gorm
pinned: false
draft: false
comment: true
lang: zh_CN
---

# GORM 原生 SQL 与 Scopes

## Raw 查询

复杂查询可以使用 Raw，并把结果扫描到结构体：

```go
type UserStat struct {
	Status string
	Count  int64
}

var stats []UserStat
err := db.Raw(`
	SELECT status, COUNT(*) AS count
	FROM users
	WHERE created_at >= ?
	GROUP BY status
`, startAt).Scan(&stats).Error
```

`Raw` 适合 SQL 本身就是主要表达方式的场景；不要为了少写一个 `Where` 而把所有查询都改成字符串 SQL。

## Exec 写操作

```go
result := db.Exec(
	"UPDATE users SET status = ? WHERE id IN ?",
	"inactive",
	[]uint{1, 2, 3},
)
if result.Error != nil {
	return result.Error
}
fmt.Println(result.RowsAffected)
```

值使用参数绑定；表名、列名和排序方向不能直接用用户输入，必须使用服务端白名单映射。

## 命名参数

```go
db.Raw(
	"SELECT * FROM users WHERE name = @name AND age >= @age",
	sql.Named("name", "Alice"),
	sql.Named("age", 18),
).Scan(&users)
```

命名参数适合参数较多的 SQL，可以减少参数位置错位。

## SQL Builder 与表达式

```go
db.Model(&Account{}).
	Where("id = ?", id).
	Update("balance", gorm.Expr("balance + ?", amount))
```

`gorm.Expr` 适合让数据库执行原子表达式，例如计数加一、余额扣减；仍然要让表达式中的值走参数绑定。

## Raw 不能随意继续链式查询

```go
// Raw 已经表达了完整 SQL，不能期望后续 Where 自动安全地拼接到所有场景
db.Raw("SELECT * FROM users WHERE status = ?", "active").Scan(&users)
```

如果查询需要大量动态条件，优先用 GORM 链式 API、Scopes 或 SQL Builder 构造，再用 DryRun 检查结果。

## 可复用 Scopes

```go
func Tenant(tenantID uint) func(*gorm.DB) *gorm.DB {
	return func(db *gorm.DB) *gorm.DB {
		return db.Where("tenant_id = ?", tenantID)
	}
}

func WithKeyword(keyword string) func(*gorm.DB) *gorm.DB {
	return func(db *gorm.DB) *gorm.DB {
		if keyword == "" {
			return db
		}
		return db.Where("name LIKE ?", "%"+keyword+"%")
	}
}

db.Scopes(Tenant(tenantID), WithKeyword(keyword)).Find(&users)
```

Scope 的职责是追加查询条件，保持纯粹、可组合、可测试。认证租户条件可以作为 Repository 的强制入口，避免调用方忘记追加。

## DryRun 检查 SQL

```go
stmt := db.Session(&gorm.Session{DryRun: true}).
	Scopes(Tenant(1)).
	Where("status = ?", "active").
	Find(&User{}).Statement

fmt.Println(stmt.SQL.String())
fmt.Printf("vars: %#v\n", stmt.Vars)
```

DryRun 只检查 SQL 构造结果；上线前仍要在目标数据库执行 `EXPLAIN` 和真实压测。

## 原生 SQL 使用边界

- 先判断 GORM API 是否已经能清楚表达需求。
- 原生 SQL 统一放在 Repository 层，避免散落在 Handler 中。
- 为每个原生 SQL 编写目标数据库测试，尤其是方言差异。
- 对字段别名和扫描结构体建立明确约定。
- 所有输入参数绑定；动态标识符使用白名单。

## 官方资料

- [SQL Builder](https://gorm.io/docs/sql_builder.html)
- [Scopes](https://gorm.io/docs/scopes.html)
- [Method Chaining](https://gorm.io/docs/method_chaining.html)
