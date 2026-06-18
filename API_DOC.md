# API 接口文档

本文档描述了中转站支持的特定解析接口。对于其他接口，中转站将直接转发原始响应。

# curl 请求示例
curl ^"https://abc.no996ai.cn/api/proxy^" ^
  -H ^"accept: */*^" ^
  -H ^"accept-language: zh-CN,zh;q=0.9^" ^
  -H ^"cache-control: no-cache^" ^
  -H ^"content-type: application/json^" ^
  -H ^"origin: https://abc.no996ai.cn^" ^
  -H ^"pragma: no-cache^" ^
  -H ^"priority: u=1, i^" ^
  -H ^"referer: https://abc.no996ai.cn/test^" ^
  -H ^"sec-ch-ua: ^\^"Not:A-Brand^\^";v=^\^"99^\^", ^\^"Google Chrome^\^";v=^\^"145^\^", ^\^"Chromium^\^";v=^\^"145^\^"^" ^
  -H ^"sec-ch-ua-mobile: ?0^" ^
  -H ^"sec-ch-ua-platform: ^\^"Windows^\^"^" ^
  -H ^"sec-fetch-dest: empty^" ^
  -H ^"sec-fetch-mode: cors^" ^
  -H ^"sec-fetch-site: same-origin^" ^
  -H ^"user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36^" ^
  --data-raw ^"^{^\^"path^\^":^\^"/api/douyin/search_general_v3^\^",^\^"method^\^":^\^"POST^\^",^\^"headers^\^":^{^\^"Authorization^\^":^\^"Bearer nDYzjfbvUwrarScn2s5HSoOC2lHORqOnZyD8DA9GlP1cJ9kaLRDptk6OjbBWkppS^\^",^\^"Content-Type^\^":^\^"application/json^\^"^},^\^"body^\^":^{
    "keyword": "搜索词",
    "sort_type": 0,
    "publish_time": 0,
    "content_type": 0,
    "filter_duration": 0,
    "cursor": "0",
    "backtrace": ""
  }"^{^\^"^}"

## 基础信息

- **中转地址**: `https://abc.no996ai.cn/api/proxy`
- **请求方式**: POST
- **通用参数**:
  - `path`: 目标接口路径 (例如 `/api/douyin/search_general_v3`)
  - `method`: 请求方法 (通常为 `POST` 或 `GET`)
  - `headers`: 请求头 (必填，需包含 `Authorization` 令牌)
  - `body`: 请求体 (JSON 对象)

### 请求示例

```json
{
  "path": "/api/douyin/search_general_v3",
  "method": "POST",
  "headers": {
    "Authorization": "Bearer YOUR_TOKEN",
    "Content-Type": "application/json"
  },
  "body": {
    "keyword": "搜索词",
    "sort_type": 0,
    "publish_time": 0,
    "content_type": 0,
    "filter_duration": 0,
    "cursor": "0",
    "backtrace": ""
  }
}
```

---

## 1. 抖音搜索解析

**接口路径**: `/api/douyin/search_general_v3`

### 输入参数 (Body)

参考 `ApifoxModel` 结构：

```typescript
export interface DouyinSearchRequest {
    /** 关键词 */
    keyword: string;
    /** 排序: 0=综合, 1=最新, 2=最热 */
    sort_type: string;
    /** 发布时间: 0=不限, 1=一天内, 7=一周内, 180=半年内 */
    publish_time: string;
    /** 内容形式: 0=全部, 1=视频, 2=图文 */
    content_type: string;
    /** 视频时长: 0=不限, 1=1分钟内, 2=1-5分钟, 3=5分钟以上 */
    filter_duration: string;
    /** 翻页参数，首次请求传 0 */
    cursor: string;
    /** 翻页回溯标识，首次传空 */
    backtrace: string;
    /** 搜索ID，首次传空 */
    search_id?: string;
}
```

### 输出参数 (Data)

解析后的数据结构如下：

```json
{
  "code": 200,
  "message": "success",
  "hit_cache": false, // 是否命中缓存
  "data": [
    {
      "account_name": "账号昵称",
      "avatar": "https://...", // 作者头像链接
      "author_link": "https://www.douyin.com/user/...", // 作者主页链接
      "publish_time": 1712345678, // 发布时间戳
      "title": "视频标题/描述",
      "original_link": "https://www.douyin.com/video/...", // 原文链接
      "desc": "完整描述内容...",
      "interaction": {
        "liked_count": 100,      // 点赞
        "comments_count": 50,    // 评论
        "collected_count": 20,   // 收藏
        "shared_count": 10       // 分享
      },
      "topics": ["话题1", "话题2"],
      "type": "video", // 或 "image_text"
      "cover": "https://...", // 封面图链接
      "video_url": "https://...", // 视频播放地址 (仅视频类型)
      "images": ["https://...", ...] // 图片列表 (仅图文类型)
    }
    // ... 更多条目
  ]
}
```

