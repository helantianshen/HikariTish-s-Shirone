---
title: Gin项目集成
published: 2026-07-30
description: 关于「Gin项目集成」的技术笔记。
tags:
  - gorm
  - gin
  - 数据库
category: Gorm
pinned: false
draft: false
comment: true
lang: zh_CN
---

# GORM 与 Gin 项目集成

## 推荐分层

```text
cmd/api/main.go
  -> config：读取环境变量和配置文件
  -> database：创建 *gorm.DB、Ping、迁移、关闭
  -> repository：只处理持久化查询
  -> service：处理业务规则和事务边界
  -> handler：解析 HTTP 请求并返回响应
```

Handler 不应该直接拼接 GORM 查询；Service 不应该依赖 Gin 的 `*gin.Context`，只接收标准库 `context.Context` 和业务参数。

## 数据库依赖注入

```go
type UserRepository struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) FindByID(ctx context.Context, id uint) (User, error) {
	var user User
	err := r.db.WithContext(ctx).First(&user, id).Error
	return user, err
}
```

构造时传入 `*gorm.DB`，便于测试时替换为 SQLite、事务对象或 SQL mock；不要在 Repository 内部偷偷创建全局连接。

## Service 负责事务

```go
type UserService struct {
	db    *gorm.DB
	users *UserRepository
}

func NewUserService(db *gorm.DB, users *UserRepository) *UserService {
	return &UserService{db: db, users: users}
}

func (s *UserService) CreateUser(ctx context.Context, user User) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&user).Error; err != nil {
			return err
		}
		return tx.Create(&UserAudit{UserID: user.ID, Action: "created"}).Error
	})
}
```

如果 Repository 需要参与事务，可以让 Service 为事务创建绑定了 `tx` 的 Repository，或让 Repository 方法接收当前数据库句柄；关键是所有操作必须在同一个事务对象上。

## Handler 传递请求上下文

```go
func (h *UserHandler) Get(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	user, err := h.service.GetUser(c.Request.Context(), uint(id))
	if errors.Is(err, ErrUserNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	if err != nil {
		c.Error(err)
		return
	}

	c.JSON(http.StatusOK, user)
}
```

请求结束或取消时，数据库查询可以感知上下文。统一错误处理中间件负责把领域错误转换为 HTTP 响应，Handler 不要泄露数据库 DSN 或驱动错误详情。

## 启动与关闭

```go
func run() error {
	db, err := OpenDatabase()
	if err != nil {
		return err
	}
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	defer sqlDB.Close()

	if err := db.AutoMigrate(&User{}, &UserAudit{}); err != nil {
		return err
	}

	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())
	// 注册 handler、路由和服务

	server := &http.Server{
		Addr:              ":8080",
		Handler:           r,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	return server.ListenAndServe()
}
```

生产项目应使用 `signal.NotifyContext` 监听退出信号，先停止接收新请求，再等待在途请求完成，最后关闭 `sql.DB`。

## 测试策略

- Repository 集成测试使用临时 SQLite 或测试 MySQL，不依赖开发者本机数据。
- Service 测试重点验证事务成功、失败回滚和并发冲突。
- Handler 测试验证参数校验、HTTP 状态码和错误映射。
- 原生 SQL 和方言特性必须在目标数据库上测试，SQLite 不能证明 MySQL/PostgreSQL 行为一致。
- 测试结束清理数据库文件、连接和临时数据。

## 常见反模式

- 全局 `var DB *gorm.DB` 被所有包直接读写。
- Handler 中直接 `db.Where(...).Find(...)`，导致业务规则和持久化散落。
- 每个请求 `gorm.Open` 一次，绕过连接池复用。
- 用 `context.Background()` 替代请求上下文，导致取消和超时失效。
- 把数据库错误原样返回给客户端。
- 依赖启动时 AutoMigrate 承担全部生产迁移。

## 与现有 Gin 笔记的关系

Gin 目录原有的数据库连接示例已被提炼到：

- [快速开始](快速开始.md)
- [数据源配置](数据源配置.md)
- [连接池与性能优化](连接池与性能优化.md)

Gin 的路由、中间件、验证和响应格式继续参考 [Gin 框架](../Gin%20框架/快速入门.md) 等原有笔记。

## 官方资料

- [Context](https://gorm.io/docs/context.html)
- [Transactions](https://gorm.io/docs/transactions.html)
- [Generic database interface](https://gorm.io/docs/generic_interface.html)
