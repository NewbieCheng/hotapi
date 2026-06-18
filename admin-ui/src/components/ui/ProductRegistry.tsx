import type { CSSProperties } from 'react'
import type { PluginId } from '../../types'
import { PLUGINS } from '../../permissions/definitions'
import { PluginLabel } from './PluginLabel'
import './ProductRegistry.css'

const ORDER: PluginId[] = ['flowx', 'cjzs', 'zhiliao', 'zhixiao']

const ACCENT: Record<PluginId, string> = {
  flowx: '#7c6fe8',
  cjzs: '#2f8f6b',
  zhiliao: '#8b7355',
  zhixiao: '#b84332'
}

export function ProductRegistry() {
  return (
    <div className="ui-registry" aria-label="四产品注册带">
      {ORDER.map((id, index) => {
        const cfg = PLUGINS[id]
        return (
          <div
            key={id}
            className="ui-registry__seal"
            style={{ '--seal-accent': ACCENT[id], animationDelay: `${index * 80}ms` } as CSSProperties}
          >
            <span className="ui-registry__mark" aria-hidden="true">{cfg.label.slice(0, 1)}</span>
            <PluginLabel config={cfg} size="sm" layout="stack" />
            <span className="ui-registry__tag">{cfg.tagline}</span>
          </div>
        )
      })}
    </div>
  )
}
