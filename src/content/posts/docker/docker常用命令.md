---
title: Docker常用命令
published: 2026-05-12
description: 以 RabbitMQ、Redis 和 MySQL 为例，拆解 docker run、docker exec 及容器重启等常用参数。
tags:
  - docker
  - 运维
category: Docker
pinned: false
draft: false
comment: true
lang: zh_CN
image: ../../../assets/images/posts/docker-commands-cover.jpg
---

# Docker 常用命令

## 概述

本文以 **RabbitMQ / Redis / MySQL** 三个中间件的部署为实例，逐一拆解 `docker run` 和 `docker exec` 的参数含义。

---

## `docker run` 参数全解

```bash
docker run [OPTIONS] IMAGE [COMMAND] [ARG...]
```

### 核心参数速查

| 参数 | 全称 | 含义 |
|------|------|------|
| `-d` | `--detach` | 后台运行容器，不阻塞终端 |
| `--name` | — | 指定容器名称（不指定则随机生成） |
| `--restart` | — | 容器退出后的重启策略 |
| `-p` | `--publish` | 端口映射 `宿主机端口:容器端口` |
| `-e` | `--env` | 注入环境变量 |
| `-v` | `--volume` | 挂载数据卷 `卷名:容器内路径` 或 `宿主机路径:容器内路径` |
| `--network` | — | 指定容器所属网络 |

---

## 实例一：RabbitMQ 3.13

```bash
docker run -d --name rabbitmq3.13 --restart unless-stopped -p 5672:5672 -p 15672:15672 -e RABBITMQ_DEFAULT_USER=2012228383 -e RABBITMQ_DEFAULT_PASS='4396Yoga.' -e RABBITMQ_DEFAULT_VHOST=/ -v rabbitmq-data:/var/lib/rabbitmq rabbitmq:3.13-management-alpine
```

### 参数拆解

| 参数 | 值 | 解释 |
|------|-----|------|
| `-d` | — | 后台运行，终端不会被 RabbitMQ 进程占用 |
| `--name` | `rabbitmq3.13` | 给容器起一个固定名称，方便后续 `docker logs rabbitmq3.13` 等操作 |
| `--restart` | `unless-stopped` | 只要不手动 `docker stop`，容器异常退出后**自动重启**；Docker 守护进程重启后也会自动拉起 |
| `-p 15672:5672` | 宿主机:容器 | **AMQP 协议端口**。应用代码连 `localhost:15672` 实际访问的是容器的 `5672`（RabbitMQ 默认消息端口） |
| `-p 25672:15672` | 宿主机:容器 | **Web 管理后台**。浏览器访问 `localhost:25672` 进入 RabbitMQ Management UI |
| `-e RABBITMQ_DEFAULT_USER` | `2012228383` | 默认管理员用户名 |
| `-e RABBITMQ_DEFAULT_PASS` | `4396Yoga.` | 默认管理员密码 |
| `-e RABBITMQ_DEFAULT_VHOST` | `/` | 默认虚拟主机（vhost），`/` 是根 vhost |
| `-v rabbitmq-data:/var/lib/rabbitmq` | 命名卷:容器路径 | **持久化数据**。RabbitMQ 的队列消息、配置存储在 Docker 命名卷 `rabbitmq-data` 中，容器删除后数据不丢失 |
| `rabbitmq:3.13-management-alpine` | — | 镜像名。`3.13` 版本 + 带管理插件 + Alpine 精简基础镜像 |

### `--restart` 策略详解

| 值 | 行为 |
|-----|------|
| `no`（默认） | 不自动重启 |
| `always` | 无论什么原因退出都重启 |
| `on-failure[:max-retries]` | 仅非零退出码时重启，可限制次数 |
| **`unless-stopped`** | **推荐**：手动 `docker stop` 才不重启，其他情况都重启 |

> `always` vs `unless-stopped`：`always` 在 Docker 重启后即使之前手动 stop 了也会拉起；`unless-stopped` 会记住手动 stop 状态。生产环境 `unless-stopped` 更合理。

