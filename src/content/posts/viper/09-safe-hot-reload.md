---
title: "Viper 学习（9）：热重载错误处理与旧配置保留"
published: 2026-10-06
publishedAt: 2026-10-06T10:00:00+08:00
description: 通过独立加载、严格解码和校验应用新配置，更新失败时保留旧配置。
tags: [Go, Viper, 配置管理]
category: Viper
series: viper
seriesOrder: 9
pinned: false
draft: false
comment: true
lang: zh_CN
---

# 热重载错误处理与旧配置保留

通过独立加载、严格解码和校验应用新配置，更新失败时保留旧配置。

本系列使用 Viper v1.21.0。每章都是独立实验，示例命令在项目目录中执行；开始新一章时，使用该章的完整程序和配置，不累积上一章的临时修改。

尚未准备练习项目时，先完成[第 1 章的项目准备](/posts/viper/01-single-values/)。

本章的目标是读取、解码和校验都成功后才应用新配置；失败时继续使用上次有效值。

## 初始示例

初始配置 `config/config.yaml`：

```yaml
app:
  name: viper-demo
  port: 8080
  debug: true
  timeout: 5s
  allowed_hosts:
    - localhost
    - example.com
  labels:
    environment: local
    owner: learner

servers:
  - name: primary
    address: "127.0.0.1:9001"
  - name: backup
    address: "127.0.0.1:9002"
```

初始完整 `main.go`：

```go
package main

import (
	"fmt"
	"github.com/fsnotify/fsnotify"
	"github.com/spf13/viper"
	"log"
	"os"
	"os/signal"
	"time"
)

type AppConfig struct {
	Name         string            `mapstructure:"name"`
	Port         int               `mapstructure:"port"`
	Debug        bool              `mapstructure:"debug"`
	Timeout      time.Duration     `mapstructure:"timeout"`
	AllowedHosts []string          `mapstructure:"allowed_hosts"`
	Labels       map[string]string `mapstructure:"labels"`
}

type Server struct {
	Name    string `mapstructure:"name"`
	Address string `mapstructure:"address"`
}

type Config struct {
	App     AppConfig `mapstructure:"app"`
	Servers []Server  `mapstructure:"servers"`
}

func validateConfig(cfg Config) error {
	if cfg.App.Name == "" {
		return fmt.Errorf("app.name 不能为空")
	}
	if cfg.App.Port < 1 || cfg.App.Port > 65535 {
		return fmt.Errorf("app.port 必须在 1 到 65535 之间")
	}
	if cfg.App.Timeout <= 0 {
		return fmt.Errorf("app.timeout 必须大于 0")
	}
	return nil
}

func loadConfig(path string) (Config, error) {
	v := viper.New()
	v.SetConfigFile(path)
	v.SetDefault("app.port", 3000)
	v.SetDefault("app.timeout", "5s")

	if err := v.ReadInConfig(); err != nil {
		return Config{}, fmt.Errorf("读取配置失败: %w", err)
	}
	var cfg Config
	if err := v.UnmarshalExact(&cfg); err != nil {
		return Config{}, fmt.Errorf("解码配置失败: %w", err)
	}
	if err := validateConfig(cfg); err != nil {
		return Config{}, err
	}
	return cfg, nil
}

func main() {
	const path = "config/config.yaml"
	cfg, err := loadConfig(path)
	if err != nil {
		log.Fatal(err)
	}

	changed := make(chan struct{}, 1)
	watcher := viper.New()
	watcher.SetConfigFile(path)
	watcher.OnConfigChange(func(_ fsnotify.Event) {
		select {
		case changed <- struct{}{}:
		default:
		}
	})
	watcher.WatchConfig()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt)
	defer signal.Stop(stop)
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()
	fmt.Println("正在监听，按 Ctrl+C 退出")

	for {
		select {
		case <-changed:
			next, err := loadConfig(path)
			if err != nil {
				log.Println("拒绝更新，继续使用旧配置:", err)
				continue
			}
			cfg = next
			fmt.Println("配置已更新")
		case <-ticker.C:
			fmt.Printf("当前配置: name=%s port=%d debug=%t\n",
				cfg.App.Name, cfg.App.Port, cfg.App.Debug)
		case <-stop:
			return
		}
	}
}
```

执行：

```bash
go run -race main.go
```

程序每两秒打印当前配置。启动时读取失败就退出，因为还没有有效配置；运行期间更新失败只记录错误并继续运行。

