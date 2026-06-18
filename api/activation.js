import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { redis } from './cache_system.js';
import {
  CJZS_PREFIX,
  ZHILIAO_PREFIX,
  ZHIXIAO_PREFIX,
  assertCjzsKey,
  assertFlowxKey,
  assertZhiliaoKey,
  assertZhixiaoKey,
  buildPhoneActivationKey,
  normalizeCjzsLevel,
  normalizeZhiliaoPermissions,
  normalizeZhixiaoPermissions
} from './_activation_core.js';

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

function normalizePermissions(input) {
  if (!input) return null;
  const toRecord = (value) => {
    if (!value) return null;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : null;
      } catch {
        return null;
      }
    }
    if (typeof value === 'object' && !Array.isArray(value)) return value;
    return null;
  };
  const raw = toRecord(input);
  if (!raw) return null;
  const toBool = (v, fallback = true) => (typeof v === 'boolean' ? v : fallback);
  const channels = Array.isArray(raw.ac)
    ? raw.ac.filter((v) => typeof v === 'string')
    : (Array.isArray(raw.allowedChannels) ? raw.allowedChannels.filter((v) => typeof v === 'string') : undefined);
  return {
    ...(channels !== undefined ? { ac: channels } : {}),
    ai: toBool(raw.ai ?? raw.aiEnabled, true),
    cp: toBool(raw.cp ?? raw.captureEnabled, true),
    co: toBool(raw.co ?? raw.collectorEnabled, true),
    sy: toBool(raw.sy ?? raw.syncEnabled, true),
    ed: toBool(raw.ed ?? raw.editorEnabled, true),
    hr: toBool(raw.hr ?? raw.hotRankEnabled, true),
    bk: toBool(raw.bk ?? raw.backupEnabled, true),
    pl: toBool(raw.pl ?? raw.promptLibraryEnabled, true),
    fw: toBool(raw.fw ?? raw.floatingWidgetEnabled, true)
  };
}

function normalizeCjzsPermissions(input) {
  if (!input) return null;
  let raw = input;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input);
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const payload = raw.p && typeof raw.p === 'object' ? { ...raw.p, ...raw } : raw;
  const ac = Array.isArray(payload.ac)
    ? payload.ac.filter((v) => typeof v === 'string')
    : Array.isArray(payload.allowedChannels)
      ? payload.allowedChannels.filter((v) => typeof v === 'string')
      : [];
  const level = normalizeCjzsLevel(payload.level);
  return { ac, level };
}

function normalizePluginPermissions(plugin, permissions) {
  if (plugin === 'cjzs') return normalizeCjzsPermissions(permissions);
  if (plugin === 'flowx') return normalizePermissions(permissions);
  if (plugin === 'zhiliao') return normalizeZhiliaoPermissions(permissions);
  if (plugin === 'zhixiao') return normalizeZhixiaoPermissions(permissions);
  return null;
}

const MAX_BATCH_COUNT = 100;

function applyPluginFilter(query, plugin) {
  if (plugin === 'cjzs') return query.ilike('key', `${CJZS_PREFIX}%`);
  if (plugin === 'zhiliao') return query.ilike('key', `${ZHILIAO_PREFIX}%`);
  if (plugin === 'zhixiao') return query.ilike('key', `${ZHIXIAO_PREFIX}%`);
  if (plugin === 'flowx') {
    return query
      .not('key', 'ilike', `${CJZS_PREFIX}%`)
      .not('key', 'ilike', `${ZHILIAO_PREFIX}%`)
      .not('key', 'ilike', `${ZHIXIAO_PREFIX}%`);
  }
  return query;
}

function applyListFilters(query, { device_id, key, duration_days, is_used, q, expires_within_days, expired_only }) {
  if (q) {
    const term = String(q).trim();
    if (term) query = query.or(`key.ilike.%${term}%,device_id.ilike.%${term}%`);
  } else {
    if (device_id) query = query.ilike('device_id', `%${device_id}%`);
    if (key) query = query.ilike('key', `%${key}%`);
  }
  if (duration_days) query = query.eq('duration_days', duration_days);
  if (is_used !== undefined && is_used !== '') query = query.eq('is_used', is_used === 'true');
  if (expires_within_days) {
    const days = parseInt(expires_within_days, 10);
    if (days > 0) {
      const now = new Date().toISOString();
      const future = new Date(Date.now() + days * 86400000).toISOString();
      query = query.eq('is_used', true).gte('expires_at', now).lte('expires_at', future);
    }
  }
  if (expired_only === 'true' || expired_only === true) {
    query = query.eq('is_used', true).lt('expires_at', new Date().toISOString());
  }
  return query;
}

