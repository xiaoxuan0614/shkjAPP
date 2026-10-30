<route lang="json5">
{
  style: {
    navigationBarTitleText: '申请详情',
  },
}
</route>
<template>
  <PageLayout :navbarShow="false">
    <view v-if="loading && !detail.id" class="state-page">
      <wd-loading />
      <text>正在加载申请详情</text>
    </view>

    <view v-else-if="loadError && !detail.id" class="state-page state-page--error">
      <text>{{ loadError }}</text>
      <button class="retry-button" @click="load">重新加载</button>
    </view>

    <template v-else-if="detail.id">
      <scroll-view class="page" :scroll-y="true">
        <SectionCard title="申请信息">
          <template #extra><button v-if="canWithdraw || withdrawing" class="cancel-apply-button" :disabled="withdrawing || submitting" @click="withdrawApply">{{ withdrawing ? '正在处理…' : cancelLabel }}</button></template>
          <view class="application-info">
          <view class="row row--full row--project">
            <text class="label">项目名称</text>
            <text class="val">{{ detail.projectLabel }}</text>
          </view>
          <view class="row" :class="{ 'row--full': detail.type !== 'out' }">
            <text class="label">申请类型</text>
            <text class="val">{{ detail.typeText }}</text>
          </view>
          <view v-if="detail.type === 'out'" class="row">
            <text class="label">领料类型</text>
            <text class="val">{{ getMaterialUsageTypeText(detail.usageType) }}</text>
          </view>
          <view class="row">
            <text class="label">申请人</text>
            <text class="val">{{ detail.applyUserName || '未提供' }}</text>
          </view>
          <view v-if="detail.type === 'out'" class="row">
            <text class="label">审批人</text>
            <text class="val">{{ detail.approvalNames }}</text>
          </view>
          <view class="row row--full">
            <text class="label">申请时间</text>
            <text class="val">{{ detail.applyTime || '—' }}</text>
          </view>
          <view v-if="detail.type === 'out'" class="row row--full">
            <text class="label">使用时间</text>
            <text class="val">{{ detail.useTime || '—' }}</text>
          </view>
          <view class="row row--full row--remark">
            <text class="label">备注</text>
            <text class="val">{{ detail.remark || '—' }}</text>
          </view>
          </view>
        </SectionCard>

        <SectionCard v-if="detail.type === 'out'" title="出库物料">
          <view v-if="outboundReadonlyReason" class="empty-state">{{ outboundReadonlyReason }}</view>
          <view v-if="loadError" class="inline-error" @click="load">
            {{ loadError }}，点击重新加载
          </view>
          <view v-else-if="!detail.items.length" class="empty-state">暂无物料明细</view>
          <template v-else>
            <view class="batch-toolbar">
              <button
                class="select-all-button"
                :class="{ 'select-all-button--disabled': !executableItems.length }"
                :disabled="!executableItems.length || submitting"
                :aria-label="allSelected ? '取消全选' : '全选可出库物料'"
                :aria-pressed="allSelected"
                @click="toggleSelectAll"
              >
                <view
                  class="check-box"
                  :class="{
                    'check-box--checked': allSelected,
                    'check-box--partial': someSelected && !allSelected,
                  }"
                >
                  <wd-icon v-if="allSelected" name="check" size="14px" color="#fff" />
                </view>
                <text>{{ allSelected ? '取消全选' : '全选可出库物料' }}</text>
              </button>
              <text class="selected-count">
                已选 {{ selectedItems.length }}/{{ executableItems.length }} 项
              </text>
            </view>

            <view
              v-for="material in pagedMaterials"
              :key="material.id"
              class="material-item"
              :class="{ 'material-item--selected': material.checked }"
            >
              <view class="material-item__top">
                <button
                  class="item-check-button"
                  :disabled="!canExecuteOutbound || !material.executable"
                  :aria-label="materialCheckLabel(material)"
                  :aria-pressed="material.checked"
                  @click="toggleItem(material)"
                >
                  <view
                    class="check-box"
                    :class="{
                      'check-box--checked': material.checked,
                      'check-box--disabled': !material.executable,
                    }"
                  >
                    <wd-icon v-if="material.checked" name="check" size="14px" color="#fff" />
                  </view>
                </button>

                <view class="material-main">
                  <view class="material-title-line">
                    <text class="material-name">{{ material.name || '未命名物料' }}</text>
                    <text
                      class="material-state"
                      :class="'material-state--' + itemState(material).type"
                    >
                      {{ itemState(material).text }}
                    </text>
                  </view>
                  <text class="material-spec">{{ materialSpec(material) }}</text>
                </view>
              </view>

              <view class="quantity-grid">
                <view class="quantity-cell">
                  <text class="quantity-label">申请数量</text>
                  <text class="quantity-value">{{ formatQty(material.requestedQty) }}</text>
                  <text class="quantity-unit">{{ material.unitName }}</text>
                </view>
                <view class="quantity-cell">
                  <text class="quantity-label">实时库存</text>
                  <text class="quantity-value">
                    {{ material.stockKnown ? formatQty(material.stockQty) : '—' }}
                  </text>
                  <text class="quantity-unit">{{ material.unitName }}</text>
                </view>
                <view class="quantity-cell">
                  <text class="quantity-label">已出库数量</text>
                  <text class="quantity-value">{{ formatQty(material.executedQty) }}</text>
                  <text class="quantity-unit">{{ material.unitName }}</text>
                </view>
                <view class="quantity-cell">
                  <text class="quantity-label">待出库数量</text>
                  <text class="quantity-value quantity-value--key">
                    {{ formatQty(material.pendingQty) }}
                  </text>
                  <text class="quantity-unit">{{ material.unitName }}</text>
                </view>
              </view>

              <view v-if="canExecuteOutbound && material.approvalPassed && material.pendingQty > 0" class="execute-panel">
                <view class="execute-row">
                  <text class="execute-label">本次出库</text>
                  <view class="quantity-control">
                    <button
                      class="quantity-button"
                      :disabled="!material.executable || !material.checked"
                      :aria-label="quantityButtonLabel(material, '减少')"
                      @click="decreaseQty(material)"
                    >
                      <wd-icon name="minus-circle" size="18px" />
                    </button>
                    <input
                      v-model="material.executeQty"
                      class="quantity-input"
                      type="digit"
                      inputmode="decimal"
                      :disabled="!material.executable || !material.checked"
                      :aria-label="quantityButtonLabel(material, '填写')"
                      @blur="normalizeExecuteQty(material)"
                    />
                    <button
                      class="quantity-button"
                      :disabled="!material.executable || !material.checked"
                      :aria-label="quantityButtonLabel(material, '增加')"
                      @click="increaseQty(material)"
                    >
                      <wd-icon name="add-circle" size="18px" />
                    </button>
                    <button
                      class="fill-button"
                      :disabled="!material.executable || !material.checked"
                      @click="fillAll(material)"
                    >
                      全部
                    </button>
                  </view>
                </view>
                <text
                  class="execute-hint"
                  :class="{
                    'execute-hint--warn': material.stockInsufficient || !material.stockKnown,
                  }"
                >
                  {{ executeHint(material) }}
                </text>
                <view class="execute-remark">
                  <text class="execute-label">执行备注</text>
                  <input v-model="material.executeRemark" class="execute-remark__input" :disabled="!material.executable || !material.checked || submitting" :maxlength="500" placeholder="选填，可填写快递单号" :aria-label="(material.name || '当前物料') + '执行备注，可填写快递单号'" />
                </view>
              </view>
            </view>
          </template>
        </SectionCard>

        <SectionCard v-else title="物料明细">
          <view v-if="inboundReadonlyReason" class="empty-state">{{ inboundReadonlyReason }}</view>
          <view v-if="loadError" class="inline-error" @click="load">{{ loadError }}，点击重新加载</view>
          <view v-else-if="!detail.items.length" class="empty-state">暂无物料明细</view>
          <view v-for="material in pagedMaterials" :key="material.id" class="material-item">
            <view class="material-title-line">
              <text class="material-name">{{ material.name || '未命名物料' }}</text>
              <text v-if="material.materialCode" class="material-code">{{ material.materialCode }}</text>
            </view>
            <text class="material-spec">{{ materialSpec(material) }}</text>
            <view class="quantity-grid quantity-grid--inbound">
              <view class="quantity-cell">
                <text class="quantity-label">申请数量</text>
                <text class="quantity-value">{{ formatQty(material.applyQty) }}</text>
                <text class="quantity-unit">{{ material.unitName }}</text>
              </view>
              <view class="quantity-cell">
                <text class="quantity-label">已入库</text>
                <text class="quantity-value">{{ formatQty(material.returnQty) }}</text>
                <text class="quantity-unit">{{ material.unitName }}</text>
              </view>
              <view class="quantity-cell">
                <text class="quantity-label">待入库</text>
                <text class="quantity-value quantity-value--key">{{ formatQty(material.pendingQty) }}</text>
                <text class="quantity-unit">{{ material.unitName }}</text>
              </view>
            </view>
            <view v-if="isExecutableInboundHead(detail) && material.pendingQty > 0 && permission.hasPermission('mtl:goods:io')" class="execute-panel">
              <view class="execute-row">
                <text class="execute-label">本次入库</text>
                <view class="inbound-quantity" :class="{ 'inbound-quantity--disabled': submitting }">
                  <input v-model="material.executeQty" class="inbound-quantity__input" type="digit" :disabled="submitting" :aria-label="material.name + '本次入库数量'" />
                  <text class="inbound-quantity__unit">{{ material.unitName }}</text>
                </view>
              </view>
              <text class="execute-hint">最多 {{ formatQty(material.pendingQty) }} {{ material.unitName }}，填 0 则本次不处理</text>
              <template v-if="isProjectReturn">
                <view class="disposition-field">
                  <text class="execute-label">还料处置</text>
                  <view class="disposition-options" role="group" aria-label="还料处置">
                    <button v-for="option in dispositionOptions" :key="option.value" class="disposition-option" :class="{ 'disposition-option--selected': material.dispositionType === option.value }" :aria-pressed="material.dispositionType === option.value" :disabled="submitting" hover-class="disposition-option--pressed" @click="material.dispositionType = option.value">
                      <text class="disposition-option__mark" aria-hidden="true">{{ material.dispositionType === option.value ? '✓' : '' }}</text>
                      <text>{{ option.label }}</text>
                    </button>
                  </view>
                </view>
                <input v-if="material.dispositionType !== 'RESTOCK'" v-model="material.dispositionRemark" class="execute-remark__input" :disabled="submitting" maxlength="500" placeholder="请填写报废或遗失原因（必填）" />
              </template>
              <input v-model="material.executeRemark" class="execute-remark__input" :disabled="submitting" maxlength="500" placeholder="执行备注（选填）" />
            </view>
          </view>
        </SectionCard>
        <view v-if="materialPageCount > 1" class="material-pagination">
          <view class="material-pagination__controls">
            <button :disabled="materialPage <= 1 || submitting" @click="materialPage--">上一页</button>
            <text>{{ materialPage }} / {{ materialPageCount }} · 共 {{ detail.items.length }} 项</text>
            <button :disabled="materialPage >= materialPageCount || submitting" @click="materialPage++">下一页</button>
          </view>
          <text class="material-pagination__hint">每页10项，翻页保留填写内容；执行范围包含所有页</text>
        </view>
        <SectionCard v-if="detail.type === 'in'" title="执行入库记录">
          <view v-if="recordError" class="inline-error" @click="loadInboundRecords(true)">{{ recordError }}，点击重试</view>
          <view v-else-if="!inboundRecords.length && !recordLoading" class="empty-state">暂无执行入库记录</view>
          <view v-for="record in inboundRecords" :key="record.id" class="material-item">
            <view class="material-title-line">
              <text class="material-name">{{ record.materialName || detail.items.find(item => String(item.materialId) === String(record.materialId))?.name || '未命名物料' }}</text>
              <text class="record-quantity">{{ formatQty(record.unitQty) }} {{ record.unitName }}</text>
            </view>
            <text class="material-spec">入库时间：{{ record.createTime || '—' }}</text>
            <text v-if="record.remark" class="material-spec">备注：{{ record.remark }}</text>
          </view>
          <button v-if="recordHasMore || recordLoading" class="record-more" :disabled="recordLoading" @click="loadInboundRecords(false)">{{ recordLoading ? '正在加载…' : '加载更多记录' }}</button>
        </SectionCard>
      </scroll-view>

      <view v-if="detail.type === 'out' && executableItems.length" class="bottom">
        <view class="bottom-summary">
          <text class="bottom-summary__value">已选 {{ selectedItems.length }} 项</text>
          <text class="bottom-summary__hint">数量可逐项调整</text>
        </view>
        <button
          class="submit-button"
          :disabled="!selectedItems.length || submitting || withdrawing"
          @click="executeOutbound"
        >
          {{ submitting ? '正在出库…' : '执行出库（' + selectedItems.length + '）' }}
        </button>
      </view>

      <view v-else-if="detail.type === 'in' && (canExecuteInbound || submitting)" class="bottom">
        <button
          class="submit-button submit-button--full"
          :disabled="submitting || withdrawing"
          @click="executeInbound"
        >
          {{ submitting ? '正在处理…' : '执行入库' }}
        </button>
      </view>
    </template>
  </PageLayout>
