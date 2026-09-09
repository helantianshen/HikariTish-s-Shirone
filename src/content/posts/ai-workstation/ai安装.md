---
title: AI安装
published: 2026-07-23
description: 汇总 Pi Agent 与 Oh My Pi 在 Windows、Linux 上的安装、配置文件和扩展管理流程。
tags:
  - AI 工具
  - 开发环境
category: 配置AI工作站
pinned: false
draft: false
comment: true
lang: zh_CN
---

# Pi Agent

## Win / Linux

```shell
npm install -g --ignore-scripts @earendil-works/pi-coding-agent

bun add -g --ignore-scripts @earendil-works/pi-coding-agent
```

## 配置文件

`auth.json`

```json
{
  "deepseek": {
    "type": "api_key",
    "key": "REDACTED_SECRET"
  },
  "xf-maas": {
    "type": "api_key",
    "key": "44fbf83f4d92a86bdb5b73d9a0c6c950:MDM5MWUxNDkxOGEyMGM1M2RjYmQ0YWE1"
  },
  "glm-count": {
    "type": "api_key",
    "key": "REDACTED_SECRET"
  },
  "酸奶GPT": {
    "type": "api_key",
    "key": "REDACTED_SECRET"
  },
  "ai2api-GPT": {
    "type": "api_key",
    "key": "REDACTED_SECRET"
  }
}
```

`models.json`

```json
{
    "providers": {
        "xf-maas": {
            "type": "apiKey",
            "baseUrl": "https://maas-coding-api.cn-huabei-1.xf-yun.com/anthropic",
            "api": "anthropic-messages",
            "api_key": "44fbf83f4d92a86bdb5b73d9a0c6c950:MDM5MWUxNDkxOGEyMGM1M2RjYmQ0YWE1",
            "models": [
                {
                    "id": "astron-code-latest",
                    "name": "GLM-5.2",
                    "reasoning": true,
                    "input": ["text"],
                    "contextWindow": 500000,
                    "thinkingLevelMap": {
                        "xhigh": "xhigh",
                        "max": "max"
                    }
                }
            ]
        },
        "glm-count": {
            "type": "apiKey",
            "baseUrl": "https://api.68886868.xyz",
            "api": "anthropic-messages",
            "api_key": "REDACTED_SECRET",
            "models": [
                {
                    "id": "[按量3][次] glm-5.2",
                    "name": "GLM-5.2",
                    "reasoning": true,
                    "input": ["text"],
                    "contextWindow": 1000000,
                    "thinkingLevelMap": {
                        "xhigh": "xhigh",
                        "max": "max"
                    }
                }
            ]
        },
        "酸奶GPT": {
            "type": "apiKey",
            "baseUrl": "https://closedai.kylenqaq.com/v1",
            "api": "openai-responses",
            "api_key": "REDACTED_SECRET",
            "models": [
                {
                    "id": "gpt-5.6-sol",
                    "name": "gpt-5.6-sol",
                    "reasoning": true,
                    "input": ["text"],
                    "contextWindow": 353000,
                    "thinkingLevelMap": {
                        "xhigh": "xhigh",
                        "max": "max"
                    }
                }
            ]
        },
        "ai2api-GPT": {
            "type": "apiKey",
            "baseUrl": "https://ai2api.cc",
            "api": "openai-responses",
            "api_key": "REDACTED_SECRET",
            "models": [
                {
                    "id": "gpt-5.6-sol",
                    "name": "GPT-5.6 Sol",
                    "reasoning": true,
                    "input": ["text"],
                    "contextWindow": 353000,
                    "thinkingLevelMap": {
                        "xhigh": "xhigh",
                        "max": "max"
                    }
                }
            ]
        }
    }
}
```

`settings.json`

