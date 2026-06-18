const API_BASE_KEY = 'hotapi_admin_api_base'
const AUTH_KEY = 'hotapi_admin_auth'

export const DEFAULT_API_BASE = 'https://abc.no996ai.cn'

export function getApiBase(): string {
  return localStorage.getItem(API_BASE_KEY) || DEFAULT_API_BASE
}

export function setApiBase(value: string) {
  localStorage.setItem(API_BASE_KEY, value.replace(/\/$/, ''))
}

export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_KEY)
}

export function setAuthToken(token: string) {
  localStorage.setItem(AUTH_KEY, token)
}

export function clearAuthToken() {
  localStorage.removeItem(AUTH_KEY)
}

async function request<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {}
): Promise<T> {
  const base = getApiBase()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined)
  }
  if (options.auth !== false) {
    const token = getAuthToken()
    if (token) headers['x-admin-auth'] = token
  }

  const response = await fetch(`${base}${path}`, { ...options, headers })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || data.message || `请求失败 (${response.status})`)
  }
  return data as T
}

export async function login(password: string) {
  return request<{ success: boolean }>('/api/activation?action=login', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ password })
  })
}

export async function listKeys(params: URLSearchParams) {
  return request<import('../types').ListResponse>(`/api/activation?action=list&${params}`)
}

export async function createKeys(body: Record<string, unknown>) {
  return request<import('../types').ActivationKeyRow[]>('/api/activation?action=create', {
    method: 'POST',
    body: JSON.stringify(body)
  })
}

export async function updatePermissions(id: string, plugin: string, permissions: Record<string, unknown> | null) {
  return request('/api/activation?action=update_permissions', {
    method: 'POST',
    body: JSON.stringify({ id, plugin, permissions })
  })
}

export async function updateExpiresAt(id: string, expires_at: string) {
  return request('/api/activation?action=update_expires_at', {
    method: 'POST',
    body: JSON.stringify({ id, expires_at })
  })
}

export async function updateCjzsLevel(id: string, level: string) {
  return request('/api/activation?action=update_level', {
    method: 'POST',
    body: JSON.stringify({ id, plugin: 'cjzs', level })
  })
}

export async function deleteKey(id: string) {
  return request(`/api/activation?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function batchDelete(ids: string[]) {
  return request('/api/activation?action=batch_delete', {
    method: 'POST',
    body: JSON.stringify({ ids })
  })
}
