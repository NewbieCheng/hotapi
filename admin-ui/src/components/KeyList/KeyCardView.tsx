import type { ActivationKeyRow, PluginId } from '../../types'
import { parseCjzsPermissions } from '../../permissions/definitions'
import { Badge, Card } from '../ui'
import { KeyRowActions } from './KeyRowActions'
import { formatDate, permissionSummary } from './keyListShared'

interface KeyCardViewProps {
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

function KeyRowCard({
  plugin,
  row,
  selected,
  onToggle,
  onCopy,
  onEditPermissions,
  onEditExpires,
  onDelete,
  onOpenDetail
}: {
  plugin: PluginId
  row: ActivationKeyRow
  selected: boolean
  onToggle: () => void
  onCopy: () => void
  onEditPermissions: () => void
  onEditExpires: () => void
  onDelete: () => void
  onOpenDetail: () => void
}) {
  return (
    <Card className="key-row-card">
      <div className="key-row-card__head">
        <label className="key-row-card__check">
          <input type="checkbox" checked={selected} onChange={onToggle} aria-label={`选择 ${row.key}`} />
        </label>
        <button type="button" className="key-row-card__title key-row-card__title-btn" onClick={onOpenDetail}>
          <span className="mono key-row-card__key">{row.key}</span>
          <Badge tone={row.is_used ? 'success' : 'warning'}>
            {row.is_used ? '已激活' : '待使用'}
          </Badge>
        </button>
      </div>
      <dl className="key-row-card__meta">
        <div><dt>设备码</dt><dd className="mono">{row.device_id || '—'}</dd></div>
        <div><dt>有效期</dt><dd>{row.duration_days} 天</dd></div>
        {plugin === 'cjzs' ? (
          <div><dt>等级</dt><dd>{parseCjzsPermissions(row.permissions).level.toUpperCase()}</dd></div>
        ) : null}
        <div><dt>权限</dt><dd>{permissionSummary(plugin, row)}</dd></div>
        <div className="key-row-card__meta-wide"><dt>过期时间</dt><dd>{formatDate(row.expires_at)}</dd></div>
      </dl>
      <KeyRowActions
        compact
        onCopy={onCopy}
        onEditPermissions={onEditPermissions}
        onEditExpires={onEditExpires}
        onDelete={onDelete}
      />
    </Card>
  )
}

export function KeyCardView({
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
}: KeyCardViewProps) {
  const allSelected = rows.length > 0 && rows.every((row) => selected.has(row.id))

  return (
    <div className="key-card-list">
      <div className="key-card-list__toolbar">
        <label className="key-card-list__select-all">
          <input type="checkbox" checked={allSelected} onChange={(e) => onToggleAll(e.target.checked)} />
          全选当前页
        </label>
        <span className="key-card-list__count">{rows.length} 条</span>
      </div>
      {rows.map((row) => (
        <KeyRowCard
          key={row.id}
          plugin={plugin}
          row={row}
          selected={selected.has(row.id)}
          onToggle={() => onToggle(row.id)}
          onCopy={() => onCopy(row.key)}
          onEditPermissions={() => onEditPermissions(row)}
          onEditExpires={() => onEditExpires(row)}
          onDelete={() => onDelete(row.id)}
          onOpenDetail={() => onOpenDetail(row)}
        />
      ))}
    </div>
  )
}
