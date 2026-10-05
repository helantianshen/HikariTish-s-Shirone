---
title: "Viper 学习（5）：读取字符串中的配置"
published: 2026-10-06
publishedAt: 2026-10-06T10:04:00+08:00
description: 使用 ReadConfig 从字符串读取 YAML、TOML 和 JSON 配置。
tags: [Go, Viper, 配置管理]
category: Viper
series: viper
seriesOrder: 5
pinned: false
draft: false
comment: true
lang: zh_CN
---

# 读取字符串中的配置

使用 ReadConfig 从字符串读取 YAML、TOML 和 JSON 配置。

本系列使用 Viper v1.21.0。每章都是独立实验，示例命令在项目目录中执行；开始新一章时，使用该章的完整程序和配置，不累积上一章的临时修改。

尚未准备练习项目时，先完成[第 1 章的项目准备](/posts/viper/01-single-values/)。

本章不需要磁盘配置文件，完整初始内容直接放在程序字符串中。

## 初始示例

初始完整 `main.go`：

```go
package main

import (
	"fmt"
	"github.com/spf13/viper"
	"log"
	"strings"
)

func main() {
	content := `
app:
  name: viper-demo
  port: 8080
`
	v := viper.New()
	v.SetConfigType("yaml")
	if err := v.ReadConfig(strings.NewReader(content)); err != nil {
		log.Fatal(err)
	}

	fmt.Println("应用名称:", v.GetString("app.name"))
	fmt.Println("监听端口:", v.GetInt("app.port"))
}
```

执行 `go run main.go`，预期名称为 `viper-demo`、端口为 `8080`。

`strings.NewReader` 把字符串包装成 `io.Reader`，`ReadConfig` 从这个数据源读取。字符串没有扩展名，因此通过 `SetConfigType` 明确格式。

## 第一次修改

将完整的 `content` 声明替换为：

```go
content := `
[app]
name = "viper-demo"
port = 9090
`
```

同时将格式设置替换为：

```go
v.SetConfigType("toml")
```

其余代码不变，再次运行，预期端口为 `9090`。

## 第二次修改

将 `content` 声明替换为：

```go
content := `{"app":{"name":"viper-demo","port":7070}}`
```

同时将格式设置替换为：

```go
v.SetConfigType("json")
```

再次运行，预期端口为 `7070`。

`ReadInConfig` 根据路径读取文件，`ReadConfig` 从传入的数据源读取内容。读入后都能使用 Getter 或结构体解码。读取字符串不会自动建立文件监听。

## 参考资料

- [Viper v1.21.0 文档与 API](https://pkg.go.dev/github.com/spf13/viper@v1.21.0)
- [Viper v1.21.0 默认 codec](https://github.com/spf13/viper/blob/v1.21.0/encoding.go)
- [Viper v1.21.0 读取与监听源码](https://github.com/spf13/viper/blob/v1.21.0/viper.go)
- [pflag](https://github.com/spf13/pflag)
