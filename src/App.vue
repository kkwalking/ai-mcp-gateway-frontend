<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Braces,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Database,
  FileJson,
  FileCheck2,
  Inbox,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Pencil,
  Plus,
  Power,
  Save,
  Search,
  Server,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  UserPlus,
  Users,
  Wrench,
  X,
} from '@lucide/vue'
import { gatewayApi, setAuthToken } from './api/gateway'
import type {
  PlatformAdmin,
  PlatformGateway,
  PlatformGatewayAuth,
  PlatformKeyApply,
  PlatformPayload,
  PlatformTool,
  ProtocolMapping,
  ToolPreview,
  UserAccount,
} from './types/gateway'
import { sampleOpenApiJson } from './utils/samples'

type ViewName =
  | 'login'
  | 'platform-list'
  | 'managed-platforms'
  | 'used-platforms'
  | 'my-api-keys'
  | 'register-platform'
  | 'my-key-applies'
  | 'my-approvals'
  | 'platform-detail'
  | 'key-apply'
  | 'tool-editor'
  | 'tool-openapi'
type DetailMode = 'readonly' | 'manage'
type ApplyStatus = 0 | 1 | 2
type MessageModalState = { type: 'success' | 'error' | 'warning'; title: string; text: string } | null
type BreadcrumbItem = { label: string; to?: RouteLocationRaw }

const DEFAULT_PAGE_SIZE = 10
const route = useRoute()
const router = useRouter()
const statusOptions: Array<{ label: string; value: ApplyStatus }> = [
  { label: '正在进行中', value: 0 },
  { label: '已通过', value: 1 },
  { label: '已拒绝', value: 2 },
]

const token = ref(localStorage.getItem('gateway_token') || '')
const currentUser = ref<UserAccount | null>(null)
const platforms = ref<PlatformGateway[]>([])
const platformTotal = ref(0)
const adminPlatforms = ref<PlatformAdmin[]>([])
const adminPlatformTotal = ref(0)
const usedPlatforms = ref<PlatformGateway[]>([])
const usedPlatformTotal = ref(0)
const tools = ref<PlatformTool[]>([])
const previews = ref<ToolPreview[]>([])
const expandedPreviewTools = ref<string[]>([])
const admins = ref<PlatformAdmin[]>([])
const myApiKeys = ref<PlatformGatewayAuth[]>([])
const currentPlatformApiKey = ref<PlatformGatewayAuth | null>(null)
const myApiKeyTotal = ref(0)
const myKeyApplies = ref<PlatformKeyApply[]>([])
const myKeyApplyTotal = ref(0)
const myApprovals = ref<PlatformKeyApply[]>([])
const myApprovalTotal = ref(0)
const selectedPlatformId = ref('')
const selectedToolId = ref<number | null>(null)
const viewName = ref<ViewName>(token.value ? 'platform-list' : 'login')
const activeMenu = ref<ViewName>('platform-list')
const detailMode = ref<DetailMode>('readonly')
const platformMode = ref<'create' | 'edit'>('edit')
const searchText = ref('')
const loading = ref(false)
const toolLoading = ref(false)
const platformApiKeyLoading = ref(false)
const previewLoading = ref(false)
const saving = ref(false)
const savingPreviewKeys = ref<string[]>([])
const platformSearchTimer = ref<number | null>(null)
const errorText = ref('')
const toastText = ref('')
const newAdminUsername = ref('')
const logoutConfirmOpen = ref(false)
const messageModal = ref<MessageModalState>(null)
const platformPage = ref(1)
const managedPage = ref(1)
const usedPage = ref(1)
const apiKeyPage = ref(1)
const myApplyPage = ref(1)
const approvalPage = ref(1)
const myApplyStatus = ref<ApplyStatus>(0)
const approvalStatus = ref<ApplyStatus>(0)

const loginForm = reactive({ username: '', password: '' })
const keyApplyForm = reactive({ applyReason: '' })
const keyApplyPlatformKeyword = ref('')
const keyApplyPlatformOptions = ref<PlatformGateway[]>([])
const keyApplyPlatformLoading = ref(false)
const keyApplyFromDetail = ref(false)
const openApiForm = reactive({ openApiJson: sampleOpenApiJson })

const platformForm = reactive<PlatformPayload>({
  platformId: '',
  platformName: '',
  platformDesc: '',
  version: '1.0.0',
  auth: 1,
  enable: 1,
})

const toolForm = reactive<PlatformTool>({
  toolName: '',
  toolType: 'function',
  toolDescription: '',
  toolVersion: '1.0.0',
  enable: 1,
  httpConfig: {
    httpUrl: '',
    httpMethod: 'post',
    httpHeaders: '{"Content-Type":"application/json"}',
    timeout: 30000,
    retryTimes: 0,
  },
  mappings: [],
})

const selectedTool = computed(() => tools.value.find((tool) => tool.toolId === selectedToolId.value))
const managedPlatforms = computed(() => currentUser.value?.managedPlatforms || [])
const managedPlatformIds = computed(() =>
  new Set([...managedPlatforms.value, ...adminPlatforms.value].map((item) => item.platformId)),
)
const isPlatformAdmin = computed(() => selectedPlatformId.value ? managedPlatformIds.value.has(selectedPlatformId.value) : false)
const canManagePlatform = computed(() => platformMode.value === 'create' || (detailMode.value === 'manage' && isPlatformAdmin.value))
const primaryAdmins = computed(() => admins.value.filter((admin) => admin.adminRole === 'primary'))
const primaryAdminNames = computed(() => primaryAdmins.value.map((admin) => admin.username).join('、'))
const normalAdmins = computed(() => admins.value.filter((admin) => admin.adminRole !== 'primary'))
const hasCurrentPlatformApiKey = computed(() =>
  selectedPlatformId.value
    ? Boolean(
        currentPlatformApiKey.value?.platformId === selectedPlatformId.value
        || myApiKeys.value.some((item) => item.platformId === selectedPlatformId.value && item.status === 1),
      )
    : false,
)
const showApplyApiKeyButton = computed(() =>
  platformMode.value === 'edit'
  && !canManagePlatform.value
  && !platformApiKeyLoading.value
  && !hasCurrentPlatformApiKey.value,
)
const isPlatformPrimaryAdmin = computed(() =>
  selectedPlatformId.value
    ? [...admins.value, ...managedPlatforms.value, ...adminPlatforms.value].some((admin) =>
        admin.platformId === selectedPlatformId.value
        && admin.username === currentUser.value?.username
        && admin.adminRole === 'primary',
      )
    : false,
)
const platformDetailListRoute = computed(() => {
  if (route.name === 'managed-platform-detail') return { name: 'managed-platforms' }
  if (route.name === 'used-platform-detail') return { name: 'used-platforms' }
  return { name: 'platform-list' }
})
const platformDetailRootLabel = computed(() => {
  if (route.name === 'managed-platform-detail') return '我管理的'
  if (route.name === 'used-platform-detail') return '我使用的'
  return '平台列表'
})
const platformDetailRoute = computed<RouteLocationRaw>(() => {
  if (!selectedPlatformId.value) return { name: 'platform-list' }
  if (route.name === 'managed-platform-detail' || activeMenu.value === 'managed-platforms') return { name: 'managed-platform-detail', params: { platformId: selectedPlatformId.value } }
  if (route.name === 'used-platform-detail' || activeMenu.value === 'used-platforms') return { name: 'used-platform-detail', params: { platformId: selectedPlatformId.value } }
  return { name: 'platform-detail', params: { platformId: selectedPlatformId.value } }
})
const backRoute = computed<RouteLocationRaw>(() => {
  if (viewName.value === 'platform-detail') return platformDetailListRoute.value
  if (viewName.value === 'key-apply') return keyApplyFromDetail.value ? platformDetailRoute.value : { name: 'my-api-keys' }
  if (viewName.value === 'tool-editor' || viewName.value === 'tool-openapi') return platformDetailRoute.value
  return { name: 'platform-list' }
})
const breadcrumbs = computed<BreadcrumbItem[]>(() => {
  const platformName = platformMode.value === 'create'
    ? '注册平台'
    : platformForm.platformName || selectedPlatformId.value || '平台详情'

  if (viewName.value === 'login') return [{ label: '登录' }]
  if (viewName.value === 'platform-list') return [{ label: '平台列表' }]
  if (viewName.value === 'managed-platforms') return [{ label: '我管理的' }]
  if (viewName.value === 'used-platforms') return [{ label: '我使用的' }]
  if (viewName.value === 'my-api-keys') return [{ label: '我的 API Key' }]
  if (viewName.value === 'my-key-applies') return [{ label: '我的申请' }]
  if (viewName.value === 'my-approvals') return [{ label: '我的审批' }]
  if (viewName.value === 'platform-detail') {
    if (platformMode.value === 'create') return [{ label: '平台列表', to: { name: 'platform-list' } }, { label: '注册平台' }]
    return [{ label: platformDetailRootLabel.value, to: platformDetailListRoute.value }, { label: platformName }]
  }
  if (viewName.value === 'key-apply') {
    return keyApplyFromDetail.value
      ? [{ label: platformName, to: platformDetailRoute.value }, { label: 'API Key 申请' }]
      : [{ label: '我的 API Key', to: { name: 'my-api-keys' } }, { label: '申请' }]
  }
  if (viewName.value === 'tool-openapi') {
    return [{ label: '我管理的', to: { name: 'managed-platforms' } }, { label: platformName, to: platformDetailRoute.value }, { label: 'OpenAPI 导入' }]
  }
  if (viewName.value === 'tool-editor') {
    return [{ label: '我管理的', to: { name: 'managed-platforms' } }, { label: platformName, to: platformDetailRoute.value }, { label: selectedToolId.value ? '编辑 Tool' : '新增 Tool' }]
  }
  return []
})

