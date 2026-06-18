import { useCallback, useEffect, useMemo, useState } from 'react'

export type ListViewMode = 'table' | 'card'
export type ViewModePreference = 'auto' | ListViewMode

const STORAGE_KEY = 'admin_prefs_view_mode'
const MOBILE_QUERY = '(max-width: 768px)'

function readPreference(): ViewModePreference {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw === 'table' || raw === 'card' || raw === 'auto') return raw
  return 'auto'
}

export function useViewMode() {
  const [preference, setPreferenceState] = useState<ViewModePreference>(readPreference)
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches)

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY)
    const onChange = () => setIsMobile(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const resolvedMode: ListViewMode = useMemo(() => {
    if (preference === 'table' || preference === 'card') return preference
    return isMobile ? 'card' : 'table'
  }, [preference, isMobile])

  const setPreference = useCallback((next: ViewModePreference) => {
    localStorage.setItem(STORAGE_KEY, next)
    setPreferenceState(next)
  }, [])

  const toggleMode = useCallback(() => {
    const next: ListViewMode = resolvedMode === 'table' ? 'card' : 'table'
    setPreference(next)
  }, [resolvedMode, setPreference])

  return { preference, resolvedMode, isMobile, setPreference, toggleMode }
}
