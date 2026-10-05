---
title: "Viper 学习（6）：读取启动参数"
published: 2026-10-06
publishedAt: 2026-10-06T10:03:00+08:00
description: 结合 pflag 读取启动参数，验证不同配置来源的优先级与端口校验。
tags: [Go, Viper, 配置管理]
category: Viper
series: viper
seriesOrder: 6
pinned: false
draft: false
comment: true
lang: zh_CN
---

# 读取启动参数

结合 pflag 读取启动参数，验证不同配置来源的优先级与端口校验。

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
	"github.com/spf13/pflag"
	"github.com/spf13/viper"
	"log"
)

func main() {
	pflag.Int("port", 4000, "应用端口")
	pflag.Parse()

	v := viper.New()
	v.SetConfigFile("config/config.yaml")
	v.SetDefault("app.port", 3000)
	if err := v.BindEnv("app.port", "APP_PORT"); err != nil {
		log.Fatal(err)
	}
	if err := v.BindPFlag("app.port", pflag.Lookup("port")); err != nil {
		log.Fatal(err)
	}
	if err := v.ReadInConfig(); err != nil {
		log.Fatal(err)
	}

	fmt.Println("监听端口:", v.GetInt("app.port"))
}
```

`pflag.Int` 注册参数名、默认值和帮助说明；`Parse` 解析启动参数；`BindPFlag` 把命令行 `port` 对应到 Viper 的 `app.port`。

分别执行：

```bash
env -u APP_PORT go run main.go
env APP_PORT=9090 go run main.go
env APP_PORT=9090 go run main.go --port=7070
go run main.go --help
```

前三条预期端口依次为 `8080`、`9090`、`7070`，最后一条显示帮助并退出。未显式传入 `--port` 时，flag 默认值 `4000` 不会压过文件中的 `8080`。

## 第一次修改

在获取端口之前增加：

```go
v.Set("app.port", 6060)
```

重新运行带 `--port=7070` 的命令，预期为 `6060`。本次涉及的覆盖关系为 `Set > 显式命令行参数 > 环境变量 > 文件 > SetDefault`，由来源决定，不是最后调用哪个方法就用哪个来源。

## 第二次修改

删除上一处 `Set`，在 `main` 外增加：

```go
type Config struct {
    App struct {
        Name string `mapstructure:"name"`
        Port int    `mapstructure:"port"`
    } `mapstructure:"app"`
}
```

将最后的端口打印语句替换为以下完整块：

```go
var cfg Config
if err := v.UnmarshalExact(&cfg); err != nil {
    log.Fatal(err)
}
if cfg.App.Port < 1 || cfg.App.Port > 65535 {
    log.Fatal("app.port 必须在 1 到 65535 之间")
}
fmt.Println("监听端口:", cfg.App.Port)
```

运行 `go run main.go --port=7070` 应成功；运行 `go run main.go --port=70000` 应校验失败。注册参数和绑定不变，只是最终获取方式从 Getter 换成结构体解码。

## 参考资料

- [Viper v1.21.0 文档与 API](https://pkg.go.dev/github.com/spf13/viper@v1.21.0)
- [Viper v1.21.0 默认 codec](https://github.com/spf13/viper/blob/v1.21.0/encoding.go)
- [Viper v1.21.0 读取与监听源码](https://github.com/spf13/viper/blob/v1.21.0/viper.go)
- [pflag](https://github.com/spf13/pflag)
