---
title: "Viper 学习（2）：解码到结构体并检查配置"
published: 2026-10-06
publishedAt: 2026-10-06T10:07:00+08:00
description: 将配置解码为结构体，理解 mapstructure 标签、严格解码与业务校验。
tags: [Go, Viper, 配置管理]
category: Viper
series: viper
seriesOrder: 2
pinned: false
draft: false
comment: true
lang: zh_CN
---

# 解码到结构体并检查配置

将配置解码为结构体，理解 mapstructure 标签、严格解码与业务校验。

本系列使用 Viper v1.21.0。每章都是独立实验，示例命令在项目目录中执行；开始新一章时，使用该章的完整程序和配置，不累积上一章的临时修改。

尚未准备练习项目时，先完成[第 1 章的项目准备](/posts/viper/01-single-values/)。

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

func main() {
	v := viper.New()
	v.SetConfigFile("config/config.yaml")
	v.SetDefault("app.port", 3000)
	v.SetDefault("app.timeout", "5s")

	if err := v.ReadInConfig(); err != nil {
		log.Fatal(err)
	}

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
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

执行 `go run main.go`，应打印名称、端口、调试开关、超时、域名、服务器和标签。map 的遍历顺序不固定，标签输出顺序可能变化。

字段首字母要大写，解码器才能设置。`mapstructure` 标签指定对应的配置键。固定字段用 struct，字符串列表用 `[]string`，对象列表用 `[]Server`，可以自由增加键名的字典用 map。

## 第一次修改

在 YAML 的 `app` 下替换这两行：

```yaml
  debug: false
  timeout: 500ms
```

重新运行，调试模式为 `false`，超时为 `500ms`。时间需要带单位，可用 `ms`、`s`、`m`、`h`，例如 `1m30s`；`1d` 不是支持的时间单位。

## 第二次修改

在 YAML 的 `app.labels` 下增加：

```yaml
region: shanghai
```

Go 结构体和解码代码不用改，遍历时会自动打印新标签。

## 第三次修改

用下面这一块替换原来的 `Unmarshal` 解码块：

```go
var cfg Config
if err := v.UnmarshalExact(&cfg); err != nil {
    log.Fatal(err)
}
```

将 YAML 中的端口字段临时替换为：

```yaml
  prot: 8080
```

运行应报告未知字段。将顶层 `servers` 缩进到 `app` 下也会造成层级不匹配。普通 `Unmarshal` 会忽略这些未知字段，可能让拼写或层级错误表现为空值。实验后恢复 `port: 8080` 和合法层级。

## 第四次修改

在 `main` 外增加：

```go
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
```

再在解码成功后、打印之前增加：

```go
if err := validateConfig(cfg); err != nil {
    log.Fatal(err)
}
```

每次只替换 YAML 的一个字段进行验证，并在下一项之前恢复合法值。

整数转换失败：

```yaml
  port: abc
```

端口范围校验失败：

```yaml
  port: 70000
```

超时校验失败：

```yaml
  timeout: 0s
```

名称校验失败：

```yaml
  name: ""
```

严格解码检查未知字段，不要求所有字段出现，也不自动检查业务范围。端口 1～65535 是本例的应用约定。实验结束后恢复合法配置。

## 参考资料

- [Viper v1.21.0 文档与 API](https://pkg.go.dev/github.com/spf13/viper@v1.21.0)
- [Viper v1.21.0 默认 codec](https://github.com/spf13/viper/blob/v1.21.0/encoding.go)
- [Viper v1.21.0 读取与监听源码](https://github.com/spf13/viper/blob/v1.21.0/viper.go)
- [pflag](https://github.com/spf13/pflag)
