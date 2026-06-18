import type { ActivationKeyRow, PluginId } from '../types'
import { parseCjzsPermissions } from '../permissions/definitions'
import './KeyTable.css'

interface KeyTableProps {
  plugin: PluginId
  rows: ActivationKeyRow[]
  selected: Set<string>
  onToggle: (id: string) => void
  onToggleAll: (checked: boolean) => void
  onCopy: (key: string) => void
  onEditPermissions: (row: ActivationKeyRow) => void
  onEditExpires: (row: ActivationKeyRow) => void
  onDelete: (id: string) => void
}

function formatDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function permissionSummary(plugin: PluginId, row: ActivationKeyRow) {
  if (!row.permissions) return '全开'
  if (plugin === 'cjzs') {
    const parsed = parseCjzsPermissions(row.permissions)
    return `${parsed.channels.length} 平台 · ${parsed.level}`
  }
  const keys = Object.keys(row.permissions).filter((k) => k !== 'level' && k !== 'ac' && k !== 'p')
  const disabled = keys.filter((k) => row.permissions?.[k] === false)
  return disabled.length ? `${disabled.length} 项关闭` : '全开'
}

export function KeyTable({
  plugin,
  rows,
  selected,
  onToggle,
  onToggleAll,
  onCopy,
  onEditPermissions,
  onEditExpires,
  onDelete
}: KeyTableProps) {
  const allSelected = rows.length > 0 && rows.every((row) => selected.has(row.id))

  return (
    <div className="key-table-wrap glass-card">
      <table className="key-table">
        <thead>
          <tr>
            <th>
              <input type="checkbox" checked={allSelected} onChange={(e) => onToggleAll(e.target.checked)} />
            </th>
            <th>激活码</th>
            <th>设备码</th>
            <th>有效期</th>
            <th>状态</th>
            {plugin === 'cjzs' ? <th>等级</th> : null}
            <th>权限</th>
            <th>过期时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <input type="checkbox" checked={selected.has(row.id)} onChange={() => onToggle(row.id)} />
              </td>
              <td className="mono">{row.key}</td>
              <td className="mono">{row.device_id || '—'}</td>
              <td>{row.duration_days} 天</td>
              <td>
                <span className={`chip ${row.is_used ? 'badge-used' : 'badge-unused'}`}>
                  {row.is_used ? '已激活' : '待使用'}
                </span>
              </td>
              {plugin === 'cjzs' ? (
                <td>{parseCjzsPermissions(row.permissions).level.toUpperCase()}</td>
              ) : null}
              <td>{permissionSummary(plugin, row)}</td>
              <td>{formatDate(row.expires_at)}</td>
              <td className="key-actions">
                <button type="button" className="btn btn-ghost" onClick={() => onCopy(row.key)}>复制</button>
                <button type="button" className="btn btn-ghost" onClick={() => onEditPermissions(row)}>权限</button>
                <button type="button" className="btn btn-ghost" onClick={() => onEditExpires(row)}>过期</button>
                <button type="button" className="btn btn-danger" onClick={() => onDelete(row.id)}>删除</button>
              </td>
            </tr>
          ))}
          {!rows.length ? (
            <tr>
              <td colSpan={plugin === 'cjzs' ? 9 : 8} className="empty-row">暂无数据</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
}
