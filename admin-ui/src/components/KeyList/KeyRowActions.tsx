import { Button } from '../ui'

interface KeyRowActionsProps {
  onCopy: () => void
  onEditPermissions: () => void
  onEditExpires: () => void
  onDelete: () => void
  compact?: boolean
}

export function KeyRowActions({ onCopy, onEditPermissions, onEditExpires, onDelete, compact }: KeyRowActionsProps) {
  return (
    <div className={compact ? 'key-row-card__actions' : 'key-actions'}>
      <Button variant="ghost" onClick={onCopy}>复制</Button>
      <Button variant="ghost" onClick={onEditPermissions}>权限</Button>
      <Button variant="ghost" onClick={onEditExpires}>过期</Button>
      <Button variant="danger" onClick={onDelete}>删除</Button>
    </div>
  )
}
