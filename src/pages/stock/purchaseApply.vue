<route lang="json5">
{ style: { navigationBarTitleText: '采购申请', navigationStyle: 'custom', disableScroll: true } }
</route>
<template>
  <PageLayout navTitle="采购申请" navLeftText="返回" navBackgroundColor="#176ac7" type="popup" @navBack="back">
    <scroll-view scroll-y class="body">
      <view class="content">
        <view v-if="completed" class="section success"><wd-icon name="check-circle" size="40px" color="#267b54" /><text class="title">采购申请已提交</text><text class="muted">当前状态：待采购</text><button @click="leave">查看采购记录</button></view>
        <view v-else-if="authorizing" class="section muted">正在加载采购权限…</view>
        <view v-else-if="!allowed" class="section muted">{{ authorizationError || '当前账号暂无采购申请权限，请联系管理员配置采购菜单。' }}<button @click="initialize">重新加载权限</button></view>
        <template v-else>
          <view class="section">
            <text class="title">采购信息</text>
            <view class="field"><text>采购类型 <text class="required">*</text></text><picker :disabled="busy || typesLoading" :range="types" range-key="label" @change="changeType"><view class="control">{{ typesLoading ? '正在加载…' : types.find(item => item.value === form.purchaseType)?.label || '请选择采购类型' }}<wd-icon name="arrow-down" size="14px" /></view></picker><button v-if="typesError" class="text-button" @click="loadTypes">类型加载失败，点击重试</button></view>
            <view class="field"><text>供应商 <text class="required">*</text></text><button class="control" :disabled="busy" @click="openPicker('supplier')">{{ form.supplierName || '请选择供应商' }}<wd-icon name="arrow-right" size="14px" /></button></view>
            <view v-if="form.purchaseType === '1'" class="field"><text>关联项目 <text class="required">*</text></text><button class="control" :disabled="busy" @click="openPicker('project')">{{ projectLabel || '请选择主项目及分期' }}<wd-icon name="arrow-right" size="14px" /></button></view>
            <view class="fields">
              <view v-for="field in dateFields" :key="field.key" class="field"><text>{{ field.label }}</text><wd-datetime-picker type="date" :title="field.label" :model-value="dateValue(form[field.key])" :root-portal="true" :z-index="2600" :safe-area-inset-bottom="true" :disabled="busy" @confirm="setDate(field.key, $event)"><view class="control">{{ form[field.key] || '请选择日期' }}<wd-icon name="calendar" size="16px" /></view></wd-datetime-picker></view>
            </view>
            <label class="field"><text>采购备注</text><textarea v-model="form.remark" :disabled="busy" :maxlength="500" placeholder="选填，请输入采购备注" @input="dirty = true" /></label>
          </view>
          <view class="section">
            <view class="heading"><text class="title">采购明细 · {{ rows.length }} 项</text><button :disabled="busy" @click="openPicker('material')">添加物料</button></view>
            <ReadOnlyTable label="采购明细" :columns="columns" :rows="visibleRows" min-width="420px" empty-text="暂未添加采购物料">
              <template #cell="{ row, column }">
                <view v-if="column.key === 'material'"><text>{{ row.materialName }}</text><text class="muted">{{ [row.materialCode, row.model].filter(Boolean).join(' · ') }}</text></view>
                <text v-else-if="column.key === 'quantity'">{{ row.quantity }} {{ row.unit }}</text>
                <text v-else-if="column.key === 'amount'">{{ lineAmount(row) }}</text>
                <button v-else class="text-button" :disabled="busy" @click="editItem(row)">填写</button>
              </template>
            </ReadOnlyTable>
            <view v-if="rows.length > 10" class="pagination"><button :disabled="page <= 1 || busy" @click="page--">上一页</button><text>{{ page }} / {{ pages }}</text><button :disabled="page >= pages || busy" @click="page++">下一页</button></view>
            <view v-if="rows.length" class="total">采购总价 <strong>{{ total === '—' ? '待填写' : `¥${total}` }}</strong></view>
          </view>
        </template>
      </view>
    </scroll-view>
    <view v-if="!completed && allowed" class="footer"><text v-if="error" class="error" role="alert">{{ error }}</text><button class="primary" :disabled="busy || typesLoading || !!typesError || uncertain" :loading="busy" @click="submit">提交采购申请</button></view>
    <PurchasePicker v-model="pickerOpen" :kind="pickerKind" :excluded="pickerKind === 'material' ? rows.map(row => String(row.materialId)) : []" @select="select" />
    <wd-popup :model-value="!!draft" position="bottom" :z-index="2500" :close-on-click-modal="false" custom-style="height:72vh;border-radius:16px 16px 0 0;overflow:hidden" @update:model-value="closeItem">
      <view class="panel">
        <view class="heading modal-head"><text class="title">填写采购明细</text><button class="text-button" @click="closeItem">取消</button></view>
        <scroll-view scroll-y class="modal-body"><view v-if="draft" class="item-form">
          <view class="heading"><text class="title">{{ draft.materialName }}</text><button v-if="editingId" class="danger" @click="removeItem">删除</button></view><text class="muted">{{ [draft.materialCode, draft.model].filter(Boolean).join(' · ') }}</text>
          <view class="fields"><label class="field"><text>采购数量 <text class="required">*</text></text><input v-model="draft.quantity" type="digit" placeholder="请输入数量" /></label><label class="field"><text>采购单价（元）<text class="required">*</text></text><input v-model="draft.unitPrice" type="digit" placeholder="请输入单价" /></label></view>
          <view class="field"><text>采购单位 <text class="required">*</text></text><picker :disabled="unitLoading || !!unitError" :range="draft.unitOptions || []" @change="draft.unit = draft.unitOptions[Number($event.detail.value)]"><view class="control">{{ unitLoading ? '正在加载…' : draft.unit || '请选择单位' }}<wd-icon name="arrow-down" size="14px" /></view></picker><button v-if="unitError" class="text-button" @click="loadUnits">单位加载失败，重试</button></view>
          <view class="total">本项金额 <strong>{{ lineAmount(draft) }}</strong></view>
        </view></scroll-view>
        <view class="footer"><text v-if="itemError || unitError" class="error" role="alert">{{ itemError || unitError }}</text><button class="primary" :disabled="unitLoading || !!unitError" @click="confirmItem">确认本项</button></view>
      </view>
    </wd-popup>
  </PageLayout>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onUnload, onBackPress } from '@dcloudio/uni-app'
