<template>
  <wd-popup v-model="visible" position="bottom" :close-on-click-modal="!submitting" safe-area-inset-bottom root-portal :z-index="2000" custom-style="border-radius:16px 16px 0 0;">
    <view class="delay-popup">
      <view class="delay-head">
        <text class="delay-title">项目延期审批</text>
        <button class="delay-close" aria-label="关闭延期审批" :disabled="submitting" @click="close">关闭</button>
      </view>
      <scroll-view class="delay-body" scroll-y :scroll-into-view="scrollTarget">
        <view v-if="loading" class="delay-state">正在加载延期申请…</view>
        <view v-else-if="loadError" class="delay-state">
          <text>{{ loadError }}</text>
          <wd-button plain @click="load">重新加载</wd-button>
        </view>
        <template v-else-if="record">
          <view class="delay-project">{{ projectLabel || '项目名称暂未获取' }}</view>
          <view v-for="row in rows" :key="row.label" class="delay-row">
            <text class="delay-label">{{ row.label }}</text><text>{{ row.value }}</text>
          </view>
          <view class="delay-section">延期原因</view>
          <view class="delay-text">{{ record.delayReason || '—' }}</view>
          <template v-if="record.remark"><view class="delay-section">备注</view><view class="delay-text">{{ record.remark }}</view></template>
          <template v-if="record.approvalReason"><view class="delay-section">审批意见</view><view class="delay-text">{{ record.approvalReason }}</view></template>
          <view v-if="pending && !canApprove" class="delay-notice">暂无延期审批权限，仅可查看。</view>
          <view v-if="mode === 'reject'" id="delay-reason" class="delay-reason">
            <view class="delay-section">驳回原因（必填）</view>
            <textarea v-model="reason" :disabled="submitting" :maxlength="-1" auto-height aria-label="驳回原因" placeholder="请填写驳回原因" />
          </view>
          <view v-if="mode === 'approve'" id="delay-confirm" class="delay-notice">确认通过此延期申请？通过后将更新对应工序的计划完成日期。</view>
          <view v-if="actionError" class="delay-error" role="alert">{{ actionError }}</view>
        </template>
      </scroll-view>
      <view v-if="record && !loading && !loadError && canApprove" class="delay-actions">
        <wd-button block plain :disabled="submitting" :type="mode ? 'default' : 'error'" @click="secondary">{{ mode ? '取消' : '驳回' }}</wd-button>
        <wd-button block :loading="submitting" :disabled="submitting" :type="mode === 'reject' ? 'error' : 'primary'" @click="primary">{{ mode === 'reject' ? '确认驳回' : mode === 'approve' ? '确认通过' : '通过' }}</wd-button>
      </view>
    </view>
  </wd-popup>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { delayApprovalApi, type DelayApproval } from '@/service/delayApproval'
import { type TodoRecord } from '@/service/todo'
import { usePermissionStore } from '@/store/permission'

