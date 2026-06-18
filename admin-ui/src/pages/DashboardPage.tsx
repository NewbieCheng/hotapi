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
import { EMPTY_FILTERS, filtersToSearchParams, type ListFilters } from '../types/filters'
import { formatPluginNamesLine, PLUGINS } from '../permissions/definitions'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { usePreferences } from '../hooks/usePreferences'
import { useToast } from '../hooks/useToast'
import { useViewMode, type ViewModePreference } from '../hooks/useViewMode'
import { PluginTabs } from '../components/PluginTabs'
import { StatsBar } from '../components/StatsBar'
import { SearchCommandBar } from '../components/SearchCommandBar'
import { KeyList } from '../components/KeyList'
import { ViewModeToggle } from '../components/ViewModeToggle'
import { GeneratePanel } from '../components/GeneratePanel'
import { CreateResultDrawer } from '../components/CreateResultDrawer'
import { KeyDetailSheet } from '../components/KeyDetailSheet'
import { BottomNav, type NavTab } from '../components/BottomNav'
import { PreferencesPanel } from '../components/PreferencesPanel'
import {
  PermissionBuilder,
  permissionStateFromRow,
  permissionStateToPayload,
  type PermissionState,
  defaultPermissionState
} from '../components/PermissionBuilder'
import { Alert, Button, Card, Chip, Modal, Select, TextField, Toast, EmptyState } from '../components/ui'
import { ListSkeleton, StatsSkeleton } from '../components/ui/Skeleton'
import './DashboardPage.css'

interface DashboardPageProps {
  onLogout: () => void
}

