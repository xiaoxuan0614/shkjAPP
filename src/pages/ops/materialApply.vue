<route lang="json5">
{
  style: {
    navigationBarTitleText: '领料申请',
  },
}
</route>
<template>
  <PageLayout :navbarShow="false">
    <scroll-view class="page" :scroll-y="true">
      <!-- 关联单号 -->
      <SectionCard title="关联信息">
        <view class="form-row">
          <text class="label">领料类型</text>
          <picker
            mode="selector"
            :disabled="!!requestedReworkId || submitting || projectSelecting"
            :range="usageTypeOptions"
            range-key="label"
            :value="usageTypeIndex"
            @change="changeUsageType"
          >
            <view class="picker-value picker-value--select">
              {{ usageTypeOptions[usageTypeIndex].label }}
            </view>
          </picker>
        </view>
        <view v-if="isProjectUsage" class="form-row">
          <text class="label">关联项目</text>
          <view class="picker-value picker-value--select" @click="openProjectPicker">
            {{ orderInfo.id ? projectOptionText(orderInfo) : '请选择当前参与的项目' }}
          </view>
        </view>
        <view v-if="isProjectUsage && orderInfo.customerName" class="form-row">
          <text class="label">客户名称</text>
          <text class="static-val">{{ orderInfo.customerName }}</text>
        </view>
        <view v-if="isProjectUsage && orderInfo.maintenanceNatureText" class="form-row">
          <text class="label">维护性质</text>
          <text class="static-val">{{ orderInfo.maintenanceNatureText }}</text>
        </view>
        <view class="form-row">
          <text class="label">使用时间</text>
          <picker mode="date" :value="useTime" @change="(e: any) => (useTime = e.detail.value)">
            <view class="picker-value">{{ useTime }}</view>
          </picker>
        </view>
      </SectionCard>

      <!-- 领料明细 -->
      <SectionCard title="领料明细">
        <view v-if="isProjectUsage && !reworkId && !requestedReworkId" class="bulk-material">
          <wd-button plain block :loading="bulkLoading" :disabled="!orderInfo.id || submitting || projectSelecting" @click="fillAllMaterials">
            一键带入可领物料
          </wd-button>
          <text class="bulk-material__hint">按全部可申请数量带入，可继续调整；已选物料及手动数量不变。</text>
        </view>
        <text v-if="reworkId" class="static-val">本轮返工额外领料；不使用首次施工额度。</text>
        <view v-for="m in selectedMaterials" :key="m.id" class="request-material request-material--compact">
          <view class="request-material__identity">
          <view class="request-material__heading">
            <text class="request-material__name">{{ m.name }}</text>
          </view>
          <text class="request-material__spec">{{ [m.brand_dictText || m.brand, m.model || m.spec].filter(Boolean).join(' · ') || '品牌型号未提供' }}</text>
          </view>
          <view class="request-material__operation">
            <view class="request-material__operation-row">
              <text class="request-material__label">数量（{{ m.unit || '单位未提供' }}）</text>
            <view class="request-material__control">
                <button class="request-material__step" :disabled="submitting" :aria-label="`减少${m.name}申请数量`" @click="dec(m)"><wd-icon name="minus-circle" size="18px" /></button>
                <input
                  v-model="m.qty"
                  class="request-material__input"
                  type="digit"
                  inputmode="decimal"
                  :disabled="submitting"
                  :aria-label="`${m.name}本次领料数量`"
                  @blur="normalizeMaterialQty(m)"
                />
                <button class="request-material__step" :disabled="submitting" :aria-label="`增加${m.name}申请数量`" @click="inc(m)"><wd-icon name="add-circle" size="18px" /></button>
            </view>
            </view>
          </view>
            <view class="request-material__operation-footer">
              <text class="request-material__hint">{{ isProjectUsage ? `当前可申请 ${getAvailableApplyQty(m)} ${m.unit}` : `库存数量 ${m.stock ?? '—'} ${m.unit}` }}</text>
              <view class="request-material__actions">
                <button v-if="isProjectUsage" class="request-material__fill" :disabled="submitting" :aria-label="`申请${m.name}全部可用数量`" @click="m.qty = getAvailableApplyQty(m)">全部</button>
              <button class="request-material__remove" :disabled="submitting" :aria-label="`删除${m.name}`" @click="removeMaterial(m)">删除</button>
              </view>
            </view>
        </view>
        <view
          class="add-material"
          :class="{ disabled: bulkLoading || (isProjectUsage && !orderInfo.id) }"
          @click="openMaterialPicker"
        >
          {{
            isProjectUsage
              ? orderInfo.id
                ? '＋ 添加可申请物料'
                : '请先查询并确认项目分期'
              : '＋ 添加物料'
          }}
        </view>
      </SectionCard>

      <SectionCard title="申请说明">
        <view class="remark-field">
          <text class="label">备注（选填）</text>
          <textarea
            v-model="remark"
            class="remark-input"
            maxlength="300"
            placeholder="填写用途、现场情况或其他需要说明的内容"
            placeholder-style="color:#767676"
          />
          <text class="remark-count">{{ remark.length }}/300</text>
        </view>
      </SectionCard>

      <view class="submit-wrap">
        <wd-button size="large" type="primary" :disabled="bulkLoading" :loading="submitting" @click="submit">
          提交领料申请
        </wd-button>
      </view>
    </scroll-view>

    <!-- 关联项目选择弹窗 -->
    <wd-popup v-model="showProject" position="bottom" custom-style="border-radius:16px 16px 0 0;">
      <view class="popup">
        <view class="popup__title">选择项目</view>
        <view class="material-search">
          <input
            v-model.trim="projectKeyword"
            class="material-search__input"
            placeholder="输入主项目或分期项目名称"
            placeholder-style="color:#767676"
            confirm-type="search"
          />
          <text v-if="projectKeyword" class="material-search__clear" @click="projectKeyword = ''">
            清空
          </text>
        </view>
        <scroll-view :scroll-y="true" class="popup__list">
          <view
            v-for="project in filteredProjectList"
            :key="project.id"
            class="mat project-mat"
            :class="{ on: String(orderInfo.id || '') === String(project.id || '') }"
            @click="selectProject(project)"
          >
            <view class="project-mat__body">
              <text class="project-mat__name">{{ projectOptionText(project) }}</text>
            </view>
            <view class="project-mat__check">
              <wd-icon
                v-if="String(orderInfo.id || '') === String(project.id || '')"
                name="check"
                size="16px"
                color="#176ac7"
              />
            </view>
          </view>
          <view v-if="projectsLoading" class="popup__empty">正在加载参与项目…</view>
          <view
            v-else-if="projectsError"
            class="popup__empty popup__empty--error"
            @click="loadParticipatedProjects"
          >
            参与项目加载失败，点击重试
          </view>
          <view v-else-if="projectKeyword && !filteredProjectList.length" class="popup__empty">
            没有找到匹配“{{ projectKeyword }}”的参与项目
          </view>
          <view v-else-if="!filteredProjectList.length" class="popup__empty">暂无已加入的项目</view>
        </scroll-view>
        <view class="popup__btns">
          <text class="btn btn--plain" @click="showProject = false">关闭</text>
        </view>
      </view>
    </wd-popup>

    <!-- 物料选择弹窗 -->
    <wd-popup v-model="showMaterial" position="bottom" custom-style="border-radius:16px 16px 0 0;">
      <view class="popup">
        <view class="popup__title">{{ isProjectUsage ? '选择可申请物料' : '选择物料' }}</view>
        <view class="material-search">
          <input
            v-model.trim="materialKeyword"
            class="material-search__input"
            :placeholder="isProjectUsage ? '输入编码、名称、品牌或型号' : '输入物料编号或名称'"
            placeholder-style="color:#767676"
            confirm-type="search"
          />
          <text v-if="materialKeyword" class="material-search__clear" @click="materialKeyword = ''">
            清空
          </text>
        </view>
        <view class="material-picker-toolbar">
          <text class="material-picker-toolbar__count">
            当前已加载 {{ filteredMaterialList.length }} 项
          </text>
          <text
            class="material-picker-toolbar__select-all"
            :class="{ disabled: !selectableMaterials.length }"
            :aria-disabled="!selectableMaterials.length"
            @click="toggleSelectAllMaterials"
          >
            {{ allLoadedMaterialsSelected ? '取消全选' : '全选' }}
          </text>
        </view>
        <scroll-view
          :scroll-y="true"
          class="popup__list"
          :lower-threshold="100"
          @scrolltolower="loadMoreProjectMaterials"
        >
          <view
            v-for="m in filteredMaterialList"
            :key="m.id"
            class="mat"
            :class="{ on: isSelected(m), 'mat--disabled': isMaterialDisabled(m) }"
            :aria-disabled="isMaterialDisabled(m)"
            @click="!isMaterialDisabled(m) && toggleMaterial(m)"
          >
            <view class="mat__body">
              <view class="mat__title">
                <text class="mat__name">{{ m.name }}</text>
                <text class="mat__code">{{ materialCode(m) || '暂无编码' }}</text>
              </view>
              <view class="mat__spec">规格：{{ m.spec || '暂无规格' }}</view>
              <view v-if="isProjectUsage" class="mat__available">
                当前可申请 {{ getAvailableApplyQty(m) }}{{ m.unit }}
              </view>
              <view v-else class="mat__spec">库存 {{ m.stock }}{{ m.unit }}</view>
            </view>
            <text v-if="isMaterialDisabled(m)" class="mat__unavailable">暂无可申请量</text>
            <view v-else class="mat__check">
              <wd-icon v-if="isSelected(m)" name="check" size="16px" />
            </view>
          </view>
          <view v-if="materialsLoading" class="popup__empty popup__empty--loading">
            {{ materialList.length ? '正在加载更多可申请物料…' : '正在加载物料…' }}
          </view>
          <view
            v-else-if="materialsError"
            class="popup__empty popup__empty--error"
            @click="retryLoadMaterials"
          >
            物料加载失败，点击重试
          </view>
          <view
            v-else-if="isProjectUsage && !filteredMaterialList.length && materialHasMore"
            class="popup__more popup__more--continue"
            @click="loadMoreProjectMaterials"
          >
            当前页暂无匹配物料，点击继续加载
          </view>
          <view v-else-if="materialKeyword && !filteredMaterialList.length" class="popup__empty">
            没有找到匹配“{{ materialKeyword }}”的物料
          </view>
          <view v-else-if="!filteredMaterialList.length" class="popup__empty">
            {{ isProjectUsage ? '该项目暂无可申请物料' : '暂无可选物料' }}
          </view>
          <view
            v-else-if="isProjectUsage && materialHasMore"
            class="popup__more"
            @click="loadMoreProjectMaterials"
          >
            上拉加载更多
          </view>
          <view v-else-if="isProjectUsage" class="popup__more popup__more--done">
            已加载全部 {{ materialTotal }} 项可申请物料
          </view>
        </scroll-view>
        <view v-if="pickerSelectedMaterials.length" class="material-selected-summary">
          已选择 {{ pickerSelectedMaterials.length }} 项物料
        </view>
        <view class="popup__btns">
          <text class="btn btn--plain" @click="cancelMaterialPicker">取消</text>
          <text class="btn btn--primary" @click="confirmMaterialPicker">
            确定{{ pickerSelectedMaterials.length ? `（${pickerSelectedMaterials.length}）` : '' }}
          </text>
        </view>
      </view>
    </wd-popup>
  </PageLayout>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { onLoad, onHide } from '@dcloudio/uni-app'
