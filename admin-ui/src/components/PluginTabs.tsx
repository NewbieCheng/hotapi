import type { PluginId } from '../types'
import { PLUGINS } from '../permissions/definitions'
import './PluginTabs.css'

interface PluginTabsProps {
  active: PluginId
  onChange: (plugin: PluginId) => void
}

const ORDER: PluginId[] = ['flowx', 'cjzs', 'zhiliao', 'zhixiao']

export function PluginTabs({ active, onChange }: PluginTabsProps) {
  return (
    <div className="plugin-tabs">
      {ORDER.map((id) => {
        const cfg = PLUGINS[id]
        return (
          <button
            key={id}
            type="button"
            className={`plugin-tab ${active === id ? 'active' : ''}`}
            onClick={() => onChange(id)}
          >
            <span className="plugin-tab-label">{cfg.label}</span>
            <span className="plugin-tab-tag">{cfg.tagline}</span>
          </button>
        )
      })}
    </div>
  )
}
