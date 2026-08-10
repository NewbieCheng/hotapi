---
name: plugin-activation-issuer
slug: plugin-activation-issuer
version: 1.1.0
displayName: 四插件激活码生成
description: >
  按固定套餐为 FlowX、知源采集助手(CJZS)、知聊、知销兑换真实激活码。
  Use when the user asks to generate/issue/购买/兑换激活码 for FlowX、今天不加班、知源、CJZS、知聊、知销，
  or provides an issue_token / SHIT1 voucher for packageId flowx-30d / cjzs-30d / zhiliao-30d / zhixiao-30d.
summary: 买家仅用一次性发码凭证兑换四插件 30 天激活码；长期 API 密钥永不进入买家环境
tags:
  - activation
  - license
  - flowx
  - cjzs
  - zhiliao
  - zhixiao
---

# 四插件激活码生成

通过中转站 `POST /api/skillhub_issue?action=issue`，用**一次性发码凭证**兑换 1 条 30 天激活码。

## 威胁模型（必读）

| 资产 | 谁能持有 |
|------|----------|
| `SKILLHUB_ISSUE_API_KEY` | **仅**你们服务器 / 本机运营中继。禁止写入本 Skill zip，禁止配给购买者 Agent |
| `issue_token`（`SHIT1.…`） | 付费确认后由中继签发，短时（约 5 分钟）单次使用，可交给买家 |
| 本 Skill 源码 | 可公开；加密客户端挡不住抓包，也解不出管理密码 |

加密或混淆本 Skill **不能**防止白嫖；防线在服务端凭证与配额。详见 [references/packages.md](references/packages.md)。

## 环境变量

| 变量 | 买家侧 | 运营中继 |
|------|--------|----------|
| `HOTAPI_BASE_URL` | 可选，默认 `https://abc.no996ai.cn` | 可选 |
| `SKILLHUB_ISSUE_API_KEY` | **禁止** | 仅 `--mint` / `--mint-and-issue` |

## 工作流（买家）

1. 用户提供一次性 `issue_token`（及可选手机号：仅知聊/知销）。
2. 确认后执行（相对本 Skill 根目录）：

```bash
node scripts/issue.mjs --token "SHIT1.xxxxx" [--phone 13800138000]
```

3. 成功时只展示：`plugin`、`key`、`duration_days`、`packageId`。
4. 失败（401/403/429/409）原样说明，**不要自动重试刷量**。

## 工作流（运营中继 — 勿对买家暴露）

付费确认后在**你们自己的环境**签发凭证，再把 token 发给买家或代为兑换：

```bash
# 只签发凭证
node scripts/issue.mjs --mint --package zhiliao-30d --order-ref ORDER123

# 本机签发并立刻兑换（密钥不出运营机）
node scripts/issue.mjs --mint-and-issue --package flowx-30d
```

## 槽位

| 槽位 | 必填 | 说明 |
|------|------|------|
| `issue_token` | 买家侧是 | 一次性凭证；绑定套餐，无需再传 packageId |
| `phone` | 否 | 仅知聊/知销 |
| `packageId` | 仅运营 mint | `flowx-30d` \| `cjzs-30d` \| `zhiliao-30d` \| `zhixiao-30d` |

## 禁止事项

- 不向用户打印或索要 `SKILLHUB_ISSUE_API_KEY` / `ADMIN_PASSWORD`
- 不调用 `/api/activation` 管理端 create
- 不把长期 API Key 写进 SkillHub 买家运行时环境
- 不与 HGD1/HGL1 加密 Skill 许可证流程混用
