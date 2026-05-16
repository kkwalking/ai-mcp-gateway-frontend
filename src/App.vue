<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Braces,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Database,
  FileJson,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Save,
  Search,
  Server,
  Trash2,
  UploadCloud,
  Wrench,
  X,
} from '@lucide/vue'
import { gatewayApi } from './api/gateway'
import type { PlatformGateway, PlatformPayload, PlatformTool, ToolPreview } from './types/gateway'
import { sampleOpenApiJson } from './utils/samples'

type ViewName = 'platforms' | 'platform-detail' | 'tool-detail' | 'tool-manual' | 'tool-openapi'
type ResultModalState = { type: 'success' | 'error'; title: string; text: string } | null
type OverwriteConfirmState = { preview: ToolPreview; key: string } | null

const platforms = ref<PlatformGateway[]>([])
const tools = ref<PlatformTool[]>([])
const previews = ref<ToolPreview[]>([])
const expandedPreviewTools = ref<string[]>([])
const savingPreviewKeys = ref<string[]>([])
const resultModal = ref<ResultModalState>(null)
const overwriteConfirm = ref<OverwriteConfirmState>(null)
const toolCounts = ref<Record<string, number>>({})
const selectedPlatformId = ref('')
const selectedToolId = ref<number | null>(null)
const viewName = ref<ViewName>('platforms')
const platformMode = ref<'create' | 'edit'>('edit')
const searchText = ref('')
const toolFilter = ref<'all' | 'enabled' | 'disabled'>('all')
const toolPage = ref(1)
const pageSize = ref(6)
const loading = ref(false)
const toolLoading = ref(false)
const previewLoading = ref(false)
const errorText = ref('')
const toastText = ref('')