</template>

<script lang="ts" setup>
import { onLoad } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { useMessage, useToast } from 'wot-design-uni'
import { stockApi, unwrapRecords, formatStockProjectName } from '@/service/shkj'
import SectionCard from '@/components/SectionCard/SectionCard.vue'
import { getMaterialUsageTypeText } from '@/types/business'
import { usePermissionStore } from '@/store/permission'
import { useUserStore } from '@/store/user'
import { stockCancelMode } from '@/service/stockCancellation'
import { ensureCurrentAuthorization } from '@/service/permission'

const toast = useToast()
const message = useMessage()
const detail = ref<any>({})
const materialPage = ref(1)
const materialPageSize = 10
const materialPageCount = computed(() => Math.max(1, Math.ceil((detail.value.items?.length || 0) / materialPageSize)))
// slice保留原行引用，跨页数量、备注、处置方式和选择状态不会丢失。
const pagedMaterials = computed(() => (detail.value.items || []).slice(
  (materialPage.value - 1) * materialPageSize, materialPage.value * materialPageSize,
))
const id = ref('')
const loading = ref(false)
const loadError = ref('')
const submitting = ref(false)
const fromStockTodo = ref(false)
const permission = usePermissionStore()
const userStore = useUserStore()
const withdrawing = ref(false)
const cancellationMode = (head: any) => stockCancelMode(head, userStore.userInfo)
const cancelLabel = computed(() => cancellationMode(detail.value) === 'withdraw' ? '撤回申请' : '取消申请')
const canWithdraw = computed(() => !loading.value && !loadError.value && !submitting.value && !withdrawing.value && !!cancellationMode(detail.value))
const withdrawApply = async () => {
  if (!canWithdraw.value) return
  const mode = cancellationMode(detail.value)
  const label = cancelLabel.value
  const prompt = mode === 'withdraw' ? '确认撤回该申请吗？撤回后将退出审批流程。' : '确认取消该待执行领料申请吗？取消后不能继续出库，需要领料时请重新申请。'
  try { await message.confirm({title:label,msg:prompt}) }
  catch { return }
  if (!canWithdraw.value) return
  withdrawing.value = true
  try {
    await ensureCurrentAuthorization(userStore.userInfo, true)
    const response: any = await stockApi.applyDetail(id.value)
    const latest = response?.result ?? response
    if (response?.success === false || String(latest?.id) !== id.value || cancellationMode(latest) !== mode) {
      toast.warning('申请状态或操作权限已变化，请查看最新详情')
      await load()
      return
    }
    const result: any = await stockApi.cancelApply(id.value)
    if (result?.success === false) throw new Error(result.message || '操作失败')
    toast.success(mode === 'withdraw' ? '已撤回申请' : '已取消申请')
    await load()
  } catch (error: any) { toast.error(error?.message || '操作失败，请刷新核对单据状态') }
  finally { withdrawing.value = false }
}
const inboundRecords = ref<any[]>([])
const recordLoading = ref(false)
const recordError = ref('')
const recordPage = ref(0)
const recordHasMore = ref(false)
const loadInboundRecords = async (reset = false) => {
  if (recordLoading.value) return
  recordLoading.value = true
  recordError.value = ''
  if (reset) { inboundRecords.value = []; recordPage.value = 0 }
  try {
    const pageNo = recordPage.value + 1
    const response: any = await stockApi.inboundRecords(id.value, pageNo)
    if (response?.success === false) throw new Error('加载失败')
    const result = response?.result ?? response
    if (!Array.isArray(result) && !Array.isArray(result?.records)) throw new Error('响应异常')
    const rows = unwrapRecords(response)
    // 即使服务端过滤失效，也不展示其他申请或出库流水。
    const matching = rows.filter((row: any) => String(row.sourceId) === id.value && String(row.ioType).toUpperCase() === 'IN')
    const seen = new Set(inboundRecords.value.map(row => String(row.id)))
    inboundRecords.value.push(...matching.filter((row: any) => !seen.has(String(row.id))))
    recordPage.value = pageNo
    recordHasMore.value = result?.total != null ? pageNo * 20 < Number(result.total) : rows.length === 20
  } catch { recordError.value = '执行入库记录加载失败' }
  finally { recordLoading.value = false }
}
const isExecutableOutboundHead = (head: any) =>
  String(head.applyType).toUpperCase() === 'OUT' &&
  String(head.status) === '1' &&
  ['PENDING', 'PARTIAL_EXECUTED'].includes(String(head.executeStatus).toUpperCase())
