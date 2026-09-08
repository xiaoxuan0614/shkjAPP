<template>
  <wd-popup
    v-model="visible"
    position="bottom"
    :close-on-click-modal="!submitting"
    :safe-area-inset-bottom="true"
    :root-portal="true"
    :z-index="2000"
    custom-style="border-radius:16px 16px 0 0;"
  >
    <view class="contract-popup">
      <view class="contract-popup__head">
        <text class="contract-popup__title">{{ popupTitle }}</text>
        <button
          class="contract-popup__close"
          aria-label="关闭合同审批"
          :disabled="submitting"
          @click="close"
        >
          <wd-icon name="close" size="18px" />
        </button>
      </view>
      <scroll-view class="contract-popup__body" scroll-y :scroll-into-view="scrollTarget">
        <view v-if="loading" class="contract-popup__state">正在加载合同…</view>
        <view v-else-if="loadFailed" class="contract-popup__state">
          <text>合同加载失败，请重试</text>
          <wd-button size="small" plain @click="load">重新加载</wd-button>
        </view>
        <template v-else-if="contract">
          <view class="contract-popup__project">{{ projectLabel || '项目合同' }}</view>
          <view class="contract-popup__row">
            <text>合同名称</text>
            <text>{{ contract.contractName || '—' }}</text>
          </view>
          <view class="contract-popup__row">
            <text>合同金额</text>
            <text class="contract-popup__amount">{{ amount(contract.contractAmount) }}</text>
          </view>
          <view class="contract-popup__row">
            <text>审批状态</text>
            <text>{{ statusText }}</text>
          </view>
          <template v-if="showDetails">
            <view v-for="row in detailRows" :key="row.label" class="contract-popup__row">
              <text>{{ row.label }}</text>
              <text>{{ row.value }}</text>
            </view>
            <view class="contract-popup__section">合同文件</view>
            <view v-for="file in files" :key="file.label" class="contract-popup__file">
              <text>{{ file.label }}</text>
              <view v-if="file.path" class="contract-popup__file-content">
                <text class="contract-popup__file-name">{{ file.name || '附件' }}</text>
                <button class="contract-popup__file-link" @click="filePreview?.open(file)">
                  <wd-icon name="view" size="16px" />
                  预览
                </button>
              </view>
              <text v-else class="contract-popup__muted">暂无附件</text>
            </view>
            <view class="contract-popup__section">回款计划</view>
            <view v-if="!paymentRecords.length" class="contract-popup__muted">暂无回款计划</view>
            <scroll-view v-else class="contract-popup__payment-scroll" scroll-x>
              <view class="contract-popup__payment-table" role="table" aria-label="回款计划">
                <view
                  class="contract-popup__payment-row contract-popup__payment-row--head"
                  role="row"
                >
                  <text class="contract-popup__payment-cell" role="columnheader">回款项</text>
                  <text class="contract-popup__payment-cell contract-popup__payment-cell--number" role="columnheader">
                    比例
                  </text>
                  <text class="contract-popup__payment-cell contract-popup__payment-cell--number" role="columnheader">
                    计划金额
                  </text>
                  <text class="contract-popup__payment-cell contract-popup__payment-cell--number" role="columnheader">
                    回款周期
                  </text>
                </view>
                <view
                  v-for="(record, index) in paymentRecords"
                  :key="record.id || index"
                  class="contract-popup__payment-row"
                  role="row"
                >
                  <view class="contract-popup__payment-cell contract-popup__payment-node" role="cell">
                    <text>
                      {{ dictText('payback_node', record.paymentNode) || `回款项 ${index + 1}` }}
                    </text>
                    <text v-if="record.remark" class="contract-popup__payment-remark">
                      {{ record.remark }}
                    </text>
                  </view>
                  <text class="contract-popup__payment-cell contract-popup__payment-cell--number" role="cell">
                    {{ record.ratio == null ? '—' : `${record.ratio}%` }}
                  </text>
                  <text class="contract-popup__payment-cell contract-popup__payment-cell--number" role="cell">
                    {{ amount(record.plannedAmount) }}
                  </text>
                  <text class="contract-popup__payment-cell contract-popup__payment-cell--number" role="cell">
                    {{ rollbackTimeText(record.rollbackTime) }}
                  </text>
                </view>
              </view>
            </scroll-view>
          </template>
          <button
            class="contract-popup__detail-link"
            :disabled="submitting"
            @click="showDetails = !showDetails"
          >
            {{ showDetails ? '返回审批' : '查看详情' }}
            <wd-icon :name="showDetails ? 'arrow-up' : 'arrow-down'" size="15px" />
          </button>
          <view v-if="approving" id="contract-project-manager" class="contract-popup__approval">
            <text class="contract-popup__section">项目经理（必选）</text>
            <button
              class="contract-popup__manager"
              :disabled="submitting"
              @click="openManagerPicker"
            >
              <view class="contract-popup__manager-text">
                <text :class="{ 'contract-popup__placeholder': !selectedManagerName }">
                  {{ selectedManagerName || '请选择项目经理' }}
                </text>
                <text class="contract-popup__manager-hint">
                  {{
                    managerConfirmed
                      ? '已确认，审批通过后项目将进入筹备中'
                      : '请在人员列表中确认后再提交'
                  }}
                </text>
              </view>
              <wd-icon name="arrow-right" size="18px" />
            </button>
          </view>
          <view v-if="rejecting" id="contract-rejection-reason" class="contract-popup__reason">
            <text class="contract-popup__section">驳回原因（必填）</text>
            <textarea
              v-model="rejectReason"
              :disabled="submitting"
              maxlength="500"
              placeholder="请填写驳回原因"
              placeholder-style="color:#68788a"
            />
          </view>
          <view v-if="!pending" class="contract-popup__notice">
            该合同当前不在待审批状态，请刷新待办。
          </view>
        </template>
      </scroll-view>
      <view v-if="contract && !loading && !loadFailed && pending" class="contract-popup__actions">
        <view>
          <wd-button
            block
            plain
            :disabled="submitting"
            :type="approvalMode ? 'default' : 'error'"
            @click="handleSecondaryAction"
          >
            {{ approvalMode ? '取消' : '驳回' }}
          </wd-button>
        </view>
        <view>
          <wd-button
            block
            :disabled="submitting"
            :loading="submitting"
            :type="rejecting ? 'error' : 'primary'"
            @click="handlePrimaryAction"
          >
            {{ rejecting ? '确认驳回' : approving ? '确认通过' : '通过' }}
          </wd-button>
        </view>
      </view>
    </view>
  </wd-popup>
  <ContractFilePreview ref="filePreview" />
  <ContractManagerPicker ref="managerPicker" @select="handleManagerSelected" />