`loadConfig` 每次创建独立的 Viper 和结构体，失败不会污染当前配置。监听实例只负责发通知，主循环重新读取文件得到明确的错误结果。

容量为 1 的通道保存一个待处理通知，`default` 跳过重复通知，避免阻塞回调。主循环读取最新文件，不必记录每个保存事件。

只有主循环读写 `cfg`。其他 goroutine 不访问它，所以这里不需要加锁；若接入并发 HTTP handler，则需要锁或不可变快照来发布配置。

## 第一次修改

在程序运行期间，将端口改为：

```yaml
  port: 9090
```

保存后应接受更新并打印 `9090`。

## 第二次修改

将端口改为：

```yaml
  port: 70000
```

保存后应拒绝更新，继续打印 `9090`。再将端口字段分别替换为下面两种内容，每次保存观察结果：

```yaml
  port: abc
```

```yaml
  prot: 8080
```

分别应出现类型转换或未知字段错误，并继续用旧值。

## 第三次修改

临时将文件完整内容改成：

```yaml
app: [
```

保存后应出现 YAML 读取错误，仍使用旧配置。监听实例自身也可能打印错误，与“拒绝更新”同时出现。

## 第四次修改

将文件完整恢复成下面的合法配置：

```yaml
app:
  name: viper-demo
  port: 6060
  debug: true
  timeout: 5s
  allowed_hosts:
    - localhost
    - example.com
  labels:
    environment: local
    owner: learner

servers:
  - name: primary
    address: "127.0.0.1:9001"
  - name: backup
    address: "127.0.0.1:9002"
```

保存后应恢复更新，开始打印 `6060`。

## 第五次修改

删除恢复配置中的 `port` 这一行：

```diff
-  port: 6060
```

保存后应打印默认值 `3000`。每次创建新结构体可以避免缺失字段无意间保留上次解码结果。

## 第六次修改

停止程序，创建 `config/config.toml`，完整内容为：

```toml
[app]
name = "viper-demo"
port = 8080
debug = true
timeout = "5s"
allowed_hosts = ["localhost", "example.com"]

[app.labels]
environment = "local"
owner = "learner"

[[servers]]
name = "primary"
address = "127.0.0.1:9001"

[[servers]]
name = "backup"
address = "127.0.0.1:9002"
```

将 `main` 中的路径常量替换为：

```go
const path = "config/config.toml"
```

重新运行 `go run -race main.go`，将 TOML 的端口行替换为：

```toml
port = 9090
```

保存后预期接受更新。将超时行临时替换为：

```toml
timeout = "invalid"
```

保存后预期拒绝。再恢复为：

```toml
timeout = "5s"
```

保存后应恢复更新。

## 第七次修改

停止程序，创建 `config/config.json`，完整内容为：

```json
{
  "app": {
    "name": "viper-demo",
    "port": 8080,
    "debug": true,
    "timeout": "5s",
    "allowed_hosts": ["localhost", "example.com"],
    "labels": {
      "environment": "local",
      "owner": "learner"
    }
  },
  "servers": [
    {"name": "primary", "address": "127.0.0.1:9001"},
    {"name": "backup", "address": "127.0.0.1:9002"}
  ]
}
```

将路径常量替换为：

```go
const path = "config/config.json"
```

重新运行，将 JSON 的端口字段替换为：

```json
"port": 9090,
```

保存后应更新。将文件最后一个服务器对象临时替换为：

```json
{"name": "backup", "address": "127.0.0.1:9002",}
```

这里故意留下末尾逗号，保存后应读取失败。再将该对象恢复为：

```json
{"name": "backup", "address": "127.0.0.1:9002"}
```

保存后应恢复更新。

本章更新的是配置数据，没有启动真实网络服务。端口或数据库地址变化后，业务代码仍需负责切换监听器或连接。

`-race` 检测本次执行中触发的数据竞争，不等于证明所有并发场景都安全。本例针对普通本地文件保存；删除文件再创建、网络文件系统和容器挂载需要单独验证。v1.21.0 收到目标文件删除事件时可能停止监听，不应把修复语法错误后的恢复等同于支持所有文件生命周期变化。

## 参考资料

- [Viper v1.21.0 文档与 API](https://pkg.go.dev/github.com/spf13/viper@v1.21.0)
- [Viper v1.21.0 默认 codec](https://github.com/spf13/viper/blob/v1.21.0/encoding.go)
- [Viper v1.21.0 读取与监听源码](https://github.com/spf13/viper/blob/v1.21.0/viper.go)
- [pflag](https://github.com/spf13/pflag)
