---
title: GORM配置项
published: 2026-07-30
description: 关于「GORM配置项」的技术笔记。
tags:
  - gorm
  - 数据库
  - 工程实践
category: Gorm
pinned: false
draft: false
comment: true
lang: zh_CN
---

# GORM 配置项

## 基础配置

```go
db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
	SkipDefaultTransaction: true,
	PrepareStmt:             true,
	NamingStrategy: schema.NamingStrategy{
		TablePrefix:   "t_",
		SingularTable: true,
		NameReplacer:  strings.NewReplacer("CID", "Cid"),
	},
	Logger: logger.Default.LogMode(logger.Warn),
})
```

## 常用 `gorm.Config`

| 配置 | 作用 | 使用建议 |
| --- | --- | --- |
| `SkipDefaultTransaction` | 写操作不自动包裹默认事务 | 只有确认业务不依赖默认事务且完成压测后再开启 |
| `PrepareStmt` | 缓存 prepared statement | 适合重复 SQL；注意 statement 和连接资源开销 |
| `NamingStrategy` | 表名、列名和关系名命名策略 | 项目启动时统一设置，避免中途改变 |
| `Logger` | SQL、耗时和错误日志 | 开发用 Info，生产通常 Warn/Error |
| `NowFunc` | 自定义时间来源 | 测试固定时间或统一时区时使用 |
| `DryRun` | 只生成 SQL，不真正执行 | 调试和测试 SQL 形状 |
| `TranslateError` | 尝试把驱动错误转换为 GORM 通用错误 | 仍需保留原始错误用于排查 |
| `DisableForeignKeyConstraintWhenMigrating` | AutoMigrate 时不创建外键约束 | 只有有明确迁移策略时使用 |
| `CreateBatchSize` | 设置批量创建默认批次 | 大批量导入时结合数据库限制调节 |
| `DisableNestedTransaction` | 禁用嵌套事务的保存点行为 | 需要理解事务边界后再改 |

## 命名策略

```go
NamingStrategy: schema.NamingStrategy{
	TablePrefix:         "t_",  // users -> t_users
	SingularTable:       true,  // User -> user
	NoLowerCase:         false,
	IdentifierMaxLength: 64,
}
```

命名策略属于全局约定。项目已经上线后不要随意修改，否则同一模型可能映射到另一张表。

单个模型需要覆盖表名时：

```go
func (Order) TableName() string {
	return "orders_archive"
}
```

## 日志配置

```go
newLogger := logger.New(
	log.New(os.Stdout, "\r\n", log.LstdFlags),
	logger.Config{
		SlowThreshold:             200 * time.Millisecond,
		LogLevel:                  logger.Warn,
		IgnoreRecordNotFoundError: true,
		ParameterizedQueries:      true,
		Colorful:                  false,
	},
)
```

`ParameterizedQueries: true` 可以避免日志打印完整参数，降低敏感数据泄露风险；需要排查具体参数时，应在受控环境短暂调整日志，而不是长期打开。

## Session 级配置

不是所有配置都应该放到初始化阶段。一次操作需要特殊行为时，使用 `Session`：

```go
// 只允许这个操作无条件更新，慎用
err := db.Session(&gorm.Session{
	AllowGlobalUpdate: true,
}).Model(&User{}).Update("status", "inactive").Error

// 只对这次会话启用 Debug
db.Session(&gorm.Session{Logger: logger.Default.LogMode(logger.Info)}).
	Where("id = ?", id).
	First(&user)
```

避免把 `AllowGlobalUpdate` 设置到全局配置；无条件更新和删除应默认被拦截。

## `Debug`、`DryRun` 和 `ToSQL`

```go
// 临时打印本次操作的 SQL
db.Debug().Where("email = ?", email).First(&user)

// 只构建 SQL，不发送到数据库
stmt := db.Session(&gorm.Session{DryRun: true}).
	Where("age > ?", 18).
	Find(&users).Statement
fmt.Println(stmt.SQL.String(), stmt.Vars)
```

DryRun 适合检查 SQL 结构，但不能证明数据库实际执行计划、索引选择或权限都正确。

## 配置分层建议

- 应用启动配置：数据库驱动、`gorm.Config`、日志、命名策略。
- 环境配置：DSN、连接池、日志级别、慢 SQL 阈值。
- 请求级配置：`WithContext`、Debug、超时和事务。
- 测试配置：SQLite/临时数据库、DryRun、固定 `NowFunc`。

## 官方资料

- [GORM Config](https://gorm.io/docs/gorm_config.html)
- [Logger](https://gorm.io/docs/logger.html)
- [Session](https://gorm.io/docs/session.html)