```json
{
  "lastChangelogVersion": "0.80.10",
  "theme": "dark",
  "defaultProvider": "xf-maas",
  "defaultModel": "astron-code-latest",
  "defaultThinkingLevel": "max",
  "retry": {
    "enabled": true,
    "maxRetries": 1,
    "baseDelayMs": 1000,
    "provider": {
      "maxRetries": 0,
      "maxRetryDelayMs": 60000
    }
  },
  "packages": [
    "npm:context-mode",
    "npm:pi-markdown-preview",
    "npm:pi-powerline-footer",
    "npm:pi-btw",
    "npm:@juicesharp/rpiv-web-tools",
    "npm:@juicesharp/rpiv-pi",
    "npm:@juicesharp/rpiv-ask-user-question",
    "npm:@juicesharp/rpiv-todo",
    "npm:@juicesharp/rpiv-advisor",
    "npm:@juicesharp/rpiv-i18n",
    "npm:@juicesharp/rpiv-args",
    "npm:@juicesharp/rpiv-workflow",
    "npm:pi-pattern-retry",
    "npm:pi-subagents",
    "npm:pi-mcp-adapter"
  ],
  "hideThinkingBlock": false
}
```

## 扩展安装

安装姿势：`pi install 扩展名/git仓库/npm@包`