const outboundReadonlyReason = computed(() => {
  if (loading.value) return '正在更新申请状态，请稍候'
  if (loadError.value) return '加载失败，请重新加载后再执行'
  if (!permission.hasPermission('mtl:goods:io')) return '当前账号无出库执行权限，仅可查看详情'
  if (!isExecutableOutboundHead(detail.value)) return '当前申请已完成或状态已变化，仅可查看详情'
  return ''
})
const canExecuteOutbound = computed(() => !outboundReadonlyReason.value && !submitting.value && !withdrawing.value)
const isExecutableInboundHead = (head: any) =>
  String(head.applyType).toUpperCase() === 'IN' && String(head.status) === '1' &&
  ['PENDING', 'PARTIAL_EXECUTED'].includes(String(head.executeStatus).toUpperCase())
const canExecuteInbound = computed(() => !loading.value && !loadError.value && !submitting.value && !withdrawing.value &&
  permission.hasPermission('mtl:goods:io') && isExecutableInboundHead(detail.value))
const inboundReadonlyReason = computed(() => {
  if (loading.value) return '正在更新申请状态'
  if (String(detail.value.status) === '2') return '等待审批，请审批人在待办中办理；通过后由库管执行入库'
  if (!permission.hasPermission('mtl:goods:io')) return '当前账号无出入库操作权限，仅可查看详情'
  if (String(detail.value.status) !== '1') return '申请尚未审批通过，暂不可入库'
  if (!isExecutableInboundHead(detail.value)) return '当前申请已完成或执行状态不可操作'
  return ''
})
const dispositionOptions = [{ label: '合格回库', value: 'RESTOCK' }, { label: '报废', value: 'SCRAP' }, { label: '遗失', value: 'LOST' }]
const isProjectReturn = computed(() =>
  String(detail.value.applyType || '').toUpperCase() === 'IN' &&
  String(detail.value.bizType || '').toUpperCase() === 'RETURN' &&
  String(detail.value.usageType || '').toUpperCase() === 'PROJECT')

