import { Card, Button, TextField, Select } from './ui'
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
    <Card className="filter-bar">
      <TextField
        placeholder="激活码关键词"
        value={filters.key}
        onChange={(e) => onChange({ ...filters, key: e.target.value })}
      />
      <TextField
        placeholder="设备码"
        value={filters.device_id}
        onChange={(e) => onChange({ ...filters, device_id: e.target.value })}
      />
      <TextField
        placeholder="有效期天数"
        value={filters.duration_days}
        onChange={(e) => onChange({ ...filters, duration_days: e.target.value })}
      />
      <Select
        options={[
          { value: '', label: '全部状态' },
          { value: 'true', label: '已激活' },
          { value: 'false', label: '未激活' }
        ]}
        value={filters.is_used}
        onChange={(e) => onChange({ ...filters, is_used: e.target.value })}
      />
      <Button type="button" onClick={onSearch}>筛选</Button>
    </Card>
  )
}

export const EMPTY_FILTERS: ListFilters = {
  key: '',
  device_id: '',
  duration_days: '',
  is_used: ''
}
