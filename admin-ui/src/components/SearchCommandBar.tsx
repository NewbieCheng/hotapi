import { useEffect, useRef, useState } from 'react'
import type { ListFilters } from '../types/filters'
import { clearFilterById, getActiveFilterLabels } from '../types/filters'
import { Button, Card, Chip, Select, TextField } from './ui'
import './SearchCommandBar.css'

interface SearchCommandBarProps {
  filters: ListFilters
  onChange: (next: ListFilters) => void
  onSearch: () => void
  activeStat?: 'total' | 'used' | 'unused' | null
}

const QUICK_CHIPS: { id: string; label: string; apply: (f: ListFilters) => ListFilters }[] = [
  { id: 'unused', label: '待使用', apply: (f) => ({ ...f, is_used: 'false', expired_only: false }) },
  { id: 'used', label: '已激活', apply: (f) => ({ ...f, is_used: 'true' }) },
  { id: 'expiring', label: '7 天内过期', apply: (f) => ({ ...f, expires_within_days: '7', expired_only: false }) },
  { id: 'expired', label: '已过期', apply: (f) => ({ ...f, expired_only: true, expires_within_days: '' }) },
  { id: 'permanent', label: '永久卡', apply: (f) => ({ ...f, permanent_only: true, duration_days: '9999' }) }
]

function isChipActive(filters: ListFilters, id: string): boolean {
  switch (id) {
    case 'unused': return filters.is_used === 'false'
    case 'used': return filters.is_used === 'true'
    case 'expiring': return filters.expires_within_days === '7'
    case 'expired': return filters.expired_only
    case 'permanent': return filters.permanent_only
    default: return false
  }
}

export function SearchCommandBar({ filters, onChange, onSearch, activeStat }: SearchCommandBarProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const pills = getActiveFilterLabels(filters)
  const onSearchRef = useRef(onSearch)
  onSearchRef.current = onSearch

  useEffect(() => {
    const timer = window.setTimeout(() => onSearchRef.current(), 300)
    return () => window.clearTimeout(timer)
  }, [filters])

  const toggleChip = (chip: typeof QUICK_CHIPS[number]) => {
    if (isChipActive(filters, chip.id)) {
      if (chip.id === 'unused' || chip.id === 'used') onChange({ ...filters, is_used: '' })
      else if (chip.id === 'expiring') onChange({ ...filters, expires_within_days: '' })
      else if (chip.id === 'expired') onChange({ ...filters, expired_only: false })
      else if (chip.id === 'permanent') onChange({ ...filters, permanent_only: false, duration_days: '' })
    } else {
      onChange(chip.apply(filters))
    }
  }

  return (
    <Card className="search-command-bar">
      <div className="search-command-bar__main">
        <TextField
          className="search-command-bar__input"
          placeholder="搜索激活码或设备码…"
          value={filters.query}
          onChange={(e) => onChange({ ...filters, query: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSearch()
          }}
        />
        <Button variant="ghost" type="button" onClick={() => setAdvancedOpen((v) => !v)}>
          {advancedOpen ? '收起' : '更多筛选'}
        </Button>
      </div>

      <div className="search-command-bar__chips">
        {QUICK_CHIPS.map((chip) => (
          <Chip
            key={chip.id}
            active={isChipActive(filters, chip.id) || (chip.id === 'used' && activeStat === 'used') || (chip.id === 'unused' && activeStat === 'unused')}
            onClick={() => toggleChip(chip)}
          >
            {chip.label}
          </Chip>
        ))}
      </div>

      {advancedOpen ? (
        <div className="search-command-bar__advanced">
          <TextField
            placeholder="有效期天数"
            value={filters.duration_days}
            onChange={(e) => onChange({ ...filters, duration_days: e.target.value, permanent_only: false })}
          />
          <Select
            options={[
              { value: '', label: '全部状态' },
              { value: 'true', label: '已激活' },
              { value: 'false', label: '待使用' }
            ]}
            value={filters.is_used}
            onChange={(e) => onChange({ ...filters, is_used: e.target.value })}
          />
          <Select
            options={[
              { value: 'created_at', label: '创建时间' },
              { value: 'expires_at', label: '过期时间' },
              { value: 'used_at', label: '激活时间' },
              { value: 'duration_days', label: '有效期' }
            ]}
            value={filters.sort_by}
            onChange={(e) => onChange({ ...filters, sort_by: e.target.value as ListFilters['sort_by'] })}
          />
          <Select
            options={[
              { value: 'desc', label: '降序' },
              { value: 'asc', label: '升序' }
            ]}
            value={filters.sort_order}
            onChange={(e) => onChange({ ...filters, sort_order: e.target.value as ListFilters['sort_order'] })}
          />
        </div>
      ) : null}

      {pills.length ? (
        <div className="search-command-bar__pills">
          {pills.map((pill) => (
            <button
              key={pill.id}
              type="button"
              className="search-command-bar__pill"
              onClick={() => onChange(clearFilterById(filters, pill.id))}
            >
              {pill.label} ×
            </button>
          ))}
          <button
            type="button"
            className="search-command-bar__pill search-command-bar__pill--clear"
            onClick={() => onChange({
              ...filters,
              query: '',
              key: '',
              device_id: '',
              duration_days: '',
              is_used: '',
              expires_within_days: '',
              expired_only: false,
              permanent_only: false
            })}
          >
            清空全部
          </button>
        </div>
      ) : null}
    </Card>
  )
}
