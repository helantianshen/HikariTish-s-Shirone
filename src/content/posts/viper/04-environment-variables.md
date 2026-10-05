---
title: "Viper 学习（4）：读取环境变量"
published: 2026-10-06
publishedAt: 2026-10-06T10:05:00+08:00
description: 通过 BindEnv 和 AutomaticEnv 读取环境变量，并验证结构体解码的键绑定。
tags: [Go, Viper, 配置管理]
category: Viper
series: viper
seriesOrder: 4
pinned: false
draft: false
comment: true
lang: zh_CN
---

# 读取环境变量

通过 BindEnv 和 AutomaticEnv 读取环境变量，并验证结构体解码的键绑定。

本系列使用 Viper v1.21.0。每章都是独立实验，示例命令在项目目录中执行；开始新一章时，使用该章的完整程序和配置，不累积上一章的临时修改。

尚未准备练习项目时，先完成[第 1 章的项目准备](/posts/viper/01-single-values/)。

## 初始示例

初始配置 `config/config.yaml`：

```yaml
app:
  name: viper-demo
  port: 8080
```

初始完整 `main.go`：

```go
package main

import (
	"fmt"
	"github.com/spf13/viper"
	"log"
)

func main() {
	v := viper.New()
	v.SetConfigFile("config/config.yaml")
	v.SetDefault("app.port", 3000)

	if err := v.BindEnv("app.port", "APP_PORT"); err != nil {
		log.Fatal(err)
	}
	if err := v.ReadInConfig(); err != nil {
		log.Fatal(err)
	}

	fmt.Println("监听端口:", v.GetInt("app.port"))
}
```

执行：

```bash
env APP_PORT=9090 go run main.go
```

预期端口为 `9090`，YAML 仍为 `8080`。`BindEnv` 第一个参数是配置键，第二个参数是确切的环境变量名。环境变量优先于文件配置，但不会修改文件。

## 第一次修改

在 import 中增加：

```go
"strings"
```

删除原来的 `BindEnv("app.port", "APP_PORT")` 错误检查块，替换为：

```go
v.SetEnvPrefix("LEARN")
v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
v.AutomaticEnv()
```

执行：

```bash
env LEARN_APP_PORT=7070 go run main.go
```

预期端口为 `7070`。前缀、替换器和大写规则共同形成 `app.port → LEARN_APP_PORT`。

## 第二次修改

保留自动映射设置，在获取配置之前增加：

```go
if err := v.BindEnv("app.port"); err != nil {
    log.Fatal(err)
}
```

只传配置键时按前缀和替换规则查找；如果明确传第二个参数 `"APP_PORT"`，则直接使用该名称，不自动追加前缀。

对于结构体解码，`AutomaticEnv` 不会枚举全部环境变量并注册所有键。某字段如果只存在于环境变量中、文件和默认值都没有提供，普通解码可能读不到；显式绑定可以让这个键参与解码。

## 第三次修改

将本章程序完整替换为下面的例子，单独验证“只通过环境变量解码结构体”：

```go
package main

import (
	"fmt"
	"github.com/spf13/viper"
	"log"
)

type Config struct {
	App struct {
		Port int `mapstructure:"port"`
	} `mapstructure:"app"`
}

func main() {
	v := viper.New()
	if err := v.BindEnv("app.port", "APP_PORT"); err != nil {
		log.Fatal(err)
	}
	var cfg Config
	if err := v.UnmarshalExact(&cfg); err != nil {
		log.Fatal(err)
	}
	fmt.Println("结构体端口:", cfg.App.Port)
}
```

执行 `env APP_PORT=9090 go run main.go`，预期结构体端口为 `9090`。执行 `env APP_PORT=abc go run main.go`，应报告整数转换错误。

环境变量名称区分大小写。空环境变量默认视为未设置，会回退到其他来源。

## 参考资料

- [Viper v1.21.0 文档与 API](https://pkg.go.dev/github.com/spf13/viper@v1.21.0)
- [Viper v1.21.0 默认 codec](https://github.com/spf13/viper/blob/v1.21.0/encoding.go)
- [Viper v1.21.0 读取与监听源码](https://github.com/spf13/viper/blob/v1.21.0/viper.go)
- [pflag](https://github.com/spf13/pflag)
