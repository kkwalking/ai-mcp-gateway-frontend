import type {
  ApiResponse,
  OpenApiPreviewPayload,
  PlatformGateway,
  PlatformPayload,
  PlatformTool,
  ToolPreview,
} from '../types/gateway'

const API_BASE = import.meta.env.VITE_API_BASE || '/api-gateway/api/v1/admin/platforms'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
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

export const gatewayApi = {
  listPlatforms: () => request<PlatformGateway[]>(''),
  createPlatform: (payload: PlatformPayload) =>
    request<PlatformGateway>('', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updatePlatform: (platformId: string, payload: PlatformPayload) =>
    request<PlatformGateway>(`/${platformId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  setPlatformEnable: (platformId: string, enable: number) =>
    request<boolean>(`/${platformId}/enable`, {
      method: 'PATCH',
      body: JSON.stringify({ enable }),
    }),
  deletePlatform: (platformId: string) =>
    request<boolean>(`/${platformId}`, {
      method: 'DELETE',
    }),
  listTools: (platformId: string, enable?: number) =>
    request<PlatformTool[]>(`/${platformId}/tools${enable === undefined ? '' : `?enable=${enable}`}`),
  previewOpenApi: (platformId: string, payload: OpenApiPreviewPayload) =>
    request<ToolPreview[]>(`/${platformId}/tools/openapi/preview`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createTool: (platformId: string, payload: PlatformTool | ToolPreview) =>
    request<PlatformTool>(`/${platformId}/tools`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateTool: (platformId: string, toolId: number, payload: PlatformTool | ToolPreview) =>
    request<PlatformTool>(`/${platformId}/tools/${toolId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  setToolEnable: (platformId: string, toolId: number, enable: number) =>
    request<boolean>(`/${platformId}/tools/${toolId}/enable`, {
      method: 'PATCH',
      body: JSON.stringify({ enable }),
    }),
  deleteTool: (platformId: string, toolId: number) =>
    request<boolean>(`/${platformId}/tools/${toolId}`, {
      method: 'DELETE',
    }),
}
