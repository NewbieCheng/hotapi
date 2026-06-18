import { FormEvent, useState } from 'react'
import { DEFAULT_API_BASE, getApiBase, setApiBase } from '../api/activationAdmin'
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
      <div className="login-hero">
        <div className="login-hero-inner">
          <p className="login-kicker">ACTIVATION COMMAND CENTER</p>
          <h1>插件激活管理控制台</h1>
          <p>FlowX · 采集助手 · 知聊 · 知销 — 统一密钥编排与权限下发</p>
        </div>
      </div>
      <form className="login-form glass-card" onSubmit={(e) => void handleSubmit(e)}>
        <h2>管理员登录</h2>
        <p>输入后台密钥以进入控制台</p>
        <label>
          API 基址
          <input
            className="input"
            value={apiBase}
            onChange={(e) => setApiBaseState(e.target.value)}
            placeholder={DEFAULT_API_BASE}
          />
        </label>
        <label>
          管理密钥
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="ADMIN_PASSWORD"
            autoFocus
          />
        </label>
        {error ? <div className="login-error">{error}</div> : null}
        <button className="btn btn-primary" type="submit" disabled={pending || !password}>
          {pending ? '验证中...' : '进入控制台'}
        </button>
      </form>
    </div>
  )
}
