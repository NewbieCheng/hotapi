import './BottomNav.css'

export type NavTab = 'list' | 'generate' | 'options'

interface BottomNavProps {
  active: NavTab
  onChange: (tab: NavTab) => void
}

const ITEMS: { id: NavTab; label: string; icon: 'list' | 'generate' | 'settings' }[] = [
  { id: 'list', label: '列表', icon: 'list' },
  { id: 'generate', label: '生成', icon: 'generate' },
  { id: 'options', label: '设置', icon: 'settings' }
]

function NavIcon({ kind }: { kind: 'list' | 'generate' | 'settings' }) {
  if (kind === 'list') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    )
  }
  if (kind === 'generate') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4l1.4-1.4M17 7l1.4-1.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="主导航">
      {ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`bottom-nav__item${active === item.id ? ' bottom-nav__item--active' : ''}`}
          aria-current={active === item.id ? 'page' : undefined}
          onClick={() => onChange(item.id)}
        >
          <span className="bottom-nav__icon"><NavIcon kind={item.icon} /></span>
          <span className="bottom-nav__label">{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