import dayjs from 'dayjs'
import { useToast, useMessage } from 'wot-design-uni'
import { useUserStore } from '@/store/user'
import {
  normalizeMaterial,
  normalizeProject,
  projectApi,
  stockApi,
  unwrapRecords,
} from '@/service/shkj'
import { MATERIAL_USAGE_TYPE } from '@/types/business'
import { PROJECT_PICK_STAGES } from '@/service/projectMaterialAccess'
import SectionCard from '@/components/SectionCard/SectionCard.vue'
import { getReworkMaterials, validateRework } from '@/service/reworkMaterials'
import { loadPickAllAccounts, missingPickAccounts } from '@/utils/pickAllMaterials'
import { http } from '@/utils/http'
import { filterMaterialSearch, materialBrandMap } from '@/utils/materialBrandSearch'

const toast = useToast()
const message = useMessage()
const userStore = useUserStore()
const orderNo = ref('')
const orderInfo = ref<any>({})
const reworkId = ref(''), requestedReworkId = ref('')
const projectSelecting = ref(false)
const participatedProjects = ref<any[]>([])
const projectKeyword = ref('')
const showProject = ref(false)
const projectsLoading = ref(false)
const projectsError = ref(false)
let projectRequestVersion = 0
let projectSearchTimer: ReturnType<typeof setTimeout> | undefined
const useTime = ref(dayjs().format('YYYY-MM-DD'))
const remark = ref('')
const materialList = ref<any[]>([])
const selectedMaterials = ref<any[]>([])
const pickerSelectedMaterials = ref<any[]>([])
const showMaterial = ref(false)
const materialKeyword = ref('')
const brandNames = ref<Record<string, string>>({})
const materialsLoading = ref(false)
const materialsError = ref(false)
const materialPageNo = ref(1)
const materialTotal = ref(0)
const materialHasMore = ref(false)
const materialPageSize = 20
let materialRequestVersion = 0
let materialSearchTimer: ReturnType<typeof setTimeout> | undefined
const submitting = ref(false)
const applyNo = ref('')
const usageTypeOptions = MATERIAL_USAGE_TYPE
const usageTypeIndex = ref(0)
const usageType = computed(() => usageTypeOptions[usageTypeIndex.value].value)
const isProjectUsage = computed(() => usageType.value === 'PROJECT')
const bulkLoading = ref(false)
let bulkVersion = 0
const invalidateBulk = () => { bulkVersion++; bulkLoading.value = false }
watch([() => orderInfo.value.id, usageType, reworkId], invalidateBulk, { flush: 'sync' })
onHide(invalidateBulk)
const projectMaterialPeriodStatus = PROJECT_PICK_STAGES.join(',')

