import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

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

      // 1. 验证激活码 (用户端 - 无需后台鉴权)
      if (action === "verify") {
        const { key } = body;
        const { data, error } = await supabase
          .from('activation_keys')
          .select('*')
          .eq('key', key)
          .single();

        if (error || !data) return res.status(404).json({ error: "激活码不存在" });
        return res.status(200).json(data);
      }

      // 2. 激活 (用户端 - 无需后台鉴权)
      if (action === "activate") {
        const { key, device_id } = body;
        
        const { data: keyData, error: fetchError } = await supabase
          .from('activation_keys')
          .select('*')
          .eq('key', key)
          .single();

        if (fetchError || !keyData) return res.status(404).json({ error: "激活码不存在" });
        if (keyData.is_used) return res.status(400).json({ error: "该激活码已被使用" });

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
    }

    if (req.method === "GET") {
      if (!checkAuth(req)) {
        return res.status(403).json({ error: "Forbidden: 鉴权失败" });
      }

      // 4. 获取激活码列表
      if (action === "list") {
        const { data, error } = await supabase
          .from('activation_keys')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) return res.status(500).json({ error: "获取列表失败" });
        return res.status(200).json(data);
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