const toQty = (value: unknown) => {
  const result = Number(value)
  return Number.isFinite(result) ? Math.max(result, 0) : 0
}

const roundQty = (value: number) => Number(value.toFixed(4))

const formatQty = (value: unknown) => {
  const result = toQty(value)
  return Number.isInteger(result) ? String(result) : String(roundQty(result))
}

const hasQty = (value: unknown) => value !== null && value !== undefined && value !== ''

const normalizeOutboundItem = (item: any, headStatus: unknown) => {
  const itemId = item.id || item.itemId
  const approvalPassed = String(item.status ?? headStatus ?? '') === '1'
  const requestedQty = toQty(item.applyQty ?? item.unitQty)
  const approvedQty = hasQty(item.approvedQty)
    ? toQty(item.approvedQty)
    : approvalPassed
      ? requestedQty
      : 0
  const executedQty = toQty(item.executedQty)
  const pendingQty = roundQty(Math.max(approvedQty - executedQty, 0))
  const stockKnown = hasQty(item.currentUnitStockQty)
  const stockQty = stockKnown ? toQty(item.currentUnitStockQty) : 0
  const maxExecuteQty = roundQty(Math.min(pendingQty, stockQty))
  const executable = Boolean(itemId) && approvalPassed && stockKnown && maxExecuteQty > 0

  return {
    ...item,
    id: itemId,
    name: item.materialName || item.name || '',
    brand: item.brand || '',
    spec: item.model || item.specification || item.spec || '',
    unitName: item.unitName || item.unit || item.baseUnitName || '',
    requestedQty,
    approvedQty,
    executedQty,
    pendingQty,
    stockKnown,
    stockQty,
    maxExecuteQty,
    approvalPassed,
    executable,
    stockInsufficient: stockKnown && stockQty < pendingQty,
    checked: executable,
    executeQty: maxExecuteQty,
    executeRemark: '',
  }
}

