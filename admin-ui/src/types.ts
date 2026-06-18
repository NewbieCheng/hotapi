export type PluginId = 'flowx' | 'cjzs' | 'zhiliao' | 'zhixiao'

export interface ActivationKeyRow {
  id: string
  key: string
  duration_days: number
  is_used: boolean
  used_at: string | null
  expires_at: string | null
  device_id: string | null
  permissions: Record<string, unknown> | null
  note?: string | null
  created_at?: string
}

export interface ListResponse {
  data: ActivationKeyRow[]
  total: number
  used: number
  unused: number
  page: number
  pageSize: number
  plugin: string
}

export type GenerateMode = 'random' | 'custom' | 'phone'

export interface PluginConfig {
  id: PluginId
  label: string
  prefix: string
  tagline: string
}
