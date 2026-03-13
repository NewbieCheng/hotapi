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
 * 限制每个 IP 每 3 分钟最多 10 次激活/验证请求
 */
async function checkRateLimit(req) {
  if (!redis) return true; // Redis 未连接则跳过校验
  
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const key = `ratelimit:activation:${ip}`;
  
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

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const { action } = req.query;
  console.log(`[API Request] Method: ${req.method}, Action: ${action}`);

  try {
    // 登录校验逻辑
    if (req.method === "POST" && action === "login") {
      const { password } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (password === ADMIN_PASSWORD) {
        return res.status(200).json({ success: true });
      } else {
        return res.status(401).json({ error: "密码错误" });
      }
    }

    if (req.method === "POST") {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      // 1. 频率限制 (仅针对激活和验证接口)
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

        if (error || !data) return res.status(404).json({ error: "激活码不存在" });

        // 如果已激活，校验设备 ID
        if (data.is_used && data.device_id !== device_id) {
          return res.status(403).json({ error: "激活码与当前设备不匹配" });
        }

        return res.status(200).json(data);
      }

      // 2. 激活 (支持设备码校验：如果已使用且设备码匹配，直接返回成功)
      if (action === "activate") {
        const { key, device_id } = body;
        
        const { data: keyData, error: fetchError } = await supabase
          .from('activation_keys')
          .select('*')
          .eq('key', key)
          .single();

        if (fetchError || !keyData) return res.status(404).json({ error: "激活码不存在" });

        // 如果已激活且设备码匹配，直接返回成功（实现重新获取状态）
        if (keyData.is_used && keyData.device_id === device_id) {
          return res.status(200).json({ message: "设备已激活", data: keyData });
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

        if (error) return res.status(500).json({ error: "激活失败", details: error.message });
        return res.status(200).json({ message: "激活成功", data });
      }

      // --- 以下操作需要后台鉴权 ---
      if (!checkAuth(req)) {
        return res.status(403).json({ error: "Forbidden: 鉴权失败" });
      }

      // 3. 创建激活码 (支持随机生成和批量)
      if (action === "create") {
        const { key, duration_days, count = 1, prefix = 'XHS' } = body;
        const keysToInsert = [];

        if (key) {
          // 指定生成单个
          keysToInsert.push({ key, duration_days, is_used: false });
        } else {
          // 随机批量生成
          for (let i = 0; i < count; i++) {
            keysToInsert.push({ key: generateRandomKey(prefix), duration_days, is_used: false });
          }
        }

        const { data, error } = await supabase
          .from('activation_keys')
          .insert(keysToInsert)
          .select();

        if (error) return res.status(500).json({ error: "创建失败", details: error.message });
        return res.status(201).json(data);
      }

      // 5. 批量删除
      if (action === "batch_delete") {
        const { ids } = body;
        if (!Array.isArray(ids) || ids.length === 0) {
          return res.status(400).json({ error: "请提供要删除的ID列表" });
        }

        const { error } = await supabase
          .from('activation_keys')
          .delete()
          .in('id', ids);

        if (error) return res.status(500).json({ error: "批量删除失败", details: error.message });
        return res.status(200).json({ message: `成功删除 ${ids.length} 条记录` });
      }
    }

    if (req.method === "GET") {
      if (!checkAuth(req)) {
        return res.status(403).json({ error: "Forbidden: 鉴权失败" });
      }

      // 4. 获取激活码列表 (支持分页、筛选、排序)
      if (action === "list") {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 5;
        const device_id = req.query.device_id;
        const key = req.query.key;
        const duration_days = req.query.duration_days;
        const is_used = req.query.is_used;

        let query = supabase
          .from('activation_keys')
          .select('*', { count: 'exact' });

        // 筛选条件
        if (device_id) query = query.ilike('device_id', `%${device_id}%`);
        if (key) query = query.ilike('key', `%${key}%`);
        if (duration_days) query = query.eq('duration_days', duration_days);
        if (is_used !== undefined && is_used !== '') query = query.eq('is_used', is_used === 'true');

        // 分页和排序
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        
        // 并行执行所有查询，显著减少响应时间
        const [mainResult, usedResult, unusedResult] = await Promise.all([
          query
            .order('created_at', { ascending: false })
            .range(from, to),
          supabase
            .from('activation_keys')
            .select('*', { count: 'exact', head: true })
            .eq('is_used', true),
          supabase
            .from('activation_keys')
            .select('*', { count: 'exact', head: true })
            .eq('is_used', false)
        ]);

        if (mainResult.error) return res.status(500).json({ error: "获取列表失败", details: mainResult.error.message });

        return res.status(200).json({ 
          data: mainResult.data, 
          total: mainResult.count, 
          used: usedResult.count || 0,
          unused: unusedResult.count || 0,
          page, 
          pageSize 
        });
      }
    }


    if (req.method === "DELETE") {
      if (!checkAuth(req)) {
        return res.status(403).json({ error: "Forbidden: 鉴权失败" });
      }

      const { id } = req.query;
      const { error } = await supabase
        .from('activation_keys')
        .delete()
        .eq('id', id);

      if (error) return res.status(500).json({ error: "删除失败" });
      return res.status(200).json({ message: "删除成功" });
    }

    return res.status(400).json({ error: "Invalid action or method" });
  } catch (err) {
    return res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
}
