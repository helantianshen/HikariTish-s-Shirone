---
title: CRUD查询
published: 2026-07-30
description: 关于「CRUD查询」的技术笔记。
tags:
  - gorm
  - 数据库
category: Gorm
pinned: false
draft: false
comment: true
lang: zh_CN
---

# GORM CRUD 查询

## 两种 API 风格

| 风格 | 错误返回 | 类型安全 | 适合场景 |
| --- | --- | --- | --- |
| Traditional API | `result.Error` | 依赖目标结构体和运行时 | 兼容已有项目、复杂链式查询 |
| Generics API | 操作直接返回 `error` | `gorm.G[T]` 提供更明确的类型 | 新代码、希望减少 `.Error` 遗漏 |

两种 API 可以共用同一个 `*gorm.DB`，不要在同一函数里无理由混用。

## Create

```go
user := User{Name: "Alice", Email: "alice@example.com"}
result := db.Create(&user)
if result.Error != nil {
	return result.Error
}
fmt.Println(user.ID, result.RowsAffected)
```

批量创建：

```go
users := []User{
	{Name: "Alice", Email: "alice@example.com"},
	{Name: "Bob", Email: "bob@example.com"},
}
if err := db.CreateInBatches(&users, 100).Error; err != nil {
	return err
}
```

只写入指定字段：

```go
db.Select("Name", "Email").Create(&user)
db.Omit("UpdatedAt").Create(&user)
```

## Read

```go
var user User
if err := db.First(&user, 10).Error; err != nil {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		// 没找到记录
	}
	return err
}

var users []User
result := db.Where("age >= ?", 18).
	Order("created_at DESC").
	Find(&users)
if result.Error != nil {
	return result.Error
}
```

`First` 按主键或默认排序拿一条记录；`Take` 不保证排序；`Find` 用于多条记录。不要把 `Find` 当成“肯定找到一条”的方法。

Generics API：

```go
ctx := context.Background()
user, err := gorm.G[User](db).Where("id = ?", 10).First(ctx)
users, err := gorm.G[User](db).
	Where("age >= ?", 18).
	Order("created_at DESC").
	Find(ctx)
```

## Update

更新单列：

```go
result := db.Model(&user).Update("name", "Carol")
```

结构体更新：

```go
// 默认跳过结构体零值，例如 Age=0 可能不会被更新
result := db.Model(&user).Updates(User{Name: "Carol", Age: 20})

// 需要明确更新零值时使用 map
result = db.Model(&user).Updates(map[string]any{
	"name": "Carol",
	"age":  0,
})
```

批量更新必须带条件：

```go
result := db.Model(&User{}).
	Where("status = ?", "inactive").
	Updates(map[string]any{"archived": true})
if errors.Is(result.Error, gorm.ErrMissingWhereClause) {
	// GORM 阻止了无条件批量更新
}
```

## Delete

```go
if err := db.Delete(&user).Error; err != nil {
	return err
}

// 按主键删除
db.Delete(&User{}, user.ID)

// 批量删除必须带条件
db.Where("status = ?", "inactive").Delete(&User{})
```

使用 `gorm.DeletedAt` 时，上面的删除是软删除；需要物理删除必须显式使用 `Unscoped()`。

## 安全边界

- 所有用户输入都通过 `?`、命名参数、结构体或 `map` 传递，不要字符串拼接 SQL 值。
- 更新和删除默认要求条件；不要为了省事全局打开 `AllowGlobalUpdate`。
- `RowsAffected` 只能说明受影响行数，不等同于业务成功，仍要检查 `Error`。
- `Save` 会保存全部字段，可能覆盖不希望修改的列；局部修改优先使用 `Select`、`Updates`。

## 复用查询对象的坑

链式方法会在 statement 中累积条件。更安全的方式是从干净的 `db` 开始每个逻辑查询，或使用 `Session`：

```go
base := db.Where("tenant_id = ?", tenantID)

var active []User
base.Session(&gorm.Session{}).
	Where("status = ?", "active").
	Find(&active)

var disabled []User
base.Session(&gorm.Session{}).
	Where("status = ?", "disabled").
	Find(&disabled)
```

不要把一个已经附带业务条件的 `*gorm.DB` 当成全局可变查询对象反复复用。

## 官方资料

- [Create](https://gorm.io/docs/create.html)
- [Query](https://gorm.io/docs/query.html)
- [Update](https://gorm.io/docs/update.html)
- [Delete](https://gorm.io/docs/delete.html)
- [Method Chaining](https://gorm.io/docs/method_chaining.html)
