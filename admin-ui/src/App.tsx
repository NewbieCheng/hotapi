import { useEffect, useState } from 'react'
import { clearAuthToken, getAuthToken, login, setAuthToken } from './api/activationAdmin'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'

export default function App() {
  const [authed, setAuthed] = useState(Boolean(getAuthToken()))

  useEffect(() => {
    document.documentElement.dataset.theme = 'flowx'
  }, [])

  const handleLogin = async (password: string) => {
    await login(password)
    setAuthToken(password)
    setAuthed(true)
  }

  const handleLogout = () => {
    clearAuthToken()
    setAuthed(false)
  }

  if (!authed) {
    return <LoginPage onLogin={handleLogin} />
  }

  return <DashboardPage onLogout={handleLogout} />
}
