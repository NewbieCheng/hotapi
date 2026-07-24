import { getApiBase, getAuthToken } from './activationAdmin'

export interface SkillProduct {
  productId: string
  displayName: string
  major: number
}

export interface SkillLicenseRequest {
  customerId: string
  requestCode: string
}

export interface SkillLicenseSuccess {
  index: number
  ok: true
  licenseCode: string
  licenseId: string
  deviceId: string
  customerId: string
  productId: string
  major: number
  keyId: string
  issuedAt: number
}

export interface SkillLicenseFailure {
  index: number
  ok: false
  customerId: string
  error: string
}

export type SkillLicenseResult = SkillLicenseSuccess | SkillLicenseFailure

export interface SkillBatchIssueResponse {
  product: SkillProduct
  total: number
  successCount: number
  failureCount: number
  results: SkillLicenseResult[]
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken()
  const response = await fetch(`${getApiBase()}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'x-admin-auth': token } : {}),
      ...(options.headers || {})
    }
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || data.details || `请求失败 (${response.status})`)
  }
  return data as T
}

export function listSkillProducts() {
  return request<{ products: SkillProduct[]; maxBatchCount: number }>(
    '/api/skill_activation?action=products'
  )
}

export function issueSkillLicenses(
  product: SkillProduct,
  requests: SkillLicenseRequest[]
) {
  return request<SkillBatchIssueResponse>('/api/skill_activation?action=batch_issue', {
    method: 'POST',
    body: JSON.stringify({
      productId: product.productId,
      major: product.major,
      requests
    })
  })
}
