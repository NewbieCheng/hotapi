# 中转站 API - Agent 导航文档

> Vercel 部署的 API 中转站 + 双插件激活码管理  
> 生产域名示例：`https://abc.no996ai.cn`

---

## 项目结构

```
中转站api/
├── agent.md                 # 本文件（AI / 开发者导航）
├── API_DOC.md               # 对外接口文档（proxy + CJZS 客户端）
├── admin.html               # 激活码管理后台（静态页，/admin）
├── vercel.json              # 路由与构建配置
├── index.js                 # 根路径占位页
├── api/
│   ├── _activation_core.js  # 激活共享：加密、前缀校验、CJZS user 映射
│   ├── _activation_desktop.js  # 知聊/知销桌面端 activate/verify 工厂
│   ├── activation.js        # 管理端 + 旧版明文 activate/verify
│   ├── activation_v2.js     # FlowX 客户端（加密 activate/verify/更新）
│   ├── activation_cjzs.js   # 采集助手客户端（加密 activate/verify）
│   ├── activation_zhiliao.js # 知聊桌面端（加密 activate/verify）
│   ├── activation_zhixiao.js # 知销桌面端（加密 activate/verify）
│   ├── proxy.js             # 搜索 API 中转
│   └── cache_system.js      # Redis 缓存 / 限流
└── sql/
    └── 20260430_add_activation_permissions.sql
```

---

## 路由一览

| 路径 | 文件 | 用途 |
|------|------|------|
| `/api/proxy` | `api/proxy.js` | 抖音/小红书等搜索中转 |
| `/api/activation` | `api/activation.js` | **管理后台专用** + 明文客户端（遗留） |
| `/api/activation_v2` | `api/activation_v2.js` | **FlowX** 插件激活（AES 加密响应） |
| `/api/activation_cjzs` | `api/activation_cjzs.js` | **采集助手 CJZS** 激活（AES 加密响应） |
| `/api/activation_zhiliao` | `api/activation_zhiliao.js` | **知聊** 桌面端激活（AES 加密响应） |
| `/api/activation_zhixiao` | `api/activation_zhixiao.js` | **知销** 桌面端激活（AES 加密响应） |
| `/admin` | `admin.html` | 激活码管理 UI |

配置见 [`vercel.json`](vercel.json)。

---

## 双插件规则

两插件共用 Supabase 表 `activation_keys`，通过 **key 前缀** 区分，互不可混用。

| 插件 | 客户端 API | 激活码前缀 | 权限字段 |
|------|-----------|-----------|---------|
| FlowX（今天不加班） | `/api/activation_v2` | `XHS-` 等（**非** `CJZS-` / `ZHILIAO-` / `ZHIXIAO-`） | `ac` + `ai/cp/co/...` 功能开关 |
| 采集助手 CJZS | `/api/activation_cjzs` | 仅 `CJZS-` | 主要读 `permissions.ac` → `user.vips` |
| 知聊（WeFlow 桌面） | `/api/activation_zhiliao` | 仅 `ZHILIAO-` | `permissions` 为空 = 全功能 |
| 知销（Private Kings） | `/api/activation_zhixiao` | 仅 `ZHIXIAO-` | `permissions` 为空 = 全功能 |

共享逻辑在 [`api/_activation_core.js`](api/_activation_core.js)：

- `assertCjzsKey(key)` — CJZS API 拒绝非 `CJZS-` 码
- `assertNotCjzsKey(key)` — FlowX API 拒绝 `CJZS-` 码
- `DEFAULT_CJZS_VIPS` — CJZS 默认全平台 VIP 列表
- `encryptPayload` / `sanitizeCjzsActivationData` — 加密与响应裁剪

### CJZS 默认平台 code

`xiaohongshu`, `douyin`, `bilibili`, `kuaishou`, `tiktok`, `xingtu`, `pgy.xiaohongshu`

### 关联客户端代码

| 仓库 | 文件 |
|------|------|
| 采集助手扩展 | `3.2.5_0/chunks/03d-cjzs-activation.js` |
| FlowX 扩展 | `my-new-plugin/src/lib/activation.ts` |

---

## 管理端 API（`activation.js`）

鉴权：请求头 `x-admin-auth: <ADMIN_PASSWORD>`

| action | 方法 | 说明 |
|--------|------|------|
| `login` | POST | `{ password }` 校验管理密钥 |
| `list` | GET | 分页列表；`plugin=flowx\|cjzs\|all` 按前缀筛选 |
| `create` | POST | 批量生成；`plugin` 强制前缀 |
| `update_permissions` | POST | `{ id, permissions }` |
| `update_expires_at` | POST | `{ id, expires_at }` ISO8601 精确到微秒 |
| `batch_delete` | POST | `{ ids: [] }` |
| `delete` | DELETE | `?id=` |

### list 参数

```
GET /api/activation?action=list&page=1&pageSize=10&plugin=cjzs
Header: x-admin-auth: ***
```

