import { Card } from './ui'
import './StatsBar.css'

interface StatsBarProps {
  total: number
  used: number
  unused: number
}

export function StatsBar({ total, used, unused }: StatsBarProps) {
  return (
    <div className="stats-bar">
      <Card className="stat-card">
        <p>激活码总数</p>
        <strong>{total}</strong>
      </Card>
      <Card className="stat-card">
        <p>已激活</p>
        <strong>{used}</strong>
      </Card>
      <Card className="stat-card">
        <p>待使用</p>
        <strong>{unused}</strong>
      </Card>
    </div>
  )
}
