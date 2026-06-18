import { useEffect, useState } from 'react'
import type { ActivationKeyRow } from '../types'
import { Button } from './ui'
import './CreateResultDrawer.css'

interface CreateResultDrawerProps {
  open: boolean
  keys: ActivationKeyRow[]
  onClose: () => void
  onCopyAll: () => void
  onCopySelected: (keys: string[]) => void
  onGoToList: () => void
  onContinue: () => void
}

export function CreateResultDrawer({
  open,
  keys,
  onClose,
  onCopyAll,
  onCopySelected,
  onGoToList,
  onContinue
}: CreateResultDrawerProps) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(keys.map((k) => k.key)))

  useEffect(() => {
    setSelected(new Set(keys.map((k) => k.key)))
  }, [keys])

  if (!open) return null

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const allSelected = keys.length > 0 && keys.every((k) => selected.has(k.key))

  return (
    <>
      <div className="create-result-backdrop" onClick={onClose} aria-hidden />
      <aside className="create-result-drawer" role="dialog" aria-label="生成结果">
        <header className="create-result-drawer__head">
          <div>
            <h2>生成成功</h2>
            <p>本次共 {keys.length} 个激活码</p>
          </div>
          <button type="button" className="create-result-drawer__close" onClick={onClose} aria-label="关闭">×</button>
        </header>
        <div className="create-result-drawer__toolbar">
          <label className="create-result-drawer__select-all">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(e) => setSelected(e.target.checked ? new Set(keys.map((k) => k.key)) : new Set())}
            />
            全选
          </label>
          <Button variant="ghost" type="button" onClick={onCopyAll}>复制全部</Button>
          <Button
            variant="ghost"
            type="button"
            disabled={selected.size === 0}
            onClick={() => onCopySelected([...selected])}
          >
            复制选中 ({selected.size})
          </Button>
        </div>
        <ul className="create-result-drawer__list">
          {keys.map((row) => (
            <li key={row.id} className="create-result-drawer__item">
              <label>
                <input
                  type="checkbox"
                  checked={selected.has(row.key)}
                  onChange={() => toggle(row.key)}
                />
                <span className="mono">{row.key}</span>
              </label>
            </li>
          ))}
        </ul>
        <footer className="create-result-drawer__footer">
          <Button variant="ghost" type="button" onClick={onGoToList}>前往列表查看</Button>
          <Button type="button" onClick={onContinue}>继续生成</Button>
        </footer>
      </aside>
    </>
  )
}
