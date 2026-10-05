---
title: "Viper 学习（3）：读取 YAML、TOML、JSON 和 envfile"
published: 2026-10-06
publishedAt: 2026-10-06T10:06:00+08:00
description: 使用 YAML、TOML、JSON 和 envfile，理解嵌套结构与平面键的区别。
tags: [Go, Viper, 配置管理]
category: Viper
series: viper
seriesOrder: 3
pinned: false
draft: false
comment: true
lang: zh_CN
---

# 读取 YAML、TOML、JSON 和 envfile

使用 YAML、TOML、JSON 和 envfile，理解嵌套结构与平面键的区别。

本系列使用 Viper v1.21.0。每章都是独立实验，示例命令在项目目录中执行；开始新一章时，使用该章的完整程序和配置，不累积上一章的临时修改。

尚未准备练习项目时，先完成[第 1 章的项目准备](/posts/viper/01-single-values/)。

本章先从 YAML 开始，前三种格式复用同一套结构体，envfile 切换为平面键读取。

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
	"github.com/spf13/viper"
	"log"
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

func main() {
	v := viper.New()
	v.SetConfigFile("config/config.yaml")
	v.SetDefault("app.port", 3000)
	v.SetDefault("app.timeout", "5s")

	if err := v.ReadInConfig(); err != nil {
		log.Fatal(err)
	}

	var cfg Config
	if err := v.UnmarshalExact(&cfg); err != nil {
		log.Fatal(err)
	}
	if err := validateConfig(cfg); err != nil {
		log.Fatal(err)
	}

	fmt.Println("应用名称:", cfg.App.Name)
	fmt.Println("监听端口:", cfg.App.Port)
	fmt.Println("调试模式:", cfg.App.Debug)
	fmt.Println("超时时间:", cfg.App.Timeout)
	for i, host := range cfg.App.AllowedHosts {
		fmt.Printf("允许的域名 %d: %s\n", i+1, host)
	}
	for _, server := range cfg.Servers {
		fmt.Printf("服务器 %s: %s\n", server.Name, server.Address)
	}
	for key, value := range cfg.App.Labels {
		fmt.Printf("标签 %s: %s\n", key, value)
	}
}
```

先执行 `go run main.go`，确认 YAML 读取和校验成功。

## 第一次修改

创建 `config/config.toml`，完整内容为：

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

仅将代码中的文件路径替换为：

```go
v.SetConfigFile("config/config.toml")
```

再次运行，读取结果应与 YAML 一致。

TOML 的 `[app]` 是表，`[app.labels]` 是嵌套表，每个 `[[servers]]` 增加一个对象。它用表头决定层级，不依靠缩进；写完 `[app.labels]` 后，普通键属于该表，直到出现下一个表头。

## 第二次修改

创建 `config/config.json`，完整内容为：

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

仅将代码中的文件路径替换为：

```go
v.SetConfigFile("config/config.json")
```

再次运行，读取结果仍应一致。JSON 的键和字符串必须使用双引号，不支持普通注释，也不允许末尾多余逗号。文件语法错误会在 `ReadInConfig` 阶段出现。

## 第三次修改

创建 `config/config.env`，完整内容为：

```dotenv
APP_NAME=viper-demo
APP_PORT=8080
```

envfile 的 `APP_PORT` 不会自动变成嵌套的 `app.port`，本次修改整个程序，使用平面键读取。完整替换代码为：

```go
package main

import (
	"fmt"
	"github.com/spf13/viper"
	"log"
	"os"
)

func main() {
	v := viper.New()
	v.SetConfigFile("config/config.env")
	if err := v.ReadInConfig(); err != nil {
		log.Fatal(err)
	}

	fmt.Println("文件名称:", v.GetString("APP_NAME"))
	fmt.Println("文件端口:", v.GetInt("APP_PORT"))
	fmt.Println("进程环境变量:", os.Getenv("APP_PORT"))
}
```

分别执行：

```bash
env -u APP_PORT go run main.go
env APP_PORT=9090 go run main.go
```

第一条命令中文件端口为 `8080`，进程环境变量为空；第二条中文件端口仍为 `8080`，进程环境变量为 `9090`。程序没有绑定环境变量，两份数据彼此独立。

读取 `.env` 文件不会自动设置进程环境变量，读取环境变量也不会自动寻找 `.env` 文件。

本文的四种格式是 YAML、TOML、JSON、envfile，而不是把 `.yaml` 和 `.yml` 算作两种。v1.21.0 默认 codec 内置这四类；扩展名列表仍出现的 INI、HCL、Properties 等名称，不代表已有默认解析器，需要另行注册相应 codec。

## 参考资料

- [Viper v1.21.0 文档与 API](https://pkg.go.dev/github.com/spf13/viper@v1.21.0)
- [Viper v1.21.0 默认 codec](https://github.com/spf13/viper/blob/v1.21.0/encoding.go)
- [Viper v1.21.0 读取与监听源码](https://github.com/spf13/viper/blob/v1.21.0/viper.go)
- [pflag](https://github.com/spf13/pflag)