const platformForm = reactive<PlatformPayload>({
  platformId: '',
  platformName: '',
  platformDesc: '',
  version: '1.0.0',
  auth: 0,
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

const openApiForm = reactive({
  openApiJson: sampleOpenApiJson,
})

const selectedPlatform = computed(() =>
  platforms.value.find((platform) => platform.platformId === selectedPlatformId.value),
)

const selectedTool = computed(() =>
  tools.value.find((tool) => tool.toolId === selectedToolId.value),
)

const filteredPlatforms = computed(() => {
  const keyword = searchText.value.trim().toLowerCase()
  if (!keyword) return platforms.value
  return platforms.value.filter((item) =>
    [item.platformId, item.platformName, item.platformDesc]
      .filter(Boolean)
      .some((text) => String(text).toLowerCase().includes(keyword)),
  )
})

const activeTools = computed(() => tools.value.filter((tool) => tool.enable === 1).length)
const disabledTools = computed(() => tools.value.filter((tool) => tool.enable === 0).length)
const filteredTools = computed(() => {
  if (toolFilter.value === 'enabled') return tools.value.filter((tool) => tool.enable === 1)
  if (toolFilter.value === 'disabled') return tools.value.filter((tool) => tool.enable === 0)
  return tools.value
})
const totalToolPages = computed(() => Math.max(1, Math.ceil(filteredTools.value.length / pageSize.value)))
const pagedTools = computed(() => {
  const page = Math.min(toolPage.value, totalToolPages.value)
  const start = (page - 1) * pageSize.value
  return filteredTools.value.slice(start, start + pageSize.value)
})

function showToast(text: string) {
  toastText.value = text
  window.setTimeout(() => {
    if (toastText.value === text) toastText.value = ''
  }, 2600)
}

function fail(error: unknown) {
  errorText.value = error instanceof Error ? error.message : String(error)
}

function clearError() {
  errorText.value = ''
}

function closeResultModal() {
  resultModal.value = null
}

function closeOverwriteConfirm() {
  overwriteConfirm.value = null
}

function resetPlatformForm() {
  Object.assign(platformForm, {
    platformId: '',
    platformName: '',
    platformDesc: '',
    version: '1.0.0',
    auth: 0,
    enable: 1,
  })
}

function fillPlatformForm(platform: PlatformGateway) {
  platformForm.platformId = platform.platformId
  platformForm.platformName = platform.platformName
  platformForm.platformDesc = platform.platformDesc || ''
  platformForm.version = platform.version || '1.0.0'
  platformForm.auth = platform.auth ?? 0
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

function fillToolForm(tool: PlatformTool) {
  Object.assign(toolForm, JSON.parse(JSON.stringify(tool)))
}

async function loadPlatforms() {
  loading.value = true
  clearError()
  try {
    platforms.value = await gatewayApi.listPlatforms()
    if (selectedPlatformId.value) {
      const current = platforms.value.find((item) => item.platformId === selectedPlatformId.value)
      if (current) fillPlatformForm(current)
    }
    await refreshToolCounts()
  } catch (error) {
    fail(error)
  } finally {
    loading.value = false
  }
}

async function refreshToolCounts() {
  const entries = await Promise.all(
    platforms.value.map(async (platform) => {
      try {
        const list = await gatewayApi.listTools(platform.platformId)
        return [platform.platformId, list.length] as const
      } catch {
        return [platform.platformId, 0] as const
      }
    }),
  )
  toolCounts.value = Object.fromEntries(entries)
}

async function loadTools() {
  if (!selectedPlatformId.value) {
    tools.value = []
    return
  }
  toolLoading.value = true
  clearError()
  try {
    tools.value = await gatewayApi.listTools(selectedPlatformId.value)
    if (selectedToolId.value && !tools.value.some((item) => item.toolId === selectedToolId.value)) {
      selectedToolId.value = null
    }
    if (toolPage.value > totalToolPages.value) toolPage.value = totalToolPages.value
    toolCounts.value = { ...toolCounts.value, [selectedPlatformId.value]: tools.value.length }
  } catch (error) {
    fail(error)
  } finally {
    toolLoading.value = false
  }
}

function goPlatformList() {
  viewName.value = 'platforms'
  selectedPlatformId.value = ''
  selectedToolId.value = null
  tools.value = []
  previews.value = []
  platformMode.value = 'edit'
}

async function openPlatform(platform: PlatformGateway) {
  selectedPlatformId.value = platform.platformId
  selectedToolId.value = null
  platformMode.value = 'edit'
  toolPage.value = 1
  toolFilter.value = 'all'
  fillPlatformForm(platform)
  viewName.value = 'platform-detail'
  await loadTools()
}

function startCreatePlatform() {
  selectedPlatformId.value = ''
  selectedToolId.value = null
  platformMode.value = 'create'
  tools.value = []
  resetPlatformForm()
  viewName.value = 'platform-detail'
}

async function savePlatform() {
  clearError()
  try {
    if (platformMode.value === 'create') {
      const created = await gatewayApi.createPlatform(platformForm)
      platforms.value = [created, ...platforms.value.filter((item) => item.platformId !== created.platformId)]
      selectedPlatformId.value = created.platformId
      platformMode.value = 'edit'
      fillPlatformForm(created)
      await loadTools()
      await refreshToolCounts()
      showToast('平台方已注册')
      return
    }

    if (selectedPlatformId.value) {
      const updated = await gatewayApi.updatePlatform(selectedPlatformId.value, platformForm)
      platforms.value = platforms.value.map((item) => (item.platformId === updated.platformId ? updated : item))
      fillPlatformForm(updated)
      showToast('平台方已更新')
    }
  } catch (error) {
    fail(error)
  }
}

async function togglePlatform(platform: PlatformGateway) {
  clearError()
  try {
    const enable = platform.enable === 1 ? 0 : 1
    await gatewayApi.setPlatformEnable(platform.platformId, enable)
    platform.enable = enable
    if (platform.platformId === selectedPlatformId.value) platformForm.enable = enable
    showToast(enable === 1 ? '平台方已启用' : '平台方已禁用')
  } catch (error) {
    fail(error)
  }
}

async function removePlatform(platform: PlatformGateway) {
  if (!confirm(`确认软删除平台方 ${platform.platformId}？`)) return
  clearError()
  try {
    await gatewayApi.deletePlatform(platform.platformId)
    platforms.value = platforms.value.filter((item) => item.platformId !== platform.platformId)
    goPlatformList()
    showToast('平台方已软删除')
  } catch (error) {
    fail(error)
  }
}

function startManualTool() {
  if (!selectedPlatformId.value) return
  selectedToolId.value = null
  Object.assign(toolForm, blankTool())
  viewName.value = 'tool-manual'
}

function startOpenApiImport() {
  if (!selectedPlatformId.value) return
  previews.value = []
  expandedPreviewTools.value = []
  savingPreviewKeys.value = []
  resultModal.value = null
  overwriteConfirm.value = null
  viewName.value = 'tool-openapi'
}

function openToolDetail(tool: PlatformTool) {
  selectedToolId.value = tool.toolId ?? null
  fillToolForm(tool)
  viewName.value = 'tool-detail'
}

async function saveTool() {
  if (!selectedPlatformId.value) return
  clearError()
  try {
    if (viewName.value === 'tool-detail' && toolForm.toolId) {
      await gatewayApi.updateTool(selectedPlatformId.value, toolForm.toolId, toolForm)
      showToast('接口映射已更新')
    } else {
      await gatewayApi.createTool(selectedPlatformId.value, toolForm)
      showToast('接口映射已创建')
    }
    await loadTools()
    viewName.value = 'platform-detail'
  } catch (error) {
    fail(error)
  }
}

async function toggleTool(tool: PlatformTool) {
  if (!selectedPlatformId.value || !tool.toolId) return
  clearError()
  try {
    const enable = tool.enable === 1 ? 0 : 1
    await gatewayApi.setToolEnable(selectedPlatformId.value, tool.toolId, enable)
    await loadTools()
    if (selectedToolId.value === tool.toolId) toolForm.enable = enable
    showToast(enable === 1 ? '工具已启用' : '工具已禁用')
  } catch (error) {
    fail(error)
  }
}

async function removeTool(tool: PlatformTool) {
  if (!selectedPlatformId.value || !tool.toolId) return
  if (!confirm(`确认软删除工具 ${tool.toolName}？`)) return
  clearError()
  try {
    await gatewayApi.deleteTool(selectedPlatformId.value, tool.toolId)
    await loadTools()
    viewName.value = 'platform-detail'
    showToast('工具已软删除')
  } catch (error) {
    fail(error)
  }
}

function changeToolFilter() {
  toolPage.value = 1
}

function changeToolPage(nextPage: number) {
  toolPage.value = Math.min(Math.max(nextPage, 1), totalToolPages.value)
}

function extractOpenApiEndpoints(openApiJson: string) {
  const parsed = JSON.parse(openApiJson) as { paths?: Record<string, unknown> }
  return Object.keys(parsed.paths ?? {}).filter(Boolean)
}

async function previewOpenApi() {
  if (!selectedPlatformId.value) return
  previewLoading.value = true
  expandedPreviewTools.value = []
  savingPreviewKeys.value = []
  resultModal.value = null
  overwriteConfirm.value = null
  clearError()
  try {
    const endpoints = extractOpenApiEndpoints(openApiForm.openApiJson)
    if (endpoints.length === 0) {
      throw new Error('OpenAPI JSON 中没有找到 paths 端点')
    }
    previews.value = await gatewayApi.previewOpenApi(selectedPlatformId.value, {
      openApiJson: openApiForm.openApiJson,
      endpoints,
    })
    showToast(`已解析 ${previews.value.length} 个接口`)
  } catch (error) {
    fail(error)
  } finally {
    previewLoading.value = false
  }
}

function isPreviewExpanded(toolName: string) {
  return expandedPreviewTools.value.includes(toolName)
}

function togglePreviewFields(toolName: string) {
  expandedPreviewTools.value = isPreviewExpanded(toolName)
    ? expandedPreviewTools.value.filter((name) => name !== toolName)
    : [...expandedPreviewTools.value, toolName]
}

function isPreviewSaving(key: string) {
  return savingPreviewKeys.value.includes(key)
}

function hasUnresolvedDuplicate(preview: ToolPreview) {
  return preview.duplicate === true && preview.toolName === preview.existingToolName
}

function previewStatusText(preview: ToolPreview) {
  if (hasUnresolvedDuplicate(preview)) return '已存在'
  if (preview.duplicate) return '已改名'
  return '新建'
}

function addPreviewMapping(preview: ToolPreview) {
  preview.mappings.push({
    mappingType: 'request',
    parentPath: null,
    fieldName: 'field',
    mcpPath: 'field',
    mcpType: 'string',
    mcpDesc: '',
    isRequired: 0,
    sortOrder: preview.mappings.length + 1,
  })
}

function removePreviewMapping(preview: ToolPreview, index: number) {
  preview.mappings.splice(index, 1)
}

async function savePreview(preview: ToolPreview, key: string) {
  if (!selectedPlatformId.value || isPreviewSaving(key)) return
  if (hasUnresolvedDuplicate(preview)) {
    resultModal.value = {
      type: 'error',
      title: '无法新建',
      text: `Tool 名称 ${preview.toolName} 已存在。请修改 Tool Name 后另存，或选择覆盖更新已有 Tool。`,
    }
    return
  }
  clearError()
  savingPreviewKeys.value = [...savingPreviewKeys.value, key]
  try {
    await gatewayApi.createTool(selectedPlatformId.value, preview)
    await loadTools()
    resultModal.value = {
      type: 'success',
      title: '保存成功',
      text: `已保存 OpenAPI 工具：${preview.toolName}`,
    }
    showToast(`OpenAPI 工具已保存：${preview.toolName}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    resultModal.value = {
      type: 'error',
      title: '保存失败',
      text: message || '保存失败，请检查配置后重试',
    }
    fail(error)
  } finally {
    savingPreviewKeys.value = savingPreviewKeys.value.filter((item) => item !== key)
  }
}

function requestOverwritePreview(preview: ToolPreview, key: string) {
  if (!preview.existingToolId) {
    resultModal.value = {
      type: 'error',
      title: '无法覆盖',
      text: '当前预览项缺少已有 Tool ID，请重新解析后再试。',
    }
    return
  }
  overwriteConfirm.value = { preview, key }
}

async function overwritePreview() {
  if (!selectedPlatformId.value || !overwriteConfirm.value) return
  const { preview, key } = overwriteConfirm.value
  if (!preview.existingToolId || isPreviewSaving(key)) return
  closeOverwriteConfirm()
  clearError()
  savingPreviewKeys.value = [...savingPreviewKeys.value, key]
  try {
    await gatewayApi.updateTool(selectedPlatformId.value, preview.existingToolId, preview)
    await loadTools()
    preview.duplicate = false
    preview.importAction = 'create'
    resultModal.value = {
      type: 'success',
      title: '覆盖成功',
      text: `已覆盖更新 Tool：${preview.toolName}`,
    }
    showToast(`OpenAPI 工具已覆盖：${preview.toolName}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    resultModal.value = {
      type: 'error',
      title: '覆盖失败',
      text: message || '覆盖失败，请检查配置后重试',
    }
    fail(error)
  } finally {
    savingPreviewKeys.value = savingPreviewKeys.value.filter((item) => item !== key)
  }
}

function addMapping() {
  toolForm.mappings.push({
    mappingType: 'request',
    parentPath: null,
    fieldName: 'field',
    mcpPath: 'field',
    mcpType: 'string',
    mcpDesc: '',
    isRequired: 0,
    sortOrder: toolForm.mappings.length + 1,
  })
}

function removeMapping(index: number) {
  toolForm.mappings.splice(index, 1)
}

onMounted(loadPlatforms)
</script>

<template>
  <main class="app-shell">
    <header class="app-header">
      <button class="brand" @click="goPlatformList">
        <span class="brand-mark">
          <Server :size="21" />
        </span>
        <span>
          <strong>AI MCP Gateway</strong>
        </span>
      </button>
    </header>

    <section class="workspace">
      <div v-if="errorText" class="notice error">
        <AlertCircle :size="18" />
        <span>{{ errorText }}</span>
        <button class="ghost-icon" @click="clearError">
          <X :size="16" />
        </button>
      </div>
      <div v-if="toastText" class="notice success">
        <CheckCircle2 :size="18" />
        <span>{{ toastText }}</span>
      </div>

      <section v-if="viewName === 'platforms'" class="page-stack">
        <div class="page-title">
          <div>
            <p class="eyebrow">Gateway Console</p>
            <h1>平台方列表</h1>
          </div>
          <div class="list-actions">
            <div class="search">
              <Search :size="16" />
              <input v-model="searchText" placeholder="搜索 platform 或名称" />
            </div>
            <button class="primary" @click="startCreatePlatform">
              <Plus :size="16" />
              新平台方
            </button>
          </div>
        </div>

        <section class="metrics">
          <div>
            <span>平台方</span>
            <strong>{{ platforms.length }}</strong>
          </div>
          <div>
            <span>启用平台</span>
            <strong>{{ platforms.filter((item) => item.enable === 1).length }}</strong>
          </div>
          <div>
            <span>工具总数</span>
            <strong>{{ Object.values(toolCounts).reduce((sum, count) => sum + count, 0) }}</strong>
          </div>
        </section>

        <div v-if="loading" class="empty large-empty">
          <Activity :size="30" />
          <span>正在加载平台方</span>
        </div>

        <div v-else class="platform-grid">
          <button
            v-for="platform in filteredPlatforms"
            :key="platform.platformId"
            class="platform-card"
            @click="openPlatform(platform)"
          >
            <span class="card-topline">
              <span class="status-dot" :class="{ off: platform.enable === 0 }"></span>
              <span class="badge" :class="{ muted: platform.enable === 0 }">
                {{ platform.enable === 1 ? '启用' : '禁用' }}
              </span>
            </span>
            <strong>{{ platform.platformName }}</strong>
            <em>{{ platform.platformId }}</em>
            <p>{{ platform.platformDesc || '暂无描述' }}</p>
            <span class="card-stats">
              <span>
                <b>{{ toolCounts[platform.platformId] ?? 0 }}</b>
                Tools
              </span>
              <span>
                <b>{{ platform.version || '1.0.0' }}</b>
                Version
              </span>
            </span>
          </button>

          <div v-if="filteredPlatforms.length === 0" class="empty large-empty">
            <Database :size="30" />
            <span>暂无匹配平台方</span>
          </div>
        </div>
      </section>

      <section v-if="viewName === 'platform-detail'" class="page-stack">
        <div class="page-title">
          <div>
            <button class="back-link" @click="goPlatformList">
              <ArrowLeft :size="16" />
              返回平台列表
            </button>
            <p class="eyebrow">Platform Detail</p>
            <h1>{{ platformMode === 'create' ? '注册平台方' : selectedPlatform?.platformName }}</h1>
          </div>
        </div>

        <section class="detail-layout" :class="{ 'create-layout': platformMode === 'create' }">
          <div class="panel platform-panel">
            <div class="panel-head">
              <div>
                <p class="eyebrow">Platform</p>
                <h2>{{ platformMode === 'create' ? '平台注册' : '平台配置' }}</h2>
              </div>
              <span class="badge">{{ platformMode === 'create' ? 'Create' : 'Edit' }}</span>
            </div>

            <div class="form-grid">
              <label>
                Platform ID
                <input v-model="platformForm.platformId" :disabled="platformMode === 'edit'" placeholder="platform_001" />
              </label>
              <label>
                名称
                <input v-model="platformForm.platformName" placeholder="员工信息查询网关" />
              </label>
              <label>
                版本
                <input v-model="platformForm.version" placeholder="1.0.0" />
              </label>
              <label>
                鉴权
                <select v-model.number="platformForm.auth">
                  <option :value="0">不校验</option>
                  <option :value="1">强校验</option>
                </select>
              </label>
              <label class="wide">
                描述
                <textarea v-model="platformForm.platformDesc" rows="4" placeholder="描述平台方提供的 MCP 能力范围"></textarea>
              </label>
            </div>

            <div class="form-footer">
              <label class="toggle">
                <input v-model.number="platformForm.enable" type="checkbox" :true-value="1" :false-value="0" />
                <span></span>
                {{ platformForm.enable === 1 ? '启用平台方' : '禁用平台方' }}
              </label>
              <div class="footer-actions">
                <button
                  v-if="selectedPlatform"
                  class="secondary"
                  @click="togglePlatform(selectedPlatform)"
                >
                  <Power :size="16" />
                  {{ selectedPlatform.enable === 1 ? '禁用' : '启用' }}
                </button>
                <button
                  v-if="selectedPlatform"
                  class="secondary danger"
                  @click="removePlatform(selectedPlatform)"
                >
                  <Trash2 :size="16" />
                  软删除
                </button>
                <button class="primary" @click="savePlatform">
                  <Save :size="16" />
                  保存
                </button>
              </div>
            </div>
          </div>

          <div v-if="platformMode === 'edit'" class="panel tools-panel">
            <div class="panel-head">
              <div>
                <p class="eyebrow">Tools</p>
                <h2>接口映射</h2>
              </div>
              <div class="tool-actions">
                <select v-model="toolFilter" :disabled="!selectedPlatformId" @change="changeToolFilter">
                  <option value="all">全部</option>
                  <option value="enabled">启用</option>
                  <option value="disabled">禁用</option>
                </select>
                <button class="secondary" :disabled="!selectedPlatformId" @click="startManualTool">
                  <Plus :size="16" />
                  手动映射
                </button>
                <button class="secondary" :disabled="!selectedPlatformId" @click="startOpenApiImport">
                  <UploadCloud :size="16" />
                  OpenAPI
                </button>
              </div>
            </div>

            <section class="tool-summary">
              <div>
                <span>全部</span>
                <strong>{{ tools.length }}</strong>
              </div>
              <div>
                <span>启用</span>
                <strong>{{ activeTools }}</strong>
              </div>
              <div>
                <span>禁用</span>
                <strong>{{ disabledTools }}</strong>
              </div>
            </section>

            <div v-if="!selectedPlatformId" class="empty">
              <Database :size="28" />
              <span>保存平台方后可维护 Tool</span>
            </div>
            <div v-else-if="toolLoading" class="empty">
              <Activity :size="28" />
              <span>正在加载接口映射</span>
            </div>
            <div v-else class="tool-table">
              <div class="table-head">
                <span>工具</span>
                <span>协议</span>
                <span>状态</span>
                <span>操作</span>
              </div>
              <button
                v-for="tool in pagedTools"
                :key="tool.toolId || tool.toolName"
                class="table-row"
                @click="openToolDetail(tool)"
              >
                <span>
                  <strong>{{ tool.toolName }}</strong>
                  <em>{{ tool.toolDescription || '暂无描述' }}</em>
                </span>
                <span class="mono">{{ tool.httpConfig?.httpMethod?.toUpperCase() || 'HTTP' }}</span>
                <span class="badge" :class="{ muted: tool.enable === 0 }">{{ tool.enable === 1 ? '启用' : '禁用' }}</span>
                <span class="row-actions" @click.stop>
                  <button class="icon-button" title="编辑" @click="openToolDetail(tool)">
                    <Pencil :size="15" />
                  </button>
                  <button class="icon-button" title="启停" @click="toggleTool(tool)">
                    <Power :size="15" />
                  </button>
                  <button class="icon-button danger" title="软删除" @click="removeTool(tool)">
                    <Trash2 :size="15" />
                  </button>
                </span>
              </button>
              <div v-if="filteredTools.length === 0" class="empty compact-empty">
                <Wrench :size="24" />
                <span>暂无接口映射</span>
              </div>
            </div>

            <div v-if="filteredTools.length > 0" class="pagination">
              <span>第 {{ toolPage }} / {{ totalToolPages }} 页，共 {{ filteredTools.length }} 条</span>
              <div>
                <button class="icon-button" :disabled="toolPage <= 1" @click="changeToolPage(toolPage - 1)">
                  <ChevronLeft :size="16" />
                </button>
                <button class="icon-button" :disabled="toolPage >= totalToolPages" @click="changeToolPage(toolPage + 1)">
                  <ChevronRight :size="16" />
                </button>
              </div>
            </div>
          </div>
        </section>
      </section>

      <section v-if="viewName === 'tool-detail' || viewName === 'tool-manual'" class="page-stack">
        <div class="page-title">
          <div>
            <button class="back-link" @click="viewName = 'platform-detail'">
              <ArrowLeft :size="16" />
              返回平台详情
            </button>
            <p class="eyebrow">Tool Editor</p>
            <h1>{{ viewName === 'tool-detail' ? selectedTool?.toolName || '编辑 Tool' : '手动新增 Tool' }}</h1>
          </div>
          <button
            v-if="viewName === 'tool-detail' && selectedTool"
            class="secondary danger"
            @click="removeTool(selectedTool)"
          >
            <Trash2 :size="16" />
            软删除
          </button>
        </div>

        <section class="panel editor-panel">
          <div class="editor-layout">
            <div class="form-grid">
              <label>
                Tool Name
                <input v-model="toolForm.toolName" placeholder="platform_001_get_company_employee" />
              </label>
              <label>
                类型
                <select v-model="toolForm.toolType">
                  <option value="function">function</option>
                  <option value="resource">resource</option>
                </select>
              </label>
              <label>
                版本
                <input v-model="toolForm.toolVersion" />
              </label>
              <label>
                方法
                <select v-model="toolForm.httpConfig.httpMethod">
                  <option value="get">GET</option>
                  <option value="post">POST</option>
                  <option value="put">PUT</option>
                  <option value="delete">DELETE</option>
                </select>
              </label>
              <label class="wide">
                HTTP URL
                <input v-model="toolForm.httpConfig.httpUrl" placeholder="http://localhost:8701/api/v1/mcp/demo" />
              </label>
              <label>
                超时 ms
                <input v-model.number="toolForm.httpConfig.timeout" type="number" min="1000" step="1000" />
              </label>
              <label>
                重试
                <input v-model.number="toolForm.httpConfig.retryTimes" type="number" min="0" max="5" />
              </label>
              <label class="wide">
                描述
                <textarea v-model="toolForm.toolDescription" rows="3"></textarea>
              </label>
              <label class="wide">
                Headers JSON
                <textarea v-model="toolForm.httpConfig.httpHeaders" rows="3"></textarea>
              </label>
            </div>

            <div class="mapping-editor">
              <div class="mapping-head">
                <div>
                  <strong>参数映射</strong>
                  <p class="mapping-hint">
                    定义 MCP 客户端传入的参数，如何映射到平台方 HTTP 接口字段；保存后客户端会按这里的字段说明生成 Tool 入参。
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
                <span>还没有参数。点击“添加字段”后，填写平台接口字段、MCP 入参路径、类型和是否必填。</span>
              </div>
            </div>
          </div>

          <div class="form-footer">
            <label class="toggle">
              <input v-model.number="toolForm.enable" type="checkbox" :true-value="1" :false-value="0" />
              <span></span>
              {{ toolForm.enable === 1 ? '工具启用' : '工具禁用' }}
            </label>
            <button class="primary" @click="saveTool">
              <Save :size="16" />
              {{ viewName === 'tool-detail' ? '更新 Tool' : '创建 Tool' }}
            </button>
          </div>
        </section>
      </section>

      <section v-if="viewName === 'tool-openapi'" class="page-stack">
        <div class="page-title">
          <div>
            <button class="back-link" @click="viewName = 'platform-detail'">
              <ArrowLeft :size="16" />
              返回平台详情
            </button>
            <p class="eyebrow">OpenAPI Import</p>
            <h1>OpenAPI 导入 Tool</h1>
          </div>
        </div>

        <section class="panel editor-panel">
          <div class="openapi-layout">
            <label>
              OpenAPI JSON
              <textarea v-model="openApiForm.openApiJson" class="json-area" rows="18"></textarea>
            </label>
          </div>

          <div class="form-footer">
            <span class="hint">系统会自动读取 OpenAPI paths 下的端点；解析预览后，可逐个保存为当前平台方的工具映射。</span>
            <button class="primary" :disabled="previewLoading" @click="previewOpenApi">
              <FileJson :size="16" />
              {{ previewLoading ? '解析中' : '解析预览' }}
            </button>
          </div>

          <div v-if="previews.length" class="preview-list">
            <article v-for="(preview, previewIndex) in previews" :key="previewIndex" class="preview-card">
              <div class="preview-row">
                <div class="preview-summary">
                  <strong>{{ preview.toolName }}</strong>
                  <em>{{ preview.httpConfig.httpMethod.toUpperCase() }} {{ preview.httpConfig.httpUrl }}</em>
                </div>
                <span class="badge" :class="{ warning: hasUnresolvedDuplicate(preview), muted: preview.duplicate && !hasUnresolvedDuplicate(preview) }">
                  {{ previewStatusText(preview) }}
                </span>
                <span class="badge">{{ preview.mappings.length }} 字段</span>
                <button class="secondary compact" @click="togglePreviewFields(String(previewIndex))">
                  <ChevronUp v-if="isPreviewExpanded(String(previewIndex))" :size="15" />
                  <ChevronDown v-else :size="15" />
                  {{ isPreviewExpanded(String(previewIndex)) ? '收起编辑' : '展开编辑' }}
                </button>
                <button
                  class="secondary"
                  :disabled="isPreviewSaving(String(previewIndex)) || hasUnresolvedDuplicate(preview)"
                  @click="savePreview(preview, String(previewIndex))"
                >
                  <Activity v-if="isPreviewSaving(String(previewIndex))" :size="15" />
                  <Save v-else :size="15" />
                  {{ isPreviewSaving(String(previewIndex)) ? '保存中' : '保存为新 Tool' }}
                </button>
                <button
                  v-if="preview.duplicate"
                  class="secondary danger"
                  :disabled="isPreviewSaving(String(previewIndex))"
                  @click="requestOverwritePreview(preview, String(previewIndex))"
                >
                  <RefreshCw :size="15" />
                  覆盖更新
                </button>
              </div>
              <p v-if="hasUnresolvedDuplicate(preview)" class="preview-conflict-hint">
                Tool 名称已存在。请修改 Tool Name 后另存，或点击“覆盖更新”替换已有 Tool 配置。
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
                <div
                  v-for="(mapping, index) in preview.mappings"
                  :key="index"
                  class="preview-field-row"
                >
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
                <div v-if="preview.mappings.length === 0" class="mapping-empty compact-empty">
                  <Braces :size="20" />
                  <span>该接口没有解析到可导入字段。</span>
                </div>
              </div>
            </article>
          </div>
        </section>
      </section>
    </section>

    <div v-if="resultModal" class="modal-backdrop" role="dialog" aria-modal="true" @click.self="closeResultModal">
      <section class="result-modal" :class="resultModal.type">
        <div class="result-modal-icon">
          <CheckCircle2 v-if="resultModal.type === 'success'" :size="26" />
          <AlertCircle v-else :size="26" />
        </div>
        <div class="result-modal-body">
          <h2>{{ resultModal.title }}</h2>
          <p>{{ resultModal.text }}</p>
        </div>
        <button class="primary" @click="closeResultModal">关闭</button>
      </section>
    </div>

    <div v-if="overwriteConfirm" class="modal-backdrop" role="dialog" aria-modal="true" @click.self="closeOverwriteConfirm">
      <section class="result-modal warning">
        <div class="result-modal-icon">
          <AlertCircle :size="26" />
        </div>
        <div class="result-modal-body">
          <h2>确认覆盖更新？</h2>
          <p>
            将使用当前预览内容替换已有 Tool“{{ overwriteConfirm.preview.existingToolName }}”的基础信息、HTTP 配置和字段映射。
          </p>
        </div>
        <div class="modal-actions">
          <button class="secondary" @click="closeOverwriteConfirm">取消</button>
          <button class="primary" @click="overwritePreview">确认覆盖</button>
        </div>
      </section>
    </div>
  </main>
</template>