function pageCount(total: number, pageSize = DEFAULT_PAGE_SIZE) {
  return Math.max(1, Math.ceil(total / pageSize))
}

function clearError() {
  errorText.value = ''
}

function showToast(text: string) {
  toastText.value = text
  window.setTimeout(() => {
    if (toastText.value === text) toastText.value = ''
  }, 2600)
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '操作失败'
}

function handleError(error: unknown) {
  errorText.value = errorMessage(error)
}

function showMessageModal(title: string, text: string, type: 'success' | 'error' | 'warning' = 'error') {
  messageModal.value = { title, text, type }
}

function showSuccessModal(title: string, text = '操作已成功完成') {
  showMessageModal(title, text, 'success')
}

function showFailureModal(title: string, error: unknown) {
  showMessageModal(title, errorMessage(error))
}

function closeMessageModal() {
  messageModal.value = null
}

function resetPlatformForm() {
  Object.assign(platformForm, {
    platformId: '',
    platformName: '',
    platformDesc: '',
    version: '1.0.0',
    auth: 1,
    enable: 1,
  })
}

function fillPlatformForm(platform: PlatformGateway) {
  platformForm.platformId = platform.platformId
  platformForm.platformName = platform.platformName
  platformForm.platformDesc = platform.platformDesc || ''
  platformForm.version = platform.version || '1.0.0'
  platformForm.auth = platform.auth ?? 1
  platformForm.enable = platform.enable ?? 1
}

function blankTool(): PlatformTool {
  return {
    toolName: '',
    toolType: 'function',
    toolDescription: '',
    toolVersion: '1.0.0',
    enable: 1,
    httpConfig: {
      httpUrl: '',
      httpMethod: 'post',
      httpHeaders: '{"Content-Type":"application/json"}',
      timeout: 30000,
      retryTimes: 0,
    },
    mappings: [],
  }
}

function platformLabel(platformId: string) {
  const fromPage = platforms.value.find((item) => item.platformId === platformId)
  const fromUsed = usedPlatforms.value.find((item) => item.platformId === platformId)
  const fromApply = keyApplyPlatformOptions.value.find((item) => item.platformId === platformId)
  const fromManaged = managedPlatforms.value.find((item) => item.platformId === platformId)
  return fromPage?.platformName || fromUsed?.platformName || fromApply?.platformName || fromManaged?.platformName || platformId
}

function statusLabel(status: number) {
  return statusOptions.find((item) => item.value === status)?.label || '未知'
}

function statusClass(status: number) {
  return { warning: status === 0, muted: status === 2 }
}

