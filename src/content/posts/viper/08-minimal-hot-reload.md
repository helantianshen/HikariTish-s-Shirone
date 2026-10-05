---
title: "Viper 学习（8）：最小热重载"
published: 2026-10-06
publishedAt: 2026-10-06T10:01:00+08:00
description: 监听配置文件变化，在回调中读取新值并重新解码结构体。
tags: [Go, Viper, 配置管理]
category: Viper
series: viper
seriesOrder: 8
pinned: false
draft: false
comment: true
lang: zh_CN
---

# 最小热重载

监听配置文件变化，在回调中读取新值并重新解码结构体。

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
	"github.com/fsnotify/fsnotify"
	"github.com/spf13/viper"
	"log"
	"os"
	"os/signal"
)

func main() {
	v := viper.New()
	v.SetConfigFile("config/config.yaml")
	if err := v.ReadInConfig(); err != nil {
		log.Fatal(err)
	}
	fmt.Println("启动端口:", v.GetInt("app.port"))

	v.OnConfigChange(func(event fsnotify.Event) {
		fmt.Println("配置文件发生变化:", event.Name)
		fmt.Println("更新后的端口:", v.GetInt("app.port"))
	})
	v.WatchConfig()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt)
	defer signal.Stop(stop)
	fmt.Println("正在监听，按 Ctrl+C 退出")
	<-stop
}
```

执行 `go run main.go`，等待“正在监听”。`OnConfigChange` 注册回调，`WatchConfig` 启动监听，等待信号让程序持续运行。

## 第一次修改

程序运行期间，将 YAML 中的端口改为：

```yaml
  port: 9090
```

保存后应看到新端口，无需重启。一次保存可能触发多个回调。

## 第二次修改

停止程序，在 `main` 外增加：

```go
type Config struct {
    App struct {
        Name string `mapstructure:"name"`
        Port int    `mapstructure:"port"`
    } `mapstructure:"app"`
}
```

将完整的 `OnConfigChange` 回调块替换为：

```go
v.OnConfigChange(func(event fsnotify.Event) {
    fmt.Println("配置文件发生变化:", event.Name)
    var next Config
    if err := v.UnmarshalExact(&next); err != nil {
        log.Println("解码失败:", err)
        return
    }
    fmt.Println("更新后的应用名称:", next.App.Name)
    fmt.Println("更新后的端口:", next.App.Port)
})
```

重新启动，再修改并保存端口，观察重新解码得到的值。结构体不会自动跟随 Viper 变化，需要主动再次解码。

本节只演示合法保存。Viper 会尝试重新读取后调用回调，但收到回调不代表读取一定成功；打印新结构体也不等于已替换业务正在使用的配置。下一章单独解决这些问题。

监听会修改 Viper 内部数据，它不保证并发读写安全。本章开始监听后只在回调中读取 `v`，不要同时增加其他 goroutine 读取这个实例的循环。

## 参考资料

- [Viper v1.21.0 文档与 API](https://pkg.go.dev/github.com/spf13/viper@v1.21.0)
- [Viper v1.21.0 默认 codec](https://github.com/spf13/viper/blob/v1.21.0/encoding.go)
- [Viper v1.21.0 读取与监听源码](https://github.com/spf13/viper/blob/v1.21.0/viper.go)
- [pflag](https://github.com/spf13/pflag)
