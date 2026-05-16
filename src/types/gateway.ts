export interface ApiResponse<T> {
  code: string
  info: string
  data: T
}

export interface PlatformGateway {
  id?: number
  platformId: string
  platformName: string
  platformDesc?: string
  version?: string
  auth: number
  enable: number
  isDeleted?: number
  createTime?: string
  updateTime?: string
  apiKey?: string | null
}

export interface HttpConfig {
  httpUrl: string
  httpMethod: 'get' | 'post' | 'put' | 'delete' | string
  httpHeaders: string
  timeout: number
  retryTimes: number
  enable?: number
  isDeleted?: number
}

export interface ProtocolMapping {
  mappingType: 'request' | 'response' | string
  parentPath?: string | null
  fieldName: string
  mcpPath: string
  mcpType: 'string' | 'number' | 'boolean' | 'object' | 'array' | string
  mcpDesc?: string | null
  isRequired: number
  sortOrder: number
}

export interface PlatformTool {
  id?: number
  platformId?: string
  toolId?: number
  toolName: string
  toolType: string
  toolDescription: string
  toolVersion: string
  protocolId?: number
  protocolType?: string
  enable: number
  isDeleted?: number
  httpConfig: HttpConfig
  mappings: ProtocolMapping[]
  createTime?: string
  updateTime?: string
}

export interface ToolPreview extends Omit<PlatformTool, 'toolId' | 'protocolId' | 'platformId'> {
  duplicate?: boolean
  existingToolId?: number
  existingToolName?: string
  importAction?: 'create' | 'update' | string
}

export interface PlatformPayload {
  platformId?: string
  platformName: string
  platformDesc?: string
  version?: string
  auth: number
  enable: number
}

export interface OpenApiPreviewPayload {
  openApiJson: string
  endpoints?: string[]
}
