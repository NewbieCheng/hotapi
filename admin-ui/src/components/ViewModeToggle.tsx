import type { ListViewMode } from '../hooks/useViewMode'
import './ViewModeToggle.css'

interface ViewModeToggleProps {
  mode: ListViewMode
  onChange: (mode: ListViewMode) => void
}

export function ViewModeToggle({ mode, onChange }: ViewModeToggleProps) {
  return (
    <div className="view-mode-toggle" role="group" aria-label="列表视图">
      <button
        type="button"
        className="view-mode-toggle__btn"
        aria-pressed={mode === 'table'}
        onClick={() => onChange('table')}
      >
        <span className="view-mode-toggle__icon" aria-hidden>☰</span>
        表格
      </button>
      <button
        type="button"
        className="view-mode-toggle__btn"
        aria-pressed={mode === 'card'}
        onClick={() => onChange('card')}
      >
        <span className="view-mode-toggle__icon" aria-hidden>▦</span>
        卡片
      </button>
    </div>
  )
}
