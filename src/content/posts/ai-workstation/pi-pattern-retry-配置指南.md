---
title: pi-pattern-retry-配置指南
published: 2026-07-21
description: 说明 pi-pattern-retry 的安装、事件匹配与重试计划配置，用于在服务异常后自动继续会话。
tags:
  - AI 工具
  - 工程实践
category: 配置AI工作站
pinned: false
draft: false
comment: true
lang: zh_CN
---

# pi-pattern-retry 插件配置指南 — 503 自动重发 continue

> 目标：当 provider 返回 HTTP `503`（或错误信息含 `503`）时，自动向 pi 注入 `continue` 消息让会话继续，避免因瞬时 503 导致任务中断。

---

## 一、插件简介

`pi-pattern-retry` 监听两类事件，匹配到配置的模式后，按 `scheduleSec` 里的间隔逐次向会话注入一条续跑消息：

| 事件来源 | 检查内容 | 典型捕获 |
|---|---|---|
| `after_provider_response` | HTTP `status` | `401 / 403 / 429 / 5xx` |
| `agent_end` | 最后一条 assistant 消息的 `errorMessage` | 传输层错误文本 |

- 同一个 `(sessionId, patternName)` 只保留一个计时器，重复触发会去重。
- `stopOnProgress: true` 时，若会话已自然推进（排除插件自己的注入），计数器重置并停止——不会在 agent 正常工作时捣乱。

---

## 二、前置条件

- 已安装 pi（`pi` 命令可用）。
- Node.js 可用（插件依赖，且下方生成配置的命令用到 `node`）。

---

## 三、配置步骤（Windows 本机）

### 步骤 1：安装插件

```bash
pi install npm:pi-pattern-retry
```

安装后，pi 会自动在 `settings.json` 的 `packages` 数组里加入 `"npm:pi-pattern-retry"`。

### 步骤 2：确认 settings.json 已注册

打开（Windows 路径）：

```
C:\Users\<你的用户名>\.pi\agent\settings.json
```

打开（Linux路径）：

```
/home/<你的用户名>/.pi/agent/settings.json 
```

确认 `packages` 数组中包含这一项：

```json
"npm:pi-pattern-retry"
```

> ⚠️ 若没有，手动补上这一行字符串到 `packages` 数组，保存后重启 pi。

### 步骤 3：创建配置文件（最关键的一步！）

**插件只读取这两个路径的配置文件，其它路径一律忽略：**

- 全局：`~/.pattern-retry.json`
- 项目级覆盖：`<当前工作目录>/.pattern-retry.json`（同名 pattern 覆盖全局，新 pattern 追加）

在 Windows 上，`~` 即用户主目录：

```
C:\Users\<你的用户名>\.pattern-retry.json
/home/<你的用户名>/.pattern-retry.json
```

> 🔴 **最常见的失效原因**：把配置放到了别的目录（例如 `.pi/agent/` 下），插件根本不会去读。
> 另一个常见错误：用了 `retryRules / trigger / delayMs / maxRetries` 这种字段名——**插件不认这些字段**，正确格式见步骤 4。

在该路径下新建 `.pattern-retry.json`，内容见步骤 4。

### 步骤 4：写入配置内容

#### ✅ 推荐版（精简、不膨胀，直接复制）

60 次重试，每次间隔 1 秒（约 1 分钟内持续打 `continue`），足以覆盖瞬时 503：

```json
{
  "enabled": true,
  "patterns": [
    {
      "name": "only-503-fast-retry",
      "match": { "source": "providerStatus", "kind": "regex", "value": "^503$" },
      "scheduleSec": [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      "message": "continue",
      "stopOnProgress": true
    },
    {
      "name": "only-503-fast-retry-err",
      "match": { "source": "errorMessage", "kind": "regex", "value": "^503" },
      "scheduleSec": [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      "message": "continue",
      "stopOnProgress": true
    }
  ]
}
```

> 两个 pattern 作用相同（都注入 `continue`），分别覆盖「HTTP 状态 503」和「错误信息含 503」两条路径，互为补充。

#### 📜 想要更多次重试？用命令生成（避免手写巨型数组）