---

## 实例二：Redis 7

```bash
docker run -d --name redis7 --restart unless-stopped -p 6379:6379 -v redis-data:/data redis:7-alpine redis-server --requirepass '4396Yoga.' --appendonly yes
```

### 参数拆解

| 参数                                                        | 值                | 解释                                                                                   |
| :-------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------ |
| `-d`                                                      | —                | 后台运行                                                                                 |
| `--name`                                                  | `redis7`         | 容器名                                                                                  |
| `--restart`                                               | `unless-stopped` | 自动重启                                                                                 |
| `-p 16379:6379`                                           | 宿主机:容器           | Redis 默认端口 6379 映射到宿主机的 **16379**（避免与宿主机已有 Redis 冲突）                                 |
| `-v redis-data:/data`                                     | 命名卷:容器路径         | Redis 的 RDB/AOF 持久化文件存储在命名卷中                                                         |
| `redis:7-alpine`                                          | —                | 镜像：Redis 7 + Alpine 精简版                                                              |
| `redis-server --requirepass '4396Yoga.' --appendonly yes` | —                | **COMMAND 参数**。覆盖镜像默认启动命令，追加 `--requirepass` 设置连接密码，追加 `--appendonly yes` 设置开启AOF持久化 |

### `-p` 端口映射详解

```
-p 宿主机端口:容器端口

宿主机 16379  ──映射──►  容器内 6379 (Redis 监听)
宿主机 15672  ──映射──►  容器内 5672 (RabbitMQ AMQP)
```

> **为什么要换端口？** 避免与宿主机上已有的服务端口冲突，或同时运行多个同类型容器（如 Redis 5 + Redis 7）。

### `COMMAND` 参数的作用

```bash
docker run IMAGE [COMMAND]
```

镜像的 `Dockerfile` 中通常有 `CMD` 或 `ENTRYPOINT`，`docker run` 末尾追加的命令会**覆盖** `CMD`。此例中 `redis-server --requirepass '4396Yoga.'` 替换了镜像默认的 `redis-server`，额外传了密码参数。

---

## 实例三：MySQL 8.0

```bash
docker run -d --name mysql8 --restart unless-stopped -p 3306:3306 -e MYSQL_ROOT_PASSWORD='4396Yoga.' -v mysql-data:/var/lib/mysql mysql:8.0
```

### 参数拆解

| 参数 | 值 | 解释 |
|------|-----|------|
| `-d` | — | 后台运行 |
| `--name` | `mysql8` | 容器名 |
| `--restart` | `unless-stopped` | 自动重启 |
| `-p 3306:3306` | 宿主机:容器 | MySQL 默认端口直接映射（如果宿主机没有其他 MySQL 则不需要改） |
| `-e MYSQL_ROOT_PASSWORD` | `4396Yoga.` | **必填环境变量**，MySQL 镜像用它初始化 root 密码 |
| `-v mysql-data:/var/lib/mysql` | 命名卷:容器路径 | MySQL 数据文件（表、索引等）持久化 |
| `mysql:8.0` | — | MySQL 8.0 官方镜像（默认 Debian 基础镜像） |

### MySQL 镜像常用环境变量

| 变量 | 说明 |
|------|------|
| `MYSQL_ROOT_PASSWORD` | **必填**，root 用户密码 |
| `MYSQL_DATABASE` | 容器启动时自动创建的数据库 |
| `MYSQL_USER` | 自动创建的普通用户 |
| `MYSQL_PASSWORD` | 普通用户的密码 |
| `MYSQL_ALLOW_EMPTY_PASSWORD` | 设为 `yes` 允许空密码（不推荐） |

完整初始化示例：

```bash
docker run -d --name mysql8 \
  -e MYSQL_ROOT_PASSWORD='4396Yoga.' \
  -e MYSQL_DATABASE=myapp \
  -e MYSQL_USER=appuser \
  -e MYSQL_PASSWORD='apppass123' \
  mysql:8.0
```

