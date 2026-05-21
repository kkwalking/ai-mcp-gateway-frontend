export interface ApiResponse<T> {
  code: string
  info: string
  data: T
}

export interface PageResult<T> {
  list: T[]
  pageNum: number
  pageSize: number
  total: number
}

export interface PageParams {
  pageNum?: number
  pageSize?: number
}

export type TimestampMillis = number

export interface PlatformGateway {
  id?: number
  platformId: string
  platformName: string
  platformDesc?: string
  version?: string
  auth: number
  enable: number
  isDeleted?: number
  createTime?: TimestampMillis
  updateTime?: TimestampMillis
  apiKey?: string | null
}

export interface PlatformAdmin {
  id?: number
  platformId: string
  platformName?: string
  username: string
  adminRole: 'primary' | 'admin' | string
  status: number
  isDeleted?: number
  createTime?: TimestampMillis
  updateTime?: TimestampMillis
}

export interface UserAccount {
  id?: number
  username: string
  token?: string
  status?: number
  managedPlatforms?: PlatformAdmin[]
}

export interface PlatformKeyApply {
  id?: number
  username: string
  platformId: string
  applyReason?: string
  status: 0 | 1 | 2 | number
  isDeleted?: number
  apiKey?: string
  createTime?: TimestampMillis
  updateTime?: TimestampMillis
}

export interface PlatformGatewayAuth {
  id?: number
  username: string
  platformId: string
  apiKey: string
  rateLimit?: number
  expireTime?: TimestampMillis
  status: number
  isDeleted?: number
  createTime?: TimestampMillis
  updateTime?: TimestampMillis
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

export interface DubboConfig {
  registryAddress?: string | null
  registryProtocol?: string | null
  interfaceName: string
  methodName: string
  version?: string | null
  group?: string | null
  parameterTypes: string[]
  timeout?: number
  retries?: number
  directUrl?: string | null
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
  dubboConfig?: DubboConfig | null
  mappings: ProtocolMapping[]
  createTime?: TimestampMillis
  updateTime?: TimestampMillis
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

export interface LoginPayload {
  username: string
  password: string
}

export interface KeyApplyPayload {
  applyReason?: string
}