下面这条命令在 Windows 上生成 **1000 次**重试（1 秒间隔）的配置并直接写到正确路径（文件约 5KB，远小于手写百万条导致的 6MB）：

```bash
node -e "const n=1000; const p={enabled:true,patterns:[{name:'only-503-fast-retry',match:{source:'providerStatus',kind:'regex',value:'^503$'},scheduleSec:Array(n).fill(1),message:'continue',stopOnProgress:true},{name:'only-503-fast-retry-err',match:{source:'errorMessage',kind:'regex',value:'^503'},scheduleSec:Array(n).fill(1),message:'continue',stopOnProgress:true}]}; require('fs').writeFileSync((process.env.USERPROFILE||require('os').homedir())+'/.pattern-retry.json', JSON.stringify(p,null,2)); console.log('written:', (process.env.USERPROFILE||require('os').homedir())+'/.pattern-retry.json');"
```

把 `n=1000` 改成你想要的重试次数即可。

> ⚠️ **不要学我本机旧配置**：旧配置把 `scheduleSec` 写成 100 万个 `1`，导致 `.pattern-retry.json` 膨胀到 5.7 MB，毫无必要。用上面的命令生成几百到几千次就足够了。

### 步骤 5：重启 pi 会话

```bash
pi
```

重启后插件才会加载新配置。

### 步骤 6：验证生效

在 pi 会话内执行：

```
/pattern-retry-status
```

应能看到两个 pattern 的 `attempt / max / exhausted / scheduled` 状态信息。

---

## 四、配置字段详解

| 字段 | 说明 |
|---|---|
| `enabled` | 顶层开关，`false` 时整个插件不工作 |
| `patterns` | 模式数组，每个元素是一条重试规则 |
| `patterns[].name` | 规则名，唯一标识（用于 status / reset） |
| `patterns[].match.source` | `providerStatus`（匹配 HTTP 状态码字符串）或 `errorMessage`（匹配错误信息文本） |
| `patterns[].match.kind` | `regex`（正则）或 `contains`（大小写敏感子串） |
| `patterns[].match.value` | 正则串或子串。正则用 `new RegExp(value)`，无隐式 flag |
| `patterns[].scheduleSec` | 重试间隔数组（秒）。**长度 = 最大重试次数**，逐项推进；耗尽后该 pattern 失活直到 `/pattern-retry-reset` |
| `patterns[].message` | 注入到会话的续跑消息文本，支持模板变量 |
| `patterns[].stopOnProgress` | `true` 时，会话自然推进则重置计数并停止重试 |
| `patterns[].notify` | 可选 `["webhook","dashboard"]`，V1 仅记日志 |

### match 语义

- `source: "providerStatus"` → 匹配十进制状态码字符串，如 `"503"`、`"429"`。
- `source: "errorMessage"` → 匹配 assistant 消息的 `errorMessage`，为空则不匹配。
- `kind: "contains"` → 大小写敏感子串；`kind: "regex"` → 正则，需大小写不敏感时自己在 value 里加 `(?i)` 或用 `i` flag 形式。

### 模板变量（message 中可用）

| 变量 | 值 |
|---|---|
| `{{status}}` | HTTP 状态码，无则为 `0` |
| `{{statusText}}` | 人读标签 |
| `{{reason}}` | 匹配来源片段 |
| `{{patternName}}` | 规则名 |
| `{{attempt}}` | 当前第几次（1 起） |
| `{{maxAttempts}}` | `scheduleSec.length` |
| `{{lastDelaySec}}` | 本次触发前等待的秒数 |
| `{{nextDelaySec}}` | 下一次延迟秒数，无则 `0` |

> 本指南中 message 固定为 `continue`，不使用变量——直接把 `continue` 当作下一条用户输入发给 pi。

---

## 五、常用命令

| 命令 | 作用 |
|---|---|
| `/pattern-retry-status` | 查看各 pattern 的 attempt/max/exhausted/scheduled |
| `/pattern-retry-reset [name\|all]` | 取消计时器并重置计数 |
| `/pattern-retry-toggle` | 切换全局 `enabled` 开关 |
| `/pattern-retry-log [N]` | 在会话内打印最近 N 行日志（默认 50，上限 500） |

---

## 六、日志排查

日志是排查的唯一真相来源，每条决策都写在这里：

