---
title: ElasticSearch部署
published: 2026-05-13
description: 记录 Elasticsearch 8.17 与 IK 分词器的分步容器部署方案，涵盖国内镜像、插件安装和启动验证。
tags:
  - docker
  - elasticsearch
  - 部署
category: Docker
pinned: false
draft: false
comment: true
lang: zh_CN
---

# Docker 部署 Elasticsearch 8.17.0 + IK 分词器

## 背景

国内服务器拉取 ES 官方镜像（`docker.elastic.co`）及在线下载插件经常 **I/O timeout**，`docker build` 一键构建含插件的镜像极易失败。最终采用**分步执行**策略：基础镜像 → 启动容器 → 容器内安装插件 → 重启生效。

---

## Step 1：获取基础镜像

通过国内加速源拉取，然后重新打上官方 Tag 保持配置整洁：

```bash
# 国内加速源拉取
docker pull docker.1panel.live/elastic/elasticsearch:8.17.0
```

> 💡 **离线备选方案**：本地电脑 `docker save` 导出 tar → 传至服务器 → `docker load -i` 离线导入。

---

## Step 2：启动 ES 容器

利用环境变量直接配置，无需额外挂载配置文件：

```bash
docker run -d --name es8.17.0 --restart unless-stopped -p 9200:9200 -v es-data:/usr/share/elasticsearch/data -e "discovery.type=single-node" -e "xpack.security.enabled=false" -e "ES_JAVA_OPTS=-Xms2g -Xmx2g" docker.1panel.live/elastic/elasticsearch:8.17.0
```

### 参数拆解

| 参数 | 值 | 含义 |
|------|-----|------|
| `-d` | — | 后台运行 |
| `--name` | `es8.17.0` | 固定容器名，方便后续 `exec`、`restart` |
| `--restart` | `unless-stopped` | 自动重启（手动 stop 除外） |
| `-p 19200:9200` | 宿主机:容器 | ES HTTP 端口映射，**换用 19200 避免与宿主机已有服务冲突** |
| `-v es-data:/usr/share/elasticsearch/data` | 命名卷 | 索引数据持久化 |
| `-e discovery.type=single-node` | 环境变量 | **单节点模式**，无需配置集群 |
| `-e xpack.security.enabled=false` | 环境变量 | **关闭安全认证**（免密登录），适合开发/测试 |
| `-e ES_JAVA_OPTS=-Xms512m -Xmx512m` | 环境变量 | 限制 JVM 堆内存 512MB，**防止撑爆小内存服务器** |

### 核心参数详解

**`discovery.type=single-node`**：ES 8.x 默认以集群模式启动，单机部署**必须**设置此项，否则服务无法正常启动。

**`xpack.security.enabled=false`**：关闭 HTTPS 和密码认证。生产环境应保持开启（`true`），并通过 `ELASTIC_PASSWORD` 环境变量设置密码。

**`ES_JAVA_OPTS`**：ES 是 Java 应用，默认会吃 4GB 堆内存。小服务器必须用此项限制，推荐设置 `Xms` = `Xmx` 避免运行时 resize 开销。

---

## Step 3：在线安装 IK 分词器

等待容器启动（约十几秒），通过 `docker exec` 直接在运行中的容器内执行安装（使用国内加速下载链接）：

```bash
docker exec -it es8.17.0 elasticsearch-plugin install -b \
  https://get.infini.cloud/elasticsearch/analysis-ik/8.17.0
```

| 参数 | 含义 |
|------|------|
| `-it` | 交互式伪终端，观察安装进度 |
| `es8.17.0` | 容器名 |
| `elasticsearch-plugin install` | ES 内置的插件管理命令 |
| `-b` | `--batch`，自动确认许可，不交互询问 |
| URL | IK 分词器 8.17.0 版本的下载地址 |

---

## Step 4：重启容器使插件生效

```bash
docker restart es8.17.0
```

> 插件安装后**必须重启**，ES 才会在启动时扫描并加载新的 `.zip` 插件包。

---

## 验证

### 验证插件加载

```bash
# 注意：路径直接跟 /_cat/plugins，不要多写斜杠
curl http://192.168.148.8:9200/_cat/plugins?v
```

期望输出：

```
name          component   version
d52544f05d01  analysis-ik 8.17.0
```

### 验证 ES 服务

```bash
curl http://192.168.148.8:9200/

# 期望输出含：
# "name" : "..."
# "version" : {"number" : "8.17.0"}
# "tagline" : "You Know, for Search"
```

---

## 部署总结

| 步骤 | 命令 | 说明 |
|------|------|------|
| 拉取镜像 | `docker pull` + `docker tag` | 国内加速源绕过网络问题 |
| 启动容器 | `docker run` + 环境变量 | single-node + 关闭安全 + 内存限制 |
| 安装插件 | `docker exec` + `plugin install -b` | 容器内直接安装，绕过 build 网络问题 |
| 重启生效 | `docker restart` | 加载新插件 |
| 验证 | `curl /_cat/plugins` | 确认 analysis-ik 已加载 |

---

## 相关链接

- [Docker常用命令](/posts/docker/docker常用命令/)