---

## 2. 小红书搜索解析

**接口路径**: `/api/xiaohongshu/search_note_v3`

### 输入参数 (Body)

参考 `ApifoxModel` 结构：

```typescript
export interface XhsSearchRequest {
    /** 关键词 */
    keyword: string;
    /** 页数，从1开始 */
    page: number;
    /** 排序: general=综合, time_descending=最新, popularity_descending=最热 */
    sort_type: "general" | "time_descending" | "popularity_descending";
    /** 笔记类型: 不限, 普通笔记, 视频笔记 */
    filter_note_type: "不限" | "普通笔记" | "视频笔记";
    /** 发布时间: 不限, 一天内, 一周内, 半年内 */
    filter_note_time: "不限" | "一天内" | "一周内" | "半年内";
    /** 搜索ID，首次可不传 */
    search_id?: string;
    /** 会话ID，首次可不传 */
    session_id?: string;
}
```

### 输出参数 (Data)

解析后的数据结构如下：

```json
{
  "code": 200,
  "message": "success",
  "hit_cache": false, // 是否命中缓存
  "data": [
    {
      "account_name": "账号昵称",
      "avatar": "https://...", // 作者头像链接
      "author_link": "https://www.xiaohongshu.com/user/profile/...", // 作者主页链接
      "publish_time": 1712345678000, // 发布时间戳 (毫秒)
      "title": "笔记标题",
      "original_link": "https://www.xiaohongshu.com/explore/...", // 原文链接
      "desc": "笔记正文内容...",
      "interaction": {
        "liked_count": 100,
        "comments_count": 50,
        "collected_count": 20,
        "shared_count": 10
      },
      "topics": ["话题1", "话题2"],
      "type": "image_text", // 或 "video"
      "cover": "https://...", // 封面图
      "images": ["https://...", ...], // 图片列表 (仅图文类型)
      "video_url": "https://..." // 视频地址 (仅视频类型)
    }
    // ... 更多条目
  ]
}
```

## 注意事项

1. **缓存机制**: 接口响应结果会缓存 1 小时。如果未搜索到数据，不会写入缓存。
2. **错误处理**: 如果上游接口返回错误或解析失败，可能会返回原始数据或错误信息。

---

## 采集助手激活码 API（CJZS）

- **地址**: `POST https://abc.no996ai.cn/api/activation_cjzs?action=activate|verify`
- **前缀**: 仅接受 `CJZS-` 开头激活码（与 FlowX 的 `XHS-` 等互斥）
- **请求体**: `{ "key": "CJZS-...", "device_id": "...", "include_permissions": true }`
- **响应**: 加密 JSON `{ "e", "i" }`，解密后与 `activation_v2` 相同盐值（`device_id + API_SALT`）
- **解密后 `data.user`**: `{ name, email, vips: string[], level: "plus"|"pro"|"ultra", isVip: boolean, isPro: boolean, isSvip: boolean }`（`isSvip` 与 `isPro` 同义，兼容旧客户端）
- **解密后 `data.user_level`**: 与 `data.user.level` 相同
- **`vips`** 来自 `permissions.ac`，缺省为全平台
- **`level`** 来自 `permissions.level`，缺省为 **`plus`**（有平台权限时）；兼容旧值 `vip`→`plus`、`svip`→`pro`
- **Plus**：平台采集 + 自定义飞书密钥（custom）
- **Pro**：Plus + RPA、异常跳过、飞书无限额、平台飞书密钥（smzs）等高级能力
- **Ultra**：预留后续新功能（当前与 Plus 相同门控，无额外能力）
- **权限 JSON 示例**（admin 生成时）:

```json
{
  "ac": ["xiaohongshu", "douyin"],
  "level": "pro"
}
```

---

## 知聊 / 知销桌面端激活 API

| 产品 | 地址 | 前缀 |
|------|------|------|
| 知聊 | `POST /api/activation_zhiliao?action=activate\|verify` | `ZHILIAO-` |
| 知销 | `POST /api/activation_zhixiao?action=activate\|verify` | `ZHIXIAO-` |

- **请求体**: `{ "key": "ZHILIAO-13800138000", "device_id": "...", "include_permissions": true }`
- **响应**: 加密 JSON `{ "e", "i" }`（盐值与 FlowX `activation_v2` 相同）
- **解密后 `data`**: `{ key, expires_at, is_used, is_licensed, is_expired, duration_days, p? }`
- **`include_permissions`**: 默认 `true`（环境变量 `ACTIVATION_DESKTOP_INCLUDE_PERMISSIONS_DEFAULT` 可关）
- **`p`**: 加密下发的功能权限对象；库中 `permissions` 为 `null` 时不返回 `p`（客户端视为全功能）
- **知聊 `p` 字段**: `ch` 聊天 · `ex` 导出 · `an` 分析 · `ar` 年度报告 · `dr` 双人报告 · `fp` 足迹 · `sn` 朋友圈 · `sop` 聊天整理 · `ai` AI 见解 · `api` 本地 HTTP API · `bk` 备份；可选 `level`: `plus` | `pro`
- **知销 `p` 字段**: `wb` 工作台 · `ct` 会话 · `pm` 发朋友圈 · `ag` 角色 · `kb` 知识库 · `mem` 记忆 · `src` 接入 · `rt` 实时建议 · `aapi` Agent API；可选 `level`: `plus` | `pro`