</template>

<script lang="ts" setup>
import { computed, nextTick, ref } from 'vue'
import { useToast } from 'wot-design-uni'
import {
  contractApprovalApi,
  type ContractManagerOption,
  type ContractPaymentRecordPayload,
} from '@/service/contractApproval'
import { parseTodoActionParams, type TodoRecord } from '@/service/todo'
import ContractFilePreview from './ContractFilePreview.vue'
import ContractManagerPicker from './ContractManagerPicker.vue'
import { http } from '@/utils/http'

const emit = defineEmits<{ processed: [] }>()
const toast = useToast()
const filePreview = ref<InstanceType<typeof ContractFilePreview>>()
const managerPicker = ref<InstanceType<typeof ContractManagerPicker>>()
const visible = ref(false)
const loading = ref(false)
const loadFailed = ref(false)
const submitting = ref(false)
const approvalMode = ref<'' | 'approve' | 'reject'>('')
const rejectReason = ref('')
const selectedManagerId = ref('')
const selectedManagerName = ref('')
const managerConfirmed = ref(false)
const showDetails = ref(false)
const scrollTarget = ref('')
const periodId = ref('')
const projectLabel = ref('')
const contract = ref<Record<string, any> | null>(null)
const contractFile = ref<Record<string, any>>({})
const materialFile = ref<Record<string, any>>({})
const paymentRecords = ref<Record<string, any>[]>([])
const dictionaries = ref<Record<string, Record<string, string>>>({})
let loadSequence = 0

