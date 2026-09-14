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
          <view class="row">
            <text class="label">申请单号</text>
            <text class="val">{{ detail.applyNo }}</text>
          </view>
          <view class="row">
            <text class="label">申请类型</text>
            <text class="val">{{ detail.typeText }}</text>
          </view>
          <view v-if="detail.type === 'out'" class="row">
            <text class="label">领料类型</text>
            <text class="val">{{ getMaterialUsageTypeText(detail.usageType) }}</text>
          </view>
          <view v-if="detail.orderNo" class="row">
            <text class="label">关联单号</text>
            <text class="val">{{ detail.orderNo }}</text>
          </view>
          <view class="row">
            <text class="label">项目名称</text>
            <text class="val">{{ detail.projectLabel }}</text>
          </view>
          <view class="row">
            <text class="label">使用时间</text>
            <text class="val">{{ detail.useTime || '—' }}</text>
          </view>
          <view class="row">
            <text class="label">申请时间</text>
            <text class="val">{{ detail.applyTime || '—' }}</text>
          </view>
          <view class="row">
            <text class="label">备注</text>
            <text class="val">{{ detail.remark || '—' }}</text>
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
              v-for="material in detail.items"
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
                  <text class="quantity-value">{{ formatQty(material.approvedQty) }}</text>
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
              </view>
            </view>
          </template>
        </SectionCard>

        <SectionCard v-else title="物料明细">
          <view class="stat-head">
            <text>物料</text>
            <text>申请</text>
            <text>出库</text>
            <text>使用</text>
            <text>应还</text>
            <text>还料</text>
          </view>
          <view v-for="material in detail.items" :key="material.id" class="stat-row">
            <view class="stat-name">
              <view>{{ material.name }}</view>
              <view class="stat-spec">{{ material.spec }}</view>
            </view>
            <text class="stat-num">{{ material.applyQty }}</text>
            <text class="stat-num">{{ material.outQty }}</text>
            <text class="stat-num">{{ material.usedQty }}</text>
            <text class="stat-num">{{ material.returnableQty }}</text>
            <text class="stat-num stat-num--key">{{ material.returnQty }}</text>
          </view>
        </SectionCard>
      </scroll-view>

      <view v-if="detail.type === 'out' && executableItems.length" class="bottom">
        <view class="bottom-summary">
          <text class="bottom-summary__value">已选 {{ selectedItems.length }} 项</text>
          <text class="bottom-summary__hint">数量可逐项调整</text>
        </view>
        <button
          class="submit-button"
          :disabled="!selectedItems.length || submitting"
          @click="executeOutbound"
        >
          {{ submitting ? '正在出库…' : '执行出库（' + selectedItems.length + '）' }}
        </button>
      </view>

      <view v-else-if="!fromStockTodo && canExecuteInbound" class="bottom">
        <button
          class="submit-button submit-button--full"
          :disabled="submitting"
          @click="executeInbound"
        >
          {{ submitting ? '正在入库…' : '确认入库' }}
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

const toast = useToast()
const message = useMessage()
const detail = ref<any>({})
const id = ref('')
const loading = ref(false)
const loadError = ref('')
const submitting = ref(false)
const fromStockTodo = ref(false)
const permission = usePermissionStore()
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
const canExecuteOutbound = computed(() => !outboundReadonlyReason.value && !submitting.value)
const isExecutableInboundHead = (head: any) =>
  String(head.applyType).toUpperCase() === 'IN' && String(head.status) === '1' &&
  ['PENDING', 'PARTIAL_EXECUTED'].includes(String(head.executeStatus).toUpperCase())
const canExecuteInbound = computed(() => !loading.value && !loadError.value && !submitting.value &&
  permission.hasPermission('mtl:goods:io') && isExecutableInboundHead(detail.value))

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

const load = async () => {
  if (loading.value) return
  if (!id.value) {
    loadError.value = '缺少申请单信息'
    return
  }

  loading.value = true
  loadError.value = ''
  try {
    const [headRes, itemRes]: any = await Promise.all([
      stockApi.applyDetail(id.value),
      stockApi.applyItems(id.value),
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
      return {
        ...item,
        id: item.id || item.itemId,
        name: item.materialName || '',
        spec: item.model || '',
        applyQty: toQty(item.applyQty ?? item.unitQty),
        outQty: 0,
        usedQty: toQty(item.usedQty),
        returnableQty: toQty(item.returnableQty),
        returnQty: toQty(item.executedQty ?? item.returnQty),
      }
    })

    detail.value = {
      ...head,
      type: applyType === 'IN' ? 'in' : 'out',
      typeText: applyType === 'IN' ? '还料申请' : '领料申请',
      orderNo: head.projectNo || head.orderNo || '',
      projectLabel: formatStockProjectName(head),
      useTime: head.useDate || head.useTime || '',
      applyTime: head.createTime || head.applyTime || '',
      // 保留 head.status 的审批状态，执行状态展示不能覆盖出库资格校验字段。
      executionDisplayStatus: ['EXECUTED', 'COMPLETED', 'DONE', '已出库', '已入库'].includes(executed)
        ? 'done'
        : 'pending',
      items,
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
  message
    .confirm('确认执行入库吗？')
    .then(async () => {
      if (!canExecuteInbound.value) return
      submitting.value = true
      try {
        const response: any = await stockApi.applyDetail(id.value)
        const latest = response?.result || response || {}
        if (String(latest.id) !== id.value || !permission.hasPermission('mtl:goods:io') || !isExecutableInboundHead(latest)) {
          toast.warning('申请状态已变化或无执行权限，请查看最新详情')
          await load()
          return
        }
        await stockApi.execute({ applyId: id.value })
        toast.success('操作成功')
        await load()
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

.row {
  display: flex;
  margin-top: 10px;

  .label {
    width: 84px;
    flex: none;
    color: #667085;
    font-size: 13px;
  }

  .val {
    flex: 1;
    min-width: 0;
    color: #333;
    font-size: 13px;
    word-break: break-all;
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
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  margin: 12px 0 0 44px;
  overflow: hidden;
  border: 1px solid #edf0f3;
  border-radius: 10px;
  background: #edf0f3;
}

.quantity-cell {
  min-width: 0;
  padding: 10px 12px;
  background: #f8fafc;
}

.quantity-label {
  display: block;
  color: #667085;
  font-size: 11px;
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

.execute-panel {
  margin: 12px 0 0 44px;
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
}

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