const materialCode = (material: any) => material.materialCode || material.code || ''
const projectOptionText = (project: any) => project.projectLabel || '—'
const filteredProjectList = computed(() => participatedProjects.value)
const filteredMaterialList = computed(() => {
  // 普通项目已由总账接口跨页搜索，不能再用品牌编码过滤服务端结果。
  if (isProjectUsage.value && !reworkId.value) return materialList.value
  return filterMaterialSearch(materialList.value, materialKeyword.value, brandNames.value)
})
const allLoadedMaterialsSelected = computed(
  () =>
    selectableMaterials.value.length > 0 &&
    selectableMaterials.value.every((material) =>
      pickerSelectedMaterials.value.some((selected) => String(selected.id) === String(material.id)),
    ),
)

const getAvailableApplyQty = (material: any) => {
  const value = Number(material.availableApplyQty)
  return Number.isFinite(value) && value > 0 ? value : 0
}
const isMaterialDisabled = (material: any) => isProjectUsage.value && getAvailableApplyQty(material) <= 0
const selectableMaterials = computed(() => filteredMaterialList.value.filter((material) => !isMaterialDisabled(material)))

const normalizeAvailableMaterial = (account: any) => ({
  ...normalizeMaterial({
    ...account,
    id: account.materialId,
    materialId: account.materialId,
    materialCode: account.materialCode,
    materialName: account.materialName,
    model: account.model,
    baseUnitName: account.baseUnitName,
  }),
  availableApplyQty: Math.max(Number(account.availableApplyQty) || 0, 0),
})

