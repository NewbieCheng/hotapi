import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { redis } from './cache_system.js';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const INCLUDE_PERMISSIONS_DEFAULT = String(process.env.ACTIVATION_V2_INCLUDE_PERMISSIONS_DEFAULT || '').toLowerCase() === 'true';

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase configuration missing');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// R2 存储配置
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "4b6ac3c08d5432e53db988684facac19";
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "9e092006e2af864b12f7751794b6fd3c";
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || "a3f6cb4d0f7c9c7cc10261cce232e7b40d32bcb2eb0341385c8d07d8504cd2eb";
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "no996ai";

let s3Client;
if (R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY) {
  s3Client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
} else {
  console.warn('R2 configuration missing (R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY)');
}

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

function parseBooleanFlag(value) {
  if (value === true || value === 1) return true;
  if (typeof value === 'string') {
    const raw = value.trim().toLowerCase();
    return raw === '1' || raw === 'true' || raw === 'yes';
  }
  return INCLUDE_PERMISSIONS_DEFAULT;
}

function sanitizeActivationData(row, includePermissions = false) {
  if (!row || typeof row !== 'object') return row;
  if (includePermissions) return row;
  const cloned = { ...row };
  delete cloned.permissions;
  return cloned;
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
      if (["activate", "verify", "check_update", "get_download_url"].includes(action)) {
        const isAllowed = await checkRateLimit(req);
        if (!isAllowed) {
          return res.status(429).json({ error: "请求过于频繁，请 3 分钟后再试" });
        }
      }

      // 0. 版本检测更新 (支持设备码及加密返回)
      if (action === "check_update") {
        const { device_id, version } = body;
        
        try {
          if (!s3Client) {
            throw new Error("R2 Client is not configured");
          }

          // 1. 从 R2 读取 version.json
          const getVersionCmd = new GetObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: "version.json"
          });
          
          const versionResponse = await s3Client.send(getVersionCmd);
          const versionStr = await versionResponse.Body.transformToString();
          const versionData = JSON.parse(versionStr);
          
          // 2. 构造返回给插件的数据格式 (不再预先生成下载链接，防止过期)
          const latestVersionInfo = {
            latest_version: versionData.version,
            download_url: "", // 用户点击下载时动态获取
            release_notes: Array.isArray(versionData.changelog) ? versionData.changelog.join('\n') : versionData.changelog,
            release_date: versionData.release_date || "",
            force_update: versionData.force_update || false
          };

          return res.status(200).json(encryptPayload({ 
            success: true, 
            data: latestVersionInfo 
          }, device_id));
        } catch (r2Error) {
          console.error("[Update Check] R2 Error:", r2Error);
          // 降级处理：如果没有配置或发生错误，返回兜底信息
          const fallbackVersionInfo = {
            latest_version: "0.6.6-beta",
            download_url: "",
            release_notes: "1. 优化了同步性能\n2. 修复了若干已知问题",
            release_date: "2024-01-01",
            force_update: false
          };
          return res.status(200).json(encryptPayload({ 
            success: true, 
            data: fallbackVersionInfo 
          }, device_id));
        }
      }

      // 0.5 动态获取最新的下载地址
      if (action === "get_download_url") {
        const { device_id } = body;
        try {
          if (!s3Client) throw new Error("R2 Client is not configured");

          const getVersionCmd = new GetObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: "version.json"
          });
          const versionResponse = await s3Client.send(getVersionCmd);
          const versionStr = await versionResponse.Body.transformToString();
          const versionData = JSON.parse(versionStr);

          // 动态生成预签名下载链接 (有效时间 1 小时，由于是即时点击即时生成，所以不会过期)
          const getFileCmd = new GetObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: versionData.filename || "my-new-plugin-v0.4.1.zip"
          });
          const presignedUrl = await getSignedUrl(s3Client, getFileCmd, { expiresIn: 3600 });

          return res.status(200).json(encryptPayload({
            success: true,
            data: { download_url: presignedUrl }
          }, device_id));
        } catch (r2Error) {
          console.error("[Get Download URL] R2 Error:", r2Error);
          return res.status(200).json(encryptPayload({
            success: false,
            error: "获取下载地址失败"
          }, device_id));
        }
      }

      // 1. 验证激活码 (用户端 - 无需后台鉴权)
      if (action === "verify") {
        const { key, device_id, include_permissions } = body;
        const includePermissions = parseBooleanFlag(include_permissions);
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

        return res.status(200).json(encryptPayload({
          success: true,
          data: sanitizeActivationData(data, includePermissions)
        }, device_id));
      }

      // 2. 激活 (支持设备码校验)
      if (action === "activate") {
        const { key, device_id, include_permissions } = body;
        const includePermissions = parseBooleanFlag(include_permissions);
        
        const { data: keyData, error: fetchError } = await supabase
          .from('activation_keys')
          .select('*')
          .eq('key', key)
          .single();

        if (fetchError || !keyData) return res.status(200).json(encryptPayload({ success: false, error: "激活码不存在" }, device_id));

        // 如果已激活且设备码匹配，直接返回成功
        if (keyData.is_used && keyData.device_id === device_id) {
          return res.status(200).json(encryptPayload({
            success: true,
            message: "设备已激活",
            data: sanitizeActivationData(keyData, includePermissions)
          }, device_id));
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
        return res.status(200).json(encryptPayload({
          success: true,
          message: "激活成功",
          data: sanitizeActivationData(data, includePermissions)
        }, device_id));
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
