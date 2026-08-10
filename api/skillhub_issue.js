import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { checkRateLimit } from './_activation_core.js';
import { redis } from './cache_system.js';
import {
  buildIssueRow,
  listSkillhubPackages,
  resolveSkillhubPackage
} from './_activation_issue.js';
import {
  DEFAULT_DAILY_ISSUE_LIMIT,
  ISSUE_TOKEN_TTL_SEC,
  checkDailyIssueQuota,
  clientIp,
  consumeIssueToken,
  getDailyIssueLimit,
  hashIp,
  mintIssueToken
} from './_skillhub_issue_token.js';

dotenv.config();

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers':
    'Authorization,Content-Type,X-Requested-With,Accept,Origin,X-Skill-Api-Key,X-Issue-Token',
  'Access-Control-Allow-Credentials': 'true',
  'Cache-Control': 'no-store'
};

const KEY_RATE_LIMIT = 60;
const KEY_RATE_WINDOW_SEC = 3600;

let supabase;

function getSupabase() {
  if (supabase) return supabase;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase configuration missing');
  }
  supabase = createClient(supabaseUrl, supabaseKey);
  return supabase;
}

function setCors(res) {
  Object.entries(CORS_HEADERS).forEach(([key, value]) => res.setHeader(key, value));
}

function readBody(req) {
  if (typeof req.body === 'string') return JSON.parse(req.body);
  return req.body || {};
}

function getConfiguredApiKey() {
  return String(process.env.SKILLHUB_ISSUE_API_KEY || '').trim();
}

function checkSkillApiKey(req) {
  const configured = getConfiguredApiKey();
  if (!configured) return { ok: false, code: 'NOT_CONFIGURED' };
  const provided = String(req.headers['x-skill-api-key'] || '').trim();
  if (!provided || provided !== configured) return { ok: false, code: 'FORBIDDEN' };
  return { ok: true };
}

function readIssueToken(req, body) {
  const fromHeader = String(req.headers['x-issue-token'] || '').trim();
  if (fromHeader) return fromHeader;
  return String(body?.issueToken || body?.issue_token || '').trim();
}

async function checkApiKeyRateLimit() {
  if (!redis) return true;
  const key = 'ratelimit:skillhub_issue:apikey';
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, KEY_RATE_WINDOW_SEC);
    return count <= KEY_RATE_LIMIT;
  } catch (e) {
    console.error('[SkillhubIssue] key rate limit error:', e);
    return true;
  }
}

async function findExistingKeys(keys) {
  const unique = [...new Set(keys.filter(Boolean))];
  if (!unique.length) return [];
  const { data, error } = await getSupabase().from('activation_keys').select('key').in('key', unique);
  if (error) throw error;
  return (data || []).map((row) => row.key);
}

