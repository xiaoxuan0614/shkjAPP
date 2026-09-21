<template>
  <wd-popup v-model="visible" position="bottom" :close-on-click-modal="false" safe-area-inset-bottom root-portal :z-index="2000" custom-style="border-radius:16px 16px 0 0;">
    <view class="material-approval">
      <view class="approval-head">
        <text class="approval-title">{{ record?.applyType === 'IN' ? '入库申请审批' : '出库申请审批' }}</text>
        <button :disabled="submitting" aria-label="关闭申请审批" @click="close">关闭</button>
      </view>
      <scroll-view class="approval-body" scroll-y :scroll-into-view="scrollTarget">
        <view v-if="loading" class="approval-state">正在加载物料申请…</view>
        <view v-else-if="loadError" class="approval-state"><text>{{ loadError }}</text><wd-button plain @click="load">重新加载</wd-button></view>
        <template v-else-if="record">
          <view class="approval-project">{{ projectName }}</view>
          <view v-for="row in rows" :key="row.label" class="approval-row"><text class="approval-label">{{ row.label }}</text><text>{{ row.value }}</text></view>
          <view class="approval-section">物料明细（{{ itemTotal }} 项）</view>
          <view v-for="item in items" :key="item.id" class="approval-item">
            <view class="item-heading"><text>{{ item.materialName || '未命名物料' }}</text><text>{{ item.unitQty ?? item.applyQty ?? '—' }} {{ item.unitName || item.unit || '' }}</text></view>
            <view class="item-spec">{{ [item.materialCode, item.brand, item.model].filter(Boolean).join(' · ') || '—' }}</view>
          </view>
          <view v-if="!items.length && !itemsLoading && !itemsError" class="approval-state">暂无物料明细</view>
          <view v-if="itemsError" class="approval-error" role="alert">{{ itemsError }}</view>
          <view v-if="itemsError || items.length < itemTotal" class="items-more"><wd-button plain :loading="itemsLoading" :disabled="itemsLoading || submitting" @click="loadItems">{{ itemsError ? '重试加载明细' : '加载更多物料' }}</wd-button></view>
          <view v-if="!pending" class="approval-notice">此申请已不处于待审批状态，仅可查看。</view>
          <view v-else-if="!allowed" class="approval-notice">当前账号没有此申请的审批资格，仅可查看。</view>
          <view v-if="mode" id="material-approval-confirm" class="approval-confirm">
            <view class="approval-section">{{ mode === 'reject' ? '驳回原因（必填）' : '确认通过整张物料申请？' }}</view>
            <textarea v-if="mode === 'reject'" v-model="reason" :disabled="submitting" :maxlength="-1" aria-label="驳回原因" placeholder="请填写驳回原因" />
            <view v-else class="approval-notice">本次审批作用于整张申请单，不会直接执行出入库。</view>
          </view>
          <view v-if="actionError" class="approval-error" role="alert">{{ actionError }}</view>
        </template>
      </scroll-view>
      <view v-if="record && !loading && !loadError && pending && allowed" class="approval-actions">
        <wd-button block plain :disabled="submitting" :type="mode ? 'default' : 'error'" @click="setMode(mode ? '' : 'reject')">{{ mode ? '取消' : '驳回' }}</wd-button>
        <wd-button block :loading="submitting" :disabled="submitting || !!itemsError || !items.length" :type="mode === 'reject' ? 'error' : 'primary'" @click="submit">{{ mode === 'reject' ? '确认驳回' : mode === 'approve' ? '确认通过' : '通过' }}</wd-button>
      </view>
    </view>
  </wd-popup>
  <wd-message-box selector="material-approval-close" root-portal />
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useMessage } from 'wot-design-uni'
import { materialApprovalApi, materialApprovalId, canApproveMaterial } from '@/service/materialApproval'
import { formatStockProjectName } from '@/service/shkj'
import { type TodoRecord, unwrapTodoPage } from '@/service/todo'
import { useUserStore } from '@/store/user'
import { usePermissionStore } from '@/store/permission'
import { ensureCurrentAuthorization } from '@/service/permission'