const emit = defineEmits<{ processed: [] }>()
const permission = usePermissionStore()
const visible = ref(false)
const loading = ref(false)
const submitting = ref(false)
const loadError = ref('')
const actionError = ref('')
const record = ref<DelayApproval | null>(null)
const projectLabel = ref('')
const id = ref('')
const mode = ref<'' | 'approve' | 'reject'>('')
const reason = ref('')
const scrollTarget = ref('')
let sequence = 0
const pending = computed(() => String(record.value?.status) === '2')
const canApprove = computed(() => pending.value && permission.loaded && permission.hasPermission('project:delay:approve'))
const statusLabels: Record<string, string> = { '0': '驳回', '1': '审核通过', '2': '待审批', '3': '已撤回' }
const statusText = computed(() => statusLabels[String(record.value?.status)] || '未知状态')
const rows = computed(() => {
  const r = record.value
  if (!r) return []
  const values = [
    ['申请单号', r.applyNo], ['申请人', r.applyUserName], ['申请时间', r.applyTime],
    ['原计划完成日期', r.originalEndTime], ['申请延期至', r.expectedEndTime],
    ['延期天数', r.delayDays == null ? null : `${r.delayDays} 天`], ['审批状态', statusText.value],
  ]
  if (r.approvalUserName) values.push(['审批人', r.approvalUserName])
  if (r.approvalTime) values.push(['审批时间', r.approvalTime])
  return values.map(([label, value]) => ({ label, value: value || '—' }))
})
watch(visible, (value) => { if (!value) sequence++ })
function close() { if (!submitting.value) visible.value = false }
async function load() {
  const current = ++sequence
  loading.value = true
  loadError.value = ''
  record.value = null
  try {
    if (!id.value) throw new Error('待办缺少延期申请 ID，请刷新待办')
    const detail = await delayApprovalApi.detail(id.value)
    if (!detail?.id || String(detail.id) !== id.value) throw new Error('未找到对应延期申请')
    let name = ''
    if (detail.periodId) {
      try {
        const project = await delayApprovalApi.project(detail.periodId)
        name = [project?.projectName, project?.periodName].filter(Boolean).join('－')
      } catch { /* 名称查询失败不影响申请详情回显。 */ }
    }
    if (current !== sequence) return
    record.value = detail
    if (name) projectLabel.value = name
  } catch (error: any) {
    if (current === sequence) loadError.value = error?.message || '延期申请加载失败，请重试'
  } finally { if (current === sequence) loading.value = false }
}
async function setMode(value: '' | 'approve' | 'reject') {
  mode.value = value
  actionError.value = ''
  scrollTarget.value = ''
  await nextTick()
  scrollTarget.value = value === 'reject' ? 'delay-reason' : value === 'approve' ? 'delay-confirm' : ''
}
function secondary() { if (!submitting.value) void setMode(mode.value ? '' : 'reject') }
async function primary() {
  if (submitting.value || !canApprove.value) return
  if (!mode.value) return setMode('approve')
  if (mode.value === 'reject' && !reason.value.trim()) {
    actionError.value = '请填写驳回原因'
    return
  }
  submitting.value = true
  actionError.value = ''
  try {
    const latest = await delayApprovalApi.detail(id.value)
    if (!latest?.id || String(latest.id) !== id.value) throw new Error('未找到对应延期申请')
    record.value = latest
    if (!pending.value) {
      mode.value = ''
      emit('processed')
      throw new Error('申请状态已变化，请查看最新审批结果')
    }
    if (!canApprove.value) throw new Error('暂无延期审批权限')
    if (mode.value === 'reject') await delayApprovalApi.reject(id.value, reason.value.trim())
    else await delayApprovalApi.approve(id.value)
    visible.value = false
    emit('processed')
    uni.showToast({ title: '审批已完成', icon: 'success' })
  } catch (error: any) { actionError.value = error?.message || '审批失败，请重试' }
  finally { submitting.value = false }
}
function open(todo: TodoRecord) {
  if (submitting.value) return
  id.value = String(todo.bizId || '')
  projectLabel.value = [todo.projectName, todo.periodName].filter(Boolean).join('－')
  mode.value = ''
  reason.value = ''
  actionError.value = ''
  scrollTarget.value = ''
  visible.value = true
  void load()
}
defineExpose({ open })
</script>

<style scoped lang="scss">
.delay-popup { display: flex; flex-direction: column; height: 85vh; color: var(--wot-color-content, #1d2129); background: var(--wot-color-white, #fff); }
.delay-head { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; border-bottom: 1px solid var(--wot-color-border-light, #e5e6eb); }
.delay-title { font-size: 18px; font-weight: 600; }
.delay-close { margin: 0; min-width: 48px; min-height: 48px; padding: 0 8px; font-size: 14px; color: inherit; background: transparent; }
.delay-close::after { border: 0; }
.delay-close:active { opacity: .65; }
.delay-body { flex: 1; min-height: 0; height: 0; }
.delay-project, .delay-section { padding: 16px 16px 8px; font-weight: 600; overflow-wrap: anywhere; }
.delay-project { font-size: 18px; }
.delay-row { display: flex; justify-content: space-between; gap: 16px; padding: 12px 16px; font-size: 14px; }
.delay-row > text:last-child { flex: 1; text-align: right; overflow-wrap: anywhere; white-space: pre-wrap; }
.delay-label { flex: 0 0 112px; color: var(--wot-color-secondary, #595959); }
.delay-text { padding: 0 16px 16px; white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.6; }
.delay-state { padding: 32px 16px; display: flex; flex-direction: column; gap: 16px; align-items: center; }
.delay-notice, .delay-error { margin: 16px; line-height: 1.6; }
.delay-error { color: var(--wot-color-danger, #b42318); }
.delay-reason textarea { box-sizing: border-box; width: calc(100% - 32px); min-height: 100px; margin: 8px 16px 16px; padding: 12px; border: 1px solid var(--wot-color-border, #bfbfbf); border-radius: 8px; }
.delay-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 12px 16px 16px; border-top: 1px solid var(--wot-color-border-light, #e5e6eb); --wot-button-medium-height: 48px; }
</style>
