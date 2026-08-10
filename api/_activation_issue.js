import crypto from 'crypto';
import {
  DEFAULT_CJZS_VIPS,
  assertCjzsKey,
  assertFlowxKey,
  assertZhiliaoKey,
  assertZhixiaoKey,
  buildPhoneActivationKey,
  normalizeCjzsLevel
} from './_activation_core.js';

export const FLOWX_DEFAULT_PERMISSIONS = {
  ai: true,
  cp: true,
  co: true,
  sy: true,
  ed: true,
  hr: true,
  bk: true,
  pl: true,
  fw: true
};

/** Fixed SkillHub sell packages — clients cannot override duration/permissions. */
export const SKILLHUB_PACKAGES = Object.freeze({
  'flowx-30d': Object.freeze({
    packageId: 'flowx-30d',
    plugin: 'flowx',
    displayName: 'FlowX（今天不加班）30 天',
    duration_days: 30,
    prefix: 'XHS',
    permissions: Object.freeze({ ...FLOWX_DEFAULT_PERMISSIONS }),
    allowPhone: false
  }),
  'cjzs-30d': Object.freeze({
    packageId: 'cjzs-30d',
    plugin: 'cjzs',
    displayName: '知源采集助手 30 天',
    duration_days: 30,
    prefix: 'CJZS',
    permissions: Object.freeze({
      ac: Object.freeze([...DEFAULT_CJZS_VIPS]),
      level: 'plus'
    }),
    allowPhone: false
  }),
  'zhiliao-30d': Object.freeze({
    packageId: 'zhiliao-30d',
    plugin: 'zhiliao',
    displayName: '知聊 30 天',
    duration_days: 30,
    prefix: 'ZHILIAO',
    permissions: null,
    allowPhone: true
  }),
  'zhixiao-30d': Object.freeze({
    packageId: 'zhixiao-30d',
    plugin: 'zhixiao',
    displayName: '知销 30 天',
    duration_days: 30,
    prefix: 'ZHIXIAO',
    permissions: null,
    allowPhone: true
  })
});

export function listSkillhubPackages() {
  return Object.values(SKILLHUB_PACKAGES).map((pkg) => ({
    packageId: pkg.packageId,
    plugin: pkg.plugin,
    displayName: pkg.displayName,
    duration_days: pkg.duration_days,
    allowPhone: pkg.allowPhone
  }));
}

export function resolveSkillhubPackage(packageId) {
  const id = String(packageId || '').trim();
  const pkg = SKILLHUB_PACKAGES[id];
  if (!pkg) {
    return { ok: false, error: `未知套餐: ${id || '(空)'}` };
  }
  return { ok: true, package: pkg };
}

export function generateRandomKey(prefix = 'XHS') {
  return `${prefix}-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

function assertPluginKey(plugin, key) {
  if (plugin === 'cjzs') return assertCjzsKey(key);
  if (plugin === 'zhiliao') return assertZhiliaoKey(key);
  if (plugin === 'zhixiao') return assertZhixiaoKey(key);
  return assertFlowxKey(key);
}

function clonePermissions(permissions) {
  if (!permissions) return null;
  if (permissions.ac) {
    return {
      ac: [...permissions.ac],
      level: normalizeCjzsLevel(permissions.level)
    };
  }
  return { ...permissions };
}

/**
 * Build a single activation_keys row for a SkillHub package.
 * @param {{ package: typeof SKILLHUB_PACKAGES[string], phone?: string }} input
 */
export function buildIssueRow(input) {
  const pkg = input.package;
  if (!pkg) throw new Error('缺少套餐');

  let key;
  const phone = input.phone != null ? String(input.phone).trim() : '';
  if (phone) {
    if (!pkg.allowPhone) {
      throw new Error(`${pkg.plugin} 套餐不支持手机号模式`);
    }
    const built = buildPhoneActivationKey(pkg.prefix, phone);
    if (!built.ok) throw new Error(built.error);
    key = built.value;
  } else {
    key = generateRandomKey(pkg.prefix);
  }

  const keyCheck = assertPluginKey(pkg.plugin, key);
  if (!keyCheck.ok) throw new Error(keyCheck.error);

  return {
    key,
    duration_days: pkg.duration_days,
    is_used: false,
    permissions: clonePermissions(pkg.permissions)
  };
}
