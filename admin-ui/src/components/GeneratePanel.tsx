import { useEffect, useMemo, useState } from 'react'
import type { ActivationKeyRow, GenerateMode, PluginId } from '../types'
import type { GeneratePrefs } from '../hooks/usePreferences'
import {
  CJZS_PLATFORMS,
  FLOWX_PERMISSIONS,
  PLUGINS,
  desktopPermissionDefs
} from '../permissions/definitions'
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

const PHONE_RE = /^1[3-9]\d{9}$/

function permissionSummaryText(plugin: PluginId, state: PermissionState): string {
  if (state.kind === 'cjzs') {
    return `已开 ${state.channels.length}/${CJZS_PLATFORMS.length} 平台 · 等级 ${state.level}`
  }
  if (state.kind === 'desktop') {
    const defs = desktopPermissionDefs(plugin)
    const enabled = defs.filter((d) => state.values[d.key]).length
    return `已开 ${enabled}/${defs.length} 项 · 等级 ${state.level}`
  }
  const enabled = FLOWX_PERMISSIONS.filter((p) => state.values[p.key]).length
  return `已开 ${enabled}/${FLOWX_PERMISSIONS.length} 项`
}

interface GeneratePanelProps {
  plugin: PluginId
  collapsedPermissions?: boolean
  onCreated: (keys: ActivationKeyRow[]) => void
  onCreate: (payload: Record<string, unknown>) => Promise<ActivationKeyRow[]>
  savedPrefs?: GeneratePrefs | null
  onSavePrefs?: (prefs: GeneratePrefs) => void
}

export function GeneratePanel({
  plugin,
  collapsedPermissions = false,
  onCreated,
  onCreate,
  savedPrefs,
  onSavePrefs
}: GeneratePanelProps) {
  const [mode, setMode] = useState<GenerateMode>(savedPrefs?.mode ?? 'random')
  const [duration, setDuration] = useState(savedPrefs?.duration ?? 30)
  const [customDuration, setCustomDuration] = useState('')
  const [count, setCount] = useState(1)
  const [customKey, setCustomKey] = useState('')
  const [phone, setPhone] = useState('')
  const [phones, setPhones] = useState('')
  const [permissionState, setPermissionState] = useState<PermissionState>(() => defaultPermissionState(plugin))
  const [permissionsOpen, setPermissionsOpen] = useState(!collapsedPermissions)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState<'success' | 'error'>('success')

  useEffect(() => {
    setPermissionState(defaultPermissionState(plugin))
    if (savedPrefs) {
      setMode(savedPrefs.mode)
      setDuration(savedPrefs.duration)
    } else {
      setMode('random')
      setDuration(30)
    }
    setCustomDuration('')
    setCustomKey('')
    setPhone('')
    setPhones('')
    setPermissionsOpen(!collapsedPermissions)
  }, [plugin, savedPrefs, collapsedPermissions])

  const resolvedDuration = customDuration ? Number(customDuration) : duration
  const prefix = PLUGINS[plugin].prefix
  const permSummary = useMemo(() => permissionSummaryText(plugin, permissionState), [plugin, permissionState])

  const phoneError = phone.trim() && !PHONE_RE.test(phone.trim()) ? '请输入 11 位大陆手机号' : ''
  const customKeyWarning = customKey.trim() && !customKey.trim().toUpperCase().startsWith(prefix)
    ? `建议使用 ${prefix} 前缀`
    : ''

  const persistPrefs = () => {
    onSavePrefs?.({ mode, duration: resolvedDuration })
  }

  const submit = async (overrideCount?: number) => {
    setPending(true)
    setMessage('')
    try {
      if (mode === 'phone' && phone.trim() && !PHONE_RE.test(phone.trim())) {
        throw new Error('请输入有效的 11 位大陆手机号')
      }

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
        if (batch.length) {
          const invalid = batch.find((p) => !PHONE_RE.test(p))
          if (invalid) throw new Error(`无效手机号: ${invalid}`)
          payload.phones = batch
        } else if (phone.trim()) {
          payload.phone = phone.trim()
        } else throw new Error('请输入手机号或批量列表')
      }

      persistPrefs()
      const created = await onCreate(payload)
      setMessageTone('success')
      setMessage(overrideCount ? `已生成 ${overrideCount} 个激活码` : '生成成功')
      onCreated(created)
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

      <div className="generate-perm-summary">{permSummary}</div>

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
          <>
            <TextField
              label="完整激活码"
              mono
              value={customKey}
              onChange={(e) => setCustomKey(e.target.value.toUpperCase())}
              placeholder={`${prefix}-VIP-ZHANGSAN`}
            />
            {customKeyWarning ? <p className="generate-inline-hint">{customKeyWarning}</p> : null}
          </>
        ) : null}

        {mode === 'phone' ? (
          <div className="generate-fields generate-fields--stack">
            <TextField
              label="手机号"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="13800138000"
              error={phoneError}
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
        <button
          type="button"
          className="generate-section__toggle"
          onClick={() => setPermissionsOpen((v) => !v)}
          aria-expanded={permissionsOpen}
        >
          <h3 className="generate-section__title">权限配置</h3>
          <span>{permissionsOpen ? '收起' : '展开'}</span>
        </button>
        {permissionsOpen ? (
          <PermissionBuilder plugin={plugin} state={permissionState} onChange={setPermissionState} />
        ) : null}
      </Card>

      {message ? <Alert tone={messageTone === 'error' ? 'error' : 'success'}>{message}</Alert> : null}

      <Button className="generate-submit" type="button" loading={pending} onClick={() => void submit()}>
        立即一键生成
      </Button>
    </Card>
  )
}
