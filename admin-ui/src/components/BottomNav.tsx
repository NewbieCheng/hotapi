import './BottomNav.css'

export type NavTab = 'list' | 'generate' | 'options'

interface BottomNavProps {
  active: NavTab
  onChange: (tab: NavTab) => void
}

const ITEMS: { id: NavTab; label: string; icon: string }[] = [
  { id: 'list', label: '列表', icon: '☰' },
  { id: 'generate', label: '生成', icon: '＋' },
  { id: 'options', label: '设置', icon: '⚙' }
]

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
          <span className="bottom-nav__icon" aria-hidden>{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
