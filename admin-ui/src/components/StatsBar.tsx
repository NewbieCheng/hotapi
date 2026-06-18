import { Card } from './ui'
import './StatsBar.css'

interface StatsBarProps {
  total: number
  used: number
  unused: number
}

const ITEMS = [
  { key: 'total' as const, label: '激活码总数', tone: 'total' as const },
  { key: 'used' as const, label: '已激活', tone: 'used' as const },
  { key: 'unused' as const, label: '待使用', tone: 'unused' as const }
]

export function StatsBar({ total, used, unused }: StatsBarProps) {
  const values = { total, used, unused }

  return (
    <div className="stats-bar">
      {ITEMS.map((item) => (
        <Card key={item.key} className={`stat-card stat-card--${item.tone}`}>
          <span className="stat-card__icon" aria-hidden="true" />
          <div className="stat-card__body">
            <p>{item.label}</p>
            <strong>{values[item.key]}</strong>
          </div>
        </Card>
      ))}
    </div>
  )
}
