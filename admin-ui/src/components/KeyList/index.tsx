import type { ListViewMode } from '../../hooks/useViewMode'
import type { ActivationKeyRow, PluginId } from '../../types'
import { KeyCardView } from './KeyCardView'
import { KeyTableView } from './KeyTableView'
import './KeyList.css'
import '../KeyDetailSheet.css'

interface KeyListProps {
  plugin: PluginId
  viewMode: ListViewMode
  rows: ActivationKeyRow[]
  selected: Set<string>
  onToggle: (id: string) => void
  onToggleAll: (checked: boolean) => void
  onCopy: (key: string) => void
  onEditPermissions: (row: ActivationKeyRow) => void
  onEditExpires: (row: ActivationKeyRow) => void
  onDelete: (id: string) => void
  onOpenDetail: (row: ActivationKeyRow) => void
}

export function KeyList({
  plugin,
  viewMode,
  rows,
  selected,
  onToggle,
  onToggleAll,
  onCopy,
  onEditPermissions,
  onEditExpires,
  onDelete,
  onOpenDetail
}: KeyListProps) {
  const shared = {
    plugin,
    rows,
    selected,
    onToggle,
    onToggleAll,
    onCopy,
    onEditPermissions,
    onEditExpires,
    onDelete,
    onOpenDetail
  }

  if (viewMode === 'card') {
    return <KeyCardView {...shared} />
  }
  return <KeyTableView {...shared} />
}