[Pi Top 20 热门扩展盘点](https://hua2003-liu.github.io/2026/05/11/Pi-Top-20-%E7%83%AD%E9%97%A8%E6%89%A9%E5%B1%95%E7%9B%98%E7%82%B9/index.html)

# Oh My Pi

## Win

安装 `Bun`

```bash
npm install -g bun
bun install -g @oh-my-pi/pi-coding-agent
```

安装脚本

```bash
irm https://omp.sh/install.ps1 | iex
```

## Linux

安装 `Bun`

```bash
npm install -g bun
bun install -g @oh-my-pi/pi-coding-agent
```

安装脚本

```bash
curl -fsSL https://omp.sh/install | sh
```

## 配置文件

`~/.omp/agent/models.yaml`

```yaml
providers:
  deepseek:
    baseUrl: https://api.deepseek.com
    api: openai-completions
    apiKey: REDACTED_SECRET
    authHeader: true
    models:
      - id: deepseek-v4-pro
        name: DeepSeek V4 Pro
        reasoning: true
        thinking:
          minLevel: high
          maxLevel: xhigh
          mode: effort
        input: [text]
        contextWindow: 1000000
        maxTokens: 384000
        compat:
          supportsDeveloperRole: false
          supportsReasoningEffort: true
          maxTokensField: max_tokens
          reasoningEffortMap:
            high: high
            xhigh: max
          supportsToolChoice: false
          requiresReasoningContentForToolCalls: true
          requiresAssistantContentForToolCalls: true
          extraBody:
            thinking:
              type: enabled
      - id: deepseek-v4-flash
        name: DeepSeek V4 Flash
        reasoning: true
        thinking:
          minLevel: high
          maxLevel: xhigh
          mode: effort
        input: [text]
        contextWindow: 1000000
        maxTokens: 384000
        compat:
          supportsDeveloperRole: false
          supportsReasoningEffort: true
          maxTokensField: max_tokens
          reasoningEffortMap:
            high: high
            xhigh: max
          supportsToolChoice: false
          requiresReasoningContentForToolCalls: true
          requiresAssistantContentForToolCalls: true
          extraBody:
            thinking:
              type: enabled

  # OpenAI 中转配置
  openai-proxy:
    baseUrl: http://codehub.ajiakesi.cn/v1
    api: openai-completions
    apiKey: REDACTED_SECRET
    models:
      - id: gpt-5.5
        name: gpt-5.5
        contextWindow: 200000
        maxTokens: 16384
        reasoning: true
        reasoningEffort: "xhigh"
        compat:
          supportsDeveloperRole: true
          supportsMultipleSystemMessages: true
          supportsToolChoice: true

  # Claude 中转配置
  claude-proxy:
    baseUrl: http://codehub.ajiakesi.cn
    api: anthropic-messages
    apiKey: REDACTED_SECRET
    models:
      - id: "claude-opus-4-7-max"
        name: claude-opus-4-7-max
        contextWindow: 1000000
        maxTokens: 24000
        reasoning: true
        reasoningEffort: "max"
        thinkingBudget: 16384
        compat:
          supportsDeveloperRole: false
          
      - id: "claude-sonnet-4-6"
        name: claude-sonnet-4-6
        contextWindow: 1000000
        maxTokens: 8192
        compat:
          supportsDeveloperRole: false

      - id: "claude-haiku-4-5"
        name: claude-haiku-4-5-20251001
        contextWindow: 1000000
        maxTokens: 4096
        compat:
          supportsDeveloperRole: false

  # Claude 酸奶中转站配置
  claude-sn:
    baseUrl: https://closedai.kylenqaq.com/v1
    api: anthropic-messages
    apiKey: REDACTED_SECRET
    models:
      - id: "claude-opus-4-8-thinking"
        name: claude-opus-4-8-thinking-sn
        contextWindow: 1000000
        maxTokens: 24000
        reasoning: true
        reasoningEffort: "max"
        thinkingBudget: 16384
        compat:
          supportsDeveloperRole: false

  # Opencode Go
  opencode-go:
    baseUrl: https://opencode.ai/zen/go/v1
    api: openai-completions
    apiKey: REDACTED_SECRET
    authHeader: true
    models:
      - id: "glm-5.2"
        name: glm-5.2
        contextWindow: 131072
        maxTokens: 8192
        reasoning: true
        thinking:
          minLevel: high
          maxLevel: xhigh
          mode: effort
        thinkingBudget: 16384
        compat:
          supportsDeveloperRole: false
          supportsToolChoice: false
          requiresReasoningContentForToolCalls: true
          requiresAssistantContentForToolCalls: true
          thinkingFormat: zai
          extraBody:
            thinking:
              type: enabled

      - id: "glm-5.1"
        name: glm-5.1
        contextWindow: 131072
        maxTokens: 8192
        reasoning: true
        thinking:
          minLevel: high
          maxLevel: xhigh
          mode: effort
        thinkingBudget: 16384
        compat:
          supportsDeveloperRole: false
          supportsToolChoice: false
          requiresReasoningContentForToolCalls: true
          requiresAssistantContentForToolCalls: true
          thinkingFormat: zai
          extraBody:
            thinking:
              type: enabled

      - id: "kimi-k2.7"
        name: kimi-k2.7
        contextWindow: 131072
        maxTokens: 8192
        reasoning: true
        thinking:
          minLevel: high
          maxLevel: xhigh
          mode: effort
        thinkingBudget: 16384
        compat:
          supportsDeveloperRole: false
          supportsToolChoice: false
          requiresReasoningContentForToolCalls: true
          requiresAssistantContentForToolCalls: true
          thinkingFormat: zai
          extraBody:
            thinking:
              type: enabled

      - id: "deepseek-v4-pro"
        name: deepseek-v4-pro
        contextWindow: 1000000
        maxTokens: 8192
        reasoning: true
        thinking:
          minLevel: high
          maxLevel: xhigh
          mode: effort
        compat:
          supportsDeveloperRole: false
          supportsReasoningEffort: true
          maxTokensField: max_tokens
          reasoningEffortMap:
            high: high
            xhigh: max
          supportsToolChoice: false
          requiresReasoningContentForToolCalls: true
          requiresAssistantContentForToolCalls: true
          extraBody:
            thinking:
              type: enabled
```

# Claude Code Cli

## Win

`npm` 安装

```bash
# Node.js 18+
npm install -g @anthropic-ai/claude-code@latest
```

官方脚本

```bash
irm https://claude.ai/install.ps1 | iex
```

## Linux

`npm` 安装

```bash
# Node.js 18+
npm install -g @anthropic-ai/claude-code@latest
```

官方脚本

```bash
curl -fsSL https://claude.ai/install.sh | bash
```

## 配置文件

`~/.claude/setting.json`

### `讯飞星辰Maas`

```json
{
  "autoUpdatesChannel": "latest",
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "44fbf83f4d92a86bdb5b73d9a0c6c950:MDM5MWUxNDkxOGEyMGM1M2RjYmQ0YWE1",
    "ANTHROPIC_BASE_URL": "https://maas-coding-api.cn-huabei-1.xf-yun.com/anthropic",
    "ANTHROPIC_DEFAULT_FABLE_MODEL": "astron-code-latest",
    "ANTHROPIC_DEFAULT_FABLE_MODEL_NAME": "glm5.2",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "astron-code-latest",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL_NAME": "glm5.2",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "astron-code-latest",
    "ANTHROPIC_DEFAULT_OPUS_MODEL_NAME": "glm5.2",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "astron-code-latest",
    "ANTHROPIC_DEFAULT_SONNET_MODEL_NAME": "glm5.2",
    "ANTHROPIC_MODEL": "astron-code-latest",
    "CLAUDE_CODE_EFFORT_LEVEL": "max"
  }
}
```

### `Deepseek-v4-Pro`

```json
{
  "autoUpdatesChannel": "latest",
  "effortLevel": "max",
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "REDACTED_SECRET",
    "ANTHROPIC_BASE_URL": "https://api.deepseek.com/anthropic",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "deepseek-v4-flash",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "deepseek-v4-pro[1m]",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "deepseek-v4-pro[1m]",
    "ANTHROPIC_MODEL": "deepseek-v4-pro[1m]",
    "CLAUDE_CODE_EFFORT_LEVEL": "max"
  }
}
```

### `Claude-Opus-4.7-max-proxy`

```json
{
  "autoUpdatesChannel": "latest",
  "effortLevel": "max",
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "REDACTED_SECRET",
    "ANTHROPIC_BASE_URL": "http://codehub.ajiakesi.cn",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "claude-haiku-4-5-20251001",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "claude-opus-4-7-max[1M]",
    "ANTHROPIC_DEFAULT_OPUS_MODEL_NAME": "claude-opus-4-7-max",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "claude-sonnet-4-6[1M]",
    "ANTHROPIC_DEFAULT_SONNET_MODEL_NAME": "claude-sonnet-4-6",
    "ANTHROPIC_MODEL": "claude-opus-4-7-max",
    "CLAUDE_CODE_EFFORT_LEVEL": "max"
  }
}
```

### `Claude-Opus-4.8-thinking-sn`

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "REDACTED_SECRET",
    "ANTHROPIC_BASE_URL": "https://closedai.kylenqaq.com",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "claude-haiku-4-5-20251101-thinking",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "claude-opus-4-8-thinking",
    "ANTHROPIC_DEFAULT_OPUS_MODEL_NAME": "claude-opus-4-8-thinking",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "claude-sonnet-4-6-thinking",
    "ANTHROPIC_DEFAULT_SONNET_MODEL_NAME": "claude-sonnet-4-6-thinking",
    "ANTHROPIC_MODEL": "claude-opus-4-8-thinking",
    "CLAUDE_CODE_EFFORT_LEVEL": "max"
  },
  "autoUpdatesChannel": "latest"
}
```

# Codex Cli

## Win / Linux

`npm` 安装

```bash
# Node.js 22+; npm 10+
npm install -g @openai/codex
```

## 配置文件

`~/.codex/auth.json`

```json
{
  "OPENAI_API_KEY": "44fbf83f4d92a86bdb5b73d9a0c6c950:MDM5MWUxNDkxOGEyMGM1M2RjYmQ0YWE1"
}
```

`~/.codex/config.toml`

```json
model_provider = "xf-api"
model = "astron-code-latest"
preferred_auth_method = "apikey"
model_reasoning_effort = "high"
disable_response_storage = true

