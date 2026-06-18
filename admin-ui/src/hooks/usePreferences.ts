import { useCallback, useState } from 'react'
import type { GenerateMode, PluginId } from '../types'
import type { ViewModePreference } from './useViewMode'

const PAGE_SIZE_KEY = 'admin_prefs_page_size'
const VIEW_MODE_KEY = 'admin_prefs_view_mode'

export interface GeneratePrefs {
  duration: number
  mode: GenerateMode
}

function readPageSize(): number {
  const raw = Number(localStorage.getItem(PAGE_SIZE_KEY))
  return [5, 10, 20, 50].includes(raw) ? raw : 10
}

export function usePreferences() {
  const [pageSize, setPageSizeState] = useState(readPageSize)

  const setPageSize = useCallback((size: number) => {
    localStorage.setItem(PAGE_SIZE_KEY, String(size))
    setPageSizeState(size)
  }, [])

  const setViewModePreference = useCallback((pref: ViewModePreference) => {
    localStorage.setItem(VIEW_MODE_KEY, pref)
  }, [])

  const getViewModePreference = useCallback((): ViewModePreference => {
    const raw = localStorage.getItem(VIEW_MODE_KEY)
    if (raw === 'auto' || raw === 'table' || raw === 'card') return raw
    return 'auto'
  }, [])

  const loadGeneratePrefs = useCallback((plugin: PluginId): GeneratePrefs | null => {
    try {
      const raw = localStorage.getItem(`admin_prefs_generate_${plugin}`)
      if (!raw) return null
      return JSON.parse(raw) as GeneratePrefs
    } catch {
      return null
    }
  }, [])

  const saveGeneratePrefs = useCallback((plugin: PluginId, prefs: GeneratePrefs) => {
    localStorage.setItem(`admin_prefs_generate_${plugin}`, JSON.stringify(prefs))
  }, [])

  const clearGeneratePrefs = useCallback((plugin: PluginId) => {
    localStorage.removeItem(`admin_prefs_generate_${plugin}`)
  }, [])

  return {
    pageSize,
    setPageSize,
    setViewModePreference,
    getViewModePreference,
    loadGeneratePrefs,
    saveGeneratePrefs,
    clearGeneratePrefs
  }
}