```
C:\Users\<你的用户名>\.pi\logs\extensions\pattern-retry.log
/home/<你的用户名>/.pi/logs/extensions/pattern-retry.log
```

每行格式：

```
<iso时间> [pattern-retry] <LEVEL> <event> <json>
```

| 关键 event | 含义 |
|---|---|
| `session-start` | 会话已绑定插件 |
| `config-loaded` / `config-load failed` | 配置加载结果（failed 说明路径/格式有问题） |
| `trigger:matched` | 触发命中，列出匹配的 pattern |
| `schedule:armed` | 计时器已设定 |
| `fire:injected` | 已注入续跑消息 |
| `fire:reset-on-progress` | 会话自然推进，计数重置未注入 |
| `schedule:skip-exhausted` | 次数用尽 |
| `trigger:skipped-disabled` / `trigger:skipped-no-session` | 触发被丢弃及原因 |

实时查看（在 pi 会话内）：

```
/pattern-retry-log 200
```

---

## 七、常见陷阱与故障排查

### ❌ 陷阱 1：配置文件放错路径

插件只读 `~/.pattern-retry.json` 和 `<cwd>/.pattern-retry.json`。放到 `.pi/agent/`、`.pi/` 下都**不会被读取**。

**自检**：确认文件就在 `C:\Users\<你的用户名>\.pattern-retry.json`。

### ❌ 陷阱 2：字段名写错

`retryRules`、`trigger`、`delayMs`、`maxRetries` 这些字段插件**完全不认**。正确字段是 `patterns` 数组 + `match` + `scheduleSec` + `message`。写成旧格式等于没配置。

### ❌ 陷阱 3：`HOME` 环境变量覆盖主目录

插件取主目录的代码是 `process.env.HOME || os.homedir()`。

- 正常 Windows：`HOME` 未设置 → 用 `os.homedir()` = `C:\Users\<用户名>` ✅
- 若你在 **Git Bash / MSYS2 / WSL** 里运行 pi，`HOME` 可能被设成 `/c/Users/...` 或 `/home/...`，导致插件去那个路径找配置。

**自检**：在运行 pi 的同一终端里执行 `echo $HOME`（Git Bash）或 `echo %HOME%`（CMD）。如果非空且不是你想放配置的目录，把 `.pattern-retry.json` 放到那个 `HOME` 指向的目录，或清掉该环境变量。

### ❌ 陷阱 4：`^503` 误匹配

`only-503-fast-retry-err` 用 `^503` 匹配 errorMessage 开头。任何以 `503` 开头的错误信息都会触发重试。若发现没遇到真 503 却一直狂发 `continue`，检查日志里 `trigger:matched` 的 `textLen` 和实际错误文本，必要时把 value 收紧（如 `^503\b` 或更精确串）。

### ❌ 陷阱 5：scheduleSec 写成百万级数组

旧本机配置把 `scheduleSec` 写成 100 万个 `1`，文件 5.7 MB，纯属浪费。用「步骤 4」的命令生成几百~几千次即可，文件仅几 KB。

### ❌ 陷阱 6：改了配置没重启

配置只在会话启动时加载。改完 `.pattern-retry.json` 必须**重启 pi**，否则不生效。

---

## 八、Windows 与 Linux 路径对照

| 文件 | Windows | Linux（本机） |
|---|---|---|
| 全局配置 | `C:\Users\<用户名>\.pattern-retry.json` | `/home/<用户名>/.pattern-retry.json` |
| 项目覆盖 | `<项目目录>\.pattern-retry.json` | `<项目目录>/.pattern-retry.json` |
| settings.json | `C:\Users\<用户名>\.pi\agent\settings.json` | `/home/<用户名>/.pi/agent/settings.json` |
| 日志 | `C:\Users\<用户名>\.pi\logs\extensions\pattern-retry.log` | `/home/<用户名>/.pi/logs/extensions/pattern-retry.log` |

---

## 九、TL;DR（最快上手三步）

1. `pi install npm:pi-pattern-retry`
2. 把 `C:\Users\<你的用户名>\.pattern-retry.json` 写成「步骤 4 推荐版」内容
3. 重启 pi，用 `/pattern-retry-status` 验证
