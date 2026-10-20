<route lang="json5">
{ style: { navigationBarTitleText: '报价详情', disableScroll: true } }
</route>
<template>
    <view class="quotation-detail">
      <scroll-view scroll-y class="quotation-detail__body">
        <view class="quotation-detail__content">
          <view v-if="loading" class="quotation-detail__hint">正在加载报价详情…</view>
          <view v-else-if="error" class="quotation-detail__hint">{{ error }}<button @click="load">重新加载</button></view>
          <template v-else>
            <view class="quotation-detail__title">{{ record.candidateName || '报价单' }}</view>
            <view class="quotation-detail__hint">{{ projectLabel }}</view>
            <view class="quotation-detail__meta"><text>提交人</text><text>{{ submitterName || '未提供' }}</text></view>
            <view v-if="showCost" class="quotation-detail__meta"><text>成本总价</text><text>{{ quotationCostTotal === '—' ? '—' : `¥${quotationCostTotal}` }}</text></view>
            <view v-if="showFinalPrice" class="quotation-detail__meta"><text>报价总价</text><text>{{ quotationTotal === '—' ? '—' : `¥${quotationTotal}` }}</text></view>
            <view class="quotation-detail__meta"><text>报价状态</text><text>{{ statusText }}</text></view>
            <view class="quotation-detail__meta"><text>审批线路</text><text>{{ record.approvalRoute === 'MARKET' ? '市场审批' : record.approvalRoute === 'TECHNICAL' ? '技术审批' : record.approvalRoute || '—' }}</text></view>
            <view class="quotation-detail__meta"><text>定价 / 采用</text><text>{{ String(record.priced) === '1' ? '已定价' : '未定价' }} · {{ String(record.adopted) === '1' ? '已采用' : '未采用' }}</text></view>
            <view class="management-actions">
              <button v-if="capabilities.edit && permission.hasPageAccess('/pages/home/quotationEdit')" :disabled="submitting" @click="openEditor('edit')">修改报价</button>
              <button v-if="capabilities.price && permission.hasPageAccess('/pages/home/quotationEdit')" :disabled="submitting" @click="openEditor('price')">{{ String(record.priced) === '1' ? '解锁重新定价' : '市场定价' }}</button>
              <button :disabled="submitting" @click="historyVisible = true">操作记录</button>
              <button :disabled="submitting" @click="refreshDetails">刷新状态</button>
            </view>
            <view class="quotation-detail__meta"><text>创建时间</text><text>{{ record.createTime || '—' }}</text></view>
            <view v-if="record.remark" class="quotation-detail__meta"><text>备注</text><text>{{ record.remark }}</text></view>
            <view class="quotation-detail__section-title">报价明细</view>
            <view v-if="itemsLoading" class="quotation-detail__hint">正在加载明细…</view>
            <view v-else-if="itemsError" class="quotation-detail__hint">{{ itemsError }}<button @click="load">重试明细</button></view>
            <template v-else>
              <view v-if="!items.length" class="quotation-detail__hint">暂无报价明细</view>
              <template v-else>
                <view class="quotation-detail__table-toolbar"><button class="detail-link" :disabled="submitting" @click="documentPreviewVisible = true">报价单预览</button></view>