const emit = defineEmits<{ processed: [] }>()
const user = useUserStore(), permission = usePermissionStore()
const closeMessage = useMessage('material-approval-close')
const visible = ref(false), loading = ref(false), submitting = ref(false), allowed = ref(false)
const id = ref(''), record = ref<any>(null), items = ref<any[]>([]), itemTotal = ref(0), itemPage = ref(0)
const loadError = ref(''), itemsError = ref(''), actionError = ref(''), itemsLoading = ref(false)
const mode = ref<'' | 'approve' | 'reject'>(''), reason = ref(''), scrollTarget = ref('')
let sequence = 0
const pending = computed(() => String(record.value?.status) === '2')
const projectName = computed(() => formatStockProjectName(record.value || {}) || '未关联项目')
const rows = computed(() => [
  { label: '申请单号', value: record.value?.applyNo || '—' },
  { label: '申请人', value: record.value?.applyUserName || '—' },
  { label: '申请时间', value: record.value?.createTime || '—' },
  { label: '申请备注', value: record.value?.remark || '—' },
])
async function checkAccess(value: any) {
  await ensureCurrentAuthorization(user.userInfo, true)
  return canApproveMaterial(value, user.userInfo, permission.hasPermission)
}
async function loadItems() {
  if (itemsLoading.value || submitting.value) return
  const current = sequence, pageNo = itemPage.value + 1
  itemsLoading.value = true; itemsError.value = ''
  try {
    const page = unwrapTodoPage(await materialApprovalApi.items(id.value, pageNo))
    if (current !== sequence) return
    if (!page.records.length && items.value.length < page.total) throw new Error('明细数据不完整，请重试')
    const existing = new Set(items.value.map(item => item.id))
    items.value.push(...page.records.filter(item => !existing.has(item.id)))
    itemTotal.value = page.total; itemPage.value = pageNo
  } catch (error: any) { if (current === sequence) itemsError.value = error?.message || '物料明细加载失败' }
  finally { if (current === sequence) itemsLoading.value = false }
}
async function load() {
  const current = ++sequence
  loading.value = true; loadError.value = ''; record.value = null; allowed.value = false
  items.value = []; itemPage.value = 0; itemTotal.value = 0; itemsLoading.value = false; itemsError.value = ''
  try {
    if (!id.value) throw new Error('待办缺少物料申请 ID，请刷新待办')
    const detail = await materialApprovalApi.detail(id.value)
    const access = await checkAccess(detail)
    if (current !== sequence) return
    record.value = detail; allowed.value = access
    await loadItems()
  } catch (error: any) { if (current === sequence) loadError.value = error?.message || '物料申请加载失败' }
  finally { if (current === sequence) loading.value = false }
}
async function close() {
  if (submitting.value) return
  if (reason.value.trim()) {
    const current = sequence
    const confirmed = await closeMessage.confirm({
      title: '放弃未提交的原因？', msg: '关闭后将丢弃已填写的驳回原因。',
      zIndex: 3000, closeOnClickModal: false,
    }).then(() => true, () => false)
    if (!confirmed || current !== sequence || submitting.value) return
  }
  sequence++; visible.value = false
}
async function setMode(value: '' | 'approve' | 'reject') {
  if (submitting.value) return
  mode.value = value; actionError.value = ''; scrollTarget.value = ''
  await nextTick(); scrollTarget.value = value ? 'material-approval-confirm' : ''
}
async function submit() {
  if (submitting.value || !allowed.value || !pending.value || itemsError.value || !items.value.length) return
  if (!mode.value) return setMode('approve')
  if (mode.value === 'reject' && !reason.value.trim()) { actionError.value = '请填写驳回原因'; return }
  submitting.value = true; actionError.value = ''
  try {
    const latest = await materialApprovalApi.detail(id.value)
    record.value = latest; allowed.value = await checkAccess(latest)
    if (!pending.value) { emit('processed'); throw new Error('申请已被处理，请查看最新状态') }
    if (!allowed.value) throw new Error('当前账号已无此申请的审批资格')
    await materialApprovalApi.submit(id.value, mode.value === 'reject' ? 'REJECT' : 'AGREE', mode.value === 'reject' ? reason.value : '')
    visible.value = false; emit('processed'); uni.showToast({ title: '审批已完成', icon: 'success' })
  } catch (error: any) { actionError.value = error?.message || '审批失败，请重试' }
  finally { submitting.value = false }
}
function open(todo: TodoRecord) {
  if (submitting.value) return
  id.value = materialApprovalId(todo); mode.value = ''; reason.value = ''; actionError.value = ''; scrollTarget.value = ''
  visible.value = true; void load()
}
defineExpose({ open })
</script>

<style scoped lang="scss">
.material-approval { display:flex; flex-direction:column; height:85vh; height:85dvh; background:#fff; color:#1d2129; }
.approval-head { display:flex; align-items:center; justify-content:space-between; padding:8px 16px; border-bottom:1px solid #e5e6eb; }
.approval-title { font-size:18px; font-weight:600; }
.approval-head button { margin:0; min-height:48px; min-width:48px; font-size:14px; background:transparent; }
.approval-head button::after { border:0; }
.approval-body { flex:1; min-height:0; height:0; }
.approval-project,.approval-section { padding:16px 16px 8px; font-weight:600; overflow-wrap:anywhere; }
.approval-project { font-size:18px; }
.approval-row { display:flex; gap:16px; padding:10px 16px; font-size:14px; }
.approval-label { flex:0 0 80px; color:#595959; }
.approval-row > text:last-child { flex:1; text-align:right; overflow-wrap:anywhere; white-space:pre-wrap; }
.approval-item { margin:0 16px; padding:12px 0; border-bottom:1px solid #e5e6eb; }
.item-heading { display:flex; justify-content:space-between; gap:16px; font-size:14px; }
.item-heading > text:first-child { flex:1; overflow-wrap:anywhere; }
.item-spec { margin-top:6px; font-size:12px; color:#595959; overflow-wrap:anywhere; }
.approval-state { display:flex; flex-direction:column; align-items:center; gap:16px; padding:24px 16px; }
.items-more { padding:12px 16px; text-align:center; }
.approval-notice,.approval-error { margin:16px; font-size:14px; line-height:1.6; }
.approval-error { color:#b42318; }
.approval-confirm textarea { box-sizing:border-box; margin:8px 16px; padding:12px; width:calc(100% - 32px); height:100px; border:1px solid #bfbfbf; border-radius:8px; }
.approval-actions { display:grid; grid-template-columns:1fr 1fr; gap:12px; padding:12px 16px 16px; border-top:1px solid #e5e6eb; --wot-button-medium-height:48px; }
</style>
