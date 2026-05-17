<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Database,
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
  UserAccount,
} from './types/gateway'

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
type DetailMode = 'readonly' | 'manage'
type ApplyStatus = 0 | 1 | 2
type MessageModalState = { type: 'error' | 'warning'; title: string; text: string } | null

const DEFAULT_PAGE_SIZE = 10
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
const saving = ref(false)
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

function showMessageModal(title: string, text: string, type: 'error' | 'warning' = 'error') {
  messageModal.value = { title, text, type }
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

async function bootstrap() {
  if (!token.value) return
  setAuthToken(token.value)
  try {
    await loadMe()
    await Promise.all([loadPlatforms(1), loadMyApiKeys(1)])
    viewName.value = 'platform-list'
    activeMenu.value = 'platform-list'
  } catch (error) {
    setAuthToken('')
    token.value = ''
    viewName.value = 'login'
    handleError(error)
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
    await Promise.all([loadPlatforms(1), loadMyApiKeys(1)])
    viewName.value = 'platform-list'
    activeMenu.value = 'platform-list'
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
  viewName.value = 'login'
}

async function navigate(view: ViewName) {
  clearError()
  activeMenu.value = view
  viewName.value = view
  selectedPlatformId.value = ''
  selectedToolId.value = null
  currentPlatformApiKey.value = null
  if (view !== 'key-apply') {
    keyApplyFromDetail.value = false
  }
  if (view === 'platform-list') await loadPlatforms(1)
  if (view === 'managed-platforms') await loadMyAdminPlatforms(1)
  if (view === 'used-platforms') await loadMyUsedPlatforms(1)
  if (view === 'my-api-keys') await loadMyApiKeys(1)
  if (view === 'key-apply') {
    keyApplyFromDetail.value = false
    resetKeyApplyState()
  }
  if (view === 'my-key-applies') {
    myApplyPage.value = 1
    await loadMyKeyApplies(1)
  }
  if (view === 'my-approvals') {
    approvalPage.value = 1
    await loadMyApprovals(1)
  }
  if (view === 'register-platform') startCreatePlatform()
}

async function searchPlatforms() {
  platformPage.value = 1
  await loadPlatforms(1)
}

async function openPlatformById(platformId: string, mode: DetailMode) {
  clearError()
  const cached = platforms.value.find((item) => item.platformId === platformId) || usedPlatforms.value.find((item) => item.platformId === platformId)
  if (cached) {
    await openPlatform(cached, mode)
    return
  }
  try {
    const platform = await gatewayApi.getPlatform(platformId)
    await openPlatform(platform, mode)
  } catch (error) {
    handleError(error)
  }
}

async function openManagedPlatform(platform: PlatformAdmin) {
  const cached = platforms.value.find((item) => item.platformId === platform.platformId) || usedPlatforms.value.find((item) => item.platformId === platform.platformId)
  if (cached) {
    await openPlatform(cached, 'manage')
    return
  }
  await openPlatformById(platform.platformId, 'manage')
}

async function openPlatform(platform: PlatformGateway, mode: DetailMode) {
  selectedPlatformId.value = platform.platformId
  selectedToolId.value = null
  currentPlatformApiKey.value = null
  detailMode.value = mode
  platformMode.value = 'edit'
  fillPlatformForm(platform)
  viewName.value = 'platform-detail'
  await Promise.all([loadPlatformRelated(), loadCurrentPlatformApiKey()])
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
  viewName.value = activeMenu.value === 'key-apply' ? 'platform-list' : activeMenu.value
}

function startCreatePlatform() {
  selectedPlatformId.value = ''
  selectedToolId.value = null
  currentPlatformApiKey.value = null
  platformApiKeyLoading.value = false
  detailMode.value = 'manage'
  platformMode.value = 'create'
  tools.value = []
  admins.value = []
  resetPlatformForm()
  viewName.value = 'platform-detail'
}

async function savePlatform() {
  saving.value = true
  try {
    if (platformMode.value === 'create') {
      const created = await gatewayApi.createPlatform(platformForm)
      selectedPlatformId.value = created.platformId
      fillPlatformForm(created)
      await loadMe()
      await loadPlatforms(1)
      platformMode.value = 'edit'
      detailMode.value = 'manage'
      activeMenu.value = 'managed-platforms'
      showToast('平台已注册')
    } else if (selectedPlatformId.value) {
      const updated = await gatewayApi.updatePlatform(selectedPlatformId.value, platformForm)
      platforms.value = platforms.value.map((item) => (item.platformId === updated.platformId ? updated : item))
      fillPlatformForm(updated)
      showToast('平台已更新')
    }
    await loadPlatformRelated()
  } catch (error) {
    handleError(error)
  } finally {
    saving.value = false
  }
}

function startKeyApply() {
  if (hasCurrentPlatformApiKey.value) return
  resetKeyApplyState()
  keyApplyFromDetail.value = true
  keyApplyPlatformKeyword.value = selectedPlatformId.value
  viewName.value = 'key-apply'
}

async function goBackFromKeyApply() {
  if (keyApplyFromDetail.value) {
    viewName.value = 'platform-detail'
    return
  }
  await navigate('my-api-keys')
}

async function submitKeyApply() {
  if (!selectedPlatformId.value) return
  saving.value = true
  try {
    await gatewayApi.submitKeyApply(selectedPlatformId.value, keyApplyForm)
    if (keyApplyFromDetail.value) {
      viewName.value = 'platform-detail'
    } else {
      activeMenu.value = 'my-key-applies'
      viewName.value = 'my-key-applies'
      myApplyStatus.value = 0
      await loadMyKeyApplies(1)
    }
    showToast('API Key 申请已提交')
  } catch (error) {
    showMessageModal('申请提交失败', errorMessage(error))
  } finally {
    saving.value = false
  }
}

function startCreateTool() {
  selectedToolId.value = null
  Object.assign(toolForm, blankTool())
  viewName.value = 'tool-editor'
}

function openToolEditor(tool: PlatformTool) {
  selectedToolId.value = tool.toolId || null
  Object.assign(toolForm, JSON.parse(JSON.stringify(tool)))
  viewName.value = 'tool-editor'
}

async function saveTool() {
  if (!selectedPlatformId.value) return
  saving.value = true
  try {
    if (selectedToolId.value) {
      await gatewayApi.updateTool(selectedPlatformId.value, selectedToolId.value, toolForm)
      showToast('Tool 已更新')
    } else {
      await gatewayApi.createTool(selectedPlatformId.value, toolForm)
      showToast('Tool 已创建')
    }
    viewName.value = 'platform-detail'
    await loadPlatformRelated()
  } catch (error) {
    handleError(error)
  } finally {
    saving.value = false
  }
}

async function toggleTool(tool: PlatformTool) {
  if (!selectedPlatformId.value || !tool.toolId) return
  try {
    await gatewayApi.setToolEnable(selectedPlatformId.value, tool.toolId, tool.enable === 1 ? 0 : 1)
    await loadPlatformRelated()
  } catch (error) {
    handleError(error)
  }
}

async function removeTool(tool: PlatformTool) {
  if (!selectedPlatformId.value || !tool.toolId) return
  if (!confirm(`确认软删除 Tool ${tool.toolName}？`)) return
  try {
    await gatewayApi.deleteTool(selectedPlatformId.value, tool.toolId)
    await loadPlatformRelated()
  } catch (error) {
    handleError(error)
  }
}

async function addAdmin() {
  if (!selectedPlatformId.value || !newAdminUsername.value.trim()) return
  if (!isPlatformPrimaryAdmin.value) {
    handleError(new Error('仅平台负责人可添加普通管理员'))
    return
  }
  try {
    await gatewayApi.addAdmin(selectedPlatformId.value, newAdminUsername.value.trim())
    newAdminUsername.value = ''
    const adminPage = await gatewayApi.listAdmins(selectedPlatformId.value, { pageNum: 1, pageSize: 100 })
    admins.value = adminPage.list
    showToast('管理员已添加')
  } catch (error) {
    handleError(error)
  }
}

async function approveApply(apply: PlatformKeyApply) {
  if (!apply.id) return
  try {
    const approved = await gatewayApi.approveKeyApply(apply.platformId, apply.id)
    myApprovals.value = myApprovals.value.filter((item) => item.id !== apply.id)
    await loadMyApiKeys(apiKeyPage.value)
    showToast(`已同意，API Key：${approved.apiKey}`)
  } catch (error) {
    handleError(error)
  }
}

async function rejectApply(apply: PlatformKeyApply) {
  if (!apply.id) return
  try {
    await gatewayApi.rejectKeyApply(apply.platformId, apply.id)
    myApprovals.value = myApprovals.value.filter((item) => item.id !== apply.id)
    showToast('已拒绝申请')
  } catch (error) {
    handleError(error)
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

onMounted(bootstrap)
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
                  <input v-model="searchText" placeholder="搜索 platform 或名称" @keyup.enter="searchPlatforms" />
                </div>
                <button class="primary" @click="startCreatePlatform"><Plus :size="16" />注册平台</button>
                <button class="secondary" @click="searchPlatforms">搜索</button>
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
            <div class="page-title"><div><h1>我管理的</h1></div></div>
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
            <div class="page-title"><div><h1>我使用的</h1></div></div>
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
            <div class="page-title"><div><h1>我的 API Key</h1></div></div>
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
            <div class="page-title">
              <div><h1>我的申请</h1></div>
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
            <div class="page-title">
              <div><h1>我的审批</h1></div>
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
                  <button v-if="canManagePlatform" class="secondary" @click="startCreateTool"><Plus :size="16" />新增 Tool</button>
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
            <button class="back-link" @click="goBackFromKeyApply">
              <ArrowLeft :size="16" />{{ keyApplyFromDetail ? '返回平台' : '返回我的 API Key' }}
            </button>
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

          <section v-if="viewName === 'tool-editor'" class="page-stack">
            <button class="back-link" @click="viewName = 'platform-detail'"><ArrowLeft :size="16" />返回平台</button>
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
              <div class="mapping-view">
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
            <AlertCircle v-if="messageModal.type === 'error'" :size="22" />
            <TriangleAlert v-else :size="22" />
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