function applyListSort(query, sort_by, sort_order) {
  const allowed = ['created_at', 'expires_at', 'used_at', 'duration_days'];
  const column = allowed.includes(sort_by) ? sort_by : 'created_at';
  const ascending = sort_order === 'asc';
  return query.order(column, { ascending, nullsFirst: false });
}

function resolveCreatePrefix(plugin, prefix) {
  if (plugin === 'cjzs') return { prefix: 'CJZS' };
  if (plugin === 'zhiliao') return { prefix: 'ZHILIAO' };
  if (plugin === 'zhixiao') return { prefix: 'ZHIXIAO' };
  const resolved = String(prefix || 'XHS').trim().toUpperCase();
  if (resolved.startsWith('CJZS')) {
    return { error: 'FlowX 插件不能使用 CJZS 前缀' };
  }
  if (resolved.startsWith('ZHILIAO')) {
    return { error: 'FlowX 插件不能使用 ZHILIAO 前缀' };
  }
  if (resolved.startsWith('ZHIXIAO')) {
    return { error: 'FlowX 插件不能使用 ZHIXIAO 前缀' };
  }
  return { prefix: resolved };
}

function assertPluginKey(plugin, key) {
  if (plugin === 'cjzs') return assertCjzsKey(key);
  if (plugin === 'zhiliao') return assertZhiliaoKey(key);
  if (plugin === 'zhixiao') return assertZhixiaoKey(key);
  return assertFlowxKey(key);
}

async function findExistingKeys(keys) {
  const unique = [...new Set(keys.filter(Boolean))];
  if (!unique.length) return [];
  const { data, error } = await supabase.from('activation_keys').select('key').in('key', unique);
  if (error) throw error;
  return (data || []).map((row) => row.key);
}

function collectKeysToInsert(body, resolvedPrefix, plugin) {
  const { key, count = 1, phone, phones } = body;
  const keysToInsert = [];
  const pushKey = (rawKey) => {
    const normalizedKey = String(rawKey).trim().toUpperCase();
    const keyCheck = assertPluginKey(plugin, normalizedKey);
    if (!keyCheck.ok) {
      throw new Error(keyCheck.error);
    }
    keysToInsert.push({
      key: normalizedKey,
      duration_days: body.duration_days,
      is_used: false,
      permissions: body.normalizedPermissions ?? null
    });
  };

  if (key) {
    pushKey(key);
    return keysToInsert;
  }

  if (phone) {
    const built = buildPhoneActivationKey(resolvedPrefix, phone);
    if (!built.ok) throw new Error(built.error);
    pushKey(built.value);
    return keysToInsert;
  }

  if (Array.isArray(phones) && phones.length) {
    for (const item of phones) {
      const built = buildPhoneActivationKey(resolvedPrefix, item);
      if (!built.ok) throw new Error(built.error);
      pushKey(built.value);
    }
    return keysToInsert;
  }

  for (let i = 0; i < Math.min(Math.max(1, Number(count) || 1), MAX_BATCH_COUNT); i++) {
    keysToInsert.push({
      key: generateRandomKey(resolvedPrefix),
      duration_days: body.duration_days,
      is_used: false,
      permissions: body.normalizedPermissions ?? null
    });
  }
  return keysToInsert;
}

