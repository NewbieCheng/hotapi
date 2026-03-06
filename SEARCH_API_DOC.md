# 搜索中转接口文档 (统一模式)

本文档描述了由 `https://abc.no996ai.cn/` 提供的搜索结果中转接口。该接口通过统一代理入口，对 OneAPI 的原始响应进行数据提取和格式统一。

## 基础信息

- **统一入口**: `https://abc.no996ai.cn/api/proxy/`
- **调用规则**: 将原始接口路径拼接到统一入口后即可。
- **认证方式**: 在 Header 中携带 `Authorization: Bearer YOUR_TOKEN`
- **请求方法**: `POST`
- **Content-Type**: `application/json`
- **缓存机制**: 为了节省 API 费用，接口内置了 1 小时的内存缓存。
    - 相同的请求（URL + Body 一致）在 1 小时内将直接返回缓存数据。
    - 缓存响应会额外包含 `"_cached": true` 字段。

---

## 1. 小红书搜索 (Xiaohongshu)

### 接口地址
`POST https://abc.no996ai.cn/api/proxy/api/xiaohongshu/search_note_v3`

### 请求参数 (Request Body)

直接传递搜索参数，无需嵌套：

| 参数名 | 类型 | 是否必填 | 描述 |
| :--- | :--- | :--- | :--- |
| `keyword` | `string` | 是 | 搜索关键词 |
| `page` | `number` | 是 | 页数，从 1 开始 |
| `filter_note_time` | `string` | 否 | 发布时间：`一周内`, `一天内`, `不限`, `半年内` |
| `filter_note_type` | `string` | 否 | 笔记类型：`不限`, `普通笔记`, `视频笔记` |
| `sort_type` | `string` | 否 | 排序：`general`, `time_descending`, `popularity_descending`, `collect_descending`, `comment_descending` |
| `search_id` | `string` | 否 | 翻页时携带，从上次响应获取 |
| `session_id` | `string` | 否 | 翻页时携带，从上次响应获取 |

### 响应字段 (Response Data)

返回的数据格式已统一：

| 字段名 | 类型 | 描述 |
| :--- | :--- | :--- |
| `account_name` | `string` | 账号名 |
| `author_link` | `string` | 作者主页链接 |
| `publish_time` | `number` | 发布时间戳 |
| `title` | `string` | 标题 |
| `original_link` | `string` | 原文链接 |
| `desc` | `string` | 描述/正文 |
| `type` | `string` | 类型：`video` 或 `image_text` |
| `topics` | `array` | 话题列表 |
| `cover` | `string` | 封面图链接 |
| `video_url` | `string` | 视频地址 (仅 `type` 为 `video` 时) |
| `images` | `array` | 图片列表 (仅 `type` 为 `image_text` 时) |
| `interaction` | `object` | 互动数据：`liked_count`, `comments_count`, `collected_count`, `shared_count` |

---

## 2. 抖音搜索 (Douyin)

### 接口地址
`POST https://abc.no996ai.cn/api/proxy/api/douyin/search_general_v3`

### 请求参数 (Request Body)

| 参数名 | 类型 | 是否必填 | 描述 |
| :--- | :--- | :--- | :--- |
| `keyword` | `string` | 是 | 搜索关键词 |
| `cursor` | `string` | 是 | 翻页参数，首次传 "0" |
| `content_type` | `string` | 是 | 内容形式：`0` (全部), `1` (视频), `2` (图文) |
| `sort_type` | `string` | 是 | 排序：`0` (综合), `1` (最新), `2` (最热) |
| `publish_time` | `string` | 是 | 发布时间：`0` (不限), `1` (一天内), `7` (一周内), `180` (半年内) |
| `filter_duration`| `string` | 是 | 视频时长：`0` (不限), `0-1` (1分钟内), `1-5` (1-5分钟), `5-10000` (5分钟以上) |
| `backtrace` | `string` | 否 | 翻页回溯标识，从上次响应获取 |
| `search_id` | `string` | 否 | 翻页携带，从上次响应获取 logid 值 |

### 响应示例 (Response Example)

```json
{
  "code": 200,
  "message": "success",
  "data": [
    {
      "account_name": "伊朗驻华大使馆",
      "author_link": "https://www.douyin.com/user/MS4wLjABAAAA...",
      "publish_time": 1772766321,
      "title": "视频标题",
      "original_link": "https://www.douyin.com/video/7613973369473546363",
      "desc": "内容详情 #话题",
      "interaction": {
        "liked_count": 125656,
        "comments_count": 31304,
        "collected_count": 1578,
        "shared_count": 1957
      },
      "type": "video",
      "cover": "https://...",
      "video_url": "https://...",
      "topics": ["支持伊朗"]
    }
  ]
}
```