function exportTxt(keys: string[], filename = 'activation-keys.txt') {
  const content = keys.join('\n')
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function DashboardPage({ onLogout }: DashboardPageProps) {
  const [plugin, setPlugin] = useState<PluginId>('flowx')
  const [subTab, setSubTab] = useState<NavTab>('list')
  const [rows, setRows] = useState<ActivationKeyRow[]>([])
  const [total, setTotal] = useState(0)
  const [used, setUsed] = useState(0)
  const [unused, setUnused] = useState(0)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<ListFilters>(EMPTY_FILTERS)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [apiBase, setApiBaseState] = useState(getApiBase())
  const [editingRow, setEditingRow] = useState<ActivationKeyRow | null>(null)
  const [modalType, setModalType] = useState<'permissions' | 'expires' | null>(null)
  const [editPermissionState, setEditPermissionState] = useState<PermissionState>(() => defaultPermissionState('flowx'))
  const [expiresInput, setExpiresInput] = useState('')
  const [activeStat, setActiveStat] = useState<'total' | 'used' | 'unused' | null>(null)
  const [createdKeys, setCreatedKeys] = useState<ActivationKeyRow[]>([])
  const [showCreateResult, setShowCreateResult] = useState(false)
  const [detailRow, setDetailRow] = useState<ActivationKeyRow | null>(null)
  const [actionsOpen, setActionsOpen] = useState(false)

  const { message: toastMessage, tone: toastTone, showToast } = useToast()
  const { preference, resolvedMode, isMobile: viewModeMobile, setPreference } = useViewMode()
  const {
    pageSize,
    setPageSize,
    setViewModePreference,
    loadGeneratePrefs,
    saveGeneratePrefs,
    clearGeneratePrefs
  } = usePreferences()
  const isMobile = useMediaQuery('(max-width: 768px)')
  const isWide = useMediaQuery('(min-width: 1280px)')

  useEffect(() => {
    document.documentElement.dataset.theme = plugin
  }, [plugin])

  const fetchList = useCallback(async (nextPage = page) => {
    setLoading(true)
    setError('')
    try {
      const base = new URLSearchParams({
        page: String(nextPage),
        pageSize: String(pageSize),
        plugin
      })
      const params = filtersToSearchParams(filters, base)
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

  const copyText = async (text: string) => {
    await navigator.clipboard.writeText(text)
    showToast('已复制到剪贴板')
  }

  const copySelected = async () => {
    const keys = rows.filter((row) => selected.has(row.id)).map((row) => row.key)
    if (!keys.length) return showToast('请先选择激活码')
    await copyText(keys.join('\n'))
  }

  const exportSelected = () => {
    const keys = rows.filter((row) => selected.has(row.id)).map((row) => row.key)
    if (!keys.length) return showToast('请先选择激活码')
    exportTxt(keys)
    showToast(`已导出 ${keys.length} 条`)
  }

  const handlePluginChange = (next: PluginId) => {
    setPlugin(next)
    setPage(1)
    setSubTab('list')
    setActiveStat(null)
  }

  const handleStatFilter = (key: 'total' | 'used' | 'unused') => {
    setActiveStat(key)
    if (key === 'total') {
      setFilters(EMPTY_FILTERS)
    } else if (key === 'used') {
      setFilters((prev) => ({ ...prev, is_used: 'true', expired_only: false }))
    } else {
      setFilters((prev) => ({ ...prev, is_used: 'false', expired_only: false }))
    }
  }

  const openPermissionEditor = (row: ActivationKeyRow) => {
    setDetailRow(null)
    setEditingRow(row)
    setModalType('permissions')
    setEditPermissionState(permissionStateFromRow(plugin, row.permissions))
  }

  const openExpiresEditor = (row: ActivationKeyRow) => {
    setDetailRow(null)
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

  const renewKey = async (row: ActivationKeyRow, days: number) => {
    const base = row.expires_at ? new Date(row.expires_at) : new Date()
    base.setDate(base.getDate() + days)
    await updateExpiresAt(row.id, base.toISOString())
    showToast(`已续期 ${days} 天`)
    setDetailRow(null)
    void fetchList(page)
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('确认删除该激活码？')) return
    await deleteKey(id)
    showToast('已删除')
    setDetailRow(null)
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

  const handleCreated = (keys: ActivationKeyRow[]) => {
    setCreatedKeys(keys)
    setShowCreateResult(true)
    void fetchList(1)
  }

  const handleViewModeChange = (pref: ViewModePreference) => {
    setPreference(pref)
    setViewModePreference(pref)
  }

  const allPageSelected = rows.length > 0 && rows.every((row) => selected.has(row.id))

  const generatePrefs = loadGeneratePrefs(plugin)

  const listSection = (
    <section className="dashboard-section">
      <div className="command-bar-sticky">
        <ViewModeToggle
          preference={preference}
          resolvedMode={resolvedMode}
          isMobile={isMobile || viewModeMobile}
          totalHint={rows.length}
          onChange={handleViewModeChange}
        />
        <SearchCommandBar
          filters={filters}
          onChange={setFilters}
          onSearch={() => void fetchList(1)}
          activeStat={activeStat}
        />
      </div>

      <div className={`list-toolbar${isMobile ? ' list-toolbar--mobile' : ''}`}>
        <span className="list-toolbar__hint">
          {selected.size > 0 ? `已选 ${selected.size} 条` : `共 ${total} 条`}
        </span>

        {isMobile ? (
          <>
            <label className="list-toolbar__select">
              <input
                type="checkbox"
                checked={allPageSelected}
                onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((row) => row.id)) : new Set())}
              />
              全选
            </label>
            <div className="list-toolbar__actions-menu">
              <Button
                variant="ghost"
                type="button"
                aria-expanded={actionsOpen}
                onClick={() => setActionsOpen((v) => !v)}
              >
                选择操作 ▾
              </Button>
              {actionsOpen ? (
                <div className="list-toolbar__dropdown" role="menu">
                  <button type="button" role="menuitem" onClick={() => { setActionsOpen(false); void copySelected() }}>
                    复制 {selected.size || ''} 个
                  </button>
                  <button type="button" role="menuitem" onClick={() => { setActionsOpen(false); exportSelected() }}>
                    导出 TXT
                  </button>
                  <button type="button" role="menuitem" className="list-toolbar__dropdown-danger" onClick={() => { setActionsOpen(false); void handleBatchDelete() }}>
                    批量删除
                  </button>
                </div>
              ) : null}
            </div>
            <div className="list-pagination list-pagination--compact">
              <Button variant="ghost" type="button" disabled={page <= 1 || loading} onClick={() => void fetchList(page - 1)} aria-label="上一页">‹</Button>
              <span className="list-pagination__label">{page} / {totalPages}</span>
              <Button variant="ghost" type="button" disabled={page >= totalPages || loading} onClick={() => void fetchList(page + 1)} aria-label="下一页">›</Button>
            </div>
          </>
        ) : (
          <>
            <Button type="button" onClick={() => void copySelected()}>
              复制 {selected.size} 个
            </Button>
            <Button variant="ghost" type="button" onClick={exportSelected}>
              导出 TXT
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
              <Button variant="ghost" type="button" disabled={page <= 1 || loading} onClick={() => void fetchList(page - 1)}>上一页</Button>
              <span>{page} / {totalPages}</span>
              <Button variant="ghost" type="button" disabled={page >= totalPages || loading} onClick={() => void fetchList(page + 1)}>下一页</Button>
            </div>
          </>
        )}
      </div>

      {error ? (
        <Alert tone="error">
          {error}
          <Button variant="ghost" type="button" onClick={() => void fetchList(page)}>重试</Button>
        </Alert>
      ) : null}

      {loading ? <ListSkeleton rows={pageSize > 10 ? 8 : pageSize} /> : null}
      {!loading && !rows.length ? (
        <EmptyState onAction={() => setSubTab('generate')} />
      ) : null}
      {!loading && rows.length ? (
        <KeyList
          plugin={plugin}
          viewMode={resolvedMode}
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
          onOpenDetail={setDetailRow}
        />
      ) : null}
    </section>
  )

  return (
    <div className={`dashboard-page${isMobile ? ' dashboard-page--mobile' : ''}${isWide ? ' dashboard-page--wide' : ''}`}>
      <Card className="dashboard-top">
        <div className="dashboard-top__band" aria-hidden />
        <div className="dashboard-top__content">
          <div className="dashboard-top__titles">
            <div className="dashboard-top__heading-row">
              <h1>激活码管理</h1>
              {isMobile ? (
                <span className="dashboard-top__plugin-pill">{PLUGINS[plugin].label}</span>
              ) : null}
            </div>
            <p>{formatPluginNamesLine()} · 批量编排 · 权限预置</p>
          </div>
          <div className="dashboard-top-actions">
            <Button variant="ghost" type="button" onClick={() => void fetchList(page)} disabled={loading}>
              刷新
            </Button>
            {!isMobile ? (
              <Button variant="danger" type="button" onClick={onLogout}>退出</Button>
            ) : null}
          </div>
        </div>
      </Card>

      <PluginTabs active={plugin} onChange={handlePluginChange} />

      {loading && !rows.length ? <StatsSkeleton /> : (
        <StatsBar
          total={total}
          used={used}
          unused={unused}
          activeKey={activeStat}
          onFilter={handleStatFilter}
        />
      )}

      {!isMobile ? (
        <div className="sub-tabs" role="tablist" aria-label="控制台分区">
          {([
            ['list', '密钥列表'],
            ...(!isWide ? [['generate', '快捷生成']] as const : []),
            ['options', '系统选项']
          ] as const).map(([id, label]) => (
            <Chip key={id} active={subTab === id} onClick={() => setSubTab(id as NavTab)}>
              {label}
            </Chip>
          ))}
        </div>
      ) : null}

      <div className="dashboard-body">
        <main className="dashboard-main">
          {(subTab === 'list' || (isWide && subTab !== 'options')) ? listSection : null}

          {subTab === 'generate' && !isWide ? (
            <GeneratePanel
              plugin={plugin}
              collapsedPermissions={isMobile}
              savedPrefs={generatePrefs}
              onSavePrefs={(prefs) => saveGeneratePrefs(plugin, prefs)}
              onCreated={handleCreated}
              onCreate={createKeys}
            />
          ) : null}

          {subTab === 'options' ? (
            <PreferencesPanel
              apiBase={apiBase}
              onApiBaseChange={setApiBaseState}
              onSaveApiBase={saveOptions}
              viewModePreference={preference}
              onViewModePreferenceChange={(pref) => {
                handleViewModeChange(pref)
              }}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
              activePlugin={plugin}
              onClearGeneratePrefs={(p) => {
                clearGeneratePrefs(p)
                showToast('已重置生成偏好')
              }}
              onLogout={onLogout}
            />
          ) : null}
        </main>

        {isWide ? (
          <aside className="dashboard-sidebar">
            <GeneratePanel
              plugin={plugin}
              savedPrefs={generatePrefs}
              onSavePrefs={(prefs) => saveGeneratePrefs(plugin, prefs)}
              onCreated={handleCreated}
              onCreate={createKeys}
            />
          </aside>
        ) : null}
      </div>

      {isMobile ? <BottomNav active={subTab} onChange={setSubTab} /> : null}

      <CreateResultDrawer
        open={showCreateResult}
        keys={createdKeys}
        onClose={() => setShowCreateResult(false)}
        onCopyAll={() => void copyText(createdKeys.map((k) => k.key).join('\n'))}
        onCopySelected={(keys) => void copyText(keys.join('\n'))}
        onGoToList={() => {
          setShowCreateResult(false)
          setSubTab('list')
        }}
        onContinue={() => setShowCreateResult(false)}
      />

      <KeyDetailSheet
        open={Boolean(detailRow)}
        plugin={plugin}
        row={detailRow}
        onClose={() => setDetailRow(null)}
        onCopy={(key) => void copyText(key)}
        onEditPermissions={openPermissionEditor}
        onRenew={(row, days) => void renewKey(row, days)}
        onDelete={(id) => void handleDelete(id)}
      />

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

      <Toast message={toastMessage} tone={toastTone} />
    </div>
  )
}
