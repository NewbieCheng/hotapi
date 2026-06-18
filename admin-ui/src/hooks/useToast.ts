import { useCallback, useState } from 'react'

export function useToast() {
  const [message, setMessage] = useState('')
  const [tone, setTone] = useState<'success' | 'error'>('success')

  const showToast = useCallback((text: string, nextTone: 'success' | 'error' = 'success') => {
    setMessage(text)
    setTone(nextTone)
    window.setTimeout(() => setMessage(''), 2400)
  }, [])

  return { message, tone, showToast }
}
