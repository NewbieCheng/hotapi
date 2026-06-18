import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  batchDelete,
  createKeys,
  deleteKey,
  getApiBase,
  listKeys,
  setApiBase,
  updateExpiresAt,
  updatePermissions
} from '../api/activationAdmin'
import type { ActivationKeyRow, PluginId } from '../types'
import { formatPluginNamesLine } from '../permissions/definitions'
import { PluginTabs } from '../components/PluginTabs'
import { StatsBar } from '../components/StatsBar'
import { FilterBar, EMPTY_FILTERS } from '../components/FilterBar'
import { KeyTable } from '../components/KeyTable'
import { GeneratePanel } from '../components/GeneratePanel'
import {
  PermissionBuilder,
  defaultPermissionState,
  permissionStateFromRow,
  permissionStateToPayload,
  type PermissionState
} from '../components/PermissionBuilder'
import { Alert, Button, Card, Chip, Modal, Select, TextField } from '../components/ui'
import './DashboardPage.css'

interface DashboardPageProps {
  onLogout: () => void
}

type SubTab = 'list' | 'generate' | 'options'

export function DashboardPage({ onLogout }: DashboardPageProps) {
  const [plugin, setPlugin] = useState<PluginId>('flowx')
  const [subTab, setSubTab] = useState<SubTab>('list')
  const [rows, setRows] = useState<ActivationKeyRow[]>([])
  const [total, setTotal] = useState(0)
  const [used, setUsed] = useState(0)
  const [unused, setUnused] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [apiBase, setApiBaseState] = useState(getApiBase())
  const [editingRow, setEditingRow] = useState<ActivationKeyRow | null>(null)
  const [modalType, setModalType] = useState<'permissions' | 'expires' | null>(null)
  const [editPermissionState, setEditPermissionState] = useState<PermissionState>(() => defaultPermissionState('flowx'))
  const [expiresInput, setExpiresInput] = useState('')
  const [toast, setToast] = useState('')

  useEffect(() => {
    document.documentElement.dataset.theme = plugin
  }, [plugin])

  const fetchList = useCallback(async (nextPage = page) => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: String(pageSize),
        plugin
      })
      if (filters.key) params.set('key', filters.key)
      if (filters.device_id) params.set('device_id', filters.device_id)
      if (filters.duration_days) params.set('duration_days', filters.duration_days)
      if (filters.is_used) params.set('is_used', filters.is_used)
      const result = await listKeys(params)
      setRows(result.data)
      setTotal(result.total)
      setUsed(result.used)
      setUnused(result.unused)
      setPage(result.page)
      setSelected(new Set())
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [filters, page, pageSize, plugin])

  useEffect(() => {
    void fetchList(1)
  }, [plugin, pageSize])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize])

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2400)
  }

  const copyText = async (text: string) => {
    await navigator.clipboard.writeText(text)
    showToast('已复制到剪贴板')
  }

  const copySelected = async () => {
    const keys = rows.filter((row) => selected.has(row.id)).map((row) => row.key)
    if (!keys.length) return showToast('请先选择激活码')
    await copyText(keys.join('\n'))
  }

  const handlePluginChange = (next: PluginId) => {
    setPlugin(next)
    setPage(1)
    setSubTab('list')
  }

  const openPermissionEditor = (row: ActivationKeyRow) => {
    setEditingRow(row)
    setModalType('permissions')
    setEditPermissionState(permissionStateFromRow(plugin, row.permissions))
  }

  const openExpiresEditor = (row: ActivationKeyRow) => {
    setEditingRow(row)
    setModalType('expires')
    setExpiresInput(row.expires_at ? row.expires_at.slice(0, 16) : '')
  }

  const closeModal = () => {
    setEditingRow(null)
    setModalType(null)
  }

  const savePermissions = async () => {
    if (!editingRow) return
    await updatePermissions(editingRow.id, plugin, permissionStateToPayload(plugin, editPermissionState))
    closeModal()
    showToast('权限已更新')
    void fetchList(page)
  }

  const saveExpires = async () => {
    if (!editingRow || !expiresInput) return
    const iso = new Date(expiresInput).toISOString()
    await updateExpiresAt(editingRow.id, iso)
    closeModal()
    showToast('过期时间已更新')
    void fetchList(page)
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('确认删除该激活码？')) return
    await deleteKey(id)
    showToast('已删除')
    void fetchList(page)
  }

  const handleBatchDelete = async () => {
    const ids = [...selected]
    if (!ids.length) return showToast('请先选择记录')
    if (!window.confirm(`确认删除选中的 ${ids.length} 条记录？`)) return
    await batchDelete(ids)
    showToast('批量删除完成')
    void fetchList(page)
  }

  const saveOptions = () => {
    setApiBase(apiBase.trim())
    showToast('系统选项已保存')
  }

  return (
    <div className="dashboard-page">
      <Card className="dashboard-top">
        <div>
          <h1>激活码管理控制台</h1>
          <p>{formatPluginNamesLine()} · 批量编排 · 权限预置</p>
        </div>
        <div className="dashboard-top-actions">
          <Button variant="ghost" type="button" onClick={() => void fetchList(page)} disabled={loading}>
            刷新
          </Button>
          <Button variant="danger" type="button" onClick={onLogout}>退出</Button>
        </div>
      </Card>

      <PluginTabs active={plugin} onChange={handlePluginChange} />
      <StatsBar total={total} used={used} unused={unused} />

      <div className="sub-tabs" role="tablist" aria-label="控制台分区">
        {([
          ['list', '密钥列表'],
          ['generate', '快捷生成'],
          ['options', '系统选项']
        ] as const).map(([id, label]) => (
          <Chip key={id} active={subTab === id} onClick={() => setSubTab(id)}>
            {label}
          </Chip>
        ))}
      </div>

      {subTab === 'list' ? (
        <section className="dashboard-section">
          <FilterBar filters={filters} onChange={setFilters} onSearch={() => void fetchList(1)} />
          <div className="list-toolbar">
            <Button type="button" onClick={() => void copySelected()}>
              复制 {selected.size} 个激活码
            </Button>
            <Button variant="danger" type="button" onClick={() => void handleBatchDelete()}>
              批量删除
            </Button>
            <div className="list-pagination">
              <Select
                className="list-page-size"
                options={[5, 10, 20, 50].map((size) => ({ value: String(size), label: `${size} 条/页` }))}
                value={String(pageSize)}
                onChange={(e) => setPageSize(Number(e.target.value))}
              />
              <Button variant="ghost" type="button" disabled={page <= 1} onClick={() => void fetchList(page - 1)}>上一页</Button>
              <span>{page} / {totalPages}</span>
              <Button variant="ghost" type="button" disabled={page >= totalPages} onClick={() => void fetchList(page + 1)}>下一页</Button>
            </div>
          </div>
          {error ? <Alert tone="error">{error}</Alert> : null}
          <KeyTable
            plugin={plugin}
            rows={rows}
            selected={selected}
            onToggle={(id) => {
              setSelected((prev) => {
                const next = new Set(prev)
                if (next.has(id)) next.delete(id)
                else next.add(id)
                return next
              })
            }}
            onToggleAll={(checked) => {
              setSelected(checked ? new Set(rows.map((row) => row.id)) : new Set())
            }}
            onCopy={(key) => void copyText(key)}
            onEditPermissions={openPermissionEditor}
            onEditExpires={openExpiresEditor}
            onDelete={(id) => void handleDelete(id)}
          />
        </section>
      ) : null}

      {subTab === 'generate' ? (
        <GeneratePanel
          plugin={plugin}
          onCreated={() => {
            setSubTab('list')
            void fetchList(1)
          }}
          onCreate={async (payload) => {
            await createKeys(payload)
          }}
        />
      ) : null}

      {subTab === 'options' ? (
        <Card className="options-panel">
          <h2>系统选项</h2>
          <TextField
            label="API 基址"
            value={apiBase}
            onChange={(e) => setApiBaseState(e.target.value)}
            mono
          />
          <Button type="button" onClick={saveOptions}>保存</Button>
        </Card>
      ) : null}

      <Modal
        open={Boolean(editingRow && modalType === 'expires')}
        title="编辑过期时间"
        subtitle={editingRow?.key}
        onClose={closeModal}
        footer={(
          <>
            <Button variant="ghost" type="button" onClick={closeModal}>取消</Button>
            <Button type="button" onClick={() => void saveExpires()}>保存</Button>
          </>
        )}
      >
        <TextField
          type="datetime-local"
          value={expiresInput}
          onChange={(e) => setExpiresInput(e.target.value)}
        />
      </Modal>

      <Modal
        open={Boolean(editingRow && modalType === 'permissions')}
        title="编辑权限"
        subtitle={editingRow?.key}
        wide
        onClose={closeModal}
        footer={(
          <>
            <Button variant="ghost" type="button" onClick={closeModal}>取消</Button>
            <Button type="button" onClick={() => void savePermissions()}>保存</Button>
          </>
        )}
      >
        <PermissionBuilder plugin={plugin} state={editPermissionState} onChange={setEditPermissionState} />
      </Modal>

      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </div>
  )
}
