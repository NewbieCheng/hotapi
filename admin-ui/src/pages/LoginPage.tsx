import { FormEvent, useState } from 'react'
import { DEFAULT_API_BASE, getApiBase, setApiBase } from '../api/activationAdmin'
import { formatPluginNamesLine } from '../permissions/definitions'
import { Alert, Button, Card, ProductRegistry, TextField } from '../components/ui'
import './LoginPage.css'

interface LoginPageProps {
  onLogin: (password: string) => Promise<void>
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [password, setPassword] = useState('')
  const [apiBase, setApiBaseState] = useState(getApiBase())
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      setApiBase(apiBase.trim() || DEFAULT_API_BASE)
      await onLogin(password)
    } catch (e) {
      setError(e instanceof Error ? e.message : '登录失败')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="login-page">
      <section className="login-hero">
        <div className="login-hero-inner">
          <p className="login-kicker">四插件激活码统一编排</p>
          <h1>插件激活管理控制台</h1>
          <p className="login-subline">
            {formatPluginNamesLine()} — 统一密钥编排与权限下发
          </p>
          <ProductRegistry />
          <p className="login-footnote">内部运营专用 · 密钥仅保存在本地会话</p>
        </div>
      </section>

      <section className="login-form-section">
        <Card className="login-form">
          <div className="login-form-head">
            <h2>管理员登录</h2>
            <p>输入后台密钥以进入控制台</p>
          </div>

          <form className="login-form-fields" onSubmit={(e) => void handleSubmit(e)}>
            <TextField
              label="API 基址"
              value={apiBase}
              onChange={(e) => setApiBaseState(e.target.value)}
              placeholder={DEFAULT_API_BASE}
              mono
            />
            <TextField
              label="管理密钥"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="ADMIN_PASSWORD"
              autoFocus
            />
            {error ? <Alert tone="error" onClose={() => setError('')}>{error}</Alert> : null}
            <Button type="submit" loading={pending} disabled={!password}>
              进入控制台
            </Button>
          </form>
        </Card>
      </section>
    </div>
  )
}
