import { useEffect, useRef } from 'react'
import type { PluginId } from '../types'
import { PLUGINS } from '../permissions/definitions'
import './PluginTabs.css'

interface PluginTabsProps {
  active: PluginId
  onChange: (plugin: PluginId) => void
  compact?: boolean
}

const ORDER: PluginId[] = ['flowx', 'cjzs', 'zhiliao', 'zhixiao']

export function PluginTabs({ active, onChange, compact = false }: PluginTabsProps) {
  const activeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [active])

  return (
    <div className={`plugin-tabs-wrap${compact ? ' plugin-tabs-wrap--compact' : ''}`}>
      <div className="plugin-tabs" role="tablist" aria-label="产品插件">
        {ORDER.map((id) => {
          const cfg = PLUGINS[id]
          const isActive = active === id
          return (
            <button
              key={id}
              ref={isActive ? activeRef : undefined}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`plugin-tab ${isActive ? 'active' : ''}`}
              onClick={() => onChange(id)}
            >
              <span className="plugin-tab__label">{cfg.label}</span>
              {!compact ? <span className="plugin-tab-tag">{cfg.tagline}</span> : null}
            </button>
          )
        })}
      </div>
      {compact ? <p className="plugin-tabs-scroll-hint">左右滑动切换产品</p> : null}
    </div>
  )
}