<scroll-view scroll-x class="quotation-detail__table-scroll">
                  <view class="quotation-detail__table quotation-detail__table--summary" :class="{ 'quotation-detail__table--two-totals': summaryColumns.filter(column => column.kind === 'price').length > 1 }" role="table" aria-label="报价物料明细">
                    <view class="quotation-detail__row quotation-detail__row--head" role="row">
                      <view class="quotation-detail__cell quotation-detail__cell--material" role="columnheader">名称</view>
                      <view v-for="column in summaryColumns" :key="column.key" class="quotation-detail__cell" :class="'quotation-detail__cell--' + column.kind" role="columnheader">{{ column.title }}</view>
                      <view class="quotation-detail__cell quotation-detail__cell--action" role="columnheader">操作</view>
                    </view>
                    <view v-for="item in items" :key="item.rowKey" class="quotation-detail__row" role="row">
                      <view class="quotation-detail__cell quotation-detail__cell--material" role="cell">
                        <text v-if="item.isFee" class="quotation-detail__fee-label">服务费</text>
                        <text class="quotation-detail__material-name" :title="quotationIdentity(item, brandNames)">{{ quotationIdentity(item, brandNames) }}</text>
                        <text class="quotation-detail__secondary">{{ item.isFee ? (item.taxRate == null ? '税率：—' : `税率：${item.taxRate}%`) : quotationModelPreview(item.model) }}</text>
                      </view>
                      <view v-for="column in summaryColumns" :key="column.key" class="quotation-detail__cell" :class="'quotation-detail__cell--' + column.kind" role="cell">{{ quotationCell(item, column.key) }}</view>
                      <view class="quotation-detail__cell quotation-detail__cell--action" role="cell"><button class="detail-link" :disabled="submitting" @click="openItem(item)">详情</button></view>
                    </view>
                  </view>
                </scroll-view>
              </template>
            </template>
            <view class="quotation-detail__pages"><button :disabled="submitting || itemsLoading || page <= 1" @click="page--">上一页</button><text>{{ page }} / {{ pageCount }} 页</text><button :disabled="submitting || itemsLoading || page >= pageCount" @click="page++">下一页</button></view>
          </template>
        </view>
      </scroll-view>
      <view class="quotation-detail__footer">
        <text v-if="actionError" class="action-error" role="alert">{{ actionError }}</text>
        <view v-if="!loading && !error && !processed" class="management-actions">
          <button v-if="capabilities.submit" :disabled="submitting" @click="operate('submit')">提交审批</button>
          <button v-if="capabilities.withdraw" :disabled="submitting" @click="operate('withdraw')">撤回审批</button>
          <button v-if="capabilities.void" :disabled="submitting" @click="operate('void')">作废报价</button>
        </view>
        <template v-if="canApprove">
          <view class="action-buttons"><button class="reject-button" :disabled="submitting" @click="rejectVisible = true">驳回</button><button :disabled="submitting" :loading="submitting" @click="review('1')">通过</button></view>
        </template>
        <text v-else-if="!loading && !error && !capabilities.submit && !capabilities.withdraw">{{ processed ? '操作已提交' : '可用操作由报价状态和当前权限决定' }}</text>
      </view>
      <QuotationHistory v-model="historyVisible" :period-id="periodId" :candidate-id="candidateId" />
      <QuotationDocumentPreview v-model="documentPreviewVisible" :title="record.candidateName || '项目报价清单'" :project-label="projectLabel" :status-text="statusText" :rows="rows" :show-price="showFinalPrice" :brands="brandNames" />
      <wd-popup v-model="drawerVisible" position="right" :safe-area-inset-bottom="false" :close-on-click-modal="false" :z-index="2100" custom-style="width:92%;max-width:480px;top:var(--window-top, 0px);bottom:0;height:auto;overflow:hidden;box-sizing:border-box;">
        <view class="item-drawer">
          <view class="quotation-detail__head"><text>{{ selected?.isFee ? '服务费详情' : '物料详情' }}</text><button @click="drawerVisible = false">关闭</button></view>
          <scroll-view scroll-y class="quotation-detail__body">
            <view class="quotation-detail__content" v-if="selected">
              <view class="quotation-detail__title">{{ selected.materialName }}</view>
              <view class="quotation-detail__section-title">{{ selected.isFee ? '服务费信息' : '物料信息' }}</view>
              <view v-if="materialLoading" class="quotation-detail__hint">正在加载物料基础信息…</view>
              <view v-if="materialError" class="action-error">{{ materialError }}<button @click="loadMaterial">重试物料信息</button></view>
              <view v-for="field in detailFields" :key="field.label" class="quotation-detail__meta"><text>{{ field.label }}</text><text>{{ field.value }}</text></view>
              <view class="quotation-detail__section-title">{{ selected.isFee ? '服务说明' : '参数信息' }}</view>
              <view class="material-parameters">{{ selected.isFee ? selected.description || '暂无服务说明' : materialDetail.specificationParams || selected.specificationParams || '暂无参数信息' }}</view>
              <view class="quotation-detail__section-title">报价信息</view>
              <view class="quotation-detail__meta"><text>报价数量</text><text>{{ selected.quantity ?? '—' }} {{ selected.unit || '' }}</text></view>
              <view v-if="showCost" class="quotation-detail__meta"><text>成本单价</text><text>{{ money(selected.basePrice) }}</text></view>
              <view v-if="showCost" class="quotation-detail__meta"><text>成本总价</text><text>{{ quotationLineTotal(selected.basePrice, selected.quantity) }}</text></view>
              <view v-if="showFinalPrice" class="quotation-detail__meta"><text>报价单价</text><text>{{ money(selected.finalPrice) }}</text></view>
              <view v-if="showFinalPrice" class="quotation-detail__meta"><text>报价总价</text><text>{{ quotationLineTotal(selected.finalPrice, selected.quantity) }}</text></view>
              <template v-if="showQuoteRatio">
                <view class="quotation-detail__meta"><text>报价比例（换算）</text><text>{{ quotationPercent(selected.basePrice, selected.finalPrice) }}</text></view>
                <view class="quotation-detail__hint">（报价单价 − 成本单价）÷ 成本单价 × 100%；成本为 0 或价格缺失时无法换算。</view>
              </template>
              <view v-if="!showCost && !showFinalPrice" class="quotation-detail__hint">暂无价格查看权限</view>
              <view class="quotation-detail__section-title">审批意见</view>
              <textarea v-if="canApprove" v-model="opinion" class="opinion-input" :maxlength="100" :cursor-spacing="80" aria-label="审批意见" placeholder="选填，最多100字" />
              <view v-else class="quotation-detail__hint">{{ selected.approvalOpinion || '暂无审批意见' }}</view>
              <view v-if="canApprove" class="quotation-detail__hint" :class="{ 'action-error': opinion.length > 100 }">{{ opinion.length }}/100 · {{ opinion.length > 100 ? '原意见超过100字，请缩短后保存' : '保存后随整单审批提交' }}</view>
            </view>
          </scroll-view>
          <view v-if="canApprove" class="quotation-detail__footer item-drawer__footer"><button :disabled="opinion.length > 100" @click="saveOpinion">保存意见</button></view>
        </view>
      </wd-popup>
      <wd-popup v-model="rejectVisible" position="bottom" :close-on-click-modal="!submitting" :z-index="2200" custom-style="border-radius:16px 16px 0 0;">
        <view class="reject-panel">
          <view class="quotation-detail__head"><text>驳回整张报价单</text><button :disabled="submitting" @click="rejectVisible = false">取消</button></view>
          <textarea v-model="rejectReason" class="opinion-input" :disabled="submitting" :maxlength="500" aria-label="驳回原因" placeholder="请填写驳回原因（必填，最多500字）" />
          <view v-if="actionError" class="action-error" role="alert">{{ actionError }}</view>
          <view class="quotation-detail__footer"><button :disabled="submitting" :loading="submitting" @click="review('0')">确认驳回</button></view>
        </view>
      </wd-popup>
    </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow, onUnload, onBackPress } from '@dcloudio/uni-app'