const fillAllMaterials = async () => {
  if (bulkLoading.value || submitting.value || projectSelecting.value || !isProjectUsage.value || reworkId.value || requestedReworkId.value) return
  const periodId = String(orderInfo.value.id || '')
  if (!periodId) return toast.warning('请先选择关联项目')
  const version = ++bulkVersion, token = userStore.userInfo.token
  const isCurrent = () => version === bulkVersion && token === userStore.userInfo.token && periodId === String(orderInfo.value.id) && isProjectUsage.value && !reworkId.value
  bulkLoading.value = true
  try {
    const accounts = await loadPickAllAccounts(({ periodId, pageNo, pageSize }) => projectApi.materialAccounts(periodId, { pageNo, pageSize }), periodId, isCurrent)
    if (!isCurrent()) return
    const missing = missingPickAccounts(accounts, selectedMaterials.value)
    if (!missing.length) return toast.info(accounts.some(row => Number(row.availableApplyQty) > 0) ? '可领物料已全部加入，已保留当前数量' : '当前项目暂无可申请的物料')
    const added = missing.map(row => ({ ...normalizeAvailableMaterial(row), unit: String(row.baseUnitName).trim(), qty: Number(row.availableApplyQty) }))
    selectedMaterials.value = [...selectedMaterials.value, ...added]
    toast.success(`已带入 ${added.length} 项物料，可继续调整数量`)
  } catch (error: any) {
    if (isCurrent()) toast.error(error?.message || '可申请物料加载失败，请重试')
  } finally {
    if (version === bulkVersion) bulkLoading.value = false
  }
}

const resetMaterialSource = () => {
  materialRequestVersion += 1
  materialList.value = []
  materialPageNo.value = 1
  materialTotal.value = 0
  materialHasMore.value = true
  materialsLoading.value = false
  materialsError.value = false
}

const loadProjectMaterials = async (reset = false) => {
  if (!orderInfo.value.id) return
  if (reset) resetMaterialSource()
  else if (materialsLoading.value || !materialHasMore.value) return

  const requestVersion = materialRequestVersion
  const periodId = String(orderInfo.value.id)
  const keyword = materialKeyword.value.trim()
  const pageNo = materialPageNo.value
  materialsLoading.value = true
  materialsError.value = false
  try {
    const res: any = reworkId.value ? { result: await getReworkMaterials(periodId, reworkId.value) } : await projectApi.materialAccounts(periodId, {
      pageNo,
      pageSize: materialPageSize,
      ...(keyword ? { keyword } : {}),
    })
    if (
      requestVersion !== materialRequestVersion ||
      periodId !== String(orderInfo.value.id) ||
      keyword !== materialKeyword.value.trim()
    )
      return

    const result = res?.result ?? res
    const isArrayResult = Array.isArray(result)
    const rawAccounts = isArrayResult
      ? result
      : Array.isArray(result?.records)
        ? result.records
        : []
    const availableMaterials = rawAccounts
      .filter((item: any) => item.materialId)
      .map(normalizeAvailableMaterial)
    const merged = reset ? availableMaterials : [...materialList.value, ...availableMaterials]
    materialList.value = Array.from(
      new Map(merged.map((item: any) => [String(item.id), item])).values(),
    )
    const freshMaterialMap = new Map(materialList.value.map((item: any) => [String(item.id), item]))
    pickerSelectedMaterials.value = pickerSelectedMaterials.value.map((selected: any) => {
      const fresh = freshMaterialMap.get(String(selected.id))
      if (!fresh) return selected
      return {
        ...fresh,
        qty: Math.min(Number(selected.qty) || 1, getAvailableApplyQty(fresh)),
      }
    })
    const total = Number(isArrayResult ? result.length : result?.total)
    materialPageNo.value = pageNo + 1
    materialHasMore.value = isArrayResult
      ? false
      : Number.isFinite(total)
        ? pageNo * materialPageSize < total && rawAccounts.length > 0
        : rawAccounts.length >= materialPageSize
    materialTotal.value = materialHasMore.value
      ? Number.isFinite(total)
        ? total
        : materialList.value.length
      : materialList.value.length
  } catch (e) {
    if (requestVersion === materialRequestVersion) materialsError.value = true
  } finally {
    if (requestVersion === materialRequestVersion) materialsLoading.value = false
  }
}