const approving = computed(() => approvalMode.value === 'approve')
const rejecting = computed(() => approvalMode.value === 'reject')
const popupTitle = computed(() => {
  if (showDetails.value) return '合同详情'
  if (approving.value) return '确认通过'
  if (rejecting.value) return '确认驳回'
  return '合同审批'
})
const pending = computed(() => String(contract.value?.status) === '2')
const statusText = computed(
  () =>
    ({
      '-1': '待提交',
      '0': '已驳回',
      '1': '已通过',
      '2': '待审批',
      '3': '已撤回',
    })[String(contract.value?.status ?? '-1')] || '未知状态',
)
const amount = (value: unknown) => {
  if (value == null || value === '' || !Number.isFinite(Number(value))) return '—'
  return `¥${Number(value).toFixed(2)}`
}
const rollbackTimeText = (value: unknown) => {
  const days = value == null || value === '' ? 7 : Number(value)
  return Number.isInteger(days) && days >= 0 ? `${days} 天` : '—'
}
const dictText = (code: string, value: unknown) => {
  if (value == null || value === '') return ''
  return dictionaries.value[code]?.[String(value)] || String(value)
}
const detailRows = computed(() => {
  const item = contract.value || {}
  return [
    { label: '合同编号', value: item.contractNo || '—' },
    { label: '合同类型', value: dictText('contract_type', item.contractType) || '—' },
    { label: '签订日期', value: item.contractSignedDate || '—' },
    { label: '计划交付日期', value: item.plannedDeliveryDate || '—' },
    { label: '质保期', value: item.warrantyPeriod == null ? '—' : `${item.warrantyPeriod} 个月` },
    {
      label: '销售负责人',
      value:
        item.salesUserName ||
        item.salesUserId_dictText ||
        (item.salesUserId ? '未返回姓名' : '未设置'),
    },
    { label: '备注', value: item.remark || '—' },
  ]
})
const files = computed(() => [
  {
    label: '合同附件',
    path:
      contractFile.value.fileId || contractFile.value.url || contract.value?.contractFileId || '',
    name: contractFile.value.fileName || contract.value?.contractFileName || '',
  },
  {
    label: '合同货物清单',
    path:
      materialFile.value.fileId || materialFile.value.url || contract.value?.materialFileId || '',
    name: materialFile.value.fileName || contract.value?.materialFileName || '',
  },
])

