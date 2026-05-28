import crypto from 'crypto';
import { redis } from './cache_system.js';

export const API_SALT = 'XHS_NO_996_SECURE_API_SALT_V2_888!@#';
export const CJZS_PREFIX = 'CJZS-';

export const DEFAULT_CJZS_VIPS = [
  'xiaohongshu',
  'douyin',
  'bilibili',
  'kuaishou',
  'tiktok',
  'xingtu',
  'pgy.xiaohongshu'
];

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers':
    'Authorization,Content-Type,X-Requested-With,Accept,Origin,X-Admin-Auth',
  'Access-Control-Allow-Credentials': 'true'
};

export function setCors(res) {
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
}

export function encryptPayload(data, deviceId) {
  if (!deviceId) deviceId = 'default_device';
  const key = Buffer.from((deviceId + API_SALT).padEnd(32, '0').slice(0, 32));
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const finalBuffer = Buffer.concat([encrypted, tag]);
  return {
    e: finalBuffer.toString('base64'),
    i: iv.toString('base64')
  };
}

export async function checkRateLimit(req, namespace) {
  if (!redis) return true;
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const key = `ratelimit:${namespace}:${ip}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 180);
    return count <= 10;
  } catch (e) {
    console.error('[RateLimit] Error:', e);
    return true;
  }
}

export function parseBooleanFlag(value, defaultValue = false) {
  if (value === true || value === 1) return true;
  if (typeof value === 'string') {
    const raw = value.trim().toLowerCase();
    return raw === '1' || raw === 'true' || raw === 'yes';
  }
  return defaultValue;
}

export function sanitizeActivationData(row, includePermissions = false) {
  if (!row || typeof row !== 'object') return row;
  const cloned = { ...row };
  const rawPerm = cloned.permissions;
  delete cloned.permissions;
  if (includePermissions && rawPerm && typeof rawPerm === 'object' && !Array.isArray(rawPerm)) {
    const p = {
      ...(Array.isArray(rawPerm.ac) ? { ac: rawPerm.ac.filter((v) => typeof v === 'string') } : {}),
      ai: typeof rawPerm.ai === 'boolean' ? rawPerm.ai : true,
      cp: typeof rawPerm.cp === 'boolean' ? rawPerm.cp : true,
      co: typeof rawPerm.co === 'boolean' ? rawPerm.co : true,
      sy: typeof rawPerm.sy === 'boolean' ? rawPerm.sy : true,
      ed: typeof rawPerm.ed === 'boolean' ? rawPerm.ed : true,
      hr: typeof rawPerm.hr === 'boolean' ? rawPerm.hr : true,
      bk: typeof rawPerm.bk === 'boolean' ? rawPerm.bk : true,
      pl: typeof rawPerm.pl === 'boolean' ? rawPerm.pl : true,
      fw: typeof rawPerm.fw === 'boolean' ? rawPerm.fw : true
    };
    cloned.p = p;
  } else {
    delete cloned.p;
  }
  return cloned;
}

export function assertCjzsKey(key) {
  if (!key || !String(key).toUpperCase().startsWith(CJZS_PREFIX)) {
    return { ok: false, error: '该激活码不适用于采集助手' };
  }
  return { ok: true };
}

export function assertNotCjzsKey(key) {
  if (key && String(key).toUpperCase().startsWith(CJZS_PREFIX)) {
    return { ok: false, error: '该激活码不适用于 FlowX 插件' };
  }
  return { ok: true };
}

export function buildCjzsUser(row, includePermissions = true) {
  const expired = !row?.expires_at || new Date(row.expires_at).getTime() < Date.now();
  const rawPerm = row?.permissions;
  const acFromP = row?.p?.ac;
  const acFromPerm = rawPerm?.ac;
  let vips = DEFAULT_CJZS_VIPS;
  if (includePermissions) {
    if (Array.isArray(acFromP) && acFromP.length) vips = acFromP;
    else if (Array.isArray(acFromPerm) && acFromPerm.length) vips = acFromPerm;
  }
  if (expired) vips = [];
  return {
    name: row?.user_name || row?.note || '已激活用户',
    email: row?.user_email || row?.key || '',
    vips,
    isVip: !expired && vips.length > 0
  };
}

export function sanitizeCjzsActivationData(row, includePermissions = false) {
  const base = sanitizeActivationData(row, includePermissions);
  if (!base) return base;
  base.user = buildCjzsUser({ ...row, p: base.p }, includePermissions);
  return base;
}