const loadAllMaterials = async () => {
  if (materialsLoading.value) return
  materialsLoading.value = true
  materialsError.value = false
  try {
    const res: any = await stockApi.materials()
    materialList.value = unwrapRecords(res).map(normalizeMaterial)
  } catch (e) {
    materialList.value = []
    materialsError.value = true
  } finally {
    materialsLoading.value = false
  }
}

const retryLoadMaterials = () =>
  isProjectUsage.value ? loadProjectMaterials(!materialList.value.length) : loadAllMaterials()

const loadMoreProjectMaterials = () => {
  if (isProjectUsage.value) loadProjectMaterials()
}

const loadParticipatedProjects = async () => {
  const request = ++projectRequestVersion
  const username = String(userStore.userInfo.username || '').trim()
  const keyword = projectKeyword.value.trim()
  participatedProjects.value = []
  if (!username) {
    projectsError.value = true
    projectsLoading.value = false
    toast.warning('登录账号信息缺失，请重新登录')
    return
  }
  projectsLoading.value = true
  projectsError.value = false
  try {
    const res: any = await projectApi.participatedProjects({
      periodStatus: projectMaterialPeriodStatus,
      approvalStatus: '1',
      username,
      ...(keyword ? { keyword } : {}),
    })
    if (request !== projectRequestVersion || username !== String(userStore.userInfo.username || '').trim()) return
    const uniqueProjects = new Map<string, any>()
    unwrapRecords(res)
      .map((item: any) => normalizeProject({ ...item, status: item.periodStatus }))
      .forEach((project: any) => {
        const key = String(project.id || `${project.projectId || ''}-${project.periodNo || ''}`)
        if (key && !uniqueProjects.has(key)) uniqueProjects.set(key, project)
      })
    participatedProjects.value = Array.from(uniqueProjects.values())
  } catch (e) {
    if (request !== projectRequestVersion) return
    participatedProjects.value = []
    projectsError.value = true
  } finally {
    if (request === projectRequestVersion) projectsLoading.value = false
  }
}

onLoad(async (query) => {
  requestedReworkId.value = String(query?.reworkId || '').trim()
  await loadParticipatedProjects()
  const requestedPeriodId = String(query?.periodId || '').trim()
  if (!requestedPeriodId) return
  const selected = participatedProjects.value.find(item => String(item.periodId || item.id) === requestedPeriodId)
  if (selected) await selectProject(selected)
  else if (!projectsError.value) toast.warning('当前分期不在可领料项目范围内，请重新选择项目')
})

const changeUsageType = (event: any) => {
  if (submitting.value || projectSelecting.value || requestedReworkId.value) return
  const nextIndex = Number(event.detail.value)
  if (nextIndex === usageTypeIndex.value) return
  usageTypeIndex.value = nextIndex
  orderNo.value = ''
  orderInfo.value = {}
  reworkId.value = ''
  resetMaterialSource()
  selectedMaterials.value = []
  pickerSelectedMaterials.value = []
  materialKeyword.value = ''
}

const openProjectPicker = async () => {
  if (submitting.value || projectSelecting.value) return
  if (reworkId.value && requestedReworkId.value) return toast.warning('返工领料已锁定当前分期')
  showProject.value = true
  await loadParticipatedProjects()
}

const selectProject = async (project: any) => {
  if (submitting.value || projectSelecting.value) return
  invalidateBulk()
  projectSelecting.value = true
  try {
    const response: any = await projectApi.detail(String(project.id))
    const current = String(response?.result?.currentReworkId || '')
    if (requestedReworkId.value && current !== requestedReworkId.value) throw new Error('返工轮次已变化，请返回项目详情重新进入')
    if (current) await validateRework(String(project.id), current)
    project = { ...project, currentReworkId: current }
  const projectChanged = String(project.id || '') !== String(orderInfo.value.id || '') || String(project.currentReworkId || '') !== reworkId.value
  orderInfo.value = project
  reworkId.value = String(project.currentReworkId || '')
  orderNo.value = project.periodNo || project.projectNo || ''
  showProject.value = false
  projectKeyword.value = ''
  if (projectChanged) {
    resetMaterialSource()
    selectedMaterials.value = []
    pickerSelectedMaterials.value = []
    materialKeyword.value = ''
  }
  } catch (error: any) { toast.warning(error?.message || '项目加载失败，请重试') }
  finally { projectSelecting.value = false }
}

