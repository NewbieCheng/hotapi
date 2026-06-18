import type { PluginId } from '../types'
import { PLUGINS } from '../permissions/definitions'
import { PluginLabel } from './ui/PluginLabel'
import './PluginTabs.css'

interface PluginTabsProps {
  active: PluginId
  onChange: (plugin: PluginId) => void
}

const ORDER: PluginId[] = ['flowx', 'cjzs', 'zhiliao', 'zhixiao']

export function PluginTabs({ active, onChange }: PluginTabsProps) {
  return (
    <div className="plugin-tabs-wrap">
      <div className="plugin-tabs" role="tablist" aria-label="产品插件">
      {ORDER.map((id) => {
        const cfg = PLUGINS[id]
        const isActive = active === id
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`plugin-tab ${isActive ? 'active' : ''}`}
            onClick={() => onChange(id)}
          >
            <PluginLabel config={cfg} size="md" layout="stack" />
            <span className="plugin-tab-tag">{cfg.tagline}</span>
          </button>
        )
      })}
      </div>
    </div>
  )
}
