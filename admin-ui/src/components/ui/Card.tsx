import type { HTMLAttributes, ReactNode } from 'react'
import './Card.css'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  glass?: boolean
}

export function Card({ children, glass = true, className = '', ...rest }: CardProps) {
  return (
    <div className={`ui-card ${glass ? 'ui-card--glass' : ''} ${className}`.trim()} {...rest}>
      {children}
    </div>
  )
}
