import type { ActivationKeyRow, PluginId } from '../../types'
import { parseCjzsPermissions } from '../../permissions/definitions'
import { Badge, Card } from '../ui'
import { KeyRowActions } from './KeyRowActions'
import { formatDate, permissionSummary } from './keyListShared'

interface KeyTableViewProps {
  plugin: PluginId
  rows: ActivationKeyRow[]
  selected: Set<string>
  onToggle: (id: string) => void
  onToggleAll: (checked: boolean) => void
  onCopy: (key: string) => void
  onEditPermissions: (row: ActivationKeyRow) => void
  onEditExpires: (row: ActivationKeyRow) => void
  onDelete: (id: string) => void
  onOpenDetail: (row: ActivationKeyRow) => void
}

export function KeyTableView({
  plugin,
  rows,
  selected,
  onToggle,
  onToggleAll,
  onCopy,
  onEditPermissions,
  onEditExpires,
  onDelete,
  onOpenDetail
}: KeyTableViewProps) {
  const allSelected = rows.length > 0 && rows.every((row) => selected.has(row.id))

  return (
    <Card className="key-table-wrap">
      <table className="key-table">
        <thead>
          <tr>
            <th>
              <input type="checkbox" checked={allSelected} onChange={(e) => onToggleAll(e.target.checked)} aria-label="全选" />
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
                <input type="checkbox" checked={selected.has(row.id)} onChange={() => onToggle(row.id)} aria-label={`选择 ${row.key}`} />
              </td>
              <td>
                <button type="button" className="key-table__key-btn mono" onClick={() => onOpenDetail(row)}>
                  {row.key}
                </button>
              </td>
              <td className="mono">{row.device_id || '—'}</td>
              <td>{row.duration_days} 天</td>
              <td>
                <Badge tone={row.is_used ? 'success' : 'warning'}>
                  {row.is_used ? '已激活' : '待使用'}
                </Badge>
              </td>
              {plugin === 'cjzs' ? (
                <td>{parseCjzsPermissions(row.permissions).level.toUpperCase()}</td>
              ) : null}
              <td>{permissionSummary(plugin, row)}</td>
              <td>{formatDate(row.expires_at)}</td>
              <td>
                <KeyRowActions
                  onCopy={() => onCopy(row.key)}
                  onEditPermissions={() => onEditPermissions(row)}
                  onEditExpires={() => onEditExpires(row)}
                  onDelete={() => onDelete(row.id)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}
