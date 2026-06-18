import './FilterBar.css'

export interface ListFilters {
  key: string
  device_id: string
  duration_days: string
  is_used: string
}

interface FilterBarProps {
  filters: ListFilters
  onChange: (next: ListFilters) => void
  onSearch: () => void
}

export function FilterBar({ filters, onChange, onSearch }: FilterBarProps) {
  return (
    <div className="filter-bar glass-card">
      <input
        className="input"
        placeholder="激活码关键词"
        value={filters.key}
        onChange={(e) => onChange({ ...filters, key: e.target.value })}
      />
      <input
        className="input"
        placeholder="设备码"
        value={filters.device_id}
        onChange={(e) => onChange({ ...filters, device_id: e.target.value })}
      />
      <input
        className="input"
        placeholder="有效期天数"
        value={filters.duration_days}
        onChange={(e) => onChange({ ...filters, duration_days: e.target.value })}
      />
      <select
        className="input"
        value={filters.is_used}
        onChange={(e) => onChange({ ...filters, is_used: e.target.value })}
      >
        <option value="">全部状态</option>
        <option value="true">已激活</option>
        <option value="false">未激活</option>
      </select>
      <button className="btn btn-primary" type="button" onClick={onSearch}>
        筛选
      </button>
    </div>
  )
}

export const EMPTY_FILTERS: ListFilters = {
  key: '',
  device_id: '',
  duration_days: '',
  is_used: ''
}
