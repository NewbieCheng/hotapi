import './Toast.css'

interface ToastProps {
  message: string
  tone?: 'success' | 'error'
}

export function Toast({ message, tone = 'success' }: ToastProps) {
  if (!message) return null
  return (
    <div className={`ui-toast ui-toast--${tone}`} role="status" aria-live="polite">
      {message}
    </div>
  )
}
