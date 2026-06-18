import type { PluginId } from '../types'

export const PLUGINS: Record<PluginId, { label: string; prefix: string; tagline: string }> = {
  flowx: { label: 'FlowX', prefix: 'XHS', tagline: '内容矩阵与分发中枢' },
  cjzs: { label: '采集助手', prefix: 'CJZS', tagline: '社媒数据采集引擎' },
  zhiliao: { label: '知聊', prefix: 'ZHILIAO', tagline: '本地微信数据工作台' },
  zhixiao: { label: '知销', prefix: 'ZHIXIAO', tagline: '信笺参谋 · AI 销售助手' }
}

export interface PermissionDef {
  key: string
  label: string
}

export const FLOWX_PERMISSIONS: PermissionDef[] = [
  { key: 'ai', label: 'AI 创作助手' },
  { key: 'cp', label: '单篇内容抓取' },
  { key: 'co', label: '批量云端采集' },
  { key: 'sy', label: '多端矩阵同步' },
  { key: 'ed', label: '图文沉浸排版' },
  { key: 'hr', label: '全网热榜洞察' },
  { key: 'bk', label: '本地自动备份' },
  { key: 'pl', label: '高阶提示词库' },
  { key: 'fw', label: '提效悬浮助手' }
]

export const FLOWX_CHANNELS = [
  { key: 'xiaohongshu', label: '小红书' },
  { key: 'douyin', label: '抖音' },
  { key: 'weixin', label: '微信生态' },
  { key: 'juejin', label: '掘金' },
  { key: 'zhihu', label: '知乎' },
  { key: 'toutiao', label: '今日头条' },
  { key: 'weibo', label: '微博' },
  { key: 'bilibili', label: 'B站' }
]

export const CJZS_PLATFORMS = [
  { key: 'xiaohongshu', label: '小红书' },
  { key: 'douyin', label: '抖音' },
  { key: 'bilibili', label: 'B站' },
  { key: 'kuaishou', label: '快手' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'xingtu', label: '星图' },
  { key: 'pgy.xiaohongshu', label: '蒲公英' }
]

export const ZHILIAO_PERMISSIONS: PermissionDef[] = [
  { key: 'ch', label: '聊天' },
  { key: 'ex', label: '导出' },
  { key: 'an', label: '分析' },
  { key: 'ar', label: '年度报告' },
  { key: 'dr', label: '双人报告' },
  { key: 'fp', label: '足迹' },
  { key: 'sn', label: '朋友圈' },
  { key: 'sop', label: '聊天整理' },
  { key: 'ai', label: 'AI 见解' },
  { key: 'api', label: '本地 HTTP API' },
  { key: 'bk', label: '备份' }
]

export const ZHIXIAO_PERMISSIONS: PermissionDef[] = [
  { key: 'wb', label: '工作台' },
  { key: 'ct', label: '会话' },
  { key: 'pm', label: '发朋友圈' },
  { key: 'ag', label: '角色' },
  { key: 'kb', label: '知识库' },
  { key: 'mem', label: '记忆' },
  { key: 'src', label: '接入' },
  { key: 'rt', label: '实时建议' },
  { key: 'aapi', label: 'Agent API' }
]

export function desktopPermissionDefs(plugin: PluginId): PermissionDef[] {
  return plugin === 'zhiliao' ? ZHILIAO_PERMISSIONS : ZHIXIAO_PERMISSIONS
}

export function isDesktopPlugin(plugin: PluginId): boolean {
  return plugin === 'zhiliao' || plugin === 'zhixiao'
}

export function buildDesktopPermissions(
  plugin: PluginId,
  values: Record<string, boolean>,
  level?: 'plus' | 'pro'
): Record<string, boolean | string> {
  const defs = desktopPermissionDefs(plugin)
  const result: Record<string, boolean | string> = {}
  defs.forEach((def) => {
    result[def.key] = values[def.key] !== false
  })
  if (level) result.level = level
  return result
}

export function parseDesktopPermissions(
  plugin: PluginId,
  raw: Record<string, unknown> | null | undefined
): Record<string, boolean> {
  const payload = raw?.p && typeof raw.p === 'object' ? { ...(raw.p as object), ...raw } : raw
  const defs = desktopPermissionDefs(plugin)
  const result: Record<string, boolean> = {}
  defs.forEach((def) => {
    const value = payload?.[def.key as keyof typeof payload]
    result[def.key] = value === false || value === 0 || value === '0' || value === 'false' ? false : true
  })
  return result
}

export function desktopTemplate(
  plugin: PluginId,
  name: 'all' | 'standard' | 'basic'
): Record<string, boolean> {
  const defs = desktopPermissionDefs(plugin)
  const allTrue = Object.fromEntries(defs.map((d) => [d.key, true])) as Record<string, boolean>
  if (name === 'all') return allTrue

  if (plugin === 'zhiliao') {
    if (name === 'standard') {
      return { ...allTrue, sop: false, ai: false, api: false }
    }
    return { ch: true, ex: true, an: false, ar: false, dr: false, fp: false, sn: false, sop: false, ai: false, api: false, bk: false }
  }

  if (name === 'standard') {
    return { ...allTrue, aapi: false, rt: false }
  }
  return { wb: true, ct: true, pm: false, ag: false, kb: false, mem: false, src: false, rt: false, aapi: false }
}

export function buildFlowxPermissions(values: Record<string, boolean>, channels: string[]): Record<string, unknown> {
  return {
    ac: channels,
    ai: values.ai !== false,
    cp: values.cp !== false,
    co: values.co !== false,
    sy: values.sy !== false,
    ed: values.ed !== false,
    hr: values.hr !== false,
    bk: values.bk !== false,
    pl: values.pl !== false,
    fw: values.fw !== false
  }
}

export function parseFlowxPermissions(raw: Record<string, unknown> | null | undefined) {
  const payload = raw?.p && typeof raw.p === 'object' ? { ...(raw.p as object), ...raw } : raw
  const values: Record<string, boolean> = {}
  FLOWX_PERMISSIONS.forEach((def) => {
    values[def.key] = payload?.[def.key as keyof typeof payload] !== false
  })
  const ac = Array.isArray(payload?.ac)
    ? (payload.ac as string[])
    : Array.isArray(payload?.allowedChannels)
      ? (payload.allowedChannels as string[])
      : FLOWX_CHANNELS.map((c) => c.key)
  return { values, channels: ac }
}

export function buildCjzsPermissions(channels: string[], level: 'plus' | 'pro' | 'ultra' = 'plus') {
  return { ac: channels, level }
}

export function parseCjzsPermissions(raw: Record<string, unknown> | null | undefined) {
  const payload = raw?.p && typeof raw.p === 'object' ? { ...(raw.p as object), ...raw } : raw
  const ac = Array.isArray(payload?.ac)
    ? (payload.ac as string[])
    : CJZS_PLATFORMS.map((c) => c.key)
  const level = String(payload?.level ?? 'plus').toLowerCase()
  return { channels: ac, level: (level === 'pro' || level === 'ultra' ? level : 'plus') as 'plus' | 'pro' | 'ultra' }
}
