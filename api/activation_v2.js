import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { redis } from './cache_system.js';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ENCRYPTION_SALT = process.env.ENCRYPTION_SALT || 'flowx_secure_salt_2024';

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

/**
 * 加密响应数据
 * 使用设备码 + SALT 生成动态密钥
 */
function encryptPayload(data, deviceId) {
  try {
    // 1. 生成 32 字节密钥 (AES-256)
    const key = crypto.createHash('sha256').update(deviceId + ENCRYPTION_SALT).digest();
    // 2. 生成随机 16 字节 IV
    const iv = crypto.randomBytes(16);
    // 3. 创建加密器
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // 4. 返回 IV + 密文的组合
    return {
      d: iv.toString('hex') + encrypted,
      v: '2.0',
      t: Date.now()
    };
  } catch (e) {
    console.error('[Encryption] Error:', e);
    return { error: "Encryption failed" };
  }
}

function checkAuth(req) {
  const auth = req.headers['x-admin-auth'];
  return auth === ADMIN_PASSWORD;
}

async function checkRateLimit(req) {
  if (!redis) return true;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const key = `ratelimit:activation_v2:${ip}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, 180);
    }
    return count <= 15; // v2 稍微放宽一点点
  } catch (e) {
    return true;
  }
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const { action } = req.query;

  try {
    if (req.method === "POST") {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      if (["activate", "verify"].includes(action)) {
        const isAllowed = await checkRateLimit(req);
        if (!isAllowed) {
          return res.status(429).json({ error: "请求过于频繁" });
        }
      }

      // 1. 验证激活码 (加密返回)
      if (action === "verify") {
        const { key, device_id } = body;
        if (!device_id) return res.status(400).json({ error: "缺少设备标识" });

        const { data, error } = await supabase
          .from('activation_keys')
          .select('*')
          .eq('key', key)
          .single();

        if (error || !data) return res.status(404).json({ error: "激活码不存在" });

        if (data.is_used && data.device_id !== device_id) {
          return res.status(403).json({ error: "激活码与当前设备不匹配" });
        }

        // 返回加密数据
        return res.status(200).json(encryptPayload(data, device_id));
      }

      // 2. 激活 (加密返回)
      if (action === "activate") {
        const { key, device_id } = body;
        if (!device_id) return res.status(400).json({ error: "缺少设备标识" });
        
        const { data: keyData, error: fetchError } = await supabase
          .from('activation_keys')
          .select('*')
          .eq('key', key)
          .single();

        if (fetchError || !keyData) return res.status(404).json({ error: "激活码不存在" });

        if (keyData.is_used && keyData.device_id === device_id) {
          return res.status(200).json(encryptPayload(keyData, device_id));
        }

        if (keyData.is_used) {
          return res.status(400).json({ error: "该激活码已被其他设备使用" });
        }

        const used_at = new Date().toISOString();
        const expires_at = new Date(Date.now() + keyData.duration_days * 24 * 60 * 60 * 1000).toISOString();

        const { data, error } = await supabase
          .from('activation_keys')
          .update({ is_used: true, used_at, expires_at, device_id })
          .eq('key', key)
          .select()
          .single();

        if (error) return res.status(500).json({ error: "激活失败" });
        return res.status(200).json(encryptPayload(data, device_id));
      }

      // 管理员接口保持原样 (通常管理员在内网或特定环境，且不需要对设备码加密)
      if (!checkAuth(req)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      // ... 其他管理员 action (create, batch_delete) 可以按需实现，这里略过以保持简洁
      // 如果需要可以从 activation.js 拷贝
    }

    return res.status(400).json({ error: "Invalid action" });
  } catch (err) {
    return res.status(500).json({ error: "Server Error" });
  }
}
