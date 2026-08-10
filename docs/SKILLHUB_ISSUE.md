# SkillHub 对外发码（四插件）

对外售卖激活码时使用本接口。**不要**把 `ADMIN_PASSWORD` 或 `SKILLHUB_ISSUE_API_KEY` 放进 Skill 包或买家运行时。

## 威胁模型

本 Skill 是薄客户端（URL + 套餐名）。别人解压 zip **得不到**造码能力，除非拿到长期 `SKILLHUB_ISSUE_API_KEY`。

| 做法 | 是否有效 |
|------|----------|
| 加密 / 混淆 `issue.mjs` | 低；挡不住读 env / 抓包 |
| HGD1/HGL1 包保护 | 适合保护核心提示词 Skill，不适合本发码薄客户端 |
| 长期密钥只留服务端 + 一次性 `issue_token` | **有效**（本版方案） |
| 日配额 + 审计 note/日志 | 降低刷量与便于追责 |

真正会毁掉生意的路径：密钥泄漏 → 绕过付费无限 `issue` → 白嫖四插件码。

## 与其它接口的区别

| 接口 | 用途 | 鉴权 |
|------|------|------|
| `/api/activation` create | 管理后台发码 | `x-admin-auth` = `ADMIN_PASSWORD` |
| `/api/skillhub_issue` mint_token | 运营签发短时凭证 | `x-skill-api-key` = `SKILLHUB_ISSUE_API_KEY` |
| `/api/skillhub_issue` issue | 买家兑换激活码 | `x-issue-token`（一次性，约 5 分钟） |
| `/api/skill_activation` | HGD1→HGL1 Skill 许可证 | `x-admin-auth`（另一产品线） |

## 环境变量

```text
SKILLHUB_ISSUE_API_KEY=<长随机串>     # 仅 Vercel / 运营中继
SKILLHUB_ISSUE_DAILY_LIMIT=200       # 可选，UTC 日全局发码上限，默认 200
REDIS_URL=...                        # 强烈建议：token 防重放与日配额；无 Redis 时用进程内存（多实例不安全）
```

泄露应急：轮换 `SKILLHUB_ISSUE_API_KEY`（旧签名立即失效）；检查 `activation_keys.note` 含 `skillhub|` 的近期记录；管理端批量删除误发码。

## 套餐

| packageId | plugin | 天数 |
|-----------|--------|------|
| `flowx-30d` | flowx | 30 |
| `cjzs-30d` | cjzs | 30 |
| `zhiliao-30d` | zhiliao | 30 |
| `zhixiao-30d` | zhixiao | 30 |

## API

```http
GET /api/skillhub_issue?action=packages
```

```http
POST /api/skillhub_issue?action=mint_token
Header: x-skill-api-key: ***
Content-Type: application/json

{ "packageId": "zhiliao-30d", "orderRef": "ORDER123" }
```

```http
POST /api/skillhub_issue?action=issue
Header: x-issue-token: SHIT1.…
Content-Type: application/json

{ "phone": "13800138000" }
```

限流与配额：

- API Key（mint）：每小时 60 次
- IP（issue）：每 3 分钟 10 次
- 全局日配额：默认 200（`SKILLHUB_ISSUE_DAILY_LIMIT`）

成功发码会：

- 写 stdout 审计 JSON（`type=skillhub_issue_audit`）
- 在 `activation_keys.note` 写入 `skillhub|packageId|iso|ip=…|jti=…`

## Skill 包

路径：`skills/plugin-activation-issuer/`（version `1.1.0`）

```bash
# 买家兑换（无长期密钥）
node skills/plugin-activation-issuer/scripts/issue.mjs --token "SHIT1.xxx"

# 运营签发
set SKILLHUB_ISSUE_API_KEY=***
node skills/plugin-activation-issuer/scripts/issue.mjs --mint --package flowx-30d

# 运营本机签发并兑换
node skills/plugin-activation-issuer/scripts/issue.mjs --mint-and-issue --package cjzs-30d

# 打上传 zip
node skills/plugin-activation-issuer/scripts/pack.mjs
```

SkillHub 发布页：上传 zip；Slug `plugin-activation-issuer`；按次计费。买家运行时**不要**配置 `SKILLHUB_ISSUE_API_KEY`——只粘贴/传入中继下发的 `issue_token`。