import { http } from '@/utils/http'
import { usePermissionStore } from '@/store/permission'
import QuotationDocumentPreview from './components/QuotationDocumentPreview.vue'
import { useUserStore } from '@/store/user'
import QuotationHistory from './components/QuotationHistory.vue'
import { quotationCapabilities, candidateAction, decimalInput } from '@/service/quotationEditor'
import { quotationDisplayColumns, quotationIdentity, quotationModelPreview, quotationCell, quotationPersonnelRoute, quotationPercent } from '@/utils/quotationTable'
import { quotationDocumentTotal } from '@/utils/quotationDocument'
import { approvalItems, canApproveQuotation, getQuotationAccess, getQuotationRecord, getQuotationMaterial, quotationLineTotal, quotationApprovalPayload, quotationPages, quotationVersion, unwrapQuotation } from '@/service/quotationApproval'

const permission = usePermissionStore()
const user = useUserStore()
const brandNames = ref<Record<string, string>>({}), personnelRoute = ref('')
const tableColumns = computed(() => quotationDisplayColumns(record.value, access.value, personnelRoute.value))
const summaryColumns = computed(() => tableColumns.value.filter(column => ['unit', 'quantity', 'costTotal', 'guideTotal'].includes(column.key)))
const loading = ref(true), error = ref(''), itemsLoading = ref(false), itemsError = ref('')
const record = ref<any>({}), access = ref<any>({}), projectLabel = ref('')
const submitterName = ref('')
const materials = ref<any[]>([]), fees = ref<any[]>([]), page = ref(1)
const submitting = ref(false), processed = ref(false), actionError = ref('')
const drawerVisible = ref(false), rejectVisible = ref(false), rejectReason = ref('')
const documentPreviewVisible = ref(false)
const historyVisible = ref(false)
const capabilities = computed(() => !loading.value && !error.value && !processed.value && permission.loaded ? quotationCapabilities(record.value, access.value, user.userInfo, permission.hasPermission) : {} as ReturnType<typeof quotationCapabilities>)
const selected = ref<any>(null), opinion = ref(''), dirty = ref(false)
const materialDetail = ref<any>({}), materialLoading = ref(false), materialError = ref('')
let materialSequence = 0
let periodId = '', candidateId = '', sequence = 0, active = true, leaving = false
const statusLabels: Record<string, string> = { '-1': '草稿', '0': '已驳回', '1': '审批通过', '2': '待审批', '4': '已作废' }
const statusText = computed(() => statusLabels[String(record.value.status)] || String(record.value.status ?? '—'))
const showCost = computed(() => access.value.canManage === true || access.value.canViewCost === true)
const showFinalPrice = computed(() => access.value.canManage === true || access.value.canViewQuote === true)
const showQuoteRatio = computed(() => access.value.canManage === true && showCost.value && showFinalPrice.value)
const canApprove = computed(() => !loading.value && !error.value && !itemsError.value && !processed.value &&
  materials.value.length > 0 && permission.loaded && canApproveQuotation(record.value, access.value, permission.hasPermission))
