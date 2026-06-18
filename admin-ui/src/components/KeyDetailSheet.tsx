import type { ActivationKeyRow, PluginId } from '../types'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { Badge, Button, Modal } from './ui'
import { formatDate, permissionSummary } from './KeyList/keyListShared'
import './KeyDetailSheet.css'

interface KeyDetailSheetProps {
  open: boolean
  plugin: PluginId
  row: ActivationKeyRow | null
  onClose: () => void
  onCopy: (key: string) => void
  onEditPermissions: (row: ActivationKeyRow) => void
  onRenew: (row: ActivationKeyRow, days: number) => void
  onDelete: (id: string) => void
}

export function KeyDetailSheet({
  open,
  plugin,
  row,
  onClose,
  onCopy,
  onEditPermissions,
  onRenew,
  onDelete
}: KeyDetailSheetProps) {
  const isMobile = useMediaQuery('(max-width: 768px)')
  if (!row) return null

  const body = (
    <div className="key-detail-sheet">
      <div className="key-detail-sheet__key-block">
        <span className="key-detail-sheet__label">激活码</span>
        <code className="mono key-detail-sheet__key">{row.key}</code>
        <Button type="button" onClick={() => onCopy(row.key)}>复制</Button>
      </div>
      <dl className="key-detail-sheet__meta">
        <div><dt>状态</dt><dd><Badge tone={row.is_used ? 'success' : 'warning'}>{row.is_used ? '已激活' : '待使用'}</Badge></dd></div>
        <div><dt>设备码</dt><dd className="mono">{row.device_id || '—'}</dd></div>
        <div><dt>有效期</dt><dd>{row.duration_days} 天</dd></div>
        <div><dt>权限</dt><dd>{permissionSummary(plugin, row)}</dd></div>
        <div><dt>过期时间</dt><dd>{formatDate(row.expires_at)}</dd></div>
        <div><dt>激活时间</dt><dd>{formatDate(row.used_at)}</dd></div>
      </dl>
      <div className="key-detail-sheet__renew">
        <span className="key-detail-sheet__label">快捷续期</span>
        <div className="key-detail-sheet__renew-btns">
          <Button variant="ghost" type="button" onClick={() => onRenew(row, 30)}>+30 天</Button>
          <Button variant="ghost" type="button" onClick={() => onRenew(row, 90)}>+90 天</Button>
        </div>
      </div>
      <div className="key-detail-sheet__actions">
        <Button variant="ghost" type="button" onClick={() => onEditPermissions(row)}>编辑权限</Button>
        <Button variant="danger" type="button" onClick={() => onDelete(row.id)}>删除</Button>
      </div>
    </div>
  )

  if (isMobile) {
    if (!open) return null
    return (
      <>
        <div className="key-detail-backdrop" onClick={onClose} aria-hidden />
        <aside className="key-detail-sheet-mobile" role="dialog" aria-label="激活码详情">
          <header className="key-detail-sheet-mobile__head">
            <h2>激活码详情</h2>
            <button type="button" onClick={onClose} aria-label="关闭">×</button>
          </header>
          {body}
        </aside>
      </>
    )
  }

  return (
    <Modal open={open} title="激活码详情" subtitle={row.key} onClose={onClose}>
      {body}
    </Modal>
  )
}