const isSelected = (m: any) =>
  pickerSelectedMaterials.value.some((item) => String(item.id) === String(m.id))

const toggleMaterial = (m: any) => {
  const index = pickerSelectedMaterials.value.findIndex((item) => String(item.id) === String(m.id))
  if (index >= 0) pickerSelectedMaterials.value.splice(index, 1)
  else {
    const availableQty = getAvailableApplyQty(m)
    if (isProjectUsage.value && availableQty <= 0) return toast.info('该物料当前不可申请')
    pickerSelectedMaterials.value.push({
      ...m,
      qty: isProjectUsage.value ? Math.min(1, availableQty) : 1,
    })
  }
}

const toggleSelectAllMaterials = () => {
  const loadedMaterials = selectableMaterials.value
  if (!loadedMaterials.length) return

  const loadedIds = new Set(loadedMaterials.map((material) => String(material.id)))
  if (allLoadedMaterialsSelected.value) {
    pickerSelectedMaterials.value = pickerSelectedMaterials.value.filter(
      (material) => !loadedIds.has(String(material.id)),
    )
    return
  }

  const selectedIds = new Set(pickerSelectedMaterials.value.map((material) => String(material.id)))
  loadedMaterials.forEach((material) => {
    if (!selectedIds.has(String(material.id))) {
      pickerSelectedMaterials.value.push({
        ...material,
        qty: isProjectUsage.value ? Math.min(1, getAvailableApplyQty(material)) : 1,
      })
      selectedIds.add(String(material.id))
    }
  })
}

const cancelMaterialPicker = () => {
  showMaterial.value = false
  pickerSelectedMaterials.value = []
}

const confirmMaterialPicker = () => {
  if (pickerSelectedMaterials.value.some(isMaterialDisabled)) return toast.warning('部分物料暂无可申请量，请取消选择后重试')
  selectedMaterials.value = pickerSelectedMaterials.value.map((item) => ({ ...item }))
  showMaterial.value = false
  pickerSelectedMaterials.value = []
}

const removeMaterial = (material: any) => {
  const id = String(material.id)
  selectedMaterials.value = selectedMaterials.value.filter((item) => String(item.id) !== id)
  pickerSelectedMaterials.value = pickerSelectedMaterials.value.filter(
    (item) => String(item.id) !== id,
  )
}

const normalizeMaterialQty = (material: any) => {
  const quantity = Number(material.qty)
  if (!Number.isFinite(quantity) || quantity <= 0) {
    material.qty = isProjectUsage.value ? Math.min(1, getAvailableApplyQty(material)) : 1
    return
  }
  if (!isProjectUsage.value) {
    material.qty = quantity
    return
  }
  const availableQty = getAvailableApplyQty(material)
  if (quantity > availableQty) {
    material.qty = availableQty
    toast.info(`申请数量不能超过当前可申请数量 ${availableQty}`)
    return
  }
  material.qty = quantity
}

const inc = (m: any) => {
  const max = isProjectUsage.value ? getAvailableApplyQty(m) : Number.POSITIVE_INFINITY
  const current = Number(m.qty) || 0
  if (current >= max) return toast.info(`申请数量不能超过当前可申请数量 ${max}`)
  m.qty = Math.min(current + 1, max)
}
const dec = (m: any) => {
  const current = Number(m.qty) || 0
  if (current <= 0.01) return
  m.qty = Math.max(0.01, Number((current - 1).toFixed(4)))
}

