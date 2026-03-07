
import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

// 内存缓存对象：key -> { data, expireAt }
const memoryCache = new Map();
const CACHE_DURATION = 3600; // 1小时缓存 (秒)

let redis = null;
if (process.env.REDIS_URL) {
    try {
        redis = new Redis(process.env.REDIS_URL);
        console.log("Redis connected");
    } catch (e) {
        console.error("Redis connection failed", e);
    }
}

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
 * @returns {Promise<Object|null>}
 */
export async function getCache(key) {
    if (!key) return null;

    if (redis) {
        try {
            const data = await redis.get(key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error("Redis get error", e);
        }
    }

    // Fallback to memory cache
    const item = memoryCache.get(key);
    if (!item) return null;

    if (Date.now() > item.expireAt) {
        memoryCache.delete(key);
        return null;
    }
    return item.data;
}

/**
 * 写入缓存
 * @param {string} key 
 * @param {Object} data 
 */
export async function setCache(key, data) {
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
        if (redis) {
            try {
                await redis.set(key, JSON.stringify(data), 'EX', CACHE_DURATION);
                return;
            } catch (e) {
                console.error("Redis set error", e);
            }
        }

        // Fallback to memory cache
        memoryCache.set(key, {
            data,
            expireAt: Date.now() + (CACHE_DURATION * 1000)
        });
        
        // 简单的清理策略：如果缓存过大，清理过期项
        if (memoryCache.size > 1000) {
            for (const [k, v] of memoryCache.entries()) {
                if (Date.now() > v.expireAt) {
                    memoryCache.delete(k);
                }
            }
        }
    }
}
