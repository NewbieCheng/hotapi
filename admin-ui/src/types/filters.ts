export type SortBy = 'created_at' | 'expires_at' | 'used_at' | 'duration_days'
export type SortOrder = 'asc' | 'desc'

export interface ListFilters {
  query: string
  key: string
  device_id: string
  duration_days: string
  is_used: string
  sort_by: SortBy
  sort_order: SortOrder
  expires_within_days: string
  expired_only: boolean
  permanent_only: boolean
}

export const EMPTY_FILTERS: ListFilters = {
  query: '',
  key: '',
  device_id: '',
  duration_days: '',
  is_used: '',
  sort_by: 'created_at',
  sort_order: 'desc',
  expires_within_days: '',
  expired_only: false,
  permanent_only: false
}

export type StatFilterKey = 'total' | 'used' | 'unused' | null

export function filtersToSearchParams(filters: ListFilters, base: URLSearchParams): URLSearchParams {
  const params = new URLSearchParams(base)
  const q = filters.query.trim()
  if (q) params.set('q', q)
  if (filters.duration_days && !filters.permanent_only) params.set('duration_days', filters.duration_days)
  if (filters.permanent_only) params.set('duration_days', '9999')
  if (filters.is_used) params.set('is_used', filters.is_used)
  if (filters.sort_by) params.set('sort_by', filters.sort_by)
  if (filters.sort_order) params.set('sort_order', filters.sort_order)
  if (filters.expires_within_days) params.set('expires_within_days', filters.expires_within_days)
  if (filters.expired_only) params.set('expired_only', 'true')
  return params
}

export function getActiveFilterLabels(filters: ListFilters): { id: string; label: string }[] {
  const pills: { id: string; label: string }[] = []
  if (filters.query) pills.push({ id: 'query', label: `搜索: ${filters.query}` })
  if (filters.is_used === 'false') pills.push({ id: 'is_used', label: '待使用' })
  if (filters.is_used === 'true') pills.push({ id: 'is_used', label: '已激活' })
  if (filters.expires_within_days) pills.push({ id: 'expires_within_days', label: `${filters.expires_within_days} 天内过期` })
  if (filters.expired_only) pills.push({ id: 'expired_only', label: '已过期' })
  if (filters.permanent_only) pills.push({ id: 'permanent_only', label: '永久卡' })
  if (filters.duration_days && !filters.permanent_only) pills.push({ id: 'duration_days', label: `${filters.duration_days} 天` })
  return pills
}

export function clearFilterById(filters: ListFilters, id: string): ListFilters {
  switch (id) {
    case 'query': return { ...filters, query: '' }
    case 'is_used': return { ...filters, is_used: '' }
    case 'expires_within_days': return { ...filters, expires_within_days: '' }
    case 'expired_only': return { ...filters, expired_only: false }
    case 'permanent_only': return { ...filters, permanent_only: false, duration_days: '' }
    case 'duration_days': return { ...filters, duration_days: '' }
    default: return filters
  }
}
