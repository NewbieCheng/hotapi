import './StatsBar.css'

interface StatsBarProps {
  total: number
  used: number
  unused: number
}

export function StatsBar({ total, used, unused }: StatsBarProps) {
  return (
    <div className="stats-bar">
      <div className="stat-card glass-card">
        <p>激活码总数</p>
        <strong>{total}</strong>
      </div>
      <div className="stat-card glass-card">
        <p>已激活</p>
        <strong>{used}</strong>
      </div>
      <div className="stat-card glass-card">
        <p>待使用</p>
        <strong>{unused}</strong>
      </div>
    </div>
  )
}
