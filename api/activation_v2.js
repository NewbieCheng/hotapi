import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { redis } from './cache_system.js';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase configuration missing');
}

const supabase = createClient(supabaseUrl, supabaseKey);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Authorization,Content-Type,X-Requested-With,Accept,Origin,X-Admin-Auth",
  "Access-Control-Allow-Credentials": "true"
};

function setCors(res) {
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
}

// 简单的鉴权检查
function checkAuth(req) {
  const auth = req.headers['x-admin-auth'];
  return auth === ADMIN_PASSWORD;
}

/**
 * 频率限制校验 (Redis 版)
 */
async function checkRateLimit(req) {
  if (!redis) return true; // Redis 未连接则跳过校验
  
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const key = `ratelimit:activation_v2:${ip}`;
  
  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, 180); // 3 分钟 (180 秒)
    }
    return count <= 10;
  } catch (e) {
    console.error('[RateLimit] Error:', e);
    return true; // 出错时放行
  }
}

// 生成随机激活码
function generateRandomKey(prefix = 'XHS') {
  return `${prefix}-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

const API_SALT = "XHS_NO_996_SECURE_API_SALT_V2_888!@#";

// 加密返回的数据
function encryptPayload(data, deviceId) {
    if (!deviceId) deviceId = "default_device";
    const key = Buffer.from((deviceId + API_SALT).padEnd(32, '0').slice(0, 32));
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    
    // WebCrypto API AES-GCM appends auth tag to the end of ciphertext
    const finalBuffer = Buffer.concat([encrypted, tag]);
    return {
        e: finalBuffer.toString('base64'),
        i: iv.toString('base64')
    };
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const { action } = req.query;
  console.log(`[API V2 Request] Method: ${req.method}, Action: ${action}`);

  try {
    if (req.method === "POST") {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      // 1. 频率限制
      if (["activate", "verify"].includes(action)) {
        const isAllowed = await checkRateLimit(req);
        if (!isAllowed) {
          return res.status(429).json({ error: "请求过于频繁，请 3 分钟后再试" });
        }
      }

      // 1. 验证激活码 (用户端 - 无需后台鉴权)
      if (action === "verify") {
        const { key, device_id } = body;
        const { data, error } = await supabase
          .from('activation_keys')
          .select('*')
          .eq('key', key)
          .single();

        if (error || !data) return res.status(200).json(encryptPayload({ success: false, error: "激活码不存在" }, device_id));

        // 如果已激活，校验设备 ID
        if (data.is_used && data.device_id !== device_id) {
          return res.status(200).json(encryptPayload({ success: false, error: "激活码与当前设备不匹配" }, device_id));
        }

        return res.status(200).json(encryptPayload({ success: true, data }, device_id));
      }

      // 2. 激活 (支持设备码校验)
      if (action === "activate") {
        const { key, device_id } = body;
        
        const { data: keyData, error: fetchError } = await supabase
          .from('activation_keys')
          .select('*')
          .eq('key', key)
          .single();

        if (fetchError || !keyData) return res.status(200).json(encryptPayload({ success: false, error: "激活码不存在" }, device_id));

        // 如果已激活且设备码匹配，直接返回成功
        if (keyData.is_used && keyData.device_id === device_id) {
          return res.status(200).json(encryptPayload({ success: true, message: "设备已激活", data: keyData }, device_id));
        }

        if (keyData.is_used) {
          return res.status(200).json(encryptPayload({ success: false, error: "该激活码已被其他设备使用" }, device_id));
        }

        const used_at = new Date().toISOString();
        const expires_at = new Date(Date.now() + keyData.duration_days * 24 * 60 * 60 * 1000).toISOString();

        const { data, error } = await supabase
          .from('activation_keys')
          .update({ is_used: true, used_at, expires_at, device_id })
          .eq('key', key)
          .select()
          .single();

        if (error) return res.status(200).json(encryptPayload({ success: false, error: "激活失败", details: error.message }, device_id));
        return res.status(200).json(encryptPayload({ success: true, message: "激活成功", data }, device_id));
      }
      
      // 其他无需加密的后台接口逻辑保持原样
      // ... (其他路由如果不需要加密可以原样保留，由于 V2 是专门为了客户端调用，最好只包含 verify 和 activate)
      return res.status(400).json({ error: "Invalid action for V2 API" });
    }

    return res.status(400).json({ error: "Invalid method" });
  } catch (err) {
    return res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
}
