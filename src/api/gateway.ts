import type {
  ApiResponse,
  PageParams,
  PageResult,
  OpenApiPreviewPayload,
  KeyApplyPayload,
  LoginPayload,
  PlatformAdmin,
  PlatformGateway,
  PlatformGatewayAuth,
  PlatformKeyApply,
  PlatformPayload,
  PlatformTool,
  UserAccount,
  ToolPreview,
} from '../types/gateway'

const API_BASE = import.meta.env.VITE_API_BASE || '/api-gateway/api/v1'

let authToken = localStorage.getItem('gateway_token') || ''

export function setAuthToken(token: string) {
  authToken = token
  if (token) localStorage.setItem('gateway_token', token)
  else localStorage.removeItem('gateway_token')
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  if (!response.ok) {
    if (response.status === 502 || response.status === 504) {
      throw new Error('后端网关服务不可用，请确认 ai-mcp-gateway 已在 8777 端口启动')
    }
    throw new Error(`HTTP ${response.status}`)
  }

  const payload = (await response.json()) as ApiResponse<T>
  if (payload.code !== '0000') {
    throw new Error(payload.info || payload.code)
  }
  return payload.data
}

function withQuery(path: string, params?: object) {
  if (!params) return path
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if ((typeof value === 'string' || typeof value === 'number') && value !== '') query.set(key, String(value))
  })
  const queryString = query.toString()
  return queryString ? `${path}?${queryString}` : path
}

export const gatewayApi = {
  login: (payload: LoginPayload) =>
    request<UserAccount>('/users/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  me: () => request<UserAccount>('/users/me'),
  myApiKeys: (params?: PageParams & { platformId?: string }) =>
    request<PageResult<PlatformGatewayAuth>>(withQuery('/users/me/api-keys', params)),
  myAdminPlatforms: (params?: PageParams) =>
    request<PageResult<PlatformAdmin>>(withQuery('/users/me/admin-platforms', params)),
  myUsedPlatforms: (params?: PageParams) =>
    request<PageResult<PlatformGateway>>(withQuery('/users/me/used-platforms', params)),
  myKeyApplies: (params?: PageParams & { status?: number }) =>
    request<PageResult<PlatformKeyApply>>(withQuery('/users/me/key-applies', params)),
  myApprovalTasks: (params?: PageParams & { status?: number }) =>
    request<PageResult<PlatformKeyApply>>(withQuery('/users/me/approval-tasks', params)),
  listPlatforms: (params?: PageParams & { keyword?: string }) =>
    request<PageResult<PlatformGateway>>(withQuery('/platforms', params)),
  getPlatform: (platformId: string) => request<PlatformGateway>(`/platforms/${platformId}`),
  createPlatform: (payload: PlatformPayload) =>
    request<PlatformGateway>('/platforms', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updatePlatform: (platformId: string, payload: PlatformPayload) =>
    request<PlatformGateway>(`/platforms/${platformId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  setPlatformEnable: (platformId: string, enable: number) =>
    request<boolean>(`/platforms/${platformId}/enable`, {
      method: 'PATCH',
      body: JSON.stringify({ enable }),
    }),
  deletePlatform: (platformId: string) =>
    request<boolean>(`/platforms/${platformId}`, {
      method: 'DELETE',
    }),
  listTools: (platformId: string, params?: PageParams & { enable?: number }) =>
    request<PageResult<PlatformTool>>(withQuery(`/platforms/${platformId}/tools`, params)),
  previewOpenApi: (platformId: string, payload: OpenApiPreviewPayload) =>
    request<ToolPreview[]>(`/platforms/${platformId}/tools/openapi/preview`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createTool: (platformId: string, payload: PlatformTool | ToolPreview) =>
    request<PlatformTool>(`/platforms/${platformId}/tools`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateTool: (platformId: string, toolId: number, payload: PlatformTool | ToolPreview) =>
    request<PlatformTool>(`/platforms/${platformId}/tools/${toolId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  setToolEnable: (platformId: string, toolId: number, enable: number) =>
    request<boolean>(`/platforms/${platformId}/tools/${toolId}/enable`, {
      method: 'PATCH',
      body: JSON.stringify({ enable }),
    }),
  deleteTool: (platformId: string, toolId: number) =>
    request<boolean>(`/platforms/${platformId}/tools/${toolId}`, {
      method: 'DELETE',
    }),
  listAdmins: (platformId: string, params?: PageParams) =>
    request<PageResult<PlatformAdmin>>(withQuery(`/platforms/${platformId}/admins`, params)),
  addAdmin: (platformId: string, username: string) =>
    request<PlatformAdmin>(`/platforms/${platformId}/admins`, {
      method: 'POST',
      body: JSON.stringify({ username }),
    }),
  submitKeyApply: (platformId: string, payload: KeyApplyPayload) =>
    request<PlatformKeyApply>(`/platforms/${platformId}/key-applies`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  listKeyApplies: (platformId: string, params?: PageParams & { status?: number }) =>
    request<PageResult<PlatformKeyApply>>(withQuery(`/platforms/${platformId}/key-applies`, params)),
  approveKeyApply: (platformId: string, applyId: number) =>
    request<PlatformKeyApply>(`/platforms/${platformId}/key-applies/${applyId}/approve`, {
      method: 'PATCH',
    }),
  rejectKeyApply: (platformId: string, applyId: number) =>
    request<PlatformKeyApply>(`/platforms/${platformId}/key-applies/${applyId}/reject`, {
      method: 'PATCH',
    }),
}