---

## `-v` 数据卷详解

### 两种挂载方式

| 方式 | 语法 | 数据位置 | 特点 |
|------|------|----------|------|
| **命名卷（Named Volume）** | `-v 卷名:容器路径` | Docker 管理 (`/var/lib/docker/volumes/`) | **推荐**：Docker 管理，可移植 |
| **绑定挂载（Bind Mount）** | `-v /宿主机/绝对/路径:容器路径` | 宿主机指定目录 | 直接操作宿主机文件 |

```bash
# 命名卷 — 推荐
-v rabbitmq-data:/var/lib/rabbitmq

# 绑定挂载 — 精确控制
-v /opt/data/rabbitmq:/var/lib/rabbitmq
```

### 卷管理命令

```bash
docker volume ls                    # 列出所有卷
docker volume inspect rabbitmq-data # 查看卷详情（宿主机实际路径）
docker volume rm rabbitmq-data      # 删除卷（⚠️ 数据不可恢复）
docker volume prune                 # 清理所有未使用的卷
```

---

## 三个实例对比总结

| 维度 | RabbitMQ | Redis | MySQL |
|------|----------|-------|-------|
| 镜像 | `rabbitmq:3.13-management-alpine` | `redis:7-alpine` | `mysql:8.0` |
| 端口映射 | `15672:5672`, `25672:15672` | `16379:6379` | `3306:3306` |
| 数据卷 | `rabbitmq-data:/var/lib/rabbitmq` | `redis-data:/data` | `mysql-data:/var/lib/mysql` |
| 认证方式 | 环境变量 | 启动命令参数 | 环境变量 |
| 管理界面 | Web UI (15672) | — | — |
| COMMAND | 无（使用镜像默认） | `redis-server --requirepass ...` | 无（使用镜像默认） |

---

## `docker exec` 进入容器

```bash
docker exec -it redis7 /bin/bash
```

| 参数 | 全称 | 含义 |
|------|------|------|
| `-i` | `--interactive` | 保持 STDIN 打开，可以输入命令 |
| `-t` | `--tty` | 分配一个伪终端（pseudo-TTY），获得正常的命令行体验 |
| `redis7` | — | 容器名（也可用容器 ID） |
| `/bin/bash` | — | 要在容器内执行的命令 |

> `-it` 必须同时使用才能获得交互式 shell。缺少 `-t` 则没有命令提示符，缺少 `-i` 则无法输入。

### 其他 exec 用法

```bash
# 执行单条命令（不需要 -it）
docker exec redis7 redis-cli PING

# 以 root 用户进入（部分镜像默认非 root）
docker exec -it -u root redis7 /bin/bash

# 进入 MySQL 容器直接连数据库
docker exec -it mysql8 mysql -uroot -p'4396Yoga.'
```

---

## 日常运维速查

```bash
# ========== 容器生命周期 ==========
docker ps                  # 查看运行中的容器
docker ps -a               # 查看所有容器（含已停止）
docker stop redis7         # 优雅停止
docker start redis7        # 启动已存在的容器
docker restart redis7      # 重启
docker rm redis7           # 删除容器（需先 stop）
docker rm -f redis7        # 强制删除（运行中也删）

# ========== 日志与调试 ==========
docker logs redis7         # 查看全部日志
docker logs -f redis7      # 实时跟踪日志（Ctrl+C 退出）
docker logs --tail 50 redis7  # 只看最后 50 行
docker inspect redis7      # 查看容器完整配置（JSON）

# ========== 资源占用 ==========
docker stats               # 实时监控所有容器 CPU/内存
docker stats redis7        # 只监控指定容器

# ========== 镜像管理 ==========
docker images              # 列出本地镜像
docker pull mysql:8.0      # 拉取镜像（不创建容器）
docker rmi mysql:8.0       # 删除镜像
docker image prune         # 清理无用镜像

# ========== 一键清理 ==========
docker system prune -a     # 清理所有未使用的容器/镜像/卷/网络（⚠️ 危险）
```