function writeAuditLog(event, fields) {
  console.log(JSON.stringify({
    type: 'skillhub_issue_audit',
    event,
    at: new Date().toISOString(),
    ...fields
  }));
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const action = req.query?.action;

  if (req.method === 'GET' && action === 'packages') {
    return res.status(200).json({
      packages: listSkillhubPackages(),
      limits: {
        perKeyPerHour: KEY_RATE_LIMIT,
        perIpPer3Min: 10,
        dailyIssueLimit: getDailyIssueLimit(),
        issueTokenTtlSec: ISSUE_TOKEN_TTL_SEC
      },
      auth: {
        mintToken: 'x-skill-api-key (server only)',
        issue: 'x-issue-token (buyer one-time voucher)'
      }
    });
  }

  if (req.method !== 'POST') {
    return res.status(404).json({ error: '不支持的操作' });
  }

  if (action === 'mint_token') {
    const auth = checkSkillApiKey(req);
    if (auth.code === 'NOT_CONFIGURED') {
      return res.status(503).json({
        error: 'SkillHub 发码服务尚未配置',
        code: 'ISSUE_SERVICE_NOT_CONFIGURED'
      });
    }
    if (!auth.ok) {
      return res.status(403).json({ error: 'Forbidden: 鉴权失败' });
    }

    const keyAllowed = await checkApiKeyRateLimit();
    if (!keyAllowed) {
      return res.status(429).json({ error: '发码配额已用尽，请稍后再试', code: 'RATE_LIMIT_KEY' });
    }

    let body;
    try {
      body = readBody(req);
    } catch {
      return res.status(400).json({ error: '请求 JSON 格式错误' });
    }

    const resolved = resolveSkillhubPackage(body.packageId);
    if (!resolved.ok) {
      return res.status(400).json({ error: resolved.error });
    }

    try {
      const minted = await mintIssueToken({
        packageId: resolved.package.packageId,
        orderRef: body.orderRef || body.order_id
      });
      writeAuditLog('mint_token', {
        packageId: minted.packageId,
        jti: minted.jti,
        ipHash: hashIp(clientIp(req)),
        orderRef: body.orderRef || body.order_id || null
      });
      return res.status(201).json({
        ok: true,
        ...minted
      });
    } catch (err) {
      return res.status(500).json({
        error: '签发凭证失败',
        details: err instanceof Error ? err.message : 'unknown'
      });
    }
  }

  if (action !== 'issue') {
    return res.status(404).json({ error: '不支持的操作' });
  }

  if (!getConfiguredApiKey()) {
    return res.status(503).json({
      error: 'SkillHub 发码服务尚未配置',
      code: 'ISSUE_SERVICE_NOT_CONFIGURED'
    });
  }

  const ipAllowed = await checkRateLimit(req, 'skillhub_issue');
  if (!ipAllowed) {
    return res.status(429).json({ error: '请求过于频繁，请稍后再试', code: 'RATE_LIMIT_IP' });
  }

  let body;
  try {
    body = readBody(req);
  } catch {
    return res.status(400).json({ error: '请求 JSON 格式错误' });
  }

  const issueToken = readIssueToken(req, body);
  if (!issueToken) {
    return res.status(401).json({
      error: '缺少一次性发码凭证 x-issue-token',
      code: 'ISSUE_TOKEN_REQUIRED'
    });
  }

  // Reject accidental use of long-lived API key on the buyer issue path.
  if (String(req.headers['x-skill-api-key'] || '').trim()) {
    return res.status(400).json({
      error: 'issue 请使用 x-issue-token，不要传递 x-skill-api-key',
      code: 'USE_ISSUE_TOKEN'
    });
  }

  let consumed;
  try {
    consumed = await consumeIssueToken(issueToken);
  } catch (err) {
    return res.status(500).json({
      error: '校验发码凭证失败',
      details: err instanceof Error ? err.message : 'unknown'
    });
  }
  if (!consumed.ok) {
    const status = consumed.code === 'ISSUE_SERVICE_NOT_CONFIGURED' ? 503 : 403;
    return res.status(status).json({
      error: consumed.error,
      code: consumed.code || 'TOKEN_INVALID'
    });
  }

  const resolved = resolveSkillhubPackage(consumed.packageId);
  if (!resolved.ok) {
    return res.status(400).json({ error: resolved.error });
  }

  // Optional phone on issue; packageId comes only from the token.
  if (body.packageId && String(body.packageId).trim() !== resolved.package.packageId) {
    return res.status(400).json({
      error: 'packageId 与发码凭证不匹配',
      code: 'PACKAGE_MISMATCH'
    });
  }

  const quota = await checkDailyIssueQuota();
  if (!quota.ok) {
    writeAuditLog('daily_quota_exceeded', {
      packageId: resolved.package.packageId,
      day: quota.day,
      count: quota.count,
      limit: quota.limit,
      ipHash: hashIp(clientIp(req))
    });
    return res.status(429).json({
      error: `今日发码已达上限（${quota.limit}）`,
      code: 'DAILY_QUOTA',
      day: quota.day,
      limit: quota.limit
    });
  }

  let row;
  try {
    row = buildIssueRow({
      package: resolved.package,
      phone: body.phone
    });
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : '创建参数无效' });
  }

  const ipHash = hashIp(clientIp(req));
  const auditNote = [
    'skillhub',
    resolved.package.packageId,
    new Date().toISOString(),
    `ip=${ipHash}`,
    consumed.orderRef ? `order=${consumed.orderRef}` : null,
    `jti=${consumed.jti}`
  ].filter(Boolean).join('|');

  try {
    const existing = await findExistingKeys([row.key]);
    if (existing.length) {
      return res.status(409).json({
        error: '激活码已存在',
        duplicates: existing
      });
    }

    const { data, error } = await getSupabase()
      .from('activation_keys')
      .insert([row])
      .select('key, duration_days, permissions')
      .single();

    if (error) {
      return res.status(500).json({ error: '创建失败', details: error.message });
    }

    writeAuditLog('issue_ok', {
      packageId: resolved.package.packageId,
      plugin: resolved.package.plugin,
      keyPrefix: String(data.key).slice(0, 12),
      jti: consumed.jti,
      orderRef: consumed.orderRef,
      ipHash,
      auditNote,
      dailyCount: quota.count,
      dailyLimit: quota.limit || DEFAULT_DAILY_ISSUE_LIMIT
    });

    return res.status(201).json({
      ok: true,
      packageId: resolved.package.packageId,
      plugin: resolved.package.plugin,
      key: data.key,
      duration_days: data.duration_days
    });
  } catch (err) {
    console.error('[SkillhubIssue] insert error:', err);
    return res.status(500).json({
      error: '创建失败',
      details: err instanceof Error ? err.message : 'unknown'
    });
  }
}