管理员可通过 `phone` / `phones` / `key` 创建激活码，见下方「创建激活码」。

---

## 管理端 API（React Admin `/admin/`）

**基址**: `https://abc.no996ai.cn/api/activation`  
**鉴权**: 请求头 `x-admin-auth: <ADMIN_PASSWORD>`  
**前端**: `admin-ui/`（Vite + React SPA，`npm run build:admin`）

### 登录

```
POST /api/activation?action=login
Body: { "password": "..." }
```

### 列表（支持插件筛选）

```
GET /api/activation?action=list&page=1&pageSize=10&plugin=flowx|cjzs|zhiliao|zhixiao|all
Header: x-admin-auth: ***
```

| 参数 | 说明 |
|------|------|
| `plugin=flowx` | 排除 `CJZS-` / `ZHILIAO-` / `ZHIXIAO-` 前缀 |
| `plugin=cjzs` | 仅 `CJZS-%` |
| `plugin=zhiliao` | 仅 `ZHILIAO-%` |
| `plugin=zhixiao` | 仅 `ZHIXIAO-%` |
| `plugin=all` 或省略 | 全量 |
| `key`, `device_id`, `is_used`, `duration_days` | 筛选 |
| `q` | 合并搜索激活码或设备码（`ilike` OR） |
| `sort_by` | `created_at` \| `expires_at` \| `used_at` \| `duration_days`（默认 `created_at`） |
| `sort_order` | `asc` \| `desc`（默认 `desc`） |
| `expires_within_days` | 未来 N 天内过期且已激活 |
| `expired_only=true` | 已激活且 `expires_at < now` |

### 创建激活码

随机批量：

```
POST /api/activation?action=create
Body: {
  "plugin": "zhiliao",
  "count": 5,
  "duration_days": 30
}
```

自定义完整码：

```
Body: { "plugin": "zhiliao", "key": "ZHILIAO-VIP-001", "duration_days": 365 }
```

前缀 + 手机号（单个或批量）：

```
Body: { "plugin": "zhixiao", "phone": "13800138000", "duration_days": 90 }
Body: { "plugin": "zhixiao", "phones": ["13800138000", "13900139000"], "duration_days": 90 }
```

CJZS / FlowX 示例：

```
POST /api/activation?action=create
Body: {
  "plugin": "cjzs",
  "count": 5,
  "duration_days": 30,
  "prefix": "CJZS",
  "permissions": { "ac": ["xiaohongshu"], "level": "plus" }
}
```

- `plugin=cjzs` 强制 prefix 为 `CJZS`
- `plugin=zhiliao` 强制 prefix 为 `ZHILIAO`
- `plugin=zhixiao` 强制 prefix 为 `ZHIXIAO`
- `plugin=flowx` 拒绝 `CJZS` / `ZHILIAO` / `ZHIXIAO` 前缀
- 随机批量 `count` 上限 **100**；管理端提供「一键生成 20 个」
- 知聊 / 知销 `permissions` 示例：`{ "ch": true, "ex": true, "sop": false, "level": "plus" }` 或 `{ "wb": true, "ct": true, "rt": false }`
- `permissions: null` 或未传 → 全功能开放（兼容旧码）
- 重复 `key` 返回 HTTP `409`

### 更新过期时间（精确 ISO8601）

```
POST /api/activation?action=update_expires_at
Body: {
  "id": "uuid",
  "expires_at": "2026-05-01T08:46:02.161624+00:00"
}
```

### 更新采集助手等级（仅 CJZS）

```
POST /api/activation?action=update_level
Header: x-admin-auth: ***
Body: {
  "id": "uuid",
  "level": "plus",
  "plugin": "cjzs"
}
```

- `level` 取值：`plus` | `pro` | `ultra`（兼容旧值 `vip`→`plus`、`svip`→`pro`）
- 与 `permissions.ac` 合并写入，不覆盖已选平台列表

### 其他管理 action

| action | 方法 | Body |
|--------|------|------|
| `update_permissions` | POST | `{ id, permissions, plugin? }`（CJZS：`ac`+`level`；知聊/知销：短 key boolean；`permissions: null` 清空为全开） |
| `update_level` | POST | `{ id, level, plugin: "cjzs" }` |
| `batch_delete` | POST | `{ ids: [] }` |
| `delete` | DELETE | `?id=` |

详见 [`agent.md`](agent.md)。
