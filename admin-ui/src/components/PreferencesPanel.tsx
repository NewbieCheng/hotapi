import type { PluginId } from '../types'
import type { ViewModePreference } from '../hooks/useViewMode'
import { PLUGINS } from '../permissions/definitions'
import { Button, Card, Select, TextField } from './ui'
import './PreferencesPanel.css'

interface PreferencesPanelProps {
  apiBase: string
  onApiBaseChange: (value: string) => void
  onSaveApiBase: () => void
  viewModePreference: ViewModePreference
  onViewModePreferenceChange: (pref: ViewModePreference) => void
  pageSize: number
  onPageSizeChange: (size: number) => void
  activePlugin: PluginId
  onClearGeneratePrefs: (plugin: PluginId) => void
  onLogout: () => void
}

export function PreferencesPanel({
  apiBase,
  onApiBaseChange,
  onSaveApiBase,
  viewModePreference,
  onViewModePreferenceChange,
  pageSize,
  onPageSizeChange,
  activePlugin,
  onClearGeneratePrefs,
  onLogout
}: PreferencesPanelProps) {
  return (
    <Card className="preferences-panel">
      <h2>偏好设置</h2>

      <section className="preferences-section">
        <h3>连接</h3>
        <TextField
          label="API 基址"
          value={apiBase}
          onChange={(e) => onApiBaseChange(e.target.value)}
          mono
        />
        <Button type="button" onClick={onSaveApiBase}>保存 API 基址</Button>
      </section>

      <section className="preferences-section">
        <h3>列表</h3>
        <Select
          label="默认视图"
          options={[
            { value: 'auto', label: '自动（手机卡片 / 桌面表格）' },
            { value: 'table', label: '表格' },
            { value: 'card', label: '卡片' }
          ]}
          value={viewModePreference}
          onChange={(e) => onViewModePreferenceChange(e.target.value as ViewModePreference)}
        />
        <Select
          label="每页条数"
          options={[5, 10, 20, 50].map((n) => ({ value: String(n), label: `${n} 条` }))}
          value={String(pageSize)}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
        />
      </section>

      <section className="preferences-section">
        <h3>生成默认值</h3>
        <p className="preferences-hint">
          当前插件：{PLUGINS[activePlugin].label}。清除后将恢复系统默认周期与权限。
        </p>
        <Button variant="ghost" type="button" onClick={() => onClearGeneratePrefs(activePlugin)}>
          重置 {PLUGINS[activePlugin].label} 生成偏好
        </Button>
      </section>

      <section className="preferences-section preferences-section--danger">
        <h3>会话</h3>
        <Button variant="danger" type="button" onClick={onLogout}>退出登录</Button>
      </section>
    </Card>
  )
}
