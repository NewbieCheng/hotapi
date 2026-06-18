import crypto from 'crypto';
import { redis } from './cache_system.js';

export const API_SALT = 'XHS_NO_996_SECURE_API_SALT_V2_888!@#';
export const CJZS_PREFIX = 'CJZS-';
export const ZHILIAO_PREFIX = 'ZHILIAO-';
export const ZHIXIAO_PREFIX = 'ZHIXIAO-';

export const DESKTOP_PREFIXES = [ZHILIAO_PREFIX, ZHIXIAO_PREFIX];

export const ZHILIAO_PERMISSION_KEYS = ['ch', 'ex', 'an', 'ar', 'dr', 'fp', 'sn', 'sop', 'ai', 'api', 'bk'];
export const ZHIXIAO_PERMISSION_KEYS = ['wb', 'ct', 'pm', 'ag', 'kb', 'mem', 'src', 'rt', 'aapi'];

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
      ...(rawPerm.level != null && rawPerm.level !== '' ? { level: String(rawPerm.level) } : {}),
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
  return assertFlowxKey(key);
}

export function isDesktopActivationKey(key) {
  const upper = String(key || '').toUpperCase();
  return DESKTOP_PREFIXES.some((prefix) => upper.startsWith(prefix));
}

export function assertZhiliaoKey(key) {
  if (!key || !String(key).toUpperCase().startsWith(ZHILIAO_PREFIX)) {
    return { ok: false, error: '该激活码不适用于知聊' };
  }
  return { ok: true };
}

export function assertZhixiaoKey(key) {
  if (!key || !String(key).toUpperCase().startsWith(ZHIXIAO_PREFIX)) {
    return { ok: false, error: '该激活码不适用于知销' };
  }
  return { ok: true };
}

export function assertFlowxKey(key) {
  const upper = String(key || '').toUpperCase();
  if (upper.startsWith(CJZS_PREFIX)) {
    return { ok: false, error: '该激活码不适用于 FlowX 插件' };
  }
  if (DESKTOP_PREFIXES.some((prefix) => upper.startsWith(prefix))) {
    return { ok: false, error: '该激活码不适用于 FlowX 插件' };
  }
  return { ok: true };
}

export function normalizeChinaMobile(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (!/^1[3-9]\d{9}$/.test(digits)) {
    return { ok: false, error: '手机号格式无效，需为 11 位中国大陆手机号' };
  }
  return { ok: true, value: digits };
}

export function buildPhoneActivationKey(prefix, phone) {
  const mobile = normalizeChinaMobile(phone);
  if (!mobile.ok) return mobile;
  const resolvedPrefix = String(prefix || '').trim().toUpperCase();
  if (!resolvedPrefix) {
    return { ok: false, error: '前缀不能为空' };
  }
  return { ok: true, value: `${resolvedPrefix}-${mobile.value}` };
}

function parsePermissionsInput(input) {
  if (!input) return null;
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  if (typeof input === 'object' && !Array.isArray(input)) return input;
  return null;
}

function toPermissionBool(value, fallback = true) {
  if (typeof value === 'boolean') return value;
  if (value === 0 || value === '0' || value === 'false') return false;
  if (value === 1 || value === '1' || value === 'true') return true;
  return fallback;
}

export function normalizeDesktopLevel(raw) {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'pro' || s === 'svip') return 'pro';
  return 'plus';
}

export function normalizeZhiliaoPermissions(input) {
  const raw = parsePermissionsInput(input);
  if (!raw) return null;
  const payload = raw.p && typeof raw.p === 'object' ? { ...raw.p, ...raw } : raw;
  const result = {};
  ZHILIAO_PERMISSION_KEYS.forEach((key) => {
    result[key] = toPermissionBool(payload[key], true);
  });
  if (payload.level != null && payload.level !== '') {
    result.level = normalizeDesktopLevel(payload.level);
  }
  return result;
}

export function normalizeZhixiaoPermissions(input) {
  const raw = parsePermissionsInput(input);
  if (!raw) return null;
  const payload = raw.p && typeof raw.p === 'object' ? { ...raw.p, ...raw } : raw;
  const result = {};
  ZHIXIAO_PERMISSION_KEYS.forEach((key) => {
    result[key] = toPermissionBool(payload[key], true);
  });
  if (payload.level != null && payload.level !== '') {
    result.level = normalizeDesktopLevel(payload.level);
  }
  return result;
}

function buildDesktopPermissionsPayload(rawPerm, key) {
  if (!rawPerm || typeof rawPerm !== 'object' || Array.isArray(rawPerm)) return null;
  const upper = String(key || '').toUpperCase();
  const keys = upper.startsWith(ZHIXIAO_PREFIX) ? ZHIXIAO_PERMISSION_KEYS : ZHILIAO_PERMISSION_KEYS;
  const p = {};
  keys.forEach((permKey) => {
    p[permKey] = toPermissionBool(rawPerm[permKey], true);
  });
  if (rawPerm.level != null && rawPerm.level !== '') {
    p.level = normalizeDesktopLevel(rawPerm.level);
  }
  return p;
}

export function sanitizeDesktopActivationData(row, includePermissions = false) {
  if (!row || typeof row !== 'object') return row;
  const expired = row.expires_at && new Date(row.expires_at).getTime() < Date.now();
  const base = {
    id: row.id,
    key: row.key,
    duration_days: row.duration_days,
    is_used: row.is_used,
    used_at: row.used_at,
    expires_at: row.expires_at,
    device_id: row.device_id,
    note: row.note ?? null,
    is_expired: Boolean(expired),
    is_licensed: Boolean(row.is_used && !expired)
  };
  if (includePermissions) {
    const p = buildDesktopPermissionsPayload(row.permissions, row.key);
    if (p) base.p = p;
  }
  return base;
}

export function normalizeCjzsLevel(raw) {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'pro' || s === 'svip') return 'pro';
  if (s === 'ultra') return 'ultra';
  if (s === 'plus' || s === 'vip') return 'plus';
  return 'plus';
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
  const levelRaw = row?.p?.level ?? row?.permissions?.level ?? row?.user_level;
  const level = vips.length > 0 ? normalizeCjzsLevel(levelRaw) : 'plus';
  const isVip = !expired && vips.length > 0;
  const isPro = isVip && level === 'pro';
  return {
    name: row?.user_name || row?.note || '已激活用户',
    email: row?.user_email || row?.key || '',
    vips,
    level,
    isVip,
    isPro,
    isSvip: isPro
  };
}

export function sanitizeCjzsActivationData(row, includePermissions = false) {
  const base = sanitizeActivationData(row, includePermissions);
  if (!base) return base;
  base.user = buildCjzsUser({ ...row, p: base.p }, includePermissions);
  base.user_level = base.user.level;
  return base;
}
