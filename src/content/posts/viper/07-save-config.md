---
title: "Viper 学习（7）：保存当前有效配置"
published: 2026-10-06
publishedAt: 2026-10-06T10:02:00+08:00
description: 保存并读回当前有效配置，比较安全写入与覆盖写入。
tags: [Go, Viper, 配置管理]
category: Viper
series: viper
seriesOrder: 7
pinned: false
draft: false
comment: true
lang: zh_CN
---

# 保存当前有效配置

保存并读回当前有效配置，比较安全写入与覆盖写入。

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
	if err := v.BindPFlag("app.port", pflag.Lookup("port")); err != nil {
		log.Fatal(err)
	}
	if err := v.ReadInConfig(); err != nil {
		log.Fatal(err)
	}
	if err := v.SafeWriteConfigAs("config/generated.yaml"); err != nil {
		log.Fatal(err)
	}

	check := viper.New()
	check.SetConfigFile("config/generated.yaml")
	if err := check.ReadInConfig(); err != nil {
		log.Fatal(err)
	}
	fmt.Println("已保存，读回端口:", check.GetInt("app.port"))
}
```

确保 `config/generated.yaml` 不存在，再执行：

```bash
go run main.go --port=7070
```

预期输出 `已保存，读回端口: 7070`。程序保存后用新实例读回，验证文件中的有效端口。

保存的是 Viper 当前配置，命令行覆盖后的值也会写入。第二次执行会因目标文件已存在而报错；重复实验时可手动删除或改名生成文件。

## 第一次修改

将安全写入块替换为：

```go
if err := v.WriteConfigAs("config/generated.yaml"); err != nil {
    log.Fatal(err)
}
```

执行 `go run main.go --port=6060`，即使文件已经存在，也会覆盖并读回 `6060`。`SafeWriteConfigAs` 拒绝覆盖，`WriteConfigAs` 允许覆盖。

## 第二次修改

在写入之前增加：

```go
v.Set("app.port", 5050)
```

再次运行，保存并读回的端口为 `5050`。如果只修改解码后的 `cfg.App.Port`，Viper 不会反向同步，因此不会据此保存新值。

输出文件不保证保留原文件注释、字段顺序和排版。有效环境变量值也可能被写入，因此本次使用演示数据。实际结构体应用应在解码和业务校验成功后再保存。

## 参考资料

- [Viper v1.21.0 文档与 API](https://pkg.go.dev/github.com/spf13/viper@v1.21.0)
- [Viper v1.21.0 默认 codec](https://github.com/spf13/viper/blob/v1.21.0/encoding.go)
- [Viper v1.21.0 读取与监听源码](https://github.com/spf13/viper/blob/v1.21.0/viper.go)
- [pflag](https://github.com/spf13/pflag)
