# API 接口文档

本文档描述了中转站支持的特定解析接口。对于其他接口，中转站将直接转发原始响应。

## 基础信息

- **中转地址**: `https://abc.no996ai.cn/`
- **请求方式**: POST
- **通用参数**:
  - `path`: 目标接口路径 (例如 `api/douyin/search_general_v3`)
  - `method`: 请求方法 (通常为 `POST` 或 `GET`)
  - `headers`: 请求头 (必填，需包含 `Authorization` 令牌)
  - `body`: 请求体 (JSON 对象)

### 请求示例

```json
{
  "path": "api/douyin/search_general_v3",
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

**接口路径**: `api/douyin/search_general_v3`

### 输入参数 (Body)

参考 `ApifoxModel` 结构：

```typescript
export interface DouyinSearchRequest {
    /** 关键词 */
    keyword: string;
    /** 排序: 0=综合, 1=最新, 2=最热 */
    sort_type: 0 | 1 | 2;
    /** 发布时间: 0=不限, 1=一天内, 7=一周内, 180=半年内 */
    publish_time: 0 | 1 | 7 | 180;
    /** 内容形式: 0=全部, 1=视频, 2=图文 */
    content_type: 0 | 1 | 2;
    /** 视频时长: 0=不限, 1=1分钟内, 2=1-5分钟, 3=5分钟以上 */
    filter_duration: 0 | 1 | 2 | 3;
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

**接口路径**: `api/xiaohongshu/search_note_v3`

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