import { http } from '@/utils/http'
import { usePermissionStore } from '@/store/permission'
import { useUserStore } from '@/store/user'
import { ensureCurrentAuthorization } from '@/service/permission'
import { unwrapQuotation, quotationLineTotal } from '@/service/quotationApproval'
import { PURCHASE_APPLICATION_PATH, purchaseItem, purchasePayload, purchaseTotal } from '@/service/purchaseApplication'
import ReadOnlyTable from '@/components/ReadOnlyTable/ReadOnlyTable.vue'
import type { ReadOnlyColumn } from '@/components/ReadOnlyTable/types'
import PurchasePicker from './components/PurchasePicker.vue'

// Operate: 继承现有移动办公导航和表单；主页面审阅采购信息，单项弹窗集中录入，底部提交。
const permission = usePermissionStore(), user = useUserStore()
const authorizing = ref(true), authorizationError = ref('')
const allowed = computed(() => permission.loaded && permission.hasPageAccess(PURCHASE_APPLICATION_PATH))
const date = new Date(), today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const form = ref({ purchaseType: '', supplierId: '', supplierName: '', projectId: '', periodId: '', projectName: '', periodName: '', orderDate: today, expectedArrivalDate: '', remark: '' })
const dateFields = [{ key: 'orderDate' as const, label: '下单日期' }, { key: 'expectedArrivalDate' as const, label: '预计到货日期' }]
const dateValue = (value: string) => new Date(`${value || today}T00:00:00`).getTime()
function setDate(key: 'orderDate' | 'expectedArrivalDate', event: any) {
  const value = new Date(event.value)
  if (busy.value || !Number.isFinite(value.getTime())) return
  form.value[key] = `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`; dirty.value = true
}
const projectLabel = computed(() => [form.value.projectName, form.value.periodName].filter(Boolean).join('-'))
const rows = ref<any[]>([]), page = ref(1), dirty = ref(false), busy = ref(false), error = ref(''), uncertain = ref(false), completed = ref(false)
const types = ref<{ value: string; label: string }[]>([]), typesLoading = ref(false), typesError = ref('')
const pickerOpen = ref(false), pickerKind = ref<'project' | 'supplier' | 'material'>('material')
const draft = ref<any>(null), editingId = ref(''), itemError = ref(''), unitLoading = ref(false), unitError = ref('')
let active = true, leaving = false, itemRequest = 0
const pages = computed(() => Math.max(1, Math.ceil(rows.value.length / 10)))
const visibleRows = computed(() => rows.value.slice((page.value - 1) * 10, page.value * 10))
const columns: ReadOnlyColumn[] = [{ key: 'material', label: '物料信息', width: 'minmax(140px, 1.5fr)' }, { key: 'quantity', label: '采购数量', width: '90px', align: 'right' }, { key: 'amount', label: '金额', width: '100px', align: 'right' }, { key: 'action', label: '操作', width: '60px' }]
const lineAmount = (row: any) => quotationLineTotal(row.unitPrice, row.quantity)
const total = computed(() => { try { return purchaseTotal(rows.value) } catch { return '—' } })
async function loadTypes() {
  if (typesLoading.value || !allowed.value) return
  const token = user.userInfo.token; typesLoading.value = true; typesError.value = ''
  try {
    const data = unwrapQuotation(await http.get('/sys/dict/getDictItems/purchase_order_type'))
    if (!active || token !== user.userInfo.token) return
    if (!Array.isArray(data) || !data.length) throw new Error('采购类型字典为空')
    types.value = data.map(item => ({ value: String(item.value), label: String(item.text || item.label || item.value) }))
  } catch (e: any) { if (active && token === user.userInfo.token) typesError.value = e?.message || '类型加载失败' }
  finally { if (active) typesLoading.value = false }
}
function changeType(event: any) {
  if (busy.value) return
  form.value.purchaseType = types.value[Number(event.detail.value)]?.value || ''
  if (form.value.purchaseType !== '1') Object.assign(form.value, { projectId: '', periodId: '', projectName: '', periodName: '' })
  dirty.value = true
}
function openPicker(kind: 'project' | 'supplier' | 'material') { if (busy.value || !allowed.value) return; pickerKind.value = kind; pickerOpen.value = true }
function select(row: any) {
  if (busy.value || !allowed.value) return
  if (pickerKind.value === 'supplier') { form.value.supplierId = String(row.id); form.value.supplierName = row.supplierName; dirty.value = true }
  else if (pickerKind.value === 'project') {
    if (form.value.purchaseType !== '1') return
    if (!row.projectId || !row.periodId) { uni.showToast({ title: '项目信息不完整，请重新选择', icon: 'none' }); return }
    Object.assign(form.value, { projectId: String(row.projectId), periodId: String(row.periodId), projectName: row.projectName || '', periodName: row.periodName || '' }); dirty.value = true
  } else {
    if (rows.value.some(item => String(item.materialId) === String(row.id))) return
    editItem({ ...row, materialId: String(row.id), quantity: 1, unitPrice: row.unitPrice ?? 0 }, true)
  }
  pickerOpen.value = false
}
function editItem(row: any, adding = false) {
  if (busy.value || !allowed.value) return
  itemRequest++; editingId.value = adding ? '' : String(row.materialId)
  draft.value = { ...row, unitOptions: [...(row.unitOptions || [])] }; itemError.value = ''; unitError.value = ''; unitLoading.value = false
  if (!draft.value.unitOptions.length) void loadUnits()
}
async function loadUnits() {
  if (!draft.value || unitLoading.value) return
  const row = draft.value, request = ++itemRequest, token = user.userInfo.token
  unitLoading.value = true; unitError.value = ''
  try {
    const data = row.unitList?.length ? row : unwrapQuotation(await http.get('/stock/material/queryById', { id: row.materialId }))
    if (!active || request !== itemRequest || token !== user.userInfo.token) return
    if (String(data.materialId || data.id) !== String(row.materialId) || !Array.isArray(data.unitList)) throw new Error('物料单位信息不完整')
    row.unitOptions = [...new Set(data.unitList.map((unit: any) => String(unit.unitName || '')).filter(Boolean))]
    if (!row.unitOptions.length) throw new Error('该物料尚未配置单位')
    if (!row.unitOptions.includes(row.unit)) row.unit = row.unitOptions[0]
  } catch (e: any) { if (active && request === itemRequest && token === user.userInfo.token) unitError.value = e?.message || '单位加载失败' }
  finally { if (request === itemRequest) unitLoading.value = false }
}
function closeItem() { itemRequest++; draft.value = null; unitLoading.value = false }
function confirmItem() {
  if (!allowed.value || !draft.value || unitLoading.value || unitError.value) return
  try {
    purchaseItem(draft.value)
    if (editingId.value) { const index = rows.value.findIndex(row => String(row.materialId) === editingId.value); if (index < 0) throw new Error('物料已移除，请重新添加'); rows.value[index] = { ...draft.value } }
    else { if (rows.value.some(row => String(row.materialId) === String(draft.value.materialId))) throw new Error('物料已添加'); rows.value.push({ ...draft.value, key: draft.value.materialId }); page.value = pages.value }
    dirty.value = true; closeItem()
  } catch (e: any) { itemError.value = e?.message || '请检查明细内容' }
}
function removeItem() { if (!allowed.value) return; rows.value = rows.value.filter(row => String(row.materialId) !== editingId.value); page.value = Math.min(page.value, pages.value); dirty.value = true; closeItem() }
async function submit() {
  if (!allowed.value || busy.value || completed.value || uncertain.value || draft.value || pickerOpen.value) return
  const token = user.userInfo.token; busy.value = true; error.value = ''; let attempted = false
  try {
    const payload = purchasePayload(form.value, rows.value, types.value)
    const confirmed = await new Promise<boolean>(resolve => uni.showModal({ title: '提交采购申请？', content: `共 ${rows.value.length} 项物料，总金额 ¥${total.value}，提交后进入待采购。`, success: result => resolve(!!result.confirm), fail: () => resolve(false) }))
    if (!confirmed || !active || token !== user.userInfo.token || !allowed.value) return
    attempted = true
    unwrapQuotation(await http.post('/project/purchaseOrder/add', payload))
    if (!active || token !== user.userInfo.token) return
    dirty.value = false; completed.value = true
  } catch (e: any) {
    if (!active || token !== user.userInfo.token) return
    uncertain.value = attempted
    error.value = attempted ? `${e?.message || '提交失败'}。请到 PC 采购订单核实是否已生成，勿重复提交。` : e?.message || '请检查申请信息'
  } finally { if (active) busy.value = false }
}
function leave() {
  leaving = true
  const fallback = () => uni.redirectTo({ url: '/pages/stock/purchaseList', fail: () => { leaving = false; uni.showToast({ title: '返回失败，请重试', icon: 'none' }) } })
  const stack = getCurrentPages()
  if (stack.length > 1 && (!completed.value || stack[stack.length - 2]?.route === 'pages/stock/purchaseList')) uni.navigateBack({ delta: 1, fail: fallback })
  else fallback()
}
function back() { if (draft.value) { closeItem(); return } if (pickerOpen.value) { pickerOpen.value = false; return } if (busy.value) return; if (!dirty.value) { leave(); return } uni.showModal({ title: '离开采购申请？', content: '尚未提交的内容将丢失。', success: result => { if (result.confirm) leave() } }) }
async function initialize() {
  authorizing.value = true; authorizationError.value = ''
  try { await ensureCurrentAuthorization(user.userInfo); if (active) await loadTypes() }
  catch { if (active) authorizationError.value = '权限加载失败，请重试' }
  finally { if (active) authorizing.value = false }
}
onLoad(() => { void initialize() })
onBackPress(() => { if (leaving) return false; back(); return true })
onUnload(() => { active = false; itemRequest++ })
</script>
<style scoped>
.body { flex:1; height:0; min-height:0; background:#f5f7fa; }.content { max-width:780px; padding:12px; margin:0 auto; }
.section { padding:16px; background:#fff; border-radius:12px; margin-bottom:12px; }.title { font-size:17px; font-weight:600; color:#1d2939; line-height:1.6; overflow-wrap:anywhere; }
.field { display:flex; flex-direction:column; gap:8px; margin-top:18px; color:#475467; font-size:14px; min-width:0; }.required,.error { color:#b42318; }.fields { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
.control,.field input,.field textarea { box-sizing:border-box; width:100%; min-height:44px; border:1px solid #d0d5dd; border-radius:8px; background:#f5f7fa; color:#1d2939; font-size:16px; padding:10px 12px; line-height:1.5; }
.control { display:flex; align-items:center; justify-content:space-between; gap:8px; text-align:left; overflow-wrap:anywhere; }.control :deep(.wd-icon) { flex-shrink:0; }.field input { height:44px; }.field textarea { height:84px; }
.heading,.pagination { display:flex; align-items:center; justify-content:space-between; gap:12px; }.heading { margin-bottom:14px; }.pagination { margin-top:16px; font-size:14px; }.muted { display:block; color:#667085; font-size:13px; line-height:1.7; overflow-wrap:anywhere; }
button { margin:0; min-height:44px; padding:0 12px; line-height:44px; font-size:14px; background:#edf4ff; color:#176ac7; border-radius:8px; }button::after { border:none; }button[disabled] { background:#f2f4f7; color:#667085; }.primary { color:#fff; background:#176ac7; width:100%; }.text-button { background:transparent; padding:0; }.danger { color:#b42318; background:transparent; }
.footer { flex-shrink:0; padding:12px 16px calc(12px + env(safe-area-inset-bottom)); background:#fff; border-top:1px solid #eaecf0; }.error { display:block; font-size:14px; line-height:1.6; margin-bottom:12px; overflow-wrap:anywhere; }.total { text-align:right; margin-top:20px; color:#475467; font-size:14px; font-variant-numeric:tabular-nums; }.total strong { margin-left:12px; color:#1d2939; }
.panel { height:100%; display:flex; flex-direction:column; background:#fff; }.modal-head { padding:8px 16px; margin:0; border-bottom:1px solid #eaecf0; }.modal-body { flex:1; height:0; min-height:0; }.item-form { padding:16px 16px 24px; }.success { display:flex; flex-direction:column; align-items:center; gap:18px; padding:32px 16px; }
button:focus-visible { outline:2px solid #176ac7; outline-offset:2px; }input,textarea { caret-color:#176ac7; }
</style>