const executableItems = computed(() =>
  !outboundReadonlyReason.value ? (detail.value.items || []).filter((item: any) => item.executable) : [],
)
const selectedItems = computed(() => executableItems.value.filter((item: any) => item.checked))
const allSelected = computed(
  () =>
    executableItems.value.length > 0 && selectedItems.value.length === executableItems.value.length,
)
const someSelected = computed(() => selectedItems.value.length > 0)

const loadApprovalNames = async (applyId: string) => {
  const names = new Set<string>()
  let hasRecords = false
  for (let pageNo = 1; ; pageNo++) {
    const response: any = await stockApi.applyApprovals(applyId, pageNo)
    const result = response?.result ?? response
    if (!Array.isArray(result) && !Array.isArray(result?.records)) throw new Error('审批记录响应异常')
    const rows = unwrapRecords(response)
    hasRecords ||= rows.length > 0
    rows.forEach((row: any) => {
      const name = String(row.approvalUserName || '').trim()
      if (name) names.add(name)
    })
    if (!rows.length || (result?.total != null ? pageNo * 100 >= Number(result.total) : rows.length < 100)) break
  }
  return [...names].join('、') || (hasRecords ? '审批人未提供' : '暂无审批记录')
}

const load = async () => {
  if (loading.value) return
  if (!id.value) {
    loadError.value = '缺少申请单信息'
    return
  }

  loading.value = true
  materialPage.value = 1
  loadError.value = ''
  try {
    await ensureCurrentAuthorization(userStore.userInfo)
    const [headRes, itemRes, approvalNames]: any = await Promise.all([
      stockApi.applyDetail(id.value),
      stockApi.applyItems(id.value),
      loadApprovalNames(id.value).catch(() => '审批记录加载失败，请重新进入详情重试'),
    ])
    const head = headRes?.result || headRes || {}
    if (!head.id || String(head.id) !== id.value) throw new Error('申请单不存在或返回不匹配')
    if (fromStockTodo.value && String(head.applyType).toUpperCase() !== 'OUT') {
      throw new Error('待办关联的不是出库申请')
    }
    const applyType = String(head.applyType || '').toUpperCase()
    const executed = String(head.executeStatus || '').toUpperCase()
    const items = unwrapRecords(itemRes).map((item: any) => {
      if (applyType === 'OUT') return normalizeOutboundItem(item, head.status)
      const approvalPassed = String(item.status ?? head.status) === '1'
      const approvedQty = approvalPassed ? toQty(item.approvedQty ?? item.applyQty ?? item.unitQty) : 0
      const executedQty = toQty(item.executedQty)
      const pendingQty = roundQty(Math.max(approvedQty - executedQty, 0))
      return {
        ...item,
        id: item.id || item.itemId,
        name: item.materialName || '',
        brand: item.brand || '',
        spec: item.model || item.specification || item.spec || '',
        unitName: item.unitName || item.unit || '',
        applyQty: toQty(item.applyQty ?? item.unitQty),
        returnQty: executedQty,
        approvedQty,
        pendingQty,
        executeQty: pendingQty,
        executeRemark: '',
        dispositionType: 'RESTOCK',
        dispositionRemark: '',
      }
    })

    detail.value = {
      ...head,
      type: applyType === 'IN' ? 'in' : 'out',
      typeText: applyType === 'IN' ? '还料申请' : '领料申请',
      approvalNames,
      projectLabel: formatStockProjectName(head),
      useTime: head.useDate || head.useTime || '',
      applyTime: head.createTime || head.applyTime || '',
      // 保留 head.status 的审批状态，执行状态展示不能覆盖出库资格校验字段。
      executionDisplayStatus: ['EXECUTED', 'COMPLETED', 'DONE', '已出库', '已入库'].includes(executed)
        ? 'done'
        : 'pending',
      items,
    }
    if (applyType === 'IN') {
      void loadInboundRecords(true)
    }
  } catch (error) {
    loadError.value = '申请详情加载失败'
  } finally {
    loading.value = false
  }
}

const toggleSelectAll = () => {
  if (!canExecuteOutbound.value) return
  const checked = !allSelected.value
  executableItems.value.forEach((item: any) => {
    item.checked = checked
    if (checked && toQty(item.executeQty) <= 0) item.executeQty = item.maxExecuteQty
  })
}

const toggleItem = (item: any) => {
  if (!canExecuteOutbound.value || !item.executable) return
  item.checked = !item.checked
  if (item.checked && toQty(item.executeQty) <= 0) item.executeQty = item.maxExecuteQty
}

const normalizeExecuteQty = (item: any) => {
  const value = Number(item.executeQty)
  if (!Number.isFinite(value) || value <= 0) {
    item.executeQty = item.maxExecuteQty
    toast.warning('出库数量必须大于 0')
    return
  }
  if (value > item.maxExecuteQty) {
    item.executeQty = item.maxExecuteQty
    toast.warning('本次最多可出库 ' + formatQty(item.maxExecuteQty) + ' ' + item.unitName)
    return
  }
  item.executeQty = roundQty(value)
}

const increaseQty = (item: any) => {
  const value = toQty(item.executeQty)
  item.executeQty = roundQty(Math.min(value + 1, item.maxExecuteQty))
}

const decreaseQty = (item: any) => {
  const minQty = Math.min(0.01, item.maxExecuteQty)
  const value = toQty(item.executeQty)
  item.executeQty = roundQty(Math.max(value - 1, minQty))
}

