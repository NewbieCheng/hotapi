import crypto from 'crypto';

// 在内存中维护缓存
// 注意：Vercel Serverless 环境下内存不是跨实例共享的，但对于短时间内的热点请求依然有效。
const cache = new Map();

// 默认缓存时间：1 小时 (单位：毫秒)
const DEFAULT_TTL = 60 * 60 * 1000;

/**
 * 生成缓存 Key
 * @param {string} url - 目标 URL
 * @param {Object} body - 请求体
 * @returns {string} - 哈希后的 Key
 */
export function generateCacheKey(url, body) {
    const data = JSON.stringify({ url, body });
    return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * 获取缓存内容
 * @param {string} key - 缓存 Key
 * @returns {any|null} - 缓存的数据或 null
 */
export function getCache(key) {
    const entry = cache.get(key);
    if (!entry) return null;

    // 检查是否过期
    if (Date.now() > entry.expiry) {
        cache.delete(key);
        return null;
    }

    return entry.data;
}

/**
 * 设置缓存内容
 * @param {string} key - 缓存 Key
 * @param {any} data - 要缓存的数据
 * @param {number} ttl - 过期时间（毫秒）
 */
export function setCache(key, data, ttl = DEFAULT_TTL) {
    // 限制缓存数量，防止内存泄漏
    if (cache.size > 1000) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
    }

    cache.set(key, {
        data,
        expiry: Date.now() + ttl
    });
}

/**
 * 清除所有缓存
 */
export function clearCache() {
    cache.clear();
}