const load = async () => {
  if (!periodId.value || loading.value) return
  const sequence = ++loadSequence
  loading.value = true
  loadFailed.value = false
  try {
    const response: any = await contractApprovalApi.detail(periodId.value)
    if (sequence !== loadSequence) return
    const result = response?.result ?? response?.data ?? {}
    const value = result.contract || result
    if (!value.id && !value.contractName) throw new Error('未找到合同')
    contract.value = value
    contractFile.value = result.contractFile || value.contractFile || {}
    materialFile.value = result.materialFile || value.materialFile || {}
    paymentRecords.value = Array.isArray(result.records) ? result.records : []
    selectedManagerId.value = String(value.projectManagerUserId || '').trim()
    selectedManagerName.value = String(
      value.projectManagerUserName || value.projectManagerUserId_dictText || '',
    ).trim()
    managerConfirmed.value = false
    if (!pending.value) emit('processed')
  } catch {
    if (sequence === loadSequence) loadFailed.value = true
  } finally {
    if (sequence === loadSequence) loading.value = false
  }
}
const loadDictionaries = async () => {
  await Promise.allSettled(
    ['contract_type', 'payback_node'].map(async (code) => {
      if (dictionaries.value[code]) return
      const response: any = await http.get(`/sys/dict/getDictItems/${code}`)
      const rows = Array.isArray(response?.result) ? response.result : []
      dictionaries.value[code] = Object.fromEntries(
        rows.map((row: any) => [String(row.value), row.text || row.label || String(row.value)]),
      )
    }),
  )
}
const open = (item: TodoRecord) => {
  if (submitting.value) return
  managerPicker.value?.close()
  const params = parseTodoActionParams(item.actionParams)
  const id = String(item.bizSubId || params.periodId || '').trim()
  if (!id) return toast.warning('当前待办缺少项目分期信息')
  loadSequence++
  loading.value = false
  periodId.value = id
  projectLabel.value =
    [item.projectName, item.periodName].filter(Boolean).join('-') || item.summary || ''
  contract.value = null
  contractFile.value = {}
  materialFile.value = {}
  paymentRecords.value = []
  approvalMode.value = ''
  rejectReason.value = ''
  selectedManagerId.value = ''
  selectedManagerName.value = ''
  managerConfirmed.value = false
  showDetails.value = false
  scrollTarget.value = ''
  visible.value = true
  load()
  loadDictionaries()
}
const close = () => {
  if (submitting.value) return
  managerPicker.value?.close()
  visible.value = false
  loadSequence++
  loading.value = false
}
const enterReject = async () => {
  if (submitting.value) return
  approvalMode.value = 'reject'
  scrollTarget.value = ''
  showDetails.value = false
  await nextTick()
  scrollTarget.value = 'contract-rejection-reason'
}
const openManagerPicker = () => {
  managerPicker.value?.open({ id: selectedManagerId.value, name: selectedManagerName.value })
}
const enterApprove = async () => {
  if (submitting.value) return
  approvalMode.value = 'approve'
  scrollTarget.value = ''
  showDetails.value = false
  await nextTick()
  scrollTarget.value = 'contract-project-manager'
  openManagerPicker()
}
const cancelDecision = () => {
  if (submitting.value) return
  approvalMode.value = ''
  scrollTarget.value = ''
}
const handleSecondaryAction = () => {
  if (approvalMode.value) cancelDecision()
  else enterReject()
}
const handleManagerSelected = (manager: ContractManagerOption) => {
  selectedManagerId.value = manager.id
  selectedManagerName.value = manager.name
  managerConfirmed.value = true
}
const paymentOptionalFields = [
  'actualAmount',
  'remark',
  'plannedDate',
  'paymentDate',
  'invoiceStatus',
  'payStatus',
  'payMethod',
  'rollbackTime',
]
const buildPaymentRecords = (): ContractPaymentRecordPayload[] =>
  paymentRecords.value.map((source) => {
    const record: Record<string, any> = {
      ...(source.id ? { id: String(source.id) } : {}),
      paymentNode: String(source.paymentNode ?? source.node ?? ''),
      ratio: Number(source.ratio),
      plannedAmount: Number(source.plannedAmount ?? source.amount),
    }
    paymentOptionalFields.forEach((field) => {
      if (source[field] !== undefined) record[field] = source[field]
    })
    return record as ContractPaymentRecordPayload
  })
