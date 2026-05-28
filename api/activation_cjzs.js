import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import {
  setCors,
  encryptPayload,
  checkRateLimit,
  parseBooleanFlag,
  assertCjzsKey,
  sanitizeCjzsActivationData
} from './_activation_core.js';

/** 激活码 permissions JSON：`{ ac: string[], level: 'plus'|'pro'|'ultra' }`，由 admin 维护 */
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const INCLUDE_PERMISSIONS_DEFAULT =
  String(process.env.ACTIVATION_CJZS_INCLUDE_PERMISSIONS_DEFAULT || 'true').toLowerCase() === 'true';

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase configuration missing');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const { action } = req.query;
  console.log(`[API CJZS Request] Method: ${req.method}, Action: ${action}`);

  try {
    if (req.method !== 'POST') {
      return res.status(400).json({ error: 'Invalid method' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    if (!['activate', 'verify'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action for CJZS API' });
    }

    const isAllowed = await checkRateLimit(req, 'activation_cjzs');
    if (!isAllowed) {
      return res.status(429).json({ error: '请求过于频繁，请 3 分钟后再试' });
    }

    const { key, device_id, include_permissions } = body;
    const prefixCheck = assertCjzsKey(key);
    if (!prefixCheck.ok) {
      return res.status(200).json(encryptPayload({ success: false, error: prefixCheck.error }, device_id));
    }

    const includePermissions = parseBooleanFlag(include_permissions, INCLUDE_PERMISSIONS_DEFAULT);

    if (action === 'verify') {
      const { data, error } = await supabase.from('activation_keys').select('*').eq('key', key).single();

      if (error || !data) {
        return res.status(200).json(encryptPayload({ success: false, error: '激活码不存在' }, device_id));
      }

      if (data.is_used && data.device_id !== device_id) {
        return res
          .status(200)
          .json(encryptPayload({ success: false, error: '激活码与当前设备不匹配' }, device_id));
      }

      if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
        return res.status(200).json(encryptPayload({ success: false, error: '激活码已过期' }, device_id));
      }

      return res.status(200).json(
        encryptPayload(
          {
            success: true,
            data: sanitizeCjzsActivationData(data, includePermissions)
          },
          device_id
        )
      );
    }

    if (action === 'activate') {
      const { data: keyData, error: fetchError } = await supabase
        .from('activation_keys')
        .select('*')
        .eq('key', key)
        .single();

      if (fetchError || !keyData) {
        return res.status(200).json(encryptPayload({ success: false, error: '激活码不存在' }, device_id));
      }

      if (keyData.is_used && keyData.device_id === device_id) {
        if (keyData.expires_at && new Date(keyData.expires_at).getTime() < Date.now()) {
          return res.status(200).json(encryptPayload({ success: false, error: '激活码已过期' }, device_id));
        }
        return res.status(200).json(
          encryptPayload(
            {
              success: true,
              message: '设备已激活',
              data: sanitizeCjzsActivationData(keyData, includePermissions)
            },
            device_id
          )
        );
      }

      if (keyData.is_used) {
        return res
          .status(200)
          .json(encryptPayload({ success: false, error: '该激活码已被其他设备使用' }, device_id));
      }

      const used_at = new Date().toISOString();
      const expires_at = new Date(
        Date.now() + keyData.duration_days * 24 * 60 * 60 * 1000
      ).toISOString();

      const { data, error } = await supabase
        .from('activation_keys')
        .update({ is_used: true, used_at, expires_at, device_id })
        .eq('key', key)
        .select()
        .single();

      if (error) {
        return res
          .status(200)
          .json(encryptPayload({ success: false, error: '激活失败', details: error.message }, device_id));
      }

      return res.status(200).json(
        encryptPayload(
          {
            success: true,
            message: '激活成功',
            data: sanitizeCjzsActivationData(data, includePermissions)
          },
          device_id
        )
      );
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
}
