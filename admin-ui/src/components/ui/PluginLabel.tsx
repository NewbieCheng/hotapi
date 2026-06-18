import type { PluginConfig } from '../../permissions/definitions'
import './PluginLabel.css'

interface PluginLabelProps {
  config: Pick<PluginConfig, 'label' | 'formerName'>
  size?: 'sm' | 'md'
  layout?: 'inline' | 'stack'
}

export function PluginLabel({ config, size = 'md', layout = 'stack' }: PluginLabelProps) {
  return (
    <span className={`ui-plugin-label ui-plugin-label--${size} ui-plugin-label--${layout}`}>
      <span className="ui-plugin-label__name">{config.label}</span>
      {config.formerName ? (
        <span className="ui-plugin-label__former">原 {config.formerName}</span>
      ) : null}
    </span>
  )
}
