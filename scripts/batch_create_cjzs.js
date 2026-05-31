import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('缺少 SUPABASE 配置');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const CJZS_PLATFORMS = [
  'xiaohongshu', 'douyin', 'bilibili', 'kuaishou', 'tiktok', 'xingtu', 'pgy.xiaohongshu'
];

function generateRandomKey(prefix = 'CJZS') {
  return `${prefix}-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

const COUNT = 20;
const duration_days = 30;
const permissions = { ac: [...CJZS_PLATFORMS], level: 'pro' };

const rows = Array.from({ length: COUNT }, () => ({
  key: generateRandomKey('CJZS'),
  duration_days,
  is_used: false,
  permissions
}));

const { data, error } = await supabase.from('activation_keys').insert(rows).select('key, duration_days, permissions');

if (error) {
  console.error('创建失败:', error.message);
  process.exit(1);
}

console.log(`成功创建 ${data.length} 个 CJZS Pro 激活码（有效期 ${duration_days} 天）：\n`);
data.forEach((row, i) => console.log(`${i + 1}. ${row.key}`));