[model_providers.xf-api]
name = "xf-api"
base_url = "https://maas-coding-api.cn-huabei-1.xf-yun.com/v1"
wire_api = "responses"

```

# OpenCode Cli

## Win / Linux

`npm` 安装

```bash
# Node.js 18+
npm install -g opencode-ai
```

## 配置文件

### 供应商

讯飞星辰 Maas

```json
"AstronCodingPlan": {
      "npm": "@liyang8246/fxxk-xf",
      "name": "astron-coding-plan",
      "options": {
        "baseURL": "https://maas-coding-api.cn-huabei-1.xf-yun.com/v2",
        "apiKey": "44fbf83f4d92a86bdb5b73d9a0c6c950:MDM5MWUxNDkxOGEyMGM1M2RjYmQ0YWE1"
      },
      "models": {
        "xopdeepseekv32": { "name": "DeepSeek-V3.2", "reasoning": true, "limit": { "context": 128000, "output": 128000 }, "options": { "enable_thinking": true } },
        "xopdeepseekv4flash": { "name": "DeepSeek-V4-Flash", "reasoning": true, "limit": { "context": 1000000, "output": 1000000 }, "options": { "enable_thinking": true } },
        "xopdeepseekv4pro": { "name": "DeepSeek-V4-Pro", "reasoning": true, "limit": { "context": 1000000, "output": 1000000 }, "options": { "enable_thinking": true } },
        "xopglmv47flash": { "name": "GLM-4.7-Flash", "reasoning": true, "limit": { "context": 128000, "output": 128000 }, "options": { "enable_thinking": true } },
        "xopglm5": { "name": "GLM-5", "reasoning": true, "limit": { "context": 200000, "output": 200000 }, "options": { "enable_thinking": true } },
        "xopglm51": { "name": "GLM-5.1", "reasoning": true, "limit": { "context": 200000, "output": 200000 }, "options": { "enable_thinking": true } },
        "xopglm52": { "name": "GLM-5.2", "reasoning": true, "limit": { "context": 500000, "output": 500000 }, "options": { "enable_thinking": true } },
        "xopkimik25": { "name": "KIMI-K2.5", "reasoning": true, "limit": { "context": 128000, "output": 128000 }, "options": { "enable_thinking": true } },
        "xopkimik26": { "name": "Kimi-K2.6", "reasoning": true, "limit": { "context": 256000, "output": 256000 }, "options": { "enable_thinking": true } },
        "xminimaxm25": { "name": "MiniMax-M2.5", "reasoning": true, "limit": { "context": 128000, "output": 128000 }, "options": { "enable_thinking": true } },
        "xop3qwencodernext": { "name": "Qwen3-Coder-Next-FP8", "reasoning": true, "limit": { "context": 256000, "output": 256000 }, "options": { "enable_thinking": true } },
        "xopqwen35v35b": { "name": "Qwen3.5-35B-A3B", "reasoning": true, "limit": { "context": 128000, "output": 128000 }, "options": { "enable_thinking": true } },
        "xopqwen35397b": { "name": "Qwen3.5-397B-A17B", "reasoning": true, "limit": { "context": 256000, "output": 256000 }, "options": { "enable_thinking": true } },
        "xopqwen36v35b": { "name": "Qwen3.6-35B-A3B", "reasoning": true, "limit": { "context": 128000, "output": 128000 }, "options": { "enable_thinking": true } },
        "xsparkx2": { "name": "Spark X2", "reasoning": true, "limit": { "context": 128000, "output": 128000 }, "options": { "enable_thinking": true } },
        "xsparkx2agent": { "name": "Spark-X2-Agent", "reasoning": true, "limit": { "context": 256000, "output": 256000 }, "options": { "enable_thinking": true } },
        "xsparkx2flash": { "name": "Spark-X2-Flash", "reasoning": true, "limit": { "context": 256000, "output": 256000 }, "options": { "enable_thinking": true } }
      }
    },
```

酸奶gpt

```json
"酸奶gpt": {
      "npm": "@ai-sdk/openai-compatible",
      "options": {
        "baseURL": "https://closedai.kylenqaq.com/v1",
        "apiKey": "REDACTED_SECRET"
      },
      "models": {
        "gpt-5.6-sol": {
          "name": "gpt-5.6-sol",
          "limit": {
            "context": 353000,
            "output": 128000
          }
        }
      }
    }
```