const rows = computed(() => [
  ...materials.value.map(row => ({ ...row, rowKey: 'material:' + row.id, isFee: false })),
  ...fees.value.map(row => ({ ...row, rowKey: 'fee:' + row.id, isFee: true,
    materialName: row.name || '未命名服务费', basePrice: row.costPrice, finalPrice: row.guidePrice })),
])
const pageCount = computed(() => Math.max(1, Math.ceil(rows.value.length / 10)))
const quotationTotal = computed(() => showFinalPrice.value ? quotationDocumentTotal(rows.value) : '—')
const quotationCostTotal = computed(() => showCost.value
  ? quotationDocumentTotal(rows.value.map(row => ({ finalPrice: row.basePrice, quantity: row.quantity })))
  : '—')
const items = computed(() => rows.value.slice((page.value - 1) * 10, page.value * 10))
const money = (value: any) => value == null || value === '' || !Number.isFinite(Number(value)) ? '—' : `¥${Number(value).toFixed(2)}`
const detailFields = computed(() => {
  const item = selected.value || {}
  const detail = materialDetail.value
  const fields = item.isFee ? [['类型', '服务费'], ['税率', item.taxRate == null ? '—' : item.taxRate + '%']]
    : [['物料名称', detail.materialName || item.materialName], ['物料编码', detail.materialCode || item.materialCode],
      ['类别', detail.materialCategory_dictText || detail.materialCategory], ['品牌', detail.brand_dictText || detail.brand || item.brand],
      ['规格型号', detail.model || item.model], ['库存', detail.stockQty == null ? '—' : String(detail.stockQty) + (detail.unit || '')]]
  return [...fields, ['数量', item.quantity], ['单位', item.unit], ['备注', item.remark]]
    .map(([label, value]) => ({ label, value: value == null || value === '' ? '—' : value }))
})
async function load() {
  const request = ++sequence
  const token = user.userInfo.token
  loading.value = true; error.value = ''; itemsError.value = ''; access.value = {}; itemsLoading.value = true
  try {
    if (!periodId || !candidateId) throw new Error('待办缺少项目分期或报价单 ID，请返回刷新待办')
    const [data, permissions, departments, brands] = await Promise.all([
      quotationPages('/project/materialCandidateItem/list', { candidateId }, true, periodId), getQuotationAccess(periodId, candidateId),
      http.get('/sys/sysDepart/queryTreeList').then(unwrapQuotation),
      http.get('/sys/dict/getDictItems/material_brand').then(unwrapQuotation).catch(() => []),
    ])
    if (!Array.isArray(departments)) throw new Error('部门信息加载失败，无法确认报价列规则，请重试')
    approvalItems(data.rows)
    if (!active || request !== sequence || token !== user.userInfo.token) return
    record.value = data.candidate; access.value = permissions
    projectLabel.value = [data.candidate.projectName, data.candidate.periodName].filter(Boolean).join('-') || '—'
    personnelRoute.value = quotationPersonnelRoute(user.identity.departmentIds, departments)
    brandNames.value = Object.fromEntries((Array.isArray(brands) ? brands : []).map(item => [String(item.value), String(item.text || item.label || item.value)]))
    materials.value = data.rows; fees.value = data.serviceFees; page.value = 1; dirty.value = false; processed.value = false
  } catch (e: any) { if (active && request === sequence) error.value = e?.message || '报价加载失败，请重试' }
  finally { if (active && request === sequence) { loading.value = false; itemsLoading.value = false } }
}
function openItem(item: any) {
  if (submitting.value) return
  selected.value = item; opinion.value = String(item.approvalOpinion ?? ''); drawerVisible.value = true
  void loadMaterial()
}
async function loadMaterial() {
  const request = ++materialSequence
  materialDetail.value = {}; materialError.value = ''; materialLoading.value = false
  if (!selected.value || selected.value.isFee) return
  materialLoading.value = true
  try {
    const detail = await getQuotationMaterial(String(selected.value.materialId || '').trim())
    if (active && request === materialSequence && drawerVisible.value) materialDetail.value = detail
  } catch (e: any) {
    if (active && request === materialSequence && drawerVisible.value) materialError.value = e?.message || '物料信息加载失败'
  } finally { if (request === materialSequence) materialLoading.value = false }
}
function saveOpinion() {
  if (!canApprove.value || !selected.value || submitting.value) return
  const source = selected.value.isFee ? fees.value : materials.value
  const row = source.find(item => String(item.id) === String(selected.value.id))
  if (!row || opinion.value.length > 100) return
  if (String(row.approvalOpinion ?? '') !== opinion.value) { row.approvalOpinion = opinion.value; dirty.value = true }
  drawerVisible.value = false
}
function openEditor(mode: 'edit' | 'price') {
  if (submitting.value || dirty.value) { actionError.value = '请先处理尚未提交的审批意见'; return }
  if (!(mode === 'price' ? capabilities.value.price : capabilities.value.edit)) return
  uni.navigateTo({ url: `/pages/home/quotationEdit?periodId=${encodeURIComponent(periodId)}&candidateId=${encodeURIComponent(candidateId)}&mode=${mode}` })
}
async function refreshDetails() {
  if (submitting.value) return
  if (dirty.value) {
    const confirmed = await new Promise<boolean>(resolve => uni.showModal({ title: '重新加载报价？', content: '未提交的审批意见将被清除。', success: res => resolve(!!res.confirm), fail: () => resolve(false) }))
    if (!confirmed) return
  }
  actionError.value = ''; await load()
}
async function operate(action: 'submit' | 'withdraw' | 'void') {
  if (submitting.value || !capabilities.value[action]) return
  const titles = { submit: '提交报价审批', withdraw: '撤回报价审批', void: '作废报价' }
  const messages = { submit: '将提交当前已保存的报价及全部明细。确认提交？', withdraw: '撤回后恢复草稿，并关闭本次审批待办。确认撤回？', void: '作废后此报价将不可继续使用。确认作废？' }
  submitting.value = true; actionError.value = ''
  let attempted = false
  const token = user.userInfo.token
  try {
    const confirmed = await new Promise<boolean>(resolve => uni.showModal({ title: titles[action], content: messages[action], success: res => resolve(!!res.confirm), fail: () => resolve(false) }))
    if (!confirmed || !active || token !== user.userInfo.token) return
    const [latest, rights] = await Promise.all([getQuotationRecord(periodId, candidateId), getQuotationAccess(periodId, candidateId)])
    if (!active || token !== user.userInfo.token) return
    if (quotationVersion(latest.version) !== quotationVersion(record.value.version)) throw new Error('报价已变化，请重新加载后核对')
    if (!quotationCapabilities(latest, rights, user.userInfo, permission.hasPermission)[action]) throw new Error('当前状态或权限不允许操作')
    if (action === 'submit' && (latest.approvalRoute === 'MARKET' || personnelRoute.value === 'MARKET')) {
      for (const row of materials.value) { decimalInput(row.basePrice, '成本价'); decimalInput(row.finalPrice, '报价') }
      for (const row of fees.value) { decimalInput(row.costPrice, '服务费成本价'); decimalInput(row.guidePrice, '服务费报价') }
    }
    attempted = true
    const updated = await candidateAction(action, record.value)
    if (!active || token !== user.userInfo.token) return
    processed.value = true; dirty.value = false
    if (action === 'submit' && String(updated?.id) === candidateId && String(updated.status) === '2' && quotationVersion(updated.version) > quotationVersion(record.value.version)) {
      record.value = updated; access.value = await getQuotationAccess(periodId, candidateId); processed.value = false
    } else await load()
    uni.showToast({ title: '操作成功', icon: 'success' })
  } catch (e: any) {
    if (attempted) { processed.value = true; actionError.value = `${e?.message || '操作失败'}，请重新进入核实状态，勿重复提交。` }
    else actionError.value = e?.message || '操作失败'
  } finally { submitting.value = false }
}
async function review(result: '0' | '1') {
  if (submitting.value || !canApprove.value) return
  actionError.value = ''
  if (result === '0' && !rejectReason.value.trim()) { actionError.value = '请填写驳回原因'; return }
  submitting.value = true
  try {
    if (result === '1') {
      const confirmed = await new Promise<boolean>(resolve => uni.showModal({
        title: '通过整张报价单', content: '确认通过该报价单？所有已保存的物料及服务费意见将一并提交。',
        success: res => resolve(Boolean(res.confirm)), fail: () => resolve(false),
      }))
      if (!confirmed || !active) return
    }
    const [latest, permissions] = await Promise.all([getQuotationRecord(periodId, candidateId), getQuotationAccess(periodId, candidateId)])
    if (!active) return
    access.value = permissions
    if (!canApproveQuotation(latest, permissions, permission.hasPermission)) throw new Error('状态或权限已变化，当前不可审批')
    if (quotationVersion(latest.version) !== quotationVersion(record.value.version)) throw new Error('报价已被修改，请返回重新进入核对后审批；本页意见未提交')
    const payload = quotationApprovalPayload(record.value, materials.value, fees.value, result, rejectReason.value)
    const response = await http.post('/project/materialCandidate/approve', payload)
    unwrapQuotation(response)
    if (!active) return
    processed.value = true; dirty.value = false; rejectVisible.value = false
    // 已提交后先关闭动作，不能因详情刷新失败再次提交。
    record.value = { ...record.value, status: result }
    uni.showToast({ title: result === '1' ? '整单审批已通过' : '整单已驳回', icon: 'success' })
  } catch (e: any) { if (active) actionError.value = e?.message || '提交失败，请核实状态后重试；填写意见已保留' }
  finally { submitting.value = false }
}
onLoad(options => {
  periodId = String(options?.periodId || '').trim()
  candidateId = String(options?.candidateId || '').trim()
  try { projectLabel.value = decodeURIComponent(String(options?.projectLabel || '')) } catch { projectLabel.value = '' }
  try { submitterName.value = decodeURIComponent(String(options?.submitterName || '')) } catch { submitterName.value = '' }
  void load()
})
let shown = false
onShow(() => {
  if (!shown) { shown = true; return }
  if (!submitting.value && !dirty.value) void load()
})
onUnload(() => { active = false; sequence++ })
onBackPress(() => {
  if (leaving) return false
  if (submitting.value) return true
  if (drawerVisible.value) { drawerVisible.value = false; return true }
  if (rejectVisible.value) { rejectVisible.value = false; return true }
  if (documentPreviewVisible.value) { documentPreviewVisible.value = false; return true }
  if (historyVisible.value) { historyVisible.value = false; return true }
  if (!dirty.value && !rejectReason.value.trim()) return false
  uni.showModal({ title: '离开报价详情？', content: '尚未提交的审批意见将丢失。',
    success: res => { if (res.confirm) { leaving = true; uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/home/index' }) }) } },
  })
  return true
})
</script>

<style scoped>
.management-actions { display:flex; gap:8px; flex-wrap:wrap; margin:12px 0; }
.management-actions button { margin:0; min-height:44px; line-height:44px; font-size:14px; padding:0 12px; border-radius:8px; background:#edf4ff; color:#176ac7; }
.management-actions button::after { border:none; }
.quotation-detail { display:flex; flex-direction:column; height:calc(100vh - var(--window-top, 0px)); height:calc(100dvh - var(--window-top, 0px)); max-width:960px; margin:auto; background:#fff; color:#333; font-size:14px; line-height:1.6; box-sizing:border-box; padding-bottom:env(safe-area-inset-bottom, 0px); }
.quotation-detail__head { display:flex; align-items:center; justify-content:space-between; padding:8px 16px; border-bottom:1px solid #edf0f3; flex-shrink:0; font-size:17px; font-weight:600; }
.quotation-detail button { min-height:44px; margin:0; font-size:14px; line-height:1.6; padding:10px 16px; border-radius:8px; }
.quotation-detail__head button { background:transparent; padding:10px; }
.quotation-detail__head button::after { border:0; }
.quotation-detail__body { flex:1; height:0; min-height:0; }
.quotation-detail__content { padding:20px 16px; }
.quotation-detail__title { font-size:17px; font-weight:600; overflow-wrap:anywhere; }
.quotation-detail__hint { color:#667085; font-size:13px; margin:8px 0 16px; overflow-wrap:anywhere; }
.quotation-detail__meta { display:flex; gap:16px; justify-content:space-between; margin-top:8px; }
.quotation-detail__meta > text:first-child { color:#667085; flex-shrink:0; }
.quotation-detail__meta > text:last-child { text-align:right; overflow-wrap:anywhere; min-width:0; }
.quotation-detail__section-title { font-size:16px; font-weight:600; margin-top:24px; padding-bottom:12px; border-bottom:1px solid #edf0f3; }
.quotation-detail__table-hint { margin:8px 0; color:#667085; font-size:12px; }
.quotation-detail__table-toolbar { display:flex; align-items:center; justify-content:space-between; gap:8px; }
.quotation-detail__table-scroll { width:100%; border:1px solid #e4e7ec; border-radius:8px; box-sizing:border-box; overflow:hidden; }
.quotation-detail__table { display:table; width:100%; font-size:13px; }
.quotation-detail__row { display:table-row; }
.quotation-detail__row:nth-child(odd) { background:#f8fafc; }
.quotation-detail__row--head { background:#eef3f9 !important; color:#475467; font-weight:600; }
.quotation-detail__cell { display:table-cell; padding:12px; border-bottom:1px solid #e4e7ec; border-right:1px solid #edf0f3; vertical-align:top; box-sizing:border-box; overflow-wrap:anywhere; }
.quotation-detail__row:last-child .quotation-detail__cell { border-bottom:0; }
.quotation-detail__cell:last-child { border-right:0; }
.quotation-detail__cell--material { width:160px; min-width:160px; max-width:160px; position:sticky; left:0; z-index:1; background:#fff; }
.quotation-detail__row--head .quotation-detail__cell--material { background:#eef3f9; }
.quotation-detail__fee-label { display:inline-block; color:#176ac7; font-size:12px; margin-bottom:4px; }
.quotation-detail__cell--number { min-width:88px; text-align:right; font-variant-numeric:tabular-nums; }
.quotation-detail__cell--unit { min-width:64px; }
.quotation-detail__cell--price { min-width:120px; text-align:right; white-space:nowrap; font-variant-numeric:tabular-nums; }
.quotation-detail__cell--opinion { min-width:200px; max-width:240px; }
.quotation-detail__material-name { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; overflow-wrap: anywhere; white-space: normal; line-height: 1.5; font-weight: 500; }
.quotation-detail__secondary { display:block; color:#667085; font-size:12px; margin-top:4px; }
.quotation-detail__pages { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-top:16px; }
.quotation-detail__footer { flex-shrink:0; padding:12px 16px; border-top:1px solid #edf0f3; }
.quotation-detail__footer > text { display:block; color:#667085; font-size:12px; margin-bottom:8px; text-align:center; }
.quotation-detail__footer button { width:100%; color:#fff; background:#176ac7; }
.quotation-detail button:focus-visible { outline:2px solid #176ac7; outline-offset:2px; }
.quotation-detail__cell--action { min-width:88px; position:sticky; right:0; background:#fff; text-align:center; }
.quotation-detail__table--summary .quotation-detail__cell { padding:10px 6px; vertical-align:middle; }
.quotation-detail__table--summary { table-layout: fixed; width:100%; min-width:0; }
.quotation-detail__table--summary .quotation-detail__cell--material { position:static; width:auto; min-width:0; max-width:none; }
.quotation-detail__table--summary .quotation-detail__cell--unit { width:12%; min-width:0; text-align:center; }
.quotation-detail__table--summary .quotation-detail__cell--number { width:14%; min-width:0; }
.quotation-detail__table--summary .quotation-detail__cell--price { width:26%; min-width:0; white-space:normal; overflow-wrap:anywhere; }
.quotation-detail__table--two-totals .quotation-detail__cell--unit { width:10%; }
.quotation-detail__table--two-totals .quotation-detail__cell--number { width:11%; }
.quotation-detail__table--two-totals .quotation-detail__cell--price { width:19%; }
.quotation-detail__table--summary .quotation-detail__cell--action { position:static; width:44px; min-width:44px; padding:8px 0; }
.quotation-detail__table--summary .quotation-detail__cell--action .detail-link { width:44px; min-height:44px; padding:10px 0; }
.quotation-detail__row--head .quotation-detail__cell--action { background:#eef3f9; }
.quotation-detail .detail-link { padding:8px; background:transparent; color:#176ac7; }
.detail-link::after { border:0; }
.item-drawer { display:flex; flex-direction:column; height:calc(100vh - var(--window-top, 0px)); height:calc(100dvh - var(--window-top, 0px)); max-height:100%; min-height:0; overflow:hidden; box-sizing:border-box; background:#fff; }
.item-drawer__footer { flex:none; background:#fff; padding-bottom:calc(12px + env(safe-area-inset-bottom, 0px)); }
.material-parameters { margin-top:12px; white-space:pre-wrap; overflow-wrap:anywhere; line-height:1.7; }
.opinion-input { display:block; width:100%; min-height:128px; padding:12px; margin-top:12px; border:1px solid #cfd6e0; border-radius:8px; font-size:16px; line-height:1.6; box-sizing:border-box; }
.action-buttons { display:flex; gap:12px; }
.action-buttons button { flex:1; }
.quotation-detail__footer .reject-button { background:#fff1f0; color:#b42318; }
.quotation-detail .action-error { color:#b42318; white-space:pre-wrap; margin:8px 0; }
.reject-panel { padding:0 16px calc(16px + env(safe-area-inset-bottom, 0px)); }
.quotation-detail button[disabled] { opacity:0.5; }
</style>
