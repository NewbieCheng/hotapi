import crypto from 'crypto';
import { redis } from './cache_system.js';

export const ISSUE_TOKEN_PREFIX = 'SHIT1';
export const ISSUE_TOKEN_TTL_SEC = 5 * 60;
export const DEFAULT_DAILY_ISSUE_LIMIT = 200;

const memoryJti = new Map();
const memoryDaily = new Map();

function getSigningSecret() {
  return String(process.env.SKILLHUB_ISSUE_API_KEY || '').trim();
}

export function getDailyIssueLimit() {
  const raw = Number(process.env.SKILLHUB_ISSUE_DAILY_LIMIT);
  if (Number.isFinite(raw) && raw > 0) return Math.floor(raw);
  return DEFAULT_DAILY_ISSUE_LIMIT;
}

function hmacSign(bodyB64) {
  const secret = getSigningSecret();
  if (!secret) throw new Error('SKILLHUB_ISSUE_API_KEY missing');
  return crypto.createHmac('sha256', secret).update(bodyB64).digest('base64url');
}

function utcDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function hashIp(ip) {
  const raw = String(ip || 'unknown');
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);
}

export function clientIp(req) {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

/**
 * Mint a short-lived, single-use issue token bound to packageId.
 * Server-side only (caller must already have verified SKILLHUB_ISSUE_API_KEY).
 */
export async function mintIssueToken({ packageId, orderRef } = {}) {
  const id = String(packageId || '').trim();
  if (!id) throw new Error('缺少 packageId');

  const jti = crypto.randomBytes(16).toString('hex');
  const exp = Math.floor(Date.now() / 1000) + ISSUE_TOKEN_TTL_SEC;
  const payload = {
    v: 1,
    packageId: id,
    jti,
    exp
  };
  if (orderRef != null && String(orderRef).trim()) {
    payload.orderRef = String(orderRef).trim().slice(0, 128);
  }

  const bodyB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = hmacSign(bodyB64);
  const token = `${ISSUE_TOKEN_PREFIX}.${bodyB64}.${sig}`;

  const redisKey = `skillhub_issue:jti:${jti}`;
  if (redis) {
    await redis.set(redisKey, 'pending', 'EX', ISSUE_TOKEN_TTL_SEC);
  } else {
    memoryJti.set(jti, { status: 'pending', exp: Date.now() + ISSUE_TOKEN_TTL_SEC * 1000 });
  }

  return {
    token,
    packageId: id,
    jti,
    expiresIn: ISSUE_TOKEN_TTL_SEC,
    expiresAt: new Date(exp * 1000).toISOString()
  };
}

function parseAndVerifyToken(token) {
  const raw = String(token || '').trim();
  const parts = raw.split('.');
  if (parts.length !== 3 || parts[0] !== ISSUE_TOKEN_PREFIX) {
    return { ok: false, error: '发码凭证格式无效' };
  }
  const [, bodyB64, sig] = parts;
  let expected;
  try {
    expected = hmacSign(bodyB64);
  } catch {
    return { ok: false, error: '发码服务尚未配置', code: 'ISSUE_SERVICE_NOT_CONFIGURED' };
  }
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, error: '发码凭证签名无效' };
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(bodyB64, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, error: '发码凭证无法解析' };
  }
  if (!payload || payload.v !== 1 || !payload.packageId || !payload.jti || !payload.exp) {
    return { ok: false, error: '发码凭证字段不完整' };
  }
  if (Number(payload.exp) * 1000 < Date.now()) {
    return { ok: false, error: '发码凭证已过期', code: 'TOKEN_EXPIRED' };
  }
  return { ok: true, payload };
}

/**
 * Verify signature/expiry and consume jti exactly once.
 */
export async function consumeIssueToken(token) {
  const verified = parseAndVerifyToken(token);
  if (!verified.ok) return verified;

  const { jti, packageId, orderRef } = verified.payload;
  const redisKey = `skillhub_issue:jti:${jti}`;

  if (redis) {
    // Atomic consume: remove pending jti so concurrent replays fail.
    const status = await redis.getdel(redisKey);
    if (status !== 'pending') {
      return { ok: false, error: '发码凭证不存在或已使用', code: 'TOKEN_USED' };
    }
  } else {
    const entry = memoryJti.get(jti);
    if (!entry || entry.exp < Date.now()) {
      return { ok: false, error: '发码凭证不存在或已使用', code: 'TOKEN_USED' };
    }
    if (entry.status === 'used') {
      return { ok: false, error: '发码凭证已使用', code: 'TOKEN_USED' };
    }
    entry.status = 'used';
    memoryJti.set(jti, entry);
  }

  return {
    ok: true,
    packageId,
    jti,
    orderRef: orderRef || null
  };
}

export async function checkDailyIssueQuota() {
  const limit = getDailyIssueLimit();
  const day = utcDayKey();
  const key = `skillhub_issue:daily:${day}`;

  if (redis) {
    try {
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, 48 * 3600);
      if (count > limit) {
        return { ok: false, count, limit, day };
      }
      return { ok: true, count, limit, day };
    } catch (e) {
      console.error('[SkillhubIssue] daily quota redis error:', e);
    }
  }

  const count = (memoryDaily.get(day) || 0) + 1;
  memoryDaily.set(day, count);
  if (count > limit) {
    return { ok: false, count, limit, day };
  }
  return { ok: true, count, limit, day };
}

/** Test helper: clear in-memory token/quota state. */
export function _resetSkillhubIssueMemoryForTests() {
  memoryJti.clear();
  memoryDaily.clear();
}
