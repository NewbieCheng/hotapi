import type { ListViewMode, ViewModePreference } from '../hooks/useViewMode'
import './ViewModeToggle.css'

interface ViewModeToggleProps {
  preference: ViewModePreference
  resolvedMode: ListViewMode
  isMobile: boolean
  totalHint?: number
  onChange: (pref: ViewModePreference) => void
}

const SEGMENTS: { id: ViewModePreference; label: string; icon: 'auto' | 'table' | 'card' }[] = [
  { id: 'auto', label: '自动', icon: 'auto' },
  { id: 'table', label: '表格', icon: 'table' },
  { id: 'card', label: '卡片', icon: 'card' }
]

function SegmentIcon({ kind }: { kind: 'auto' | 'table' | 'card' }) {
  if (kind === 'auto') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <rect x="2" y="3" width="5" height="10" rx="1" stroke="currentColor" strokeWidth="1.4" />
        <rect x="9" y="3" width="5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
        <rect x="9" y="9.5" width="5" height="3.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    )
  }
  if (kind === 'table') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M6 4v8M10 4v8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2" y="2.5" width="12" height="4" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="2" y="9.5" width="12" height="4" rx="1" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

function resolvedLabel(resolvedMode: ListViewMode, isMobile: boolean, preference: ViewModePreference): string {
  const modeLabel = resolvedMode === 'card' ? '卡片视图' : '表格视图'
  if (preference === 'auto') {
    const device = isMobile ? '手机端' : '桌面端'
    return `当前显示：${modeLabel}（${device}自动）`
  }
  return `当前显示：${modeLabel}`
}

export function ViewModeToggle({
  preference,
  resolvedMode,
  isMobile,
  totalHint,
  onChange
}: ViewModeToggleProps) {
  return (
    <div className="view-mode-toggle-wrap">
      <div className="view-mode-toggle" role="group" aria-label="列表视图模式">
        {SEGMENTS.map((seg) => (
          <button
            key={seg.id}
            type="button"
            className="view-mode-toggle__btn"
            aria-pressed={preference === seg.id}
            onClick={() => onChange(seg.id)}
          >
            <SegmentIcon kind={seg.icon} />
            <span>{seg.label}</span>
          </button>
        ))}
      </div>
      <p className="view-mode-toggle__hint">
        {resolvedLabel(resolvedMode, isMobile, preference)}
        {typeof totalHint === 'number' ? ` · 本页 ${totalHint} 条` : ''}
      </p>
    </div>
  )
}
