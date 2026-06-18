import type { ActivationKeyRow, PluginId } from '../../types'
import { parseCjzsPermissions } from '../../permissions/definitions'

export function formatDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export function permissionSummary(plugin: PluginId, row: ActivationKeyRow) {
  if (!row.permissions) return '全开'
  if (plugin === 'cjzs') {
    const parsed = parseCjzsPermissions(row.permissions)
    return `${parsed.channels.length} 平台 · ${parsed.level}`
  }
  const keys = Object.keys(row.permissions).filter((k) => k !== 'level' && k !== 'ac' && k !== 'p')
  const disabled = keys.filter((k) => row.permissions?.[k] === false)
  return disabled.length ? `${disabled.length} 项关闭` : '全开'
}
