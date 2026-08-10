# 固定套餐与鉴权

服务端白名单，客户端不能改天数或权限。每次 issue 只生成 **1** 条码。

| packageId | 插件 | 天数 | 前缀 | 手机号 |
|-----------|------|------|------|--------|
| `flowx-30d` | FlowX（今天不加班） | 30 | `XHS-…` | 不支持 |
| `cjzs-30d` | 知源采集助手 | 30 | `CJZS-` | 不支持 |
| `zhiliao-30d` | 知聊 | 30 | `ZHILIAO-` | 可选 |
| `zhixiao-30d` | 知销 | 30 | `ZHIXIAO-` | 可选 |

## 两段鉴权

```text
运营机 + SKILLHUB_ISSUE_API_KEY
  → POST mint_token → issue_token (约 5 分钟、单次)
买家 / Skill
  → POST issue + x-issue-token → 激活码
```

- 长期密钥**永不**进入买家环境
- 加密本 Skill 源码挡不住抓包；不要指望客户端混淆保护发码能力

## API

- 套餐列表：`GET {HOTAPI_BASE_URL}/api/skillhub_issue?action=packages`
- 签发凭证（服务端密钥）：`POST ...?action=mint_token`  
  Header: `x-skill-api-key`  
  Body: `{ "packageId": "zhiliao-30d", "orderRef": "可选订单号" }`
- 兑换发码（买家凭证）：`POST ...?action=issue`  
  Header: `x-issue-token: SHIT1.…`  
  Body: `{ "phone": "可选" }`
