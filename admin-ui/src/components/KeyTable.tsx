import type { ActivationKeyRow, PluginId } from '../types'
import { parseCjzsPermissions } from '../permissions/definitions'
import { Badge, Button, Card } from './ui'
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

interface KeyRowCardProps {
  plugin: PluginId
  row: ActivationKeyRow
  selected: boolean
  onToggle: () => void
  onCopy: () => void
  onEditPermissions: () => void
  onEditExpires: () => void
  onDelete: () => void
}

function KeyRowCard({
  plugin,
  row,
  selected,
  onToggle,
  onCopy,
  onEditPermissions,
  onEditExpires,
  onDelete
}: KeyRowCardProps) {
  return (
    <Card className="key-row-card">
      <div className="key-row-card__head">
        <label className="key-row-card__check">
          <input type="checkbox" checked={selected} onChange={onToggle} aria-label={`选择 ${row.key}`} />
        </label>
        <div className="key-row-card__title">
          <span className="mono key-row-card__key">{row.key}</span>
          <Badge tone={row.is_used ? 'success' : 'warning'}>
            {row.is_used ? '已激活' : '待使用'}
          </Badge>
        </div>
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
      <div className="key-row-card__actions">
        <Button variant="ghost" onClick={onCopy}>复制</Button>
        <Button variant="ghost" onClick={onEditPermissions}>权限</Button>
        <Button variant="ghost" onClick={onEditExpires}>过期</Button>
        <Button variant="danger" onClick={onDelete}>删除</Button>
      </div>
    </Card>
  )
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
    <>
      <Card className="key-table-wrap key-table-wrap--desktop">
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
                <td className="mono">{row.key}</td>
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
                <td className="key-actions">
                  <Button variant="ghost" onClick={() => onCopy(row.key)}>复制</Button>
                  <Button variant="ghost" onClick={() => onEditPermissions(row)}>权限</Button>
                  <Button variant="ghost" onClick={() => onEditExpires(row)}>过期</Button>
                  <Button variant="danger" onClick={() => onDelete(row.id)}>删除</Button>
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
      </Card>

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
          />
        ))}
        {!rows.length ? <Card className="key-card-empty">暂无数据</Card> : null}
      </div>
    </>
  )
}
