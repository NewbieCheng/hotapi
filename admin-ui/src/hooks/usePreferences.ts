import { useCallback, useState } from 'react'
import type { GenerateMode, PluginId } from '../types'
import type { ViewModePreference } from './useViewMode'

const PAGE_SIZE_KEY = 'admin_prefs_page_size'
const VIEW_MODE_KEY = 'admin_prefs_view_mode'
const ACTIVE_PLUGIN_KEY = 'admin_prefs_active_plugin'
const NAV_TAB_KEY = 'admin_prefs_nav_tab'

const PLUGIN_IDS: PluginId[] = ['flowx', 'cjzs', 'zhiliao', 'zhixiao']
export type NavTabPreference = 'list' | 'generate' | 'options'

function readActivePlugin(): PluginId {
  const raw = localStorage.getItem(ACTIVE_PLUGIN_KEY)
  return PLUGIN_IDS.includes(raw as PluginId) ? (raw as PluginId) : 'flowx'
}

function readNavTab(): NavTabPreference {
  const raw = localStorage.getItem(NAV_TAB_KEY)
  return raw === 'list' || raw === 'generate' || raw === 'options' ? raw : 'list'
}

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

  const setActivePlugin = useCallback((plugin: PluginId) => {
    localStorage.setItem(ACTIVE_PLUGIN_KEY, plugin)
  }, [])

  const setNavTab = useCallback((tab: NavTabPreference) => {
    localStorage.setItem(NAV_TAB_KEY, tab)
  }, [])

  return {
    pageSize,
    setPageSize,
    setViewModePreference,
    getViewModePreference,
    getActivePlugin: readActivePlugin,
    getNavTab: readNavTab,
    setActivePlugin,
    setNavTab,
    loadGeneratePrefs,
    saveGeneratePrefs,
    clearGeneratePrefs
  }
}