function validateExpiresAt(expires_at) {
  if (typeof expires_at !== 'string' || !expires_at.trim()) {
    return { ok: false, error: 'expires_at 必须是 ISO8601 字符串' };
  }
  const trimmed = expires_at.trim();
  const ts = new Date(trimmed).getTime();
  if (Number.isNaN(ts)) {
    return { ok: false, error: 'expires_at 无法解析为合法时间' };
  }
  return { ok: true, value: trimmed };
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
        const { key, duration_days, count = 1, prefix = 'XHS', permissions, plugin, phone, phones } = body;
        const prefixResult = resolveCreatePrefix(plugin, prefix);
        if (prefixResult.error) {
          return res.status(400).json({ error: prefixResult.error });
        }
        const resolvedPrefix = prefixResult.prefix;
        const normalizedPermissions = normalizePluginPermissions(plugin, permissions);

        let keysToInsert = [];
        try {
          keysToInsert = collectKeysToInsert(
            { key, count, phone, phones, duration_days, normalizedPermissions },
            resolvedPrefix,
            plugin
          );
        } catch (err) {
          return res.status(400).json({ error: err.message || '创建参数无效' });
        }

        const existing = await findExistingKeys(keysToInsert.map((item) => item.key));
        if (existing.length) {
          return res.status(409).json({
            error: '部分激活码已存在',
            duplicates: existing
          });
        }

        const { data, error } = await supabase
          .from('activation_keys')
          .insert(keysToInsert)
          .select();

        if (error) return res.status(500).json({ error: "创建失败", details: error.message });
        return res.status(201).json(data);
      }

      if (action === "update_expires_at") {
        const { id, expires_at } = body;
        if (!id) return res.status(400).json({ error: "缺少 id" });
        const validation = validateExpiresAt(expires_at);
        if (!validation.ok) return res.status(400).json({ error: validation.error });
        const { data, error } = await supabase
          .from('activation_keys')
          .update({ expires_at: validation.value })
          .eq('id', id)
          .select()
          .single();
        if (error) return res.status(500).json({ error: "更新过期时间失败", details: error.message });
        return res.status(200).json({ message: "过期时间更新成功", data });
      }

      if (action === "update_permissions") {
        const { id, permissions, plugin } = body;
        if (!id) return res.status(400).json({ error: "缺少 id" });
        let normalizedPermissions = null;
        if (permissions !== null && permissions !== undefined && permissions !== '') {
          normalizedPermissions = normalizePluginPermissions(plugin, permissions);
          if (!normalizedPermissions) {
            return res.status(400).json({ error: "permissions 必须是合法 JSON 对象" });
          }
        }
        const { data, error } = await supabase
          .from('activation_keys')
          .update({ permissions: normalizedPermissions })
          .eq('id', id)
          .select()
          .single();
        if (error) return res.status(500).json({ error: "更新权限失败", details: error.message });
        return res.status(200).json({ message: "权限更新成功", data });
      }

      if (action === "update_level") {
        const { id, level, plugin } = body;
        if (plugin !== 'cjzs') {
          return res.status(400).json({ error: "仅采集助手（CJZS）激活码支持等级字段" });
        }
        if (!id) return res.status(400).json({ error: "缺少 id" });
        const { data: existing, error: fetchError } = await supabase
          .from('activation_keys')
          .select('id, key, permissions')
          .eq('id', id)
          .single();
        if (fetchError || !existing) {
          return res.status(404).json({ error: "激活码不存在" });
        }
        const keyCheck = assertCjzsKey(existing.key);
        if (!keyCheck.ok) return res.status(400).json({ error: keyCheck.error });
        const merged = normalizeCjzsPermissions({
          ...(existing.permissions && typeof existing.permissions === 'object' ? existing.permissions : {}),
          level
        });
        if (!merged) {
          return res.status(400).json({ error: "等级无效" });
        }
        const { data, error } = await supabase
          .from('activation_keys')
          .update({ permissions: merged })
          .eq('id', id)
          .select()
          .single();
        if (error) return res.status(500).json({ error: "更新等级失败", details: error.message });
        return res.status(200).json({ message: "等级更新成功", data });
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
        const q = req.query.q;
        const duration_days = req.query.duration_days;
        const is_used = req.query.is_used;
        const sort_by = req.query.sort_by;
        const sort_order = req.query.sort_order;
        const expires_within_days = req.query.expires_within_days;
        const expired_only = req.query.expired_only;
        const plugin = req.query.plugin || 'all';
        const filterParams = { device_id, key, duration_days, is_used, q, expires_within_days, expired_only };

        let query = supabase.from('activation_keys').select('*', { count: 'exact' });
        query = applyPluginFilter(query, plugin);
        query = applyListFilters(query, filterParams);
        query = applyListSort(query, sort_by, sort_order);

        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let usedQuery = supabase.from('activation_keys').select('*', { count: 'exact', head: true }).eq('is_used', true);
        let unusedQuery = supabase.from('activation_keys').select('*', { count: 'exact', head: true }).eq('is_used', false);
        usedQuery = applyPluginFilter(usedQuery, plugin);
        unusedQuery = applyPluginFilter(unusedQuery, plugin);
        usedQuery = applyListFilters(usedQuery, filterParams);
        unusedQuery = applyListFilters(unusedQuery, filterParams);

        const [mainResult, usedResult, unusedResult] = await Promise.all([
          query.range(from, to),
          usedQuery,
          unusedQuery
        ]);

        if (mainResult.error) return res.status(500).json({ error: "获取列表失败", details: mainResult.error.message });

        return res.status(200).json({
          data: mainResult.data,
          total: mainResult.count,
          used: usedResult.count || 0,
          unused: unusedResult.count || 0,
          page,
          pageSize,
          plugin
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