const submit = async () => {
  if (submitting.value || projectSelecting.value || bulkLoading.value) return
  if (isProjectUsage.value && !orderInfo.value.id) return toast.warning('请选择关联单号')
  if (!selectedMaterials.value.length) return toast.warning('请选择物料')
  const invalid = selectedMaterials.value.find((m) => !Number(m.qty) || Number(m.qty) <= 0)
  if (invalid) return toast.warning(`${invalid.name}的申请数量应大于 0`)
  const overPlan =
    isProjectUsage.value &&
    selectedMaterials.value.find((m) => Number(m.qty) > getAvailableApplyQty(m))
  if (overPlan) return toast.warning(`${overPlan.name}的申请数量不能超过当前可申请数量`)
  submitting.value = true
  try {
    if (isProjectUsage.value) {
      const project: any = await projectApi.detail(String(orderInfo.value.id))
      const currentRework = String(project?.result?.currentReworkId || '')
      if (currentRework !== reworkId.value) throw new Error('项目返工轮次已变化，请重新选择项目和物料')
      if (reworkId.value) {
        const fresh = await getReworkMaterials(String(orderInfo.value.id), reworkId.value)
        if (selectedMaterials.value.some(item => {
          const row = fresh.find((row: any) => String(row.materialId) === String(item.id))
          return !row || Number(item.qty) > Number(row.availableApplyQty)
        })) return toast.warning('本轮可申请数量已变化，请重新选择物料')
      }
    }
    const user = userStore.userInfo as any
    const res: any = await stockApi.addApply({
      applyType: 'OUT',
      usageType: usageType.value,
      ...(isProjectUsage.value
        ? {
            periodId: String(orderInfo.value.id),
            ...(reworkId.value ? { reworkId: reworkId.value } : {}),
          }
        : {}),
      applyUserId: user.userid || user.id || '',
      useDate: useTime.value,
      remark: remark.value.trim(),
      itemList: selectedMaterials.value.map((m) => ({
        materialId: m.id,
        unitName: m.unit,
        unitQty: Number(m.qty),
      })),
    })
    applyNo.value = res.result?.applyNo || res.result?.id || ''
    const noText = applyNo.value ? `申请单号：${applyNo.value}\n` : ''
    const approvalText = String(res.result?.status) === '1' ? '申请已通过，等待库管出库。' : String(res.result?.status) === '2' ? '申请已提交，等待审批；审批通过后由库管办理出库。' : '申请已提交，请在申请记录中查看审批和出库进度。'
    message
      .alert({ title: '申请提交成功', msg: `${noText}${approvalText}` })
      .then(() => uni.navigateBack())
  } catch (e: any) {
    toast.error(e?.message || '提交失败，请重试')
  } finally {
    submitting.value = false
  }
}

const openMaterialPicker = async () => {
  if (projectSelecting.value || submitting.value || bulkLoading.value) return
  if (isProjectUsage.value && !orderInfo.value.id) return toast.warning('请先选择关联单号')
  pickerSelectedMaterials.value = selectedMaterials.value.map((item) => ({ ...item }))
  showMaterial.value = true
  if (!isProjectUsage.value || reworkId.value) {
    // 完整字典由公共 http 字典缓存去重，不从当前物料页收集品牌。
    void http.get('/sys/dict/getDictItems/material_brand').then((response) => {
      brandNames.value = materialBrandMap(response)
    }).catch(() => toast.warning('品牌字典加载失败，请重新打开选料重试'))
  }
  if (isProjectUsage.value) await loadProjectMaterials(true)
  else if (!materialList.value.length) await loadAllMaterials()
}

watch(projectKeyword, () => {
  if (projectSearchTimer) clearTimeout(projectSearchTimer)
  projectRequestVersion++
  participatedProjects.value = []
  projectsError.value = false
  projectsLoading.value = true
  projectSearchTimer = setTimeout(() => { void loadParticipatedProjects() }, 320)
})

watch(materialKeyword, () => {
  if (!showMaterial.value || !isProjectUsage.value) return
  if (materialSearchTimer) clearTimeout(materialSearchTimer)
  materialSearchTimer = setTimeout(() => loadProjectMaterials(true), 320)
})

onBeforeUnmount(() => {
  invalidateBulk()
  projectRequestVersion++
  if (projectSearchTimer) clearTimeout(projectSearchTimer)
  if (materialSearchTimer) clearTimeout(materialSearchTimer)
})
</script>

<style lang="scss" scoped>
@import './components/materialRequest.scss';