function formatTimestamp(value?: number | string | null) {
  if (value === undefined || value === null || value === '') return '-'
  const timestamp = typeof value === 'number' ? value : Number(value)
  const date = Number.isFinite(timestamp) ? new Date(timestamp) : new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  const pad = (num: number) => String(num).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

async function loadMe() {
  currentUser.value = await gatewayApi.me()
}

async function loadPlatforms(pageNum = platformPage.value) {
  loading.value = true
  try {
    const page = await gatewayApi.listPlatforms({
      keyword: searchText.value.trim(),
      pageNum,
      pageSize: DEFAULT_PAGE_SIZE,
    })
    platforms.value = page.list
    platformPage.value = page.pageNum
    platformTotal.value = page.total
  } catch (error) {
    handleError(error)
  } finally {
    loading.value = false
  }
}

async function loadMyApiKeys(pageNum = apiKeyPage.value) {
  const page = await gatewayApi.myApiKeys({ pageNum, pageSize: DEFAULT_PAGE_SIZE })
  myApiKeys.value = page.list
  apiKeyPage.value = page.pageNum
  myApiKeyTotal.value = page.total
}

function resetKeyApplyState() {
  keyApplyForm.applyReason = ''
  keyApplyPlatformKeyword.value = ''
  keyApplyPlatformOptions.value = []
}

async function searchKeyApplyPlatforms() {
  const keyword = keyApplyPlatformKeyword.value.trim()
  if (!keyword) {
    keyApplyPlatformOptions.value = []
    return
  }
  keyApplyPlatformLoading.value = true
  try {
    const page = await gatewayApi.listPlatforms({
      keyword,
      pageNum: 1,
      pageSize: 5,
    })
    keyApplyPlatformOptions.value = page.list
  } catch (error) {
    handleError(error)
  } finally {
    keyApplyPlatformLoading.value = false
  }
}

async function handleKeyApplyPlatformInput() {
  selectedPlatformId.value = ''
  await searchKeyApplyPlatforms()
}

function selectKeyApplyPlatform(platform: PlatformGateway) {
  selectedPlatformId.value = platform.platformId
  keyApplyPlatformKeyword.value = `${platform.platformName} ${platform.platformId}`
  keyApplyPlatformOptions.value = []
}

async function loadCurrentPlatformApiKey() {
  currentPlatformApiKey.value = null
  if (!selectedPlatformId.value) return
  platformApiKeyLoading.value = true
  try {
    const page = await gatewayApi.myApiKeys({
      platformId: selectedPlatformId.value,
      pageNum: 1,
      pageSize: 1,
    })
    const apiKey = page.list[0] || null
    currentPlatformApiKey.value = apiKey
    if (apiKey && !myApiKeys.value.some((item) => item.id === apiKey.id || item.apiKey === apiKey.apiKey)) {
      myApiKeys.value = [apiKey, ...myApiKeys.value]
    }
  } catch (error) {
    handleError(error)
  } finally {
    platformApiKeyLoading.value = false
  }
}

async function loadMyAdminPlatforms(pageNum = managedPage.value) {
  const page = await gatewayApi.myAdminPlatforms({ pageNum, pageSize: DEFAULT_PAGE_SIZE })
  adminPlatforms.value = page.list
  managedPage.value = page.pageNum
  adminPlatformTotal.value = page.total
}

async function loadMyUsedPlatforms(pageNum = usedPage.value) {
  const page = await gatewayApi.myUsedPlatforms({ pageNum, pageSize: DEFAULT_PAGE_SIZE })
  usedPlatforms.value = page.list
  usedPage.value = page.pageNum
  usedPlatformTotal.value = page.total
}

async function loadMyKeyApplies(pageNum = myApplyPage.value) {
  loading.value = true
  try {
    const page = await gatewayApi.myKeyApplies({
      status: myApplyStatus.value,
      pageNum,
      pageSize: DEFAULT_PAGE_SIZE,
    })
    myKeyApplies.value = page.list
    myApplyPage.value = page.pageNum
    myKeyApplyTotal.value = page.total
  } catch (error) {
    handleError(error)
  } finally {
    loading.value = false
  }
}

async function loadMyApprovals(pageNum = approvalPage.value) {
  loading.value = true
  try {
    const page = await gatewayApi.myApprovalTasks({
      status: approvalStatus.value,
      pageNum,
      pageSize: DEFAULT_PAGE_SIZE,
    })
    myApprovals.value = page.list
    approvalPage.value = page.pageNum
    myApprovalTotal.value = page.total
  } catch (error) {
    handleError(error)
  } finally {
    loading.value = false
  }
}

function routeParam(name: string) {
  const value = route.params[name]
  return Array.isArray(value) ? value[0] : value || ''
}

function routeToolId() {
  const value = Number(routeParam('toolId'))
  return Number.isFinite(value) ? value : null
}

function resetRouteDetailState() {
  selectedPlatformId.value = ''
  selectedToolId.value = null
  currentPlatformApiKey.value = null
  platformApiKeyLoading.value = false
  keyApplyFromDetail.value = false
}

async function bootstrapAuth() {
  if (!token.value) return false
  setAuthToken(token.value)
  try {
    await loadMe()
    return true
  } catch (error) {
    setAuthToken('')
    token.value = ''
    handleError(error)
    return false
  }
}

async function loadPlatformDetail(platformId: string, mode: DetailMode) {
  selectedPlatformId.value = platformId
  selectedToolId.value = null
  currentPlatformApiKey.value = null
  detailMode.value = mode
  platformMode.value = 'edit'

  try {
    const cached = platforms.value.find((item) => item.platformId === platformId)
      || usedPlatforms.value.find((item) => item.platformId === platformId)
    const platform = cached || await gatewayApi.getPlatform(platformId)
    fillPlatformForm(platform)
    await Promise.all([loadPlatformRelated(), loadCurrentPlatformApiKey()])
  } catch (error) {
    handleError(error)
  }
}

async function loadToolRoute(platformId: string, toolId: number | null) {
  await loadPlatformDetail(platformId, 'manage')
  selectedToolId.value = toolId
  if (toolId) {
    const tool = tools.value.find((item) => item.toolId === toolId)
    if (tool) {
      Object.assign(toolForm, JSON.parse(JSON.stringify(tool)))
    } else {
      Object.assign(toolForm, blankTool())
      handleError(new Error('未找到指定 Tool'))
    }
  } else {
    Object.assign(toolForm, blankTool())
  }
}

async function syncRoute() {
  clearError()
  const routeName = String(route.name || '')

  if (!token.value && routeName !== 'login') {
    viewName.value = 'login'
    await router.replace({ name: 'login' })
    return
  }

  if (token.value && !currentUser.value) {
    const authed = await bootstrapAuth()
    if (!authed) {
      viewName.value = 'login'
      await router.replace({ name: 'login' })
      return
    }
  }

  if (routeName === 'login') {
    viewName.value = 'login'
    activeMenu.value = 'platform-list'
    return
  }

  if (routeName === 'platform-list') {
    resetRouteDetailState()
    viewName.value = 'platform-list'
    activeMenu.value = 'platform-list'
    await Promise.all([loadPlatforms(1), loadMyApiKeys(1)])
    return
  }

  if (routeName === 'managed-platforms') {
    resetRouteDetailState()
    viewName.value = 'managed-platforms'
    activeMenu.value = 'managed-platforms'
    await loadMyAdminPlatforms(1)
    return
  }

  if (routeName === 'used-platforms') {
    resetRouteDetailState()
    viewName.value = 'used-platforms'
    activeMenu.value = 'used-platforms'
    await loadMyUsedPlatforms(1)
    return
  }

  if (routeName === 'my-api-keys') {
    resetRouteDetailState()
    viewName.value = 'my-api-keys'
    activeMenu.value = 'my-api-keys'
    await loadMyApiKeys(1)
    return
  }

  if (routeName === 'api-key-apply') {
    resetRouteDetailState()
    viewName.value = 'key-apply'
    activeMenu.value = 'key-apply'
    resetKeyApplyState()
    return
  }

  if (routeName === 'my-key-applies') {
    resetRouteDetailState()
    viewName.value = 'my-key-applies'
    activeMenu.value = 'my-key-applies'
    myApplyPage.value = 1
    await loadMyKeyApplies(1)
    return
  }

  if (routeName === 'my-approvals') {
    resetRouteDetailState()
    viewName.value = 'my-approvals'
    activeMenu.value = 'my-approvals'
    approvalPage.value = 1
    await loadMyApprovals(1)
    return
  }

  if (routeName === 'platform-new') {
    viewName.value = 'platform-detail'
    activeMenu.value = 'platform-list'
    selectedPlatformId.value = ''
    selectedToolId.value = null
    currentPlatformApiKey.value = null
    detailMode.value = 'manage'
    platformMode.value = 'create'
    tools.value = []
    admins.value = []
    resetPlatformForm()
    return
  }

  if (routeName === 'platform-detail' || routeName === 'managed-platform-detail' || routeName === 'used-platform-detail') {
    const platformId = routeParam('platformId')
    viewName.value = 'platform-detail'
    activeMenu.value = routeName === 'managed-platform-detail' ? 'managed-platforms' : routeName === 'used-platform-detail' ? 'used-platforms' : 'platform-list'
    await loadPlatformDetail(platformId, routeName === 'managed-platform-detail' ? 'manage' : 'readonly')
    return
  }

  if (routeName === 'platform-key-apply') {
    const platformId = routeParam('platformId')
    viewName.value = 'key-apply'
    activeMenu.value = 'platform-list'
    keyApplyFromDetail.value = true
    resetKeyApplyState()
    keyApplyPlatformKeyword.value = platformId
    await loadPlatformDetail(platformId, 'readonly')
    return
  }

  if (routeName === 'tool-new') {
    const platformId = routeParam('platformId')
    viewName.value = 'tool-editor'
    activeMenu.value = 'managed-platforms'
    await loadToolRoute(platformId, null)
    return
  }

  if (routeName === 'tool-editor') {
    const platformId = routeParam('platformId')
    viewName.value = 'tool-editor'
    activeMenu.value = 'managed-platforms'
    await loadToolRoute(platformId, routeToolId())
    return
  }

  if (routeName === 'tool-openapi') {
    const platformId = routeParam('platformId')
    viewName.value = 'tool-openapi'
    activeMenu.value = 'managed-platforms'
    previews.value = []
    expandedPreviewTools.value = []
    savingPreviewKeys.value = []
    if (!openApiForm.openApiJson.trim()) {
      openApiForm.openApiJson = sampleOpenApiJson
    }
    await loadPlatformDetail(platformId, 'manage')
  }
}

async function navigateTo(to: RouteLocationRaw) {
  await router.push(to)
}

async function navigate(view: ViewName) {
  const routeMap: Partial<Record<ViewName, RouteLocationRaw>> = {
    'platform-list': { name: 'platform-list' },
    'managed-platforms': { name: 'managed-platforms' },
    'used-platforms': { name: 'used-platforms' },
    'my-api-keys': { name: 'my-api-keys' },
    'key-apply': { name: 'api-key-apply' },
    'my-key-applies': { name: 'my-key-applies' },
    'my-approvals': { name: 'my-approvals' },
    'register-platform': { name: 'platform-new' },
  }
  const to = routeMap[view]
  if (to) {
    await navigateTo(to)
  }
}

async function login() {
  clearError()
  saving.value = true
  try {
    const user = await gatewayApi.login({
      username: loginForm.username.trim(),
      password: loginForm.password.trim(),
    })
    token.value = user.token || ''
    setAuthToken(token.value)
    currentUser.value = user
    await loadMe()
    await router.push({ name: 'platform-list' })
    showToast('登录成功')
  } catch (error) {
    handleError(error)
  } finally {
    saving.value = false
  }
}

function requestLogout() {
  logoutConfirmOpen.value = true
}

function cancelLogout() {
  logoutConfirmOpen.value = false
}

function confirmLogout() {
  logoutConfirmOpen.value = false
  token.value = ''
  setAuthToken('')
  currentUser.value = null
  platforms.value = []
  tools.value = []
  myApiKeys.value = []
  currentPlatformApiKey.value = null
  router.push({ name: 'login' })
}

async function searchPlatforms() {
  if (platformSearchTimer.value !== null) {
    window.clearTimeout(platformSearchTimer.value)
    platformSearchTimer.value = null
  }
  platformPage.value = 1
  await loadPlatforms(1)
}

function schedulePlatformSearch() {
  if (platformSearchTimer.value !== null) {
    window.clearTimeout(platformSearchTimer.value)
  }
  platformSearchTimer.value = window.setTimeout(() => {
    void searchPlatforms()
  }, 320)
}

async function clearPlatformSearch() {
  if (!searchText.value) return
  searchText.value = ''
  await searchPlatforms()
}

async function openPlatformById(platformId: string, mode: DetailMode) {
  await navigateTo({
    name: mode === 'manage' ? 'managed-platform-detail' : 'platform-detail',
    params: { platformId },
  })
}

async function openManagedPlatform(platform: PlatformAdmin) {
  await navigateTo({ name: 'managed-platform-detail', params: { platformId: platform.platformId } })
}

async function openPlatform(platform: PlatformGateway, mode: DetailMode) {
  await navigateTo({
    name: activeMenu.value === 'used-platforms'
      ? 'used-platform-detail'
      : mode === 'manage'
        ? 'managed-platform-detail'
        : 'platform-detail',
    params: { platformId: platform.platformId },
  })
}

async function loadPlatformRelated() {
  if (!selectedPlatformId.value) return
  toolLoading.value = true
  try {
    const toolPage = await gatewayApi.listTools(selectedPlatformId.value, {
      pageNum: 1,
      pageSize: 100,
      enable: canManagePlatform.value ? undefined : 1,
    })
    tools.value = toolPage.list
    if (canManagePlatform.value) {
      const adminPage = await gatewayApi.listAdmins(selectedPlatformId.value, { pageNum: 1, pageSize: 100 })
      admins.value = adminPage.list
    } else {
      admins.value = []
    }
  } catch (error) {
    handleError(error)
  } finally {
    toolLoading.value = false
  }
}

function goBackToMenu() {
  navigateTo(backRoute.value)
}

function startCreatePlatform() {
  navigateTo({ name: 'platform-new' })
}

async function savePlatform() {
  saving.value = true
  try {
    let successTitle = ''
    let successText = ''
    if (platformMode.value === 'create') {
      const created = await gatewayApi.createPlatform(platformForm)
      selectedPlatformId.value = created.platformId
      fillPlatformForm(created)
      await loadMe()
      await loadPlatforms(1)
      platformMode.value = 'edit'
      detailMode.value = 'manage'
      activeMenu.value = 'managed-platforms'
      successTitle = '平台注册成功'
      successText = `平台 ${created.platformName || created.platformId} 已注册。`
      await router.replace({ name: 'managed-platform-detail', params: { platformId: created.platformId } })
    } else if (selectedPlatformId.value) {
      const updated = await gatewayApi.updatePlatform(selectedPlatformId.value, platformForm)
      platforms.value = platforms.value.map((item) => (item.platformId === updated.platformId ? updated : item))
      fillPlatformForm(updated)
      successTitle = '平台保存成功'
      successText = `平台 ${updated.platformName || updated.platformId} 已更新。`
    }
    await loadPlatformRelated()
    if (successTitle) {
      showSuccessModal(successTitle, successText)
    }
  } catch (error) {
    showFailureModal('平台保存失败', error)
  } finally {
    saving.value = false
  }
}

function startKeyApply() {
  if (hasCurrentPlatformApiKey.value) return
  navigateTo({ name: 'platform-key-apply', params: { platformId: selectedPlatformId.value } })
}

async function submitKeyApply() {
  if (!selectedPlatformId.value) return
  saving.value = true
  try {
    await gatewayApi.submitKeyApply(selectedPlatformId.value, keyApplyForm)
    if (keyApplyFromDetail.value) {
      await router.push(platformDetailRoute.value)
    } else {
      myApplyStatus.value = 0
      await router.push({ name: 'my-key-applies' })
    }
    showSuccessModal('申请提交成功', 'API Key 申请已提交，请等待平台管理员审批。')
  } catch (error) {
    showFailureModal('申请提交失败', error)
  } finally {
    saving.value = false
  }
}

function startCreateTool() {
  if (!selectedPlatformId.value) return
  navigateTo({ name: 'tool-new', params: { platformId: selectedPlatformId.value } })
}

function startOpenApiImport() {
  if (!selectedPlatformId.value) return
  navigateTo({ name: 'tool-openapi', params: { platformId: selectedPlatformId.value } })
}

function openToolEditor(tool: PlatformTool) {
  if (!selectedPlatformId.value || !tool.toolId) return
  navigateTo({ name: 'tool-editor', params: { platformId: selectedPlatformId.value, toolId: tool.toolId } })
}

function previewStatusText(preview: ToolPreview) {
  if (preview.duplicate) return '已存在'
  return '新 Tool'
}

function isPreviewSaving(key: string) {
  return savingPreviewKeys.value.includes(key)
}

function isPreviewExpanded(key: string) {
  return expandedPreviewTools.value.includes(key)
}

function togglePreviewFields(key: string) {
  expandedPreviewTools.value = isPreviewExpanded(key)
    ? expandedPreviewTools.value.filter((item) => item !== key)
    : [...expandedPreviewTools.value, key]
}

function addPreviewMapping(preview: ToolPreview) {
  const mapping: ProtocolMapping = {
    mappingType: 'request',
    parentPath: '',
    fieldName: '',
    mcpPath: '',
    mcpType: 'string',
    mcpDesc: '',
    isRequired: 0,
    sortOrder: preview.mappings.length + 1,
  }
  preview.mappings.push(mapping)
}

function removePreviewMapping(preview: ToolPreview, index: number) {
  preview.mappings.splice(index, 1)
}

function addMapping() {
  if (!toolForm.mappings) {
    toolForm.mappings = []
  }
  const mapping: ProtocolMapping = {
    mappingType: 'request',
    parentPath: '',
    fieldName: '',
    mcpPath: '',
    mcpType: 'string',
    mcpDesc: '',
    isRequired: 0,
    sortOrder: toolForm.mappings.length + 1,
  }
  toolForm.mappings.push(mapping)
}

function removeMapping(index: number) {
  toolForm.mappings.splice(index, 1)
}

async function previewOpenApi() {
  if (!selectedPlatformId.value) return
  previewLoading.value = true
  previews.value = []
  expandedPreviewTools.value = []
  savingPreviewKeys.value = []
  try {
    previews.value = await gatewayApi.previewOpenApi(selectedPlatformId.value, {
      openApiJson: openApiForm.openApiJson,
    })
  } catch (error) {
    handleError(error)
  } finally {
    previewLoading.value = false
  }
}

async function savePreview(preview: ToolPreview, key: string) {
  if (!selectedPlatformId.value) return
  savingPreviewKeys.value = [...savingPreviewKeys.value, key]
  try {
    let successTitle = ''
    let successText = ''
    if (preview.duplicate && preview.existingToolId) {
      await gatewayApi.updateTool(selectedPlatformId.value, preview.existingToolId, preview)
      successTitle = 'Tool 覆盖更新成功'
      successText = `Tool ${preview.toolName} 已覆盖更新。`
    } else {
      await gatewayApi.createTool(selectedPlatformId.value, preview)
      successTitle = 'Tool 保存成功'
      successText = `Tool ${preview.toolName} 已导入。`
    }
    await loadPlatformRelated()
    showSuccessModal(successTitle, successText)
  } catch (error) {
    showFailureModal('Tool 保存失败', error)
  } finally {
    savingPreviewKeys.value = savingPreviewKeys.value.filter((item) => item !== key)
  }
}

async function saveTool() {
  if (!selectedPlatformId.value) return
  saving.value = true
  try {
    let successText = ''
    if (selectedToolId.value) {
      await gatewayApi.updateTool(selectedPlatformId.value, selectedToolId.value, toolForm)
      successText = `Tool ${toolForm.toolName} 已更新。`
    } else {
      await gatewayApi.createTool(selectedPlatformId.value, toolForm)
      successText = `Tool ${toolForm.toolName} 已创建。`
    }
    await loadPlatformRelated()
    await router.push(platformDetailRoute.value)
    showSuccessModal('Tool 保存成功', successText)
  } catch (error) {
    showFailureModal('Tool 保存失败', error)
  } finally {
    saving.value = false
  }
}

async function toggleTool(tool: PlatformTool) {
  if (!selectedPlatformId.value || !tool.toolId) return
  try {
    await gatewayApi.setToolEnable(selectedPlatformId.value, tool.toolId, tool.enable === 1 ? 0 : 1)
    await loadPlatformRelated()
    showSuccessModal('Tool 状态保存成功', `Tool ${tool.toolName} 已${tool.enable === 1 ? '禁用' : '启用'}。`)
  } catch (error) {
    showFailureModal('Tool 状态保存失败', error)
  }
}

async function removeTool(tool: PlatformTool) {
  if (!selectedPlatformId.value || !tool.toolId) return
  if (!confirm(`确认软删除 Tool ${tool.toolName}？`)) return
  try {
    await gatewayApi.deleteTool(selectedPlatformId.value, tool.toolId)
    await loadPlatformRelated()
    showSuccessModal('Tool 删除成功', `Tool ${tool.toolName} 已软删除。`)
  } catch (error) {
    showFailureModal('Tool 删除失败', error)
  }
}

async function addAdmin() {
  if (!selectedPlatformId.value || !newAdminUsername.value.trim()) return
  if (!isPlatformPrimaryAdmin.value) {
    showMessageModal('添加管理员失败', '仅平台负责人可添加普通管理员')
    return
  }
  try {
    await gatewayApi.addAdmin(selectedPlatformId.value, newAdminUsername.value.trim())
    newAdminUsername.value = ''
    const adminPage = await gatewayApi.listAdmins(selectedPlatformId.value, { pageNum: 1, pageSize: 100 })
    admins.value = adminPage.list
    showSuccessModal('管理员保存成功', '普通管理员已添加。')
  } catch (error) {
    showFailureModal('管理员保存失败', error)
  }
}

async function approveApply(apply: PlatformKeyApply) {
  if (!apply.id) return
  try {
    const approved = await gatewayApi.approveKeyApply(apply.platformId, apply.id)
    myApprovals.value = myApprovals.value.filter((item) => item.id !== apply.id)
    await loadMyApiKeys(apiKeyPage.value)
    showSuccessModal('审批保存成功', `已同意申请，API Key：${approved.apiKey}`)
  } catch (error) {
    showFailureModal('审批保存失败', error)
  }
}

async function rejectApply(apply: PlatformKeyApply) {
  if (!apply.id) return
  try {
    await gatewayApi.rejectKeyApply(apply.platformId, apply.id)
    myApprovals.value = myApprovals.value.filter((item) => item.id !== apply.id)
    showSuccessModal('审批保存成功', '已拒绝申请。')
  } catch (error) {
    showFailureModal('审批保存失败', error)
  }
}

async function changeMyApplyStatus(status: ApplyStatus) {
  myApplyStatus.value = status
  myApplyPage.value = 1
  await loadMyKeyApplies(1)
}

async function changeApprovalStatus(status: ApplyStatus) {
  approvalStatus.value = status
  approvalPage.value = 1
  await loadMyApprovals(1)
}

watch(
  () => route.fullPath,
  () => {
    void syncRoute()
  },
  { immediate: true },
)
</script>

<template>
  <main class="app-shell">
    <section v-if="viewName === 'login'" class="login-screen">
      <div class="login-panel">
        <span class="brand-mark"><Server :size="24" /></span>
        <h1>AI MCP Gateway</h1>
        <label>账号<input v-model="loginForm.username" placeholder="账号" @keyup.enter="login" /></label>
        <label>密码<input v-model="loginForm.password" type="password" placeholder="密码" @keyup.enter="login" /></label>
        <button class="primary wide login-submit" :disabled="saving" @click="login">
          <Activity v-if="saving" :size="16" />
          <KeyRound v-else :size="16" />
          登录
        </button>
      </div>
    </section>

    <template v-else>
      <aside class="sidebar">
        <button class="brand sidebar-brand" @click="navigate('platform-list')">
          <span class="brand-mark"><Server :size="20" /></span>
          <strong>AI MCP Gateway</strong>
        </button>
        <nav class="sidebar-nav">
          <button :class="{ active: activeMenu === 'platform-list' }" @click="navigate('platform-list')">
            <LayoutDashboard :size="17" />平台列表
          </button>
          <p>平台管理</p>
          <button :class="{ active: activeMenu === 'managed-platforms' }" @click="navigate('managed-platforms')">
            <ShieldCheck :size="17" />我管理的
          </button>
          <button :class="{ active: activeMenu === 'used-platforms' }" @click="navigate('used-platforms')">
            <Users :size="17" />我使用的
          </button>
          <p>审批</p>
          <button :class="{ active: activeMenu === 'my-key-applies' }" @click="navigate('my-key-applies')">
            <Inbox :size="17" />我的申请
          </button>
          <button :class="{ active: activeMenu === 'my-approvals' }" @click="navigate('my-approvals')">
            <ClipboardCheck :size="17" />我的审批
          </button>
          <p>API Key</p>
          <button :class="{ active: activeMenu === 'my-api-keys' }" @click="navigate('my-api-keys')">
            <KeyRound :size="17" />我的
          </button>
          <button :class="{ active: activeMenu === 'key-apply' }" @click="navigate('key-apply')">
            <Plus :size="17" />申请
          </button>
        </nav>
      </aside>

      <section class="main-area">
        <header class="app-header">
          <div></div>
          <div class="userbar">
            <span>{{ currentUser?.username }}</span>
            <button class="icon-button" title="退出登录" @click="requestLogout">
              <LogOut :size="16" />
            </button>
          </div>
        </header>

        <section class="workspace">
          <nav v-if="breadcrumbs.length" class="breadcrumb" aria-label="面包屑导航">
            <template v-for="(item, index) in breadcrumbs" :key="`${item.label}-${index}`">
              <button v-if="item.to" type="button" @click="navigateTo(item.to)">{{ item.label }}</button>
              <span v-else>{{ item.label }}</span>
              <em v-if="index < breadcrumbs.length - 1">/</em>
            </template>
          </nav>
          <div v-if="errorText" class="notice error">
            <AlertCircle :size="18" />
            <span>{{ errorText }}</span>
            <button class="ghost-icon" @click="clearError"><X :size="16" /></button>
          </div>
          <div v-if="toastText" class="notice success">
            <CheckCircle2 :size="18" />
            <span>{{ toastText }}</span>
          </div>

          <section v-if="viewName === 'platform-list'" class="page-stack">
            <div class="page-title platform-list-title">
              <div class="list-actions">
                <div class="search">
                  <Search :size="16" />
                  <input
                    v-model="searchText"
                    placeholder="搜索 platform 或名称"
                    @input="schedulePlatformSearch"
                    @keyup.enter="searchPlatforms"
                  />
                  <button v-if="searchText" class="search-clear" type="button" title="清空搜索" @click="clearPlatformSearch">
                    <X :size="14" />
                  </button>
                </div>
                <button class="primary" @click="startCreatePlatform"><Plus :size="16" />注册平台</button>
              </div>
            </div>
            <div v-if="loading" class="empty large-empty"><Activity :size="30" /><span>正在加载平台</span></div>
            <div v-else class="platform-grid">
              <button v-for="platform in platforms" :key="platform.platformId" class="platform-card" @click="openPlatform(platform, 'readonly')">
                <span class="card-topline">
                  <span class="status-dot" :class="{ off: platform.enable === 0 }"></span>
                  <span class="badge" :class="{ muted: platform.enable === 0 }">{{ platform.enable === 1 ? '启用' : '禁用' }}</span>
                </span>
                <strong>{{ platform.platformName }}</strong>
                <em>{{ platform.platformId }}</em>
                <p>{{ platform.platformDesc || '暂无描述' }}</p>
              </button>
              <div v-if="platforms.length === 0" class="empty large-empty"><Database :size="30" /><span>暂无匹配平台</span></div>
            </div>
            <div class="pagination">
              <span>共 {{ platformTotal }} 条</span>
              <div>
                <button class="secondary compact" :disabled="platformPage <= 1" @click="loadPlatforms(platformPage - 1)">上一页</button>
                <span>{{ platformPage }} / {{ pageCount(platformTotal) }}</span>
                <button class="secondary compact" :disabled="platformPage >= pageCount(platformTotal)" @click="loadPlatforms(platformPage + 1)">下一页</button>
              </div>
            </div>
          </section>

          <section v-if="viewName === 'managed-platforms'" class="page-stack">
            <div class="platform-grid">
              <button v-for="platform in adminPlatforms" :key="platform.platformId" class="platform-card" @click="openManagedPlatform(platform)">
                <span class="card-topline"><span class="status-dot"></span><span class="badge admin-badge">{{ platform.adminRole }}</span></span>
                <strong>{{ platform.platformName || platform.platformId }}</strong>
                <em>{{ platform.platformId }}</em>
                <p>点击进入平台编辑页面</p>
              </button>
              <div v-if="adminPlatforms.length === 0" class="empty large-empty"><ShieldCheck :size="30" /><span>暂无管理平台</span></div>
            </div>
            <div class="pagination">
              <span>共 {{ adminPlatformTotal }} 条</span>
              <div>
                <button class="secondary compact" :disabled="managedPage <= 1" @click="loadMyAdminPlatforms(managedPage - 1)">上一页</button>
                <span>{{ managedPage }} / {{ pageCount(adminPlatformTotal) }}</span>
                <button class="secondary compact" :disabled="managedPage >= pageCount(adminPlatformTotal)" @click="loadMyAdminPlatforms(managedPage + 1)">下一页</button>
              </div>
            </div>
          </section>

          <section v-if="viewName === 'used-platforms'" class="page-stack">
            <div class="platform-grid">
              <button v-for="platform in usedPlatforms" :key="platform.platformId" class="platform-card" @click="openPlatform(platform, 'readonly')">
                <span class="card-topline"><span class="status-dot"></span><span class="badge">已授权</span></span>
                <strong>{{ platform.platformName }}</strong>
                <em>{{ platform.platformId }}</em>
                <p>{{ platform.platformDesc || '点击查看平台详情' }}</p>
              </button>
              <div v-if="usedPlatforms.length === 0" class="empty large-empty"><KeyRound :size="30" /><span>暂无已授权平台</span></div>
            </div>
            <div class="pagination">
              <span>共 {{ usedPlatformTotal }} 条</span>
              <div>
                <button class="secondary compact" :disabled="usedPage <= 1" @click="loadMyUsedPlatforms(usedPage - 1)">上一页</button>
                <span>{{ usedPage }} / {{ pageCount(usedPlatformTotal) }}</span>
                <button class="secondary compact" :disabled="usedPage >= pageCount(usedPlatformTotal)" @click="loadMyUsedPlatforms(usedPage + 1)">下一页</button>
              </div>
            </div>
          </section>

          <section v-if="viewName === 'my-api-keys'" class="page-stack">
            <div class="panel">
              <div class="data-table api-key-table">
                <div class="data-head"><span>平台</span><span>API Key</span><span>状态</span></div>
                <button v-for="item in myApiKeys" :key="item.id || item.apiKey" class="data-row" @click="openPlatformById(item.platformId, 'readonly')">
                  <span><strong>{{ platformLabel(item.platformId) }}</strong><em>{{ item.platformId }}</em></span>
                  <code>{{ item.apiKey }}</code>
                  <span class="badge">{{ item.status === 1 ? '启用' : '禁用' }}</span>
                </button>
                <div v-if="myApiKeys.length === 0" class="empty compact-empty"><FileCheck2 :size="24" /><span>暂无 API Key</span></div>
              </div>
              <div class="pagination">
                <span>共 {{ myApiKeyTotal }} 条</span>
                <div>
                  <button class="secondary compact" :disabled="apiKeyPage <= 1" @click="loadMyApiKeys(apiKeyPage - 1)">上一页</button>
                  <span>{{ apiKeyPage }} / {{ pageCount(myApiKeyTotal) }}</span>
                  <button class="secondary compact" :disabled="apiKeyPage >= pageCount(myApiKeyTotal)" @click="loadMyApiKeys(apiKeyPage + 1)">下一页</button>
                </div>
              </div>
            </div>
          </section>

          <section v-if="viewName === 'my-key-applies'" class="page-stack">
            <div class="page-title page-actions-only">
              <div class="segment">
                <button v-for="option in statusOptions" :key="option.value" :class="{ active: myApplyStatus === option.value }" @click="changeMyApplyStatus(option.value)">{{ option.label }}</button>
              </div>
            </div>
            <div class="panel">
              <div class="data-table apply-table">
                <div class="data-head"><span>平台</span><span>申请理由</span><span>状态</span><span>创建时间</span></div>
                <button v-for="apply in myKeyApplies" :key="apply.id" class="data-row" @click="openPlatformById(apply.platformId, 'readonly')">
                  <span><strong>{{ platformLabel(apply.platformId) }}</strong><em>{{ apply.platformId }}</em></span>
                  <span>{{ apply.applyReason || '未填写申请理由' }}</span>
                  <span class="badge" :class="statusClass(apply.status)">{{ statusLabel(apply.status) }}</span>
                  <span>{{ formatTimestamp(apply.createTime) }}</span>
                </button>
                <div v-if="myKeyApplies.length === 0" class="empty compact-empty">暂无申请记录</div>
              </div>
              <div class="pagination">
                <span>共 {{ myKeyApplyTotal }} 条</span>
                <div>
                  <button class="secondary compact" :disabled="myApplyPage <= 1" @click="loadMyKeyApplies(myApplyPage - 1)">上一页</button>
                  <span>{{ myApplyPage }} / {{ pageCount(myKeyApplyTotal) }}</span>
                  <button class="secondary compact" :disabled="myApplyPage >= pageCount(myKeyApplyTotal)" @click="loadMyKeyApplies(myApplyPage + 1)">下一页</button>
                </div>
              </div>
            </div>
          </section>

          <section v-if="viewName === 'my-approvals'" class="page-stack">
            <div class="page-title page-actions-only">
              <div class="segment">
                <button v-for="option in statusOptions" :key="option.value" :class="{ active: approvalStatus === option.value }" @click="changeApprovalStatus(option.value)">{{ option.label }}</button>
              </div>
            </div>
            <div class="panel">
              <div class="data-table approval-table">
                <div class="data-head"><span>平台</span><span>申请人</span><span>申请理由</span><span>状态</span><span>操作</span></div>
                <button v-for="apply in myApprovals" :key="apply.id" class="data-row" @click="openPlatformById(apply.platformId, 'readonly')">
                  <span><strong>{{ platformLabel(apply.platformId) }}</strong><em>{{ apply.platformId }}</em></span>
                  <span>{{ apply.username }}</span>
                  <span>{{ apply.applyReason || '未填写申请理由' }}</span>
                  <span class="badge" :class="statusClass(apply.status)">{{ statusLabel(apply.status) }}</span>
                  <span class="row-actions" @click.stop>
                    <button v-if="apply.status === 0" class="secondary compact" @click="approveApply(apply)">同意</button>
                    <button v-if="apply.status === 0" class="secondary compact danger" @click="rejectApply(apply)">拒绝</button>
                    <span v-if="apply.status !== 0" class="hint">已处理</span>
                  </span>
                </button>
                <div v-if="myApprovals.length === 0" class="empty compact-empty">暂无审批记录</div>
              </div>
              <div class="pagination">
                <span>共 {{ myApprovalTotal }} 条</span>
                <div>
                  <button class="secondary compact" :disabled="approvalPage <= 1" @click="loadMyApprovals(approvalPage - 1)">上一页</button>
                  <span>{{ approvalPage }} / {{ pageCount(myApprovalTotal) }}</span>
                  <button class="secondary compact" :disabled="approvalPage >= pageCount(myApprovalTotal)" @click="loadMyApprovals(approvalPage + 1)">下一页</button>
                </div>
              </div>
            </div>
          </section>

          <section v-if="viewName === 'platform-detail'" class="page-stack">
            <div class="page-title">
              <div>
                <button class="back-link" @click="goBackToMenu"><ArrowLeft :size="16" />返回</button>
                
                <h1>{{ platformMode === 'create' ? '注册平台' : platformForm.platformName }}</h1>
              </div>
              <button v-if="showApplyApiKeyButton" class="primary" @click="startKeyApply">
                <KeyRound :size="16" />申请 API Key
              </button>
            </div>

            <section class="detail-layout" :class="{ 'create-layout': platformMode === 'create' }">
              <div class="panel">
                <div class="panel-head">
                  <div><h2>基础信息</h2></div>
                  <span v-if="canManagePlatform" class="badge">可编辑</span>
                </div>
                <div class="form-grid">
                  <label>Platform ID<input v-model="platformForm.platformId" :disabled="platformMode === 'edit'" placeholder="platform_001" /></label>
                  <label>名称<input v-model="platformForm.platformName" :disabled="!canManagePlatform" /></label>
                  <label>版本<input v-model="platformForm.version" :disabled="!canManagePlatform" /></label>
                  <label>鉴权<select v-model.number="platformForm.auth" :disabled="!canManagePlatform"><option :value="0">不校验</option><option :value="1">强校验</option></select></label>
                  <label class="wide">描述<textarea v-model="platformForm.platformDesc" :disabled="!canManagePlatform" rows="4"></textarea></label>
                </div>
                <div v-if="canManagePlatform" class="form-footer">
                  <label class="toggle"><input v-model.number="platformForm.enable" type="checkbox" :true-value="1" :false-value="0" /><span></span>{{ platformForm.enable === 1 ? '启用平台' : '禁用平台' }}</label>
                  <div class="footer-actions">
                    <button class="primary" :disabled="saving" @click="savePlatform"><Save :size="16" />保存</button>
                  </div>
                </div>
              </div>

              <div v-if="platformMode === 'edit'" class="panel tools-panel">
                <div class="panel-head">
                  <div><h2>Tool 列表</h2></div>
                  <div v-if="canManagePlatform" class="list-actions compact-actions">
                    <button class="secondary" @click="startOpenApiImport"><FileJson :size="16" />OpenAPI 导入</button>
                    <button class="secondary" @click="startCreateTool"><Plus :size="16" />新增 Tool</button>
                  </div>
                </div>
                <div v-if="toolLoading" class="empty"><Activity :size="28" /><span>正在加载</span></div>
                <div v-else class="tool-table" :class="{ readonly: !canManagePlatform }">
                  <div class="table-head">
                    <span>工具</span><span>协议</span><span v-if="canManagePlatform">状态</span><span v-if="canManagePlatform">操作</span>
                  </div>
                  <button v-for="tool in tools" :key="tool.toolId || tool.toolName" class="table-row" @click="openToolEditor(tool)">
                    <span><strong>{{ tool.toolName }}</strong><em>{{ tool.toolDescription || '暂无描述' }}</em></span>
                    <span>{{ tool.httpConfig?.httpMethod?.toUpperCase() || 'HTTP' }}</span>
                    <span v-if="canManagePlatform" class="badge" :class="{ muted: tool.enable === 0 }">{{ tool.enable === 1 ? '启用' : '禁用' }}</span>
                    <span v-if="canManagePlatform" class="row-actions" @click.stop>
                      <button class="icon-button" title="编辑" @click="openToolEditor(tool)"><Pencil :size="15" /></button>
                      <button class="icon-button" title="启停" @click="toggleTool(tool)"><Power :size="15" /></button>
                      <button class="icon-button danger" title="软删除" @click="removeTool(tool)"><Trash2 :size="15" /></button>
                    </span>
                  </button>
                  <div v-if="tools.length === 0" class="empty compact-empty"><Wrench :size="24" /><span>暂无 Tool</span></div>
                </div>
              </div>
            </section>

            <section v-if="platformMode === 'edit' && canManagePlatform" class="admin-grid single">
              <div class="panel">
                <div class="panel-head"><div><h2>平台管理员</h2></div><ShieldCheck :size="18" /></div>
                <div class="admin-sections">
                  <section>
                    <div class="owner-line">
                      <strong>负责人</strong>
                      <span v-if="primaryAdminNames">{{ primaryAdminNames }}</span>
                      <span v-else class="muted">暂无负责人</span>
                    </div>
                  </section>
                  <section>
                    <div class="subsection-title"><strong>普通管理员</strong><span>{{ normalAdmins.length }} 人</span></div>
                    <div v-if="isPlatformPrimaryAdmin" class="inline-form">
                      <input v-model="newAdminUsername" placeholder="账号" />
                      <button class="secondary" @click="addAdmin"><UserPlus :size="16" />添加</button>
                    </div>
                    <p v-else class="hint admin-hint">仅平台负责人可添加普通管理员</p>
                    <div class="list">
                      <span v-for="admin in normalAdmins" :key="admin.id || admin.username"><b>{{ admin.username }}</b><em>普通管理员</em></span>
                      <div v-if="normalAdmins.length === 0" class="empty compact-empty">暂无普通管理员</div>
                    </div>
                  </section>
                </div>
              </div>
            </section>
          </section>

          <section v-if="viewName === 'key-apply'" class="page-stack narrow">
            <div class="panel">
              <div class="panel-head"><div><h2>授权申请</h2></div></div>
              <div class="form-grid">
                <label>用户名<input :value="currentUser?.username" disabled /></label>
                <label v-if="!keyApplyFromDetail" class="wide platform-picker">
                  平台搜索
                  <div class="search">
                    <Search :size="16" />
                    <input
                      v-model="keyApplyPlatformKeyword"
                      placeholder="输入 platform 或名称搜索"
                      @input="handleKeyApplyPlatformInput"
                      @keyup.enter="searchKeyApplyPlatforms"
                    />
                  </div>
                  <div v-if="keyApplyPlatformLoading" class="option-list muted-list">正在搜索</div>
                  <div v-else-if="keyApplyPlatformOptions.length" class="option-list">
                    <button
                      v-for="platform in keyApplyPlatformOptions"
                      :key="platform.platformId"
                      type="button"
                      @click="selectKeyApplyPlatform(platform)"
                    >
                      <strong>{{ platform.platformName }}</strong>
                      <em>{{ platform.platformId }}</em>
                    </button>
                  </div>
                </label>
                <label>平台 ID<input :value="selectedPlatformId" disabled /></label>
                <label class="wide">申请理由<textarea v-model="keyApplyForm.applyReason" rows="5" placeholder="可选"></textarea></label>
              </div>
              <div class="form-footer">
                <button class="primary" :disabled="saving || !selectedPlatformId" @click="submitKeyApply">
                  <Save :size="16" />提交申请
                </button>
              </div>
            </div>
          </section>

          <section v-if="viewName === 'tool-openapi'" class="page-stack">
            <button class="back-link" @click="navigateTo(backRoute)"><ArrowLeft :size="16" />返回平台</button>
            <div class="panel">
              <div class="panel-head">
                <div><h2>OpenAPI 导入</h2></div>
                <button class="primary" :disabled="previewLoading || !openApiForm.openApiJson.trim()" @click="previewOpenApi">
                  <FileJson :size="16" />{{ previewLoading ? '解析中' : '解析预览' }}
                </button>
              </div>
              <label>
                OpenAPI JSON
                <textarea v-model="openApiForm.openApiJson" class="json-area" rows="16"></textarea>
              </label>
              <div v-if="previews.length" class="preview-list">
                <article v-for="(preview, previewIndex) in previews" :key="`${preview.toolName}-${previewIndex}`" class="preview-card">
                  <div class="preview-row">
                    <div class="preview-summary">
                      <strong>{{ preview.toolName }}</strong>
                      <em>{{ preview.toolDescription || '暂无描述' }}</em>
                    </div>
                    <span class="badge" :class="{ warning: preview.duplicate }">{{ previewStatusText(preview) }}</span>
                    <span class="badge">{{ preview.httpConfig.httpMethod.toUpperCase() }}</span>
                    <span class="badge">{{ preview.mappings.length }} 字段</span>
                    <button class="secondary compact" @click="togglePreviewFields(String(previewIndex))">
                      <ChevronUp v-if="isPreviewExpanded(String(previewIndex))" :size="15" />
                      <ChevronDown v-else :size="15" />
                      {{ isPreviewExpanded(String(previewIndex)) ? '收起字段' : '展开字段' }}
                    </button>
                    <button
                      class="secondary"
                      :disabled="isPreviewSaving(String(previewIndex))"
                      @click="savePreview(preview, String(previewIndex))"
                    >
                      <Activity v-if="isPreviewSaving(String(previewIndex))" :size="15" />
                      <Save v-else :size="15" />
                      {{ preview.duplicate ? '覆盖更新' : '保存 Tool' }}
                    </button>
                  </div>
                  <p v-if="preview.duplicate" class="preview-conflict-hint">
                    Tool 名称已存在，保存时会覆盖更新已有 Tool 配置。
                  </p>
                  <div v-if="isPreviewExpanded(String(previewIndex))" class="preview-fields">
                    <div class="preview-draft-grid">
                      <label>
                        Tool Name
                        <input v-model="preview.toolName" />
                      </label>
                      <label>
                        方法
                        <select v-model="preview.httpConfig.httpMethod">
                          <option value="get">GET</option>
                          <option value="post">POST</option>
                          <option value="put">PUT</option>
                          <option value="delete">DELETE</option>
                        </select>
                      </label>
                      <label class="wide">
                        HTTP URL
                        <input v-model="preview.httpConfig.httpUrl" />
                      </label>
                      <label class="wide">
                        描述
                        <textarea v-model="preview.toolDescription" rows="2"></textarea>
                      </label>
                    </div>
                    <div class="preview-section-title">
                      <strong>字段映射</strong>
                      <button class="secondary compact" @click="addPreviewMapping(preview)">
                        <Plus :size="15" />
                        添加字段
                      </button>
                    </div>
                    <div class="preview-field-head">
                      <span>平台接口字段</span>
                      <span>MCP 入参路径</span>
                      <span>类型</span>
                      <span>必填</span>
                      <span>字段说明</span>
                      <span>操作</span>
                    </div>
                    <div v-for="(mapping, index) in preview.mappings" :key="index" class="preview-field-row">
                      <input v-model="mapping.fieldName" placeholder="平台接口字段" />
                      <input v-model="mapping.mcpPath" placeholder="MCP 入参路径" />
                      <select v-model="mapping.mcpType">
                        <option value="string">string</option>
                        <option value="number">number</option>
                        <option value="boolean">boolean</option>
                        <option value="object">object</option>
                        <option value="array">array</option>
                      </select>
                      <label class="preview-required">
                        <input v-model.number="mapping.isRequired" type="checkbox" :true-value="1" :false-value="0" />
                        {{ mapping.isRequired === 1 ? '必填' : '可选' }}
                      </label>
                      <input v-model="mapping.mcpDesc" placeholder="字段说明" />
                      <button class="icon-button danger" @click="removePreviewMapping(preview, index)">
                        <Trash2 :size="14" />
                      </button>
                    </div>
                    <div v-if="preview.mappings.length === 0" class="empty compact-empty">
                      <Braces :size="20" />
                      <span>该接口没有解析到可导入字段。</span>
                    </div>
                  </div>
                </article>
              </div>
              <div v-else class="empty compact-empty"><FileJson :size="24" /><span>解析后展示可导入的 Tool</span></div>
            </div>
          </section>

          <section v-if="viewName === 'tool-editor'" class="page-stack">
            <button class="back-link" @click="navigateTo(backRoute)"><ArrowLeft :size="16" />返回平台</button>
            <div class="panel">
              <div class="panel-head">
                <div><h2>{{ selectedTool ? (canManagePlatform ? '编辑 Tool' : 'Tool 详情') : '新增 Tool' }}</h2></div>
                <span v-if="canManagePlatform" class="badge">可编辑</span>
              </div>
              <div class="form-grid">
                <label>Tool Name<input v-model="toolForm.toolName" :disabled="!canManagePlatform" /></label>
                <label>版本<input v-model="toolForm.toolVersion" :disabled="!canManagePlatform" /></label>
                <label>HTTP Method<select v-model="toolForm.httpConfig.httpMethod" :disabled="!canManagePlatform"><option value="get">GET</option><option value="post">POST</option><option value="put">PUT</option><option value="delete">DELETE</option></select></label>
                <label>Timeout<input v-model.number="toolForm.httpConfig.timeout" type="number" min="1000" step="1000" :disabled="!canManagePlatform" /></label>
                <label class="wide">HTTP URL<input v-model="toolForm.httpConfig.httpUrl" placeholder="http://localhost:8701/api/v1/mcp/demo" :disabled="!canManagePlatform" /></label>
                <label class="wide">描述<textarea v-model="toolForm.toolDescription" rows="3" :disabled="!canManagePlatform"></textarea></label>
                <label class="wide">Headers<textarea v-model="toolForm.httpConfig.httpHeaders" rows="3" :disabled="!canManagePlatform"></textarea></label>
              </div>
              <div v-if="canManagePlatform" class="mapping-editor">
                <div class="mapping-head">
                  <div>
                    <strong>字段映射</strong>
                    <p class="mapping-hint">
                      定义 MCP 客户端传入的参数，如何映射到平台方 HTTP 接口字段。
                    </p>
                  </div>
                  <button class="secondary compact" @click="addMapping">
                    <Plus :size="15" />
                    添加字段
                  </button>
                </div>
                <div class="mapping-table-head">
                  <span>
                    平台接口字段
                    <em>平台方 HTTP 接口最终接收的字段名</em>
                  </span>
                  <span>
                    MCP 入参路径
                    <em>MCP 客户端调用 Tool 时填写的参数路径</em>
                  </span>
                  <span>
                    参数类型
                    <em>用于生成 schema 和参数校验</em>
                  </span>
                  <span>
                    是否必填
                    <em>勾选后客户端必须提供</em>
                  </span>
                  <span>操作</span>
                </div>
                <div v-for="(mapping, index) in toolForm.mappings" :key="index" class="mapping-row">
                  <input v-model="mapping.fieldName" placeholder="例如 city 或 company.name" />
                  <input v-model="mapping.mcpPath" placeholder="例如 city 或 company.name" />
                  <select v-model="mapping.mcpType">
                    <option value="string">string</option>
                    <option value="number">number</option>
                    <option value="boolean">boolean</option>
                    <option value="object">object</option>
                    <option value="array">array</option>
                  </select>
                  <label class="inline-check">
                    <input v-model.number="mapping.isRequired" type="checkbox" :true-value="1" :false-value="0" />
                    必填
                  </label>
                  <button class="icon-button danger" @click="removeMapping(index)">
                    <Trash2 :size="14" />
                  </button>
                </div>
                <div v-if="toolForm.mappings.length === 0" class="mapping-empty">
                  <Braces :size="20" />
                  <span>暂无映射配置</span>
                </div>
              </div>
              <div v-else class="mapping-view">
                <div class="mapping-view-head">
                  <strong>字段映射</strong>
                  <span>{{ toolForm.mappings?.length || 0 }} 条</span>
                </div>
                <div v-if="toolForm.mappings?.length" class="mapping-view-table">
                  <div class="mapping-view-row heading">
                    <span>方向</span><span>字段</span><span>MCP 路径</span><span>类型</span><span>必填</span><span>说明</span>
                  </div>
                  <div v-for="(mapping, index) in toolForm.mappings" :key="`${mapping.mappingType}-${mapping.fieldName}-${index}`" class="mapping-view-row">
                    <span>{{ mapping.mappingType === 'request' ? '请求' : '响应' }}</span>
                    <span><b>{{ mapping.fieldName }}</b><em v-if="mapping.parentPath">{{ mapping.parentPath }}</em></span>
                    <code>{{ mapping.mcpPath }}</code>
                    <span>{{ mapping.mcpType }}</span>
                    <span>{{ mapping.isRequired === 1 ? '是' : '否' }}</span>
                    <span>{{ mapping.mcpDesc || '-' }}</span>
                  </div>
                </div>
                <div v-else class="empty compact-empty">暂无映射配置</div>
              </div>
              <div v-if="canManagePlatform" class="form-footer">
                <label class="toggle"><input v-model.number="toolForm.enable" type="checkbox" :true-value="1" :false-value="0" /><span></span>{{ toolForm.enable === 1 ? '启用 Tool' : '禁用 Tool' }}</label>
                <button class="primary" :disabled="saving" @click="saveTool"><Save :size="16" />保存 Tool</button>
              </div>
            </div>
          </section>
        </section>
      </section>

      <div v-if="messageModal" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="message-modal-title" @click.self="closeMessageModal">
        <div class="result-modal" :class="messageModal.type">
          <span class="result-modal-icon">
            <CheckCircle2 v-if="messageModal.type === 'success'" :size="22" />
            <AlertCircle v-if="messageModal.type === 'error'" :size="22" />
            <TriangleAlert v-if="messageModal.type === 'warning'" :size="22" />
          </span>
          <div class="result-modal-body">
            <h2 id="message-modal-title">{{ messageModal.title }}</h2>
            <p>{{ messageModal.text }}</p>
          </div>
          <button class="primary" @click="closeMessageModal">知道了</button>
        </div>
      </div>

      <div v-if="logoutConfirmOpen" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="logout-title">
        <div class="result-modal warning">
          <span class="result-modal-icon"><TriangleAlert :size="22" /></span>
          <div class="result-modal-body">
            <h2 id="logout-title">确认退出登录？</h2>
            <p>退出后需要重新登录才能继续访问控制台。</p>
          </div>
          <div class="modal-actions">
            <button class="secondary" @click="cancelLogout">取消</button>
            <button class="primary" @click="confirmLogout">确认退出</button>
          </div>
        </div>
      </div>
    </template>
  </main>
</template>
