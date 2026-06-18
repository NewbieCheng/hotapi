import type { ReactNode } from 'react'
import './Badge.css'

type BadgeTone = 'default' | 'success' | 'warning' | 'danger'

interface BadgeProps {
  children: ReactNode
  tone?: BadgeTone
  className?: string
}

export function Badge({ children, tone = 'default', className = '' }: BadgeProps) {
  return <span className={`ui-badge ui-badge--${tone} ${className}`.trim()}>{children}</span>
}

interface ChipProps {
  children: ReactNode
  active?: boolean
  onClick?: () => void
  className?: string
}

export function Chip({ children, active = false, onClick, className = '' }: ChipProps) {
  const Tag = onClick ? 'button' : 'span'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`ui-chip ${active ? 'ui-chip--active' : ''} ${className}`.trim()}
      onClick={onClick}
    >
      {children}
    </Tag>
  )
}
