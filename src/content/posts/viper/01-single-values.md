---
title: "Viper 学习（1）：获取单个配置值"
published: 2026-10-06
publishedAt: 2026-10-06T10:08:00+08:00
description: 通过配置文件、默认值和显式覆盖学习 Getter，并区分缺失键、零值和文件配置。
tags: [Go, Viper, 配置管理]
category: Viper
series: viper
seriesOrder: 1
pinned: false
draft: false
comment: true
lang: zh_CN
---

# 获取单个配置值

通过配置文件、默认值和显式覆盖学习 Getter，并区分缺失键、零值和文件配置。

本系列使用 Viper v1.21.0。每章都是独立实验，示例命令在项目目录中执行；开始新一章时，使用该章的完整程序和配置，不累积上一章的临时修改。

## 准备项目

新项目可以这样初始化：

```bash
mkdir viper-learn
cd viper-learn
go mod init viper-learn
go get github.com/spf13/viper@v1.21.0
go get github.com/spf13/pflag@v1.0.10
mkdir config
```

已有项目使用现有目录和依赖即可，不要重复初始化。

每章开始时，把该章的完整 Go 程序保存为 `main.go`，使用该章给出的完整配置文件。不要把上一章的临时实验继续累积到下一章。

本文统一执行 `go run main.go`，所有命令都在项目目录中运行。我的练习目录里保留了多个含 `main` 的实验文件，直接 `go run .` 会一起编译并出现重复声明。下面的完整示例都包含自己需要的类型和函数，适合单文件运行。

命令示例面向 Linux shell；配置文件的相对路径基于运行命令时的工作目录。

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

	if err := v.ReadInConfig(); err != nil {
		log.Fatal(err)
	}

	fmt.Println("应用名称:", v.GetString("app.name"))
	fmt.Println("监听端口:", v.GetInt("app.port"))
}
```

执行 `go run main.go`，输出名称 `viper-demo` 和端口 `8080`。

`SetConfigFile` 指定文件，`ReadInConfig` 真正读取，`GetString` 和 `GetInt` 按类型获取值。`app.port` 表示嵌套配置键。

## 第一次修改

删除 YAML 中的端口，配置完整内容变为：

```yaml
app:
  name: viper-demo
```

重新运行，端口变成 `3000`，来自初始代码的 `SetDefault`。默认值必须在本次获取配置之前设置，不一定必须在读取文件之前，但集中放在初始化阶段更清晰。

## 第二次修改

将 YAML 改成：

```yaml
app:
  name: viper-demo
  port: 0
```

重新运行，端口是 `0`。默认值用于缺失，不会因为配置是零值就自动替换。

## 第三次修改

在 `ReadInConfig` 成功后增加：

```go
fmt.Println("missing 的值:", v.GetInt("app.missing"))
fmt.Println("missing 是否存在:", v.IsSet("app.missing"))
fmt.Println("port 是否存在:", v.IsSet("app.port"))
fmt.Println("port 是否写在文件中:", v.InConfig("app.port"))
```

当前配置中端口为 `0` 时，依次输出 `0`、`false`、`true`、`true`。再删除端口这一行，最后两个结果变成 `true` 和 `false`，因为默认值存在，但文件未提供。

`IsSet` 检查是否有可用配置，默认值也算；`InConfig` 检查文件配置中是否存在该键。

## 第四次修改

在 `ReadInConfig` 成功后、打印之前增加：

```go
v.Set("app.port", 6060)
```

重新运行，端口为 `6060`。`Set` 显式覆盖的优先级高于文件和默认值。实验结束后删除这行，避免干扰后续学习。

Getter 在键缺失或转换失败时可能返回零值，所以“得到 0”不能证明配置正确。

## 参考资料

- [Viper v1.21.0 文档与 API](https://pkg.go.dev/github.com/spf13/viper@v1.21.0)
- [Viper v1.21.0 默认 codec](https://github.com/spf13/viper/blob/v1.21.0/encoding.go)
- [Viper v1.21.0 读取与监听源码](https://github.com/spf13/viper/blob/v1.21.0/viper.go)
- [pflag](https://github.com/spf13/pflag)