.bulk-material { margin-bottom: 16px; }
.bulk-material__hint { display: block; margin-top: 8px; color: #667085; font-size: 14px; line-height: 1.5; }
.page {
  min-height: 0;
}

.form-row {
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f5f5f5;

  &:last-child {
    border-bottom: none;
  }

  .label {
    width: 84px;
    font-size: 14px;
    color: #333;
    flex: none;
  }

  .search-input,
  .static-val,
  .picker-value {
    flex: 1;
    font-size: 14px;
    color: #333;
  }

  .picker-value--select::after {
    content: '›';
    margin-left: 8px;
    color: #767676;
  }

  .search-box {
    flex: 1;
    display: flex;
    align-items: center;
  }

  .search-btn {
    color: #2f86ff;
    font-size: 13px;
    padding: 4px 0 4px 12px;
  }

  .static-val {
    color: #666;
  }
}

.add-material {
  text-align: center;
  color: #2f86ff;
  font-size: 14px;
  padding: 12px 0 2px;
}

.submit-wrap {
  padding: 20px 16px 40px;
}

.remark-field {
  position: relative;

  .label {
    display: block;
    margin-bottom: 9px;
    font-size: 14px;
    color: #333;
  }
}

.remark-input {
  box-sizing: border-box;
  width: 100%;
  height: 96px;
  padding: 10px 12px 26px;
  font-size: 14px;
  line-height: 1.55;
  color: #222;
  background: #f7f8fa;
  border: 1px solid #ddd;
  border-radius: 10px;
}

.remark-count {
  position: absolute;
  right: 10px;
  bottom: 8px;
  font-size: 11px;
  color: #666;
}

.popup {
  padding: 16px 20px 24px;

  &__title {
    font-size: 16px;
    font-weight: 600;
    text-align: center;
  }

  &__list {
    max-height: 50vh;
    margin-top: 12px;
  }

  &__empty {
    padding: 42px 12px;
    font-size: 13px;
    color: #666;
    text-align: center;

    &--error {
      color: #a13a3a;
    }

    &--loading {
      padding: 24px 12px;
    }
  }

  &__btns {
    display: flex;
    margin-top: 16px;

    .btn {
      flex: 1;
      text-align: center;
      padding: 11px 0;
      border-radius: 22px;
      font-size: 14px;
      margin-left: 12px;

      &:first-child {
        margin-left: 0;
      }

      &--plain {
        border: 1px solid #ddd;
        color: #666;
      }

      &--primary {
        background: #2f86ff;
        color: #fff;
      }
    }
  }
}

.popup__more {
  padding: 12px 8px 18px;
  color: #176ac7;
  font-size: 12px;
  text-align: center;

  &--done {
    color: #667085;
  }
}

.material-selected-summary {
  padding: 10px 12px;
  margin-top: 10px;
  border-radius: 10px;
  background: #edf5ff;
  color: #176ac7;
  font-size: 13px;
  font-weight: 600;
  text-align: center;
}

.material-search {
  display: flex;
  padding: 9px 12px;
  margin-top: 14px;
  background: #f4f6f8;
  border: 1px solid #e1e4e8;
  border-radius: 10px;
  align-items: center;

  &__input {
    min-width: 0;
    font-size: 14px;
    color: #222;
    flex: 1;
  }

  &__clear {
    padding-left: 12px;
    font-size: 12px;
    color: #176ac7;
  }
}

.material-picker-toolbar {
  display: flex;
  min-height: 38px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 4px 2px 0;

  &__count {
    color: #667085;
    font-size: 12px;
  }

  &__select-all {
    padding: 8px 0 8px 12px;
    color: #176ac7;
    font-size: 13px;
    font-weight: 600;

    &.disabled {
      color: #98a2b3;
    }
  }
}

.mat {
  display: flex;
  align-items: center;
  padding: 12px;
  border: 1px solid #eee;
  border-radius: 10px;
  margin-bottom: 10px;

  &--disabled {
    background: #f5f5f5;
    cursor: not-allowed;
  }

  &__unavailable {
    margin-left: 8px;
    font-size: 12px;
    color: #767676;
  }

  &.on {
    border-color: #2f86ff;
    background: #f0f7ff;
  }

  &__body {
    min-width: 0;
    flex: 1;
  }

  &__title {
    display: flex;
    gap: 12px;
    align-items: baseline;
    justify-content: space-between;
  }

  &__name {
    min-width: 0;
    overflow: hidden;
    font-size: 14px;
    color: #333;
    font-weight: 500;
    line-height: 1.45;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  &__spec {
    font-size: 12px;
    color: #666;
    margin-top: 2px;
  }

  &__code {
    max-width: 46%;
    overflow: hidden;
    color: #667085;
    font-size: 11px;
    line-height: 1.45;
    text-align: right;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: none;
  }

  &__available {
    margin-top: 5px;
    color: #176ac7;
    font-size: 12px;
    font-weight: 600;
  }

  &__check {
    display: flex;
    width: 24px;
    height: 24px;
    color: #2f86ff;
    align-items: center;
    justify-content: center;
    flex: none;
  }
}

.project-mat {
  min-height: 58px;
  padding: 11px 12px;
  background: #f7f9fb;
  border-color: #edf0f3;
  border-radius: 12px;

  &.on {
    background: #edf5ff;
    border-color: #a8cff9;
  }

  &__body {
    display: flex;
    gap: 16px;
    min-width: 0;
    align-items: center;
    justify-content: space-between;
    flex: 1;
  }

  &__name {
    min-width: 0;
    overflow: hidden;
    font-size: 14.5px;
    font-weight: 650;
    line-height: 1.45;
    color: #1f2937;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  &__period {
    max-width: 44%;
    overflow: hidden;
    font-size: 12px;
    line-height: 1.45;
    color: #667085;
    text-align: right;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: none;
  }

  &__check {
    display: flex;
    width: 18px;
    height: 18px;
    margin-left: 8px;
    align-items: center;
    justify-content: center;
    flex: none;
  }

  &.on &__name {
    color: #176ac7;
  }

  &.on &__period {
    color: #356d9f;
  }
}

.done-box {
  text-align: center;
  padding: 8px 0;

  .done-icon {
    font-size: 40px;
  }

  .done-no {
    font-size: 15px;
    font-weight: 600;
    margin-top: 10px;
  }

  .done-desc {
    font-size: 13px;
    color: #999;
    margin-top: 6px;
  }
}
</style>
