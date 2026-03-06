/**
 * 小红书搜索结果解析函数
 * @param {Object} data - 原始接口返回的 JSON 数据
 * @returns {Object} - 提取后的统一格式数据或原始数据
 */
function extractXhsData(data) {
  // 检查 OneAPI 或小红书响应中常见的嵌套结构
  let items = [];
  if (data?.data?.data?.items) {
      items = data.data.data.items;
  } else if (data?.data?.items) {
      items = data.data.items;
  } else {
      // 如果不匹配预期结构，直接返回原始数据
      return data;
  }

  const extractedItems = items
    .filter(item => item.model_type === 'note') // 仅处理笔记类型的条目
    .map(item => {
      const note = item.note;
      if (!note) return null;

      // 提取通用字段
      const common = {
        account_name: note.user?.nickname, // 账号名
        author_link: `https://www.xiaohongshu.com/user/profile/${note.user?.userid}`, // 作者主页
        publish_time: note.timestamp,      // 发布时间
        title: note.title || '',           // 标题
        original_link: `https://www.xiaohongshu.com/explore/${note.id}`, // 原文链接
        desc: note.desc,                   // 描述正文
        interaction: {
            liked_count: note.liked_count,       // 点赞数
            comments_count: note.comments_count, // 评论数
            collected_count: note.collected_count, // 收藏数
            shared_count: note.shared_count      // 分享数
        }
      };
      
      // 从描述中提取话题（以#开头的标签）
      const topics = (note.desc?.match(/#[^\s#]+/g) || []).map(t => t.slice(1));

      // 根据类型区分视频和图文
      if (note.type === 'video') {
        return {
          ...common,
          type: 'video',
          cover: note.video_info_v2?.image?.thumbnail, // 视频封面
          video_url: note.video_info_v2?.media?.stream?.h264?.[0]?.master_url, // 视频地址
          topics: topics
        };
      } else {
        // 图文类 (Normal/Image_Text)
        const images = (note.images_list || []).map(img => img.url_size_large || img.url); // 所有正文图片
        return {
          ...common,
          type: 'image_text',
          cover: images[0], // 封面图（取第一张）
          images: images,
          topics: topics
        };
      }
    })
    .filter(Boolean); // 过滤掉无效数据

  return { 
      code: 200,
      message: "success",
      data: extractedItems 
  };
}

/**
 * 抖音搜索结果解析函数
 * @param {Object} data - 原始接口返回的 JSON 数据
 * @returns {Object} - 提取后的统一格式数据或原始数据
 */
function extractDyData(data) {
  let items = [];
  // 抖音返回的数据通常在 data.data 数组中
  if (data?.data?.data) {
      items = data.data.data;
  } else {
      return data;
  }

  const extractedItems = items
    .filter(item => item.aweme_info) // 确保包含 aweme_info 核心数据
    .map(item => {
      const note = item.aweme_info;
      
      // 提取通用字段
      const common = {
        account_name: note.author?.nickname, // 账号名
        author_link: `https://www.douyin.com/user/${note.author?.sec_uid}`, // 作者主页
        publish_time: note.create_time,      // 发布时间
        title: note.desc || '',              // 标题（抖音通常使用描述作为标题）
        original_link: `https://www.douyin.com/video/${note.aweme_id}`, // 原文链接
        desc: note.desc,                     // 描述
        interaction: {
            liked_count: note.statistics?.digg_count || 0,     // 点赞数
            comments_count: note.statistics?.comment_count || 0, // 评论数
            collected_count: note.statistics?.collect_count || 0, // 收藏数
            shared_count: note.statistics?.share_count || 0    // 分享数
        }
      };
      
      // 提取话题
      const topics = (note.desc?.match(/#[^\s#]+/g) || []).map(t => t.slice(1));

      // 抖音图文判断：如果包含 images 数组且不为空
      if (note.images && note.images.length > 0) {
         const images = note.images.map(img => img.url_list?.[0]).filter(Boolean);
         return {
           ...common,
           type: 'image_text',
           cover: images[0],
           images: images,
           topics: topics
         };
      } else {
         // 默认为视频类型
         return {
           ...common,
           type: 'video',
           cover: note.video?.cover?.url_list?.[0], // 视频封面
           video_url: note.video?.play_addr?.url_list?.[0], // 视频播放地址
           topics: topics
         };
      }
    })
    .filter(Boolean);

  return { 
      code: 200,
      message: "success",
      data: extractedItems 
  };
}

/**
 * 解析策略映射表
 * 只有定义在这里的接口路径才会被执行解析逻辑
 */
const strategies = {
    'api/xiaohongshu/search_note_v3': extractXhsData, // 小红书搜索
    'api/douyin/search_general_v3': extractDyData      // 抖音搜索
};

/**
 * 执行数据提取
 * @param {string} url - 请求的目标 URL
 * @param {Object} data - 接口返回的 JSON 对象
 * @returns {Object} - 解析后的数据或原始数据
 */
export function extractData(url, data) {
    for (const [key, extractor] of Object.entries(strategies)) {
        // 如果 URL 包含策略中的关键字，则调用对应的解析器
        if (url.includes(key)) {
            return extractor(data);
        }
    }
    // 如果没有匹配的策略，返回原始数据
    return data;
}

/**
 * 判断当前 URL 是否需要拦截解析
 * @param {string} url - 请求的目标 URL
 * @returns {boolean} - 是否需要拦截
 */
export function shouldIntercept(url) {
    for (const key of Object.keys(strategies)) {
        if (url.includes(key)) {
            return true;
        }
    }
    return false;
}