const fillAll = (item: any) => {
  item.executeQty = item.maxExecuteQty
}

const itemState = (item: any) => {
  if (!item.approvalPassed) return { type: 'muted', text: '未审批' }
  if (item.pendingQty <= 0) return { type: 'success', text: '已完成' }
  if (!item.stockKnown) return { type: 'warning', text: '库存未知' }
  if (item.stockQty <= 0) return { type: 'danger', text: '暂无库存' }
  if (item.stockInsufficient) return { type: 'warning', text: '库存不足' }
  return { type: 'primary', text: '待出库' }
}

const executeHint = (item: any) => {
  if (!item.stockKnown) return '未获取到实时库存，暂不可执行出库'
  if (item.stockQty <= 0) return '当前无可用库存，暂不可执行出库'
  if (item.stockInsufficient) {
    return '库存不足，本次最多可出库 ' + formatQty(item.maxExecuteQty) + ' ' + item.unitName
  }
  return '本次最多可出库 ' + formatQty(item.maxExecuteQty) + ' ' + item.unitName
}

const materialCheckLabel = (item: any) =>
  (item.checked ? '取消选择' : '选择') + (item.name || '当前物料')

const quantityButtonLabel = (item: any, action: string) =>
  action + (item.name || '当前物料') + '的本次出库数量'

const materialSpec = (item: any) =>
  [item.brand, item.spec].filter(Boolean).join(' · ') || '暂无品牌规格'

const executeOutbound = () => {
  if (!canExecuteOutbound.value) return
  if (!selectedItems.value.length) {
    toast.warning('请至少选择一种物料')
    return
  }

  const invalidItem = selectedItems.value.find((item: any) => {
    const value = Number(item.executeQty)
    return !Number.isFinite(value) || value <= 0 || value > item.maxExecuteQty
  })
  if (invalidItem) {
    toast.warning('请检查“' + invalidItem.name + '”的本次出库数量')
    return
  }

  const itemCount = selectedItems.value.length
  const items = selectedItems.value.map((item: any) => ({
    itemId: item.id,
    executeQty: roundQty(Number(item.executeQty)),
    ...(String(item.executeRemark || '').trim() ? { remark: String(item.executeRemark).trim() } : {}),
  }))
  message
    .confirm({
      title: '确认执行出库',
      msg: '已选择 ' + itemCount + ' 种物料，确认后将按填写数量扣减实时库存。',
    })
    .then(async () => {
      if (!canExecuteOutbound.value) return
      submitting.value = true
      try {
        const response: any = await stockApi.applyDetail(id.value)
        const latest = response?.result || response || {}
        if (!permission.hasPermission('mtl:goods:io') || !isExecutableOutboundHead(latest)) {
          toast.warning('申请状态已变化或无执行权限，请查看最新详情')
          await load()
          return
        }
        await stockApi.execute({
          applyId: id.value,
          itemIds: items.map((item) => item.itemId),
          items,
        })
        toast.success('已出库 ' + itemCount + ' 种物料')
        await load()
      } finally {
        submitting.value = false
      }
    })
    .catch(() => {})
}

const executeInbound = () => {
  if (!canExecuteInbound.value) return
  const candidates = detail.value.items.filter((item: any) => item.pendingQty > 0)
  const invalid = candidates.find((item: any) => !Number.isFinite(Number(item.executeQty)) || Number(item.executeQty) < 0 || Number(item.executeQty) > item.pendingQty)
  if (invalid) { toast.warning(`${invalid.name}本次入库数量须在 0 至 ${formatQty(invalid.pendingQty)} 之间`); return }
  const selected = candidates.filter((item: any) => Number(item.executeQty) > 0)
  if (!selected.length) { toast.warning('请填写至少一种物料的本次入库数量'); return }
  if (isProjectReturn.value && selected.some((item: any) => !dispositionOptions.some(option => option.value === item.dispositionType) || (item.dispositionType !== 'RESTOCK' && !item.dispositionRemark.trim()))) {
    toast.warning('报废或遗失必须填写原因'); return
  }
  const items = selected.map((item: any) => ({
    itemId: item.id,
    executeQty: Number(item.executeQty),
    ...(item.executeRemark.trim() ? { remark: item.executeRemark.trim() } : {}),
    ...(isProjectReturn.value ? { dispositionType: item.dispositionType,
      ...(item.dispositionType !== 'RESTOCK' ? { dispositionRemark: item.dispositionRemark.trim() } : {}) } : {}),
  }))
  message
    .confirm(`确认处理本次 ${items.length} 种物料吗？`)
    .then(async () => {
      if (!canExecuteInbound.value) return
      submitting.value = true
      try {
        await ensureCurrentAuthorization(userStore.userInfo, true)
        const response: any = await stockApi.applyDetail(id.value)
        const latest = response?.result || response || {}
        if (response?.success === false || String(latest.id) !== id.value || !permission.hasPermission('mtl:goods:io') || !isExecutableInboundHead(latest)) {
          toast.warning('申请状态已变化或无执行权限，请查看最新详情')
          await load()
          return
        }
        const itemResponse: any = await stockApi.applyItems(id.value)
        if (itemResponse?.success === false) throw new Error('最新物料明细加载失败')
        const latestItems = unwrapRecords(itemResponse)
        for (const item of items) {
          const current = latestItems.find((row: any) => String(row.id || row.itemId) === String(item.itemId))
          if (!current || String(current.status ?? latest.status) !== '1' || item.executeQty > roundQty(Math.max(toQty(current.approvedQty ?? current.applyQty ?? current.unitQty) - toQty(current.executedQty), 0))) {
            throw new Error('物料可入库数量已变化，请重新加载后操作')
          }
        }
        const result: any = await stockApi.execute({ applyId: id.value, items })
        if (result?.success === false) throw new Error(result.message || '执行入库失败')
        toast.success('操作成功')
        await load()
      } catch (error: any) {
        toast.error(error?.message || '执行入库失败，请重试')
      } finally {
        submitting.value = false
      }
    })
    .catch(() => {})
}