- `plugin=cjzs` → 仅 `CJZS-%`
- `plugin=zhiliao` → 仅 `ZHILIAO-%`
- `plugin=zhixiao` → 仅 `ZHIXIAO-%`
- `plugin=flowx` → 排除 `CJZS-%` / `ZHILIAO-%` / `ZHIXIAO-%`
- `plugin=all` 或省略 → 全量（兼容旧行为）
- 其他：`key`, `device_id`, `is_used`, `duration_days`

### create 参数

```json
{
  "plugin": "cjzs",
  "count": 5,
  "duration_days": 30,
  "prefix": "CJZS",
  "permissions": { "ac": ["xiaohongshu", "douyin"] }
}
```

- `plugin=cjzs` → 强制 prefix `CJZS`
- `plugin=zhiliao` → 强制 prefix `ZHILIAO`
- `plugin=zhixiao` → 强制 prefix `ZHIXIAO`
- `plugin=flowx` → 拒绝 `CJZS` / `ZHILIAO` / `ZHIXIAO` 前缀

支持三种生成方式（`action=create`）：

| 模式 | 参数 | 示例 |
|------|------|------|
| 随机批量 | `count` + `prefix` | `{ "plugin":"zhiliao", "count":5, "duration_days":30 }` |
| 自定义完整码 | `key` | `{ "plugin":"zhiliao", "key":"ZHILIAO-VIP-001", "duration_days":365 }` |
| 前缀+手机号 | `phone` 或 `phones[]` | `{ "plugin":"zhixiao", "phone":"13800138000", "duration_days":90 }` |

手机号模式自动生成 `ZHILIAO-13800138000` 格式；重复 key 返回 `409`。

### update_expires_at

```json
{
  "id": "uuid",
  "expires_at": "2026-05-01T08:46:02.161624+00:00"
}
```

---

## 客户端 API 摘要

### FlowX — `activation_v2.js`

```
POST /api/activation_v2?action=activate|verify|check_update|get_download_url
Body: { key, device_id, include_permissions? }
Response: { e, i }  // AES-256-GCM，密钥 device_id + API_SALT
```

### CJZS — `activation_cjzs.js`

```
POST /api/activation_cjzs?action=activate|verify
Body: { key, device_id, include_permissions? }
Response: { e, i }
解密后含 data.user: { name, email, vips[], isVip }
```

### 知聊 / 知销 — `activation_zhiliao.js` / `activation_zhixiao.js`

```
POST /api/activation_zhiliao?action=activate|verify
POST /api/activation_zhixiao?action=activate|verify
Body: { key, device_id }
Response: { e, i }
解密后含 data: { key, expires_at, is_licensed, is_expired, ... }
```

激活码格式：`ZHILIAO-13800138000` / `ZHIXIAO-13800138000`（前缀 + 11 位手机号）或管理员自定义完整码。

详见 [`API_DOC.md`](API_DOC.md) 采集助手章节。

---

## 环境变量

| 变量 | 用途 |
|------|------|
| `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | 服务端读写 `activation_keys` |
| `ADMIN_PASSWORD` | admin.html 管理密钥 |
| `REDIS_URL` | 限流 / 缓存（可选） |
| `ACTIVATION_CJZS_INCLUDE_PERMISSIONS_DEFAULT` | CJZS 默认是否下发权限 |
| `ACTIVATION_V2_INCLUDE_PERMISSIONS_DEFAULT` | FlowX 默认是否下发权限 |
| R2 相关 | FlowX 版本更新（`activation_v2` check_update） |

---

## admin.html 结构

```
[FlowX] [采集助手] [知聊] [知销] [系统选项]     ← 顶层插件页签
  └─ [激活码库] [快捷生成] [选项]  ← 子页签（各插件）
```

- FlowX：完整功能权限 + 分发渠道
- CJZS：仅平台 `ac` chip
- 知聊 / 知销：会员周期 + 随机 / 自定义 / 手机号三种生成方式
- 过期时间：完整 ISO 展示 + 弹窗精确编辑
- 偏好存 `localStorage`（`admin_prefs_flowx` / `admin_prefs_cjzs` / `admin_prefs_system`）

访问：`https://abc.no996ai.cn/admin`

---

## 修改指引

| 目标 | 改哪里 |
|------|--------|
| 管理后台 UI | `admin.html` |
| 管理端接口 / 列表筛选 / 续期 | `api/activation.js` |
| FlowX 客户端激活逻辑 | `api/activation_v2.js` + `my-new-plugin` |
| CJZS 客户端激活逻辑 | `api/activation_cjzs.js` + `03d-cjzs-activation.js` |
| 双插件共享规则 | `api/_activation_core.js` |
| 新增 DB 字段 | `sql/` 迁移 + 三处 activation 读写 |
| 部署路由 | `vercel.json` |

改完 admin 或 API 后本地可用 Vercel CLI 或 `vercel dev` 验证 `/admin` 与 `/api/activation?action=list`。

---

## 专题文档索引

| 文档 | 内容 |
|------|------|
| [API_DOC.md](API_DOC.md) | proxy 搜索、CJZS 客户端、管理端 action |
| [03-vip-and-auth.md](../dbichmdlbjdeplpkhcejgkakobjbjalc/dbichmdlbjdeplpkhcejgkakobjbjalc/3.2.5_0/03-vip-and-auth.md) | 采集助手 VIP 体系（扩展侧） |