const submitReject = async () => {
  if (submitting.value || loading.value || loadFailed.value || !pending.value) return
  const reason = rejectReason.value.trim()
  if (!reason) return toast.warning('请填写驳回原因')
  submitting.value = true
  try {
    await contractApprovalApi.decide(periodId.value, '0', reason)
    visible.value = false
    toast.success('合同已驳回')
    emit('processed')
  } catch {
    // 保留详情与驳回原因，接口统一展示失败原因。
  } finally {
    submitting.value = false
  }
}
const submitApprove = async () => {
  if (submitting.value || loading.value || loadFailed.value || !pending.value) return
  if (!managerConfirmed.value || !selectedManagerId.value || !selectedManagerName.value) {
    toast.warning('请确认项目经理')
    openManagerPicker()
    return
  }
  if (!contract.value?.plannedDeliveryDate) {
    toast.warning('合同缺少计划交付日期，请驳回并补充后重新提交')
    return
  }
  submitting.value = true
  let completedStep: '' | 'manager' | 'contract' = ''
  try {
    await contractApprovalApi.saveManager(
      periodId.value,
      {
        id: selectedManagerId.value,
        name: selectedManagerName.value,
      },
      buildPaymentRecords(),
    )
    completedStep = 'manager'
    await contractApprovalApi.decide(periodId.value, '1')
    completedStep = 'contract'
    await contractApprovalApi.startPreparing(periodId.value)
    visible.value = false
    toast.success('合同审批通过，项目已进入筹备中')
    emit('processed')
  } catch {
    if (completedStep === 'manager') {
      toast.warning('项目经理已保存，合同通过失败，请重试')
    } else if (completedStep === 'contract') {
      visible.value = false
      toast.warning('合同已通过，但项目状态更新失败，请联系管理员')
      emit('processed')
    }
  } finally {
    submitting.value = false
  }
}
const handlePrimaryAction = () => {
  if (approving.value) return submitApprove()
  if (rejecting.value) return submitReject()
  return enterApprove()
}
defineExpose({ open })
</script>

