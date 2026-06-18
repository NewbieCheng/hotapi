import { useState } from 'react'
import type { GenerateMode, PluginId } from '../types'
import { PLUGINS } from '../permissions/definitions'
import {
  PermissionBuilder,
  defaultPermissionState,
  permissionStateToPayload,
  type PermissionState
} from './PermissionBuilder'
import { Alert, Button, Card, Chip, TextArea, TextField } from './ui'
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
  const [messageTone, setMessageTone] = useState<'success' | 'error'>('success')

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
      setMessageTone('success')
      setMessage(overrideCount ? `已生成 ${overrideCount} 个激活码` : '生成成功')
      onCreated()
    } catch (e) {
      setMessageTone('error')
      setMessage(e instanceof Error ? e.message : '生成失败')
    } finally {
      setPending(false)
    }
  }

  return (
    <Card className="generate-panel">
      <div className="generate-header">
        <div>
          <h2>快捷生成</h2>
          <p>前缀 <span className="mono">{prefix}</span> · 批量上限 100</p>
        </div>
        <Button variant="ghost" type="button" onClick={() => setPermissionState(defaultPermissionState(plugin))}>
          重置权限
        </Button>
      </div>

      <Card className="generate-section">
        <h3 className="generate-section__title">会员周期</h3>
        <div className="duration-grid">
          {DURATIONS.map((item) => (
            <Chip
              key={item.days}
              active={duration === item.days && !customDuration}
              onClick={() => {
                setDuration(item.days)
                setCustomDuration('')
              }}
            >
              {item.label}
            </Chip>
          ))}
          <TextField
            className="duration-custom"
            placeholder="自定义天数"
            value={customDuration}
            onChange={(e) => setCustomDuration(e.target.value)}
          />
        </div>
      </Card>

      <Card className="generate-section">
        <h3 className="generate-section__title">生成方式</h3>
        <div className="mode-tabs">
          {([
            ['random', '随机批量'],
            ['custom', '自定义激活码'],
            ['phone', '前缀 + 手机号']
          ] as const).map(([value, label]) => (
            <Chip key={value} active={mode === value} onClick={() => setMode(value)}>
              {label}
            </Chip>
          ))}
        </div>

        {mode === 'random' ? (
          <div className="generate-fields">
            <TextField
              label="批量数量"
              type="number"
              min={1}
              max={100}
              value={String(count)}
              onChange={(e) => setCount(Number(e.target.value))}
            />
            <Button variant="ghost" type="button" disabled={pending} onClick={() => void submit(20)}>
              一键生成 20 个
            </Button>
          </div>
        ) : null}

        {mode === 'custom' ? (
          <TextField
            label="完整激活码"
            mono
            value={customKey}
            onChange={(e) => setCustomKey(e.target.value.toUpperCase())}
            placeholder={`${prefix}-VIP-ZHANGSAN`}
          />
        ) : null}

        {mode === 'phone' ? (
          <div className="generate-fields generate-fields--stack">
            <TextField
              label="手机号"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="13800138000"
            />
            <TextArea
              label="批量手机号（一行一个）"
              rows={4}
              value={phones}
              onChange={(e) => setPhones(e.target.value)}
            />
          </div>
        ) : null}
      </Card>

      <Card className="generate-section">
        <h3 className="generate-section__title">权限配置</h3>
        <PermissionBuilder plugin={plugin} state={permissionState} onChange={setPermissionState} />
      </Card>

      {message ? <Alert tone={messageTone === 'error' ? 'error' : 'success'}>{message}</Alert> : null}

      <Button className="generate-submit" type="button" loading={pending} onClick={() => void submit()}>
        立即一键生成
      </Button>
    </Card>
  )
}
