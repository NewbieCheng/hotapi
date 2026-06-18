import { Button } from './Button'
import './EmptyState.css'

interface EmptyStateProps {
  title?: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({
  title = '暂无激活码',
  description = '当前筛选条件下没有记录，试试调整筛选或快捷生成一批。',
  actionLabel = '去快捷生成',
  onAction
}: EmptyStateProps) {
  return (
    <div className="ui-empty-state">
      <div className="ui-empty-state__icon" aria-hidden>◇</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {onAction ? (
        <Button type="button" onClick={onAction}>{actionLabel}</Button>
      ) : null}
    </div>
  )
}
