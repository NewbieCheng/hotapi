import type { PluginId } from '../types'
import {
  CJZS_PLATFORMS,
  FLOWX_CHANNELS,
  FLOWX_PERMISSIONS,
  buildCjzsPermissions,
  buildDesktopPermissions,
  buildFlowxPermissions,
  desktopPermissionDefs,
  desktopTemplate,
  isDesktopPlugin,
  parseCjzsPermissions,
  parseDesktopPermissions,
  parseFlowxPermissions
} from '../permissions/definitions'
import './PermissionBuilder.css'

export type PermissionState =
  | { kind: 'flowx'; values: Record<string, boolean>; channels: string[] }
  | { kind: 'cjzs'; channels: string[]; level: 'plus' | 'pro' | 'ultra' }
  | { kind: 'desktop'; values: Record<string, boolean>; level: 'plus' | 'pro' }

export function defaultPermissionState(plugin: PluginId): PermissionState {
  if (plugin === 'cjzs') {
    return { kind: 'cjzs', channels: CJZS_PLATFORMS.map((c) => c.key), level: 'plus' }
  }
  if (isDesktopPlugin(plugin)) {
    return { kind: 'desktop', values: desktopTemplate(plugin, 'all'), level: 'plus' }
  }
  return {
    kind: 'flowx',
    values: Object.fromEntries(FLOWX_PERMISSIONS.map((p) => [p.key, true])),
    channels: FLOWX_CHANNELS.map((c) => c.key)
  }
}

export function permissionStateFromRow(plugin: PluginId, raw: Record<string, unknown> | null): PermissionState {
  if (plugin === 'cjzs') {
    const parsed = parseCjzsPermissions(raw)
    return { kind: 'cjzs', channels: parsed.channels, level: parsed.level }
  }
  if (isDesktopPlugin(plugin)) {
    return { kind: 'desktop', values: parseDesktopPermissions(plugin, raw), level: 'plus' }
  }
  const parsed = parseFlowxPermissions(raw)
  return { kind: 'flowx', values: parsed.values, channels: parsed.channels }
}

export function permissionStateToPayload(plugin: PluginId, state: PermissionState): Record<string, unknown> | null {
  if (state.kind === 'cjzs') return buildCjzsPermissions(state.channels, state.level)
  if (state.kind === 'desktop') return buildDesktopPermissions(plugin, state.values, state.level)
  return buildFlowxPermissions(state.values, state.channels)
}

interface PermissionBuilderProps {
  plugin: PluginId
  state: PermissionState
  onChange: (next: PermissionState) => void
}

export function PermissionBuilder({ plugin, state, onChange }: PermissionBuilderProps) {
  if (state.kind === 'cjzs') {
    return (
      <div className="permission-builder">
        <div className="permission-templates">
          <button type="button" className="btn btn-ghost" onClick={() => onChange({ kind: 'cjzs', channels: CJZS_PLATFORMS.map((c) => c.key), level: 'plus' })}>全平台</button>
          <button type="button" className="btn btn-ghost" onClick={() => onChange({ kind: 'cjzs', channels: ['xiaohongshu', 'douyin', 'bilibili', 'kuaishou'], level: 'plus' })}>国内主流</button>
          <button type="button" className="btn btn-ghost" onClick={() => onChange({ kind: 'cjzs', channels: CJZS_PLATFORMS.map((c) => c.key), level: 'pro' })}>全平台 Pro</button>
        </div>
        <div className="permission-levels">
          {(['plus', 'pro', 'ultra'] as const).map((level) => (
            <label key={level} className="perm-chip">
              <input
                type="radio"
                name="cjzs-level"
                checked={state.level === level}
                onChange={() => onChange({ ...state, level })}
              />
              <span>{level.toUpperCase()}</span>
            </label>
          ))}
        </div>
        <div className="permission-grid">
          {CJZS_PLATFORMS.map((platform) => (
            <label key={platform.key} className="perm-toggle">
              <span>{platform.label}</span>
              <input
                type="checkbox"
                checked={state.channels.includes(platform.key)}
                onChange={(e) => {
                  const channels = e.target.checked
                    ? [...state.channels, platform.key]
                    : state.channels.filter((c) => c !== platform.key)
                  onChange({ ...state, channels })
                }}
              />
            </label>
          ))}
        </div>
      </div>
    )
  }

  if (state.kind === 'desktop') {
    const defs = desktopPermissionDefs(plugin)
    return (
      <div className="permission-builder">
        <div className="permission-templates">
          <button type="button" className="btn btn-ghost" onClick={() => onChange({ kind: 'desktop', values: desktopTemplate(plugin, 'all'), level: state.level })}>全开</button>
          <button type="button" className="btn btn-ghost" onClick={() => onChange({ kind: 'desktop', values: desktopTemplate(plugin, 'standard'), level: state.level })}>标准</button>
          <button type="button" className="btn btn-ghost" onClick={() => onChange({ kind: 'desktop', values: desktopTemplate(plugin, 'basic'), level: state.level })}>基础</button>
        </div>
        <div className="permission-levels">
          {(['plus', 'pro'] as const).map((level) => (
            <label key={level} className="perm-chip">
              <input
                type="radio"
                name="desktop-level"
                checked={state.level === level}
                onChange={() => onChange({ ...state, level })}
              />
              <span>{level.toUpperCase()}</span>
            </label>
          ))}
        </div>
        <div className="permission-grid">
          {defs.map((def) => (
            <label key={def.key} className="perm-toggle">
              <span>{def.label}</span>
              <input
                type="checkbox"
                checked={state.values[def.key] !== false}
                onChange={(e) => onChange({ ...state, values: { ...state.values, [def.key]: e.target.checked } })}
              />
            </label>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="permission-builder">
      <div className="permission-templates">
        <button type="button" className="btn btn-ghost" onClick={() => onChange({ kind: 'flowx', values: Object.fromEntries(FLOWX_PERMISSIONS.map((p) => [p.key, true])), channels: FLOWX_CHANNELS.map((c) => c.key) })}>旗舰全开</button>
        <button type="button" className="btn btn-ghost" onClick={() => onChange({ kind: 'flowx', values: { ai: true, cp: true, co: false, sy: true, ed: true, hr: false, bk: false, pl: false, fw: true }, channels: ['xiaohongshu', 'douyin', 'weixin', 'toutiao'] })}>标准基础</button>
      </div>
      <div className="permission-grid">
        {FLOWX_PERMISSIONS.map((def) => (
          <label key={def.key} className="perm-toggle">
            <span>{def.label}</span>
            <input
              type="checkbox"
              checked={state.values[def.key] !== false}
              onChange={(e) => onChange({ ...state, values: { ...state.values, [def.key]: e.target.checked } })}
            />
          </label>
        ))}
      </div>
      <p className="permission-section-title">分发渠道</p>
      <div className="permission-grid">
        {FLOWX_CHANNELS.map((channel) => (
          <label key={channel.key} className="perm-toggle">
            <span>{channel.label}</span>
            <input
              type="checkbox"
              checked={state.channels.includes(channel.key)}
              onChange={(e) => {
                const channels = e.target.checked
                  ? [...state.channels, channel.key]
                  : state.channels.filter((c) => c !== channel.key)
                onChange({ ...state, channels })
              }}
            />
          </label>
        ))}
      </div>
    </div>
  )
}
