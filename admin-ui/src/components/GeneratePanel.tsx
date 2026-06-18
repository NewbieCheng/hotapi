import { useState } from 'react'
import type { GenerateMode, PluginId } from '../types'
import { PLUGINS } from '../permissions/definitions'
import {
  PermissionBuilder,
  defaultPermissionState,
  permissionStateToPayload,
  type PermissionState
} from './PermissionBuilder'
import './GeneratePanel.css'

const DURATIONS = [
  { label: '周卡', days: 7 },
  { label: '月卡', days: 30 },
  { label: '季卡', days: 90 },
  { label: '年卡', days: 365 },
  { label: '永久', days: 9999 }
]

interface GeneratePanelProps {
  plugin: PluginId
  onCreated: () => void
  onCreate: (payload: Record<string, unknown>) => Promise<void>
}

export function GeneratePanel({ plugin, onCreated, onCreate }: GeneratePanelProps) {
  const [mode, setMode] = useState<GenerateMode>('random')
  const [duration, setDuration] = useState(30)
  const [customDuration, setCustomDuration] = useState('')
  const [count, setCount] = useState(1)
  const [customKey, setCustomKey] = useState('')
  const [phone, setPhone] = useState('')
  const [phones, setPhones] = useState('')
  const [permissionState, setPermissionState] = useState<PermissionState>(() => defaultPermissionState(plugin))
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')

  const resolvedDuration = customDuration ? Number(customDuration) : duration
  const prefix = PLUGINS[plugin].prefix

  const submit = async (overrideCount?: number) => {
    setPending(true)
    setMessage('')
    try {
      const payload: Record<string, unknown> = {
        plugin,
        duration_days: resolvedDuration,
        permissions: permissionStateToPayload(plugin, permissionState)
      }

      if (mode === 'random') {
        payload.count = overrideCount ?? count
      } else if (mode === 'custom') {
        if (!customKey.trim()) throw new Error('请输入完整激活码')
        payload.key = customKey.trim().toUpperCase()
      } else {
        const batch = phones
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
        if (batch.length) payload.phones = batch
        else if (phone.trim()) payload.phone = phone.trim()
        else throw new Error('请输入手机号或批量列表')
      }

      await onCreate(payload)
      setMessage(overrideCount ? `已生成 ${overrideCount} 个激活码` : '生成成功')
      onCreated()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '生成失败')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="generate-panel glass-card">
      <div className="generate-header">
        <div>
          <h2>快捷生成</h2>
          <p>前缀 <span className="mono">{prefix}</span> · 批量上限 100</p>
        </div>
        <button className="btn btn-ghost" type="button" onClick={() => setPermissionState(defaultPermissionState(plugin))}>
          重置权限
        </button>
      </div>

      <div className="duration-grid">
        {DURATIONS.map((item) => (
          <button
            key={item.days}
            type="button"
            className={`duration-chip ${duration === item.days && !customDuration ? 'active' : ''}`}
            onClick={() => {
              setDuration(item.days)
              setCustomDuration('')
            }}
          >
            {item.label}
          </button>
        ))}
        <input
          className="input duration-custom"
          placeholder="自定义天数"
          value={customDuration}
          onChange={(e) => setCustomDuration(e.target.value)}
        />
      </div>

      <div className="mode-tabs">
        {([
          ['random', '随机批量'],
          ['custom', '自定义激活码'],
          ['phone', '前缀 + 手机号']
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`mode-tab ${mode === value ? 'active' : ''}`}
            onClick={() => setMode(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'random' ? (
        <div className="generate-fields">
          <label>
            批量数量
            <input className="input" type="number" min={1} max={100} value={count} onChange={(e) => setCount(Number(e.target.value))} />
          </label>
          <div className="quick-batch">
            <button className="btn btn-ghost" type="button" disabled={pending} onClick={() => void submit(20)}>
              一键生成 20 个
            </button>
          </div>
        </div>
      ) : null}

      {mode === 'custom' ? (
        <label>
          完整激活码
          <input
            className="input mono"
            value={customKey}
            onChange={(e) => setCustomKey(e.target.value.toUpperCase())}
            placeholder={`${prefix}-VIP-ZHANGSAN`}
          />
        </label>
      ) : null}

      {mode === 'phone' ? (
        <div className="generate-fields">
          <label>
            手机号
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="13800138000" />
          </label>
          <label>
            批量手机号（一行一个）
            <textarea className="input" rows={4} value={phones} onChange={(e) => setPhones(e.target.value)} />
          </label>
        </div>
      ) : null}

      <PermissionBuilder plugin={plugin} state={permissionState} onChange={setPermissionState} />

      {message ? <div className="generate-message">{message}</div> : null}

      <button className="btn btn-primary generate-submit" type="button" disabled={pending} onClick={() => void submit()}>
        {pending ? '生成中...' : '立即一键生成'}
      </button>
    </div>
  )
}
