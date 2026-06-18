import type { ReactNode } from 'react'
import './Alert.css'

type AlertTone = 'error' | 'success' | 'info'

interface AlertProps {
  children: ReactNode
  tone?: AlertTone
  onClose?: () => void
  className?: string
}

export function Alert({ children, tone = 'info', onClose, className = '' }: AlertProps) {
  return (
    <div className={`ui-alert ui-alert--${tone} ${className}`.trim()} role="alert">
      <span className="ui-alert__body">{children}</span>
      {onClose ? (
        <button type="button" className="ui-alert__close" onClick={onClose} aria-label="关闭">
          ×
        </button>
      ) : null}
    </div>
  )
}