onLoad((query) => {
  id.value = query?.id || ''
  fromStockTodo.value = query?.from === 'stockOutTodo'
  load()
})
</script>

<style lang="scss" scoped>
.cancel-apply-button { margin:0; padding:0 6px; min-height:44px; background:transparent; color:#b42318; font-size:13px; line-height:44px; }
.cancel-apply-button::after { border:0; }
.cancel-apply-button[disabled] { color:#909399; }

.material-pagination {
  margin: 0 12px 16px;
  color: #555;
  font-size: 13px;
}
.material-pagination__controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}
.material-pagination__controls button {
  margin: 0;
  padding: 0 12px;
  min-height: 44px;
  line-height: 44px;
  font-size: 14px;
  color: #176ac7;
  background: #fff;
}
.material-pagination__controls button[disabled] { color: #767676; background: #f4f6f8; }
.material-pagination__hint { display: block; margin-top: 8px; line-height: 1.5; }
.page {
  min-height: 0;
  padding-bottom: 12px;
}

.state-page {
  min-height: 50vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #667085;
  font-size: 14px;

  &--error {
    color: #d14343;
  }
}

.retry-button {
  min-height: 44px;
  margin: 0;
  padding: 0 20px;
  border-radius: 22px;
  background: #2f86ff;
  color: #fff;
  font-size: 14px;
  line-height: 44px;

  &::after {
    border: 0;
  }
}

.application-info {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px 16px;
  padding-top: 8px;
}
.row {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 6px;

  &--full { grid-column: 1 / -1; }
  &--project { padding-bottom: 16px; border-bottom: 1px solid #edf0f3; }
  &--project .val { font-weight: 600; }
  &--remark { padding-top: 16px; border-top: 1px solid #edf0f3; }
  &--remark .val { white-space: pre-wrap; }

  .label {
    flex: none;
    color: #667085;
    font-size: 13px;
  }

  .val {
    flex: 1;
    min-width: 0;
    color: #27364a;
    font-size: 16px;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }
}

.inline-error,
.empty-state {
  padding: 28px 12px;
  text-align: center;
  color: #667085;
  font-size: 13px;
}

.inline-error {
  color: #d14343;
}

.batch-toolbar {
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 8px;
}

.select-all-button,
.item-check-button,
.quantity-button,
.fill-button,
.submit-button {
  margin: 0;

  &::after {
    border: 0;
  }
}

.select-all-button {
  min-height: 44px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0;
  background: transparent;
  color: #344054;
  font-size: 14px;
  line-height: 1;

  &--disabled {
    color: #98a2b3;
  }
}

.selected-count {
  color: #667085;
  font-size: 12px;
}

.check-box {
  width: 20px;
  height: 20px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #c5cbd4;
  border-radius: 5px;
  background: #fff;

  &--checked,
  &--partial {
    border-color: #2f86ff;
    background: #2f86ff;
  }

  &--partial::after {
    content: '';
    width: 10px;
    height: 2px;
    border-radius: 1px;
    background: #fff;
  }

  &--disabled {
    border-color: #e4e7ec;
    background: #f2f4f7;
  }
}

.material-item {
  padding: 16px 0;
  border-top: 1px solid #edf0f3;

  &--selected .material-name {
    color: #1d2939;
  }

  &__top {
    display: flex;
    align-items: flex-start;
    gap: 4px;
  }
}

.item-check-button {
  width: 44px;
  height: 44px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  background: transparent;
  line-height: 1;
}

.material-main {
  flex: 1;
  min-width: 0;
  padding-top: 3px;
}

.material-title-line {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.material-name {
  flex: 1;
  min-width: 0;
  color: #344054;
  font-size: 15px;
  font-weight: 600;
  line-height: 22px;
  word-break: break-all;
}

.material-spec {
  display: block;
  margin-top: 3px;
  color: #667085;
  font-size: 12px;
  line-height: 18px;
}

.material-state {
  flex: none;
  padding: 3px 8px;
  border-radius: 10px;
  font-size: 11px;
  line-height: 16px;

  &--primary {
    background: #eaf3ff;
    color: #1769c2;
  }

  &--success {
    background: #eaf7ef;
    color: #21844a;
  }

  &--warning {
    background: #fff5df;
    color: #a15c00;
  }

  &--danger {
    background: #fff0f0;
    color: #c03636;
  }

  &--muted {
    background: #f2f4f7;
    color: #667085;
  }
}

.quantity-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1px;
  margin: 12px 0 0;
  overflow: hidden;
  border: 1px solid #edf0f3;
  border-radius: 10px;
  background: #edf0f3;
}

.quantity-grid--inbound { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.material-code { max-width: 45%; font-size: 12px; color: #667085; overflow-wrap: anywhere; text-align: right; }
.record-quantity { flex-shrink: 0; font-size: 14px; color: #1d2939; font-weight: 600; }
.record-more { margin-top: 12px; color: #2563eb; background: transparent; font-size: 14px; }

.quantity-cell {
  min-width: 0;
  padding: 10px 6px;
  text-align: center;
  overflow-wrap: anywhere;
  background: #f8fafc;
}

.quantity-label {
  display: block;
  color: #667085;
  font-size: 12px;
  line-height: 16px;
}

.quantity-value {
  display: inline-block;
  margin-top: 3px;
  color: #1d2939;
  font-size: 17px;
  font-weight: 600;
  line-height: 24px;

  &--key {
    color: #1769c2;
  }
}

.quantity-unit {
  margin-left: 4px;
  color: #667085;
  font-size: 11px;
}

.inbound-quantity {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
  max-width: 100%;
  box-sizing: border-box;
}
.inbound-quantity__input {
  width: 80px;
  min-width: 0;
  height: 44px;
  color: #1d2939;
  font-size: 16px;
  font-weight: 600;
  text-align: right;
}
.inbound-quantity__unit { color: #667085; font-size: 13px; overflow-wrap: anywhere; }
.inbound-quantity--disabled { background: #f2f4f7; }
.disposition-field { margin-top: 16px; }
.disposition-options { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
.disposition-option {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1 1 72px;
  gap: 5px;
  min-height: 48px;
  margin: 0;
  padding: 8px 4px;
  box-sizing: border-box;
  border: 1px solid #dce2eb;
  border-radius: 8px;
  background: #fff;
  color: #475467;
  font-size: 13px;
  line-height: 20px;
}
.disposition-option::after { border: 0; }
.disposition-option--selected { border-color: #176ac7; background: #edf5ff; color: #176ac7; font-weight: 600; }
.disposition-option__mark { width: 14px; height: 14px; border: 1px solid #b8c3d1; border-radius: 50%; font-size: 11px; line-height: 14px; }
.disposition-option--selected .disposition-option__mark { background: #176ac7; border-color: #176ac7; color: #fff; }
.disposition-option--pressed { background: #e8f0fb; }
.disposition-option[disabled] { opacity: 0.6; }

.execute-panel {
  margin: 12px 0 0;
  padding: 12px;
  border-radius: 10px;
  background: #f7f9fc;
}

.execute-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.execute-label {
  color: #344054;
  font-size: 13px;
  font-weight: 600;
}

.quantity-control {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  min-width: 0;
}

.execute-remark { margin-top: 12px; padding-top: 12px; border-top: 1px solid #e4e7ec; }
.execute-remark__input { width: 100%; min-height: 44px; box-sizing: border-box; margin-top: 8px; padding: 8px 10px; border: 1px solid #d7dce3; border-radius: 8px; background: #fff; color: #27364a; font-size: 16px; }
.execute-remark__input[disabled] { background: #f2f4f7; color: #667085; }

.quantity-button,
.fill-button {
  height: 44px;
  min-width: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 10px;
  border: 1px solid #d7dce3;
  border-radius: 8px;
  background: #fff;
  color: #344054;
  font-size: 13px;
  line-height: 1;

  &[disabled] {
    background: #f2f4f7;
    color: #98a2b3;
  }
}

.quantity-input {
  width: 72px;
  height: 44px;
  box-sizing: border-box;
  padding: 0 8px;
  border: 1px solid #b8c0cc;
  border-radius: 8px;
  background: #fff;
  color: #1d2939;
  font-size: 15px;
  font-weight: 600;
  text-align: center;

  &[disabled] {
    background: #f2f4f7;
    color: #98a2b3;
  }
}

.fill-button {
  min-width: 52px;
  border-color: #9ac4f8;
  color: #1769c2;
}

.execute-hint {
  display: block;
  margin-top: 8px;
  color: #667085;
  font-size: 11px;
  line-height: 17px;

  &--warn {
    color: #a15c00;
  }
}

.stat-head,
.stat-row {
  display: flex;
  align-items: center;

  text {
    flex: 1;
    text-align: center;
    font-size: 12px;
  }
}

.stat-head {
  padding-bottom: 8px;
  color: #667085;

  text:first-child {
    flex: 2;
  }
}

.stat-row {
  padding: 10px 0;
  border-top: 1px solid #f0f1f3;

  .stat-name {
    flex: 2;
    color: #333;
    font-size: 13px;

    .stat-spec {
      margin-top: 2px;
      color: #667085;
      font-size: 11px;
    }
  }

  .stat-num {
    color: #333;
    font-size: 13px;

    &--key {
      color: #c03636;
      font-weight: 700;
    }
  }
}

.bottom {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px calc(10px + env(safe-area-inset-bottom));
  border-top: 1px solid #e8ebef;
  background: #fff;
}

.bottom-summary {
  flex: 1;
  min-width: 0;

  &__value,
  &__hint {
    display: block;
  }

  &__value {
    color: #1d2939;
    font-size: 14px;
    font-weight: 600;
  }

  &__hint {
    margin-top: 2px;
    color: #667085;
    font-size: 11px;
  }
}

.submit-button {
  min-width: 174px;
  min-height: 46px;
  margin: 0;
  padding: 0 20px;
  border-radius: 23px;
  background: #2f86ff;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  line-height: 46px;

  &[disabled] {
    background: #b9d6fb;
    color: #fff;
  }

  &--full {
    flex: 1;
  }
}

@media (max-width: 360px) {
  .quantity-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .quantity-grid,
  .execute-panel {
    margin-left: 0;
  }

  .bottom-summary {
    display: none;
  }

  .submit-button {
    flex: 1;
  }
}
</style>
