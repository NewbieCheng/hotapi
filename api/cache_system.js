
// 内存缓存对象：key -> { data, expireAt }
const cache = new Map();
const CACHE_DURATION = 3600 * 1000; // 1小时缓存

/**
 * 生成缓存 Key
 * @param {string} url - 请求 URL
 * @param {Object} body - 请求参数
 * @returns {string} - 缓存 Key
 */
export function generateCacheKey(url, body) {
    try {
        // 简单序列化，确保参数顺序一致可能需要更复杂的处理，这里暂用 JSON.stringify
        return `${url}|${JSON.stringify(body)}`;
    } catch (e) {
        return null;
    }
}

/**
 * 获取缓存数据
 * @param {string} key 
 * @returns {Object|null}
 */
export function getCache(key) {
    if (!key) return null;
    const item = cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expireAt) {
        cache.delete(key);
        return null;
    }
    return item.data;
}

/**
 * 写入缓存
 * @param {string} key 
 * @param {Object} data 
 */
export function setCache(key, data) {
    if (!key || !data) return;
    
    // 简单判断数据有效性：必须有 data 字段且不为空（针对 OneAPI 结构）
    // 小红书/抖音解析后的结构通常是 { code: 200, data: [...] }
    let isValid = false;
    
    if (data.data && Array.isArray(data.data) && data.data.length > 0) {
        isValid = true;
    } else if (data.data && data.data.data && Array.isArray(data.data.data) && data.data.data.length > 0) {
        // 针对原始 OneAPI 嵌套结构
        isValid = true;
    }

    if (isValid) {
        cache.set(key, {
            data,
            expireAt: Date.now() + CACHE_DURATION
        });
        
        // 简单的清理策略：如果缓存过大，清理过期项
        if (cache.size > 1000) {
            for (const [k, v] of cache.entries()) {
                if (Date.now() > v.expireAt) {
                    cache.delete(k);
                }
            }
        }
    }
}