<style lang="scss" scoped>
.contract-popup {
  display: flex;
  box-sizing: border-box;
  width: 100%;
  max-width: 560px;
  height: 78vh;
  max-height: calc(100vh - 48px - env(safe-area-inset-bottom));
  max-height: calc(100dvh - 48px - env(safe-area-inset-bottom));
  margin: 0 auto;
  background: #fff;
  flex-direction: column;
}
.contract-popup__head {
  display: flex;
  padding: 12px 16px;
  align-items: center;
  justify-content: space-between;
  flex: none;
  border-bottom: 1px solid #edf0f3;
}
.contract-popup__title {
  color: #27364a;
  font-size: 18px;
  font-weight: 650;
}
.contract-popup__close {
  display: flex;
  width: 44px;
  height: 44px;
  padding: 0;
  margin: 0;
  color: #596574;
  background: transparent;
  align-items: center;
  justify-content: center;
}
button::after {
  border: none;
}
.contract-popup__body {
  min-height: 0;
  height: 0;
  flex: 1;
}
.contract-popup__project {
  padding: 18px 16px 8px;
  color: #27364a;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.contract-popup__row {
  display: flex;
  gap: 16px;
  padding: 12px 16px;
  font-size: 14px;
  line-height: 1.6;
  border-bottom: 1px solid #f0f2f5;
}
.contract-popup__row > text:first-child {
  flex: none;
  width: 90px;
  color: #68788a;
}
.contract-popup__row > text:last-child {
  min-width: 0;
  flex: 1;
  color: #27364a;
  text-align: right;
  overflow-wrap: anywhere;
}
.contract-popup__amount {
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}
.contract-popup__section {
  display: block;
  padding: 20px 16px 8px;
  font-size: 15px;
  font-weight: 600;
  color: #27364a;
}
.contract-popup__file {
  display: flex;
  gap: 12px;
  padding: 8px 16px;
  font-size: 14px;
  align-items: center;
}
.contract-popup__file > text:first-child {
  flex: none;
  width: 90px;
  color: #68788a;
}
.contract-popup__file-link {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  min-width: 0;
  min-height: 44px;
  padding: 8px 0;
  margin: 0;
  color: #176ac7;
  background: transparent;
  font-size: 14px;
  line-height: 1.5;
  text-align: right;
  overflow-wrap: anywhere;
}
.contract-popup__file-content {
  min-width: 0;
  flex: 1;
}
.contract-popup__file-name {
  display: block;
  color: #27364a;
  line-height: 1.5;
  text-align: right;
  overflow-wrap: anywhere;
}
.contract-popup__muted {
  padding: 4px 16px;
  color: #68788a;
  font-size: 13px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.contract-popup__file .contract-popup__muted {
  padding: 0;
  flex: 1;
  text-align: right;
}
.contract-popup__payment-scroll {
  box-sizing: border-box;
  width: calc(100% - 32px);
  margin: 0 16px;
  border: 1px solid #e1e6ec;
  border-radius: 8px;
  overflow: hidden;
}
.contract-popup__payment-table {
  min-width: 400px;
  background: #fff;
}
.contract-popup__payment-row {
  display: grid;
  min-height: 52px;
  grid-template-columns: minmax(112px, 1fr) 58px 112px 78px;
  border-bottom: 1px solid #edf0f3;
}
.contract-popup__payment-row:last-child {
  border-bottom: none;
}
.contract-popup__payment-row--head {
  min-height: 42px;
  color: #596574;
  background: #f6f8fa;
  font-size: 12px;
  font-weight: 600;
}
.contract-popup__payment-cell {
  display: flex;
  min-width: 0;
  padding: 10px 8px;
  color: #27364a;
  font-size: 13px;
  line-height: 1.45;
  align-items: center;
  overflow-wrap: anywhere;
  border-right: 1px solid #edf0f3;
}
.contract-popup__payment-cell:last-child {
  border-right: none;
}
.contract-popup__payment-row--head .contract-popup__payment-cell {
  color: #596574;
  font-size: 12px;
}
.contract-popup__payment-cell--number {
  justify-content: flex-end;
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.contract-popup__payment-node {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  flex-direction: column;
}
.contract-popup__payment-remark {
  margin-top: 2px;
  color: #68788a;
  font-size: 11px;
  line-height: 1.4;
}
.contract-popup__detail-link {
  display: flex;
  min-height: 44px;
  margin: 12px 16px;
  padding: 8px 12px;
  color: #176ac7;
  background: #edf5ff;
  border-radius: 8px;
  font-size: 14px;
  gap: 8px;
  align-items: center;
  justify-content: center;
}
.contract-popup__approval {
  padding: 0 16px 16px;
}
.contract-popup__approval .contract-popup__section {
  padding: 8px 0;
}
.contract-popup__manager {
  display: flex;
  box-sizing: border-box;
  width: 100%;
  min-height: 68px;
  padding: 11px 12px;
  margin: 0;
  color: #27364a;
  background: #fff;
  border: 1px solid #ccd5df;
  border-radius: 8px;
  align-items: center;
  justify-content: space-between;
  text-align: left;
}
.contract-popup__manager-text {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  font-size: 16px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.contract-popup__placeholder,
.contract-popup__manager-hint {
  color: #68788a;
}
.contract-popup__manager-hint {
  font-size: 12px;
}
.contract-popup__reason {
  padding: 0 16px 16px;
}
.contract-popup__reason .contract-popup__section {
  padding: 8px 0;
}
.contract-popup__reason textarea {
  box-sizing: border-box;
  width: 100%;
  height: 104px;
  padding: 10px 12px;
  color: #27364a;
  border: 1px solid #ccd5df;
  border-radius: 8px;
  font-size: 16px;
  line-height: 1.5;
}
.contract-popup__notice {
  padding: 12px 16px;
  color: #8a5a13;
  font-size: 14px;
  line-height: 1.6;
}
.contract-popup__actions {
  display: flex;
  gap: 12px;
  padding: 14px 16px;
  border-top: 1px solid #edf0f3;
  flex: none;
}
.contract-popup__actions > view {
  min-width: 0;
  flex: 1;
}
.contract-popup__state {
  display: flex;
  gap: 16px;
  padding: 44px 16px;
  color: #68788a;
  font-size: 14px;
  align-items: center;
  flex-direction: column;
}
</style>
