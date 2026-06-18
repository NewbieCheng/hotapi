import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button'
import { Card } from './Card'
import './Modal.css'

interface ModalProps {
  open: boolean
  title: string
  subtitle?: string
  wide?: boolean
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

export function Modal({ open, title, subtitle, wide = false, onClose, children, footer }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="ui-modal-backdrop" onClick={onClose} role="presentation">
      <Card
        className={`ui-modal ${wide ? 'ui-modal--wide' : ''}`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ui-modal-title"
      >
        <h3 id="ui-modal-title" className="ui-modal__title">{title}</h3>
        {subtitle ? <p className="ui-modal__subtitle mono">{subtitle}</p> : null}
        <div className="ui-modal__body">{children}</div>
        {footer ? (
          <div className="ui-modal__footer">{footer}</div>
        ) : (
          <div className="ui-modal__footer">
            <Button variant="ghost" onClick={onClose}>取消</Button>
          </div>
        )}
      </Card>
    </div>,
    document.body
  )
}
