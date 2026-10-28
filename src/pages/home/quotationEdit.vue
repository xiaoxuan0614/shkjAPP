<route lang="json5">
{ style: { navigationBarTitleText: '编辑报价', navigationStyle: 'custom', disableScroll: true } }
</route>
<template>
  <PageLayout :navTitle="pricing ? '市场定价' : record.id ? '修改报价' : '新建报价'" navLeftText="返回" navBackgroundColor="#176ac7" type="popup" @navBack="back">
    <scroll-view scroll-y class="editor-body">
      <view class="editor-content">
        <view v-if="loading" class="notice">正在加载报价…</view>
        <view v-else-if="fatal" class="notice error">{{ fatal }}<button @click="load">重新加载</button></view>
        <template v-else>
          <view class="section">
            <view class="section-title">项目信息</view>
            <button v-if="!record.id" class="project-choice" :disabled="busy" @click="openPicker('project')">{{ projectLabel || '选择主项目及分期' }}<wd-icon name="arrow-right" size="16px" /></button>
            <view v-else class="project-name">{{ projectLabel }}</view>
            <label class="field"><text>报价单名称</text><input v-model="name" :disabled="!!record.id || busy" :maxlength="100" placeholder="请输入报价单名称" @input="dirty = true" /></label>
            <view class="notice">{{ pricing ? '仅维护加价比例与指导价，成本及明细结构不可改。指导价=成本×（1+加价比例÷100），修改指导价自动反算比例。' : direct ? '填写成本价和报价，保存草稿后提交审批。' : '填写成本价及明细，技术审批通过后再进行市场定价。' }}</view>
            <view v-if="record.id && String(record.adopted) === '1'" class="notice">此报价已采用，物料、单位、数量和成本价已锁定。</view>
          </view>
          <view class="section">
            <view class="section-heading"><text class="section-title">报价明细 · {{ materials.length + fees.length }} 项</text><text class="secondary">每页 10 项</text></view>
            <view v-if="canStructure" class="toolbar"><button :disabled="busy || !periodId" @click="openPicker('material')">添加物料</button><button :disabled="busy || !periodId" @click="openPicker('fee')">添加服务费</button></view>
            <view v-if="!displayRows.length" class="notice">暂未添加物料或服务费</view>
            <ReadOnlyTable v-if="displayRows.length" class="items-table" label="报价明细" :columns="columns" :rows="visibleRows" min-width="480px">
              <template #cell="{ row: item, column }">
                <view v-if="column.key === 'name'"><text>{{ item.fee ? item.row.name : item.row.materialName }}</text><text class="secondary">{{ item.fee ? '服务费' : [item.row.materialCode, item.row.model].filter(Boolean).join(' · ') }}</text></view>
                <text v-else-if="column.key === 'quantity'">{{ item.row.quantity }} {{ item.row.unit }}</text>
                <text v-else-if="column.key === 'cost'">{{ lineTotal(item, true) }}</text>
                <text v-else-if="column.key === 'quote'">{{ lineTotal(item, false) }}</text>
                <button v-else class="text-button" :disabled="busy" @click="openItem(item)">填写</button>
              </template>
            </ReadOnlyTable>
            <view v-if="displayRows.length" class="pagination"><button :disabled="page <= 1 || busy" @click="page--">上一页</button><text>{{ page }} / {{ pages }}</text><button :disabled="page >= pages || busy" @click="page++">下一页</button></view>
          </view>
          <view class="section totals"><text v-if="showCost">成本总价 <strong>{{ costTotal }}</strong></text><text v-if="showQuote">报价总价 <strong>{{ quoteTotal }}</strong></text></view>
        </template>
      </view>
    </scroll-view>
    <wd-popup :model-value="itemOpen" position="bottom" :close-on-click-modal="false" :z-index="2500" custom-style="height:80vh;border-radius:16px 16px 0 0;overflow:hidden;" @update:model-value="closeItem">
      <view class="item-panel">
        <view class="item-heading"><text class="section-title">{{ pricing ? '明细定价' : '填写报价明细' }}</text><button class="text-button" @click="closeItem">取消</button></view>
        <scroll-view scroll-y class="item-body">
            <view v-if="draftItem" class="item-form">
              <template v-for="item in [draftItem]" :key="item.key">
              <view class="line-head"><view><text class="line-name">{{ item.fee ? item.row.name : item.row.materialName }}</text><text class="secondary">{{ item.fee ? '服务费' : [item.row.materialCode, item.row.model].filter(Boolean).join(' · ') }}</text></view><button v-if="canStructure" class="danger" :disabled="busy" @click="remove(item)">删除</button></view>
              <view class="fields">
                <label class="field"><text>数量</text><input v-model="item.row.quantity" type="digit" :disabled="!canStructure || busy" /></label>
                <label v-if="item.fee" class="field"><text>单位</text><input v-model="item.row.unit" :maxlength="50" :disabled="!canStructure || busy" /></label>
                <view v-else class="field"><text>单位</text><picker :disabled="!canStructure || busy || itemLoading || !!unitError" :range="item.row._units || []" range-key="label" @change="changeUnit(item.row, $event)"><view class="select-control">{{ itemLoading ? '正在加载…' : item.row.unit || '请选择单位' }}<wd-icon v-if="canStructure" name="arrow-down" size="14px" /></view></picker><button v-if="unitError" class="text-button" @click="loadItemUnits">单位加载失败，重试</button></view>
                <label v-if="showCost" class="field"><text>成本单价（元）</text><input v-model="item.row[item.fee ? 'costPrice' : 'basePrice']" type="digit" :disabled="!canCost || busy" @input="syncRate(item)" /></label>
                <label v-if="showRate && !direct" class="field"><text>加价比例（%）</text><input v-model="item.row.markupRate" type="text" placeholder="0.00" :disabled="!canPrice || busy" @input="changeRate(item)" @blur="normalizeGuide(item, true)" /></label>
                <label v-if="showQuote" class="field"><text>{{ direct ? '报价' : '指导价' }}（元）</text><input v-model="item.row[item.fee ? 'guidePrice' : 'finalPrice']" type="digit" placeholder="0.00" :disabled="!canPrice || busy" @input="syncRate(item)" @blur="normalizeGuide(item, false)" /></label>
              </view>
              <view v-if="item.row._error" class="error" role="alert">{{ item.row._error }}</view>
              <label class="field"><text>备注</text><input v-model="item.row.remark" :disabled="pricing || busy" :maxlength="500" placeholder="选填" /></label>
              </template>
            </view>
        </scroll-view>
        <view class="editor-footer"><text v-if="itemError || unitError" class="error" role="alert">{{ itemError || unitError }}</text><button class="primary" :disabled="itemLoading || !!unitError || !allowed" @click="confirmItem">确认本项</button></view>
      </view>
    </wd-popup>
    <view class="editor-footer"><text v-if="actionError" class="error" role="alert">{{ actionError }}</text><view class="footer-actions"><button :disabled="busy" @click="back">取消</button><button class="primary" :disabled="loading || !!fatal || !periodId || busy || !allowed" :loading="busy" @click="save">{{ pricing ? '确认定价' : '保存草稿' }}</button></view></view>
    <QuotationPicker v-model="pickerOpen" :kind="pickerKind" :excluded="pickerKind === 'material' ? materials.map(row => String(row.materialId)) : pickerKind === 'fee' ? fees.map(row => String(row.serviceFeeId)) : []" @select="select" />
  </PageLayout>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onUnload, onBackPress } from '@dcloudio/uni-app'
import { http } from '@/utils/http'
import { useUserStore } from '@/store/user'
import { usePermissionStore } from '@/store/permission'
import { quotationPersonnelRoute, quotationPercent } from '@/utils/quotationTable'
import { quotationDocumentTotal } from '@/utils/quotationDocument'
import { quotationPages, quotationVersion, getQuotationAccess, getQuotationRecord, unwrapQuotation } from '@/service/quotationApproval'
import { quotationCapabilities, materialPayload, feePayload, pricingPayload, guidancePrice, candidateAction, decimalInput } from '@/service/quotationEditor'
import QuotationPicker from './components/QuotationPicker.vue'
import ReadOnlyTable from '@/components/ReadOnlyTable/ReadOnlyTable.vue'
import type { ReadOnlyColumn } from '@/components/ReadOnlyTable/types'

const user = useUserStore(), permission = usePermissionStore()
const record = ref<any>({}), access = ref<any>({}), periodId = ref(''), candidateId = ref(''), projectLabel = ref(''), name = ref(''), personnelRoute = ref('')
const materials = ref<any[]>([]), fees = ref<any[]>([]), page = ref(1), pricing = ref(false)
const loading = ref(true), busy = ref(false), fatal = ref(''), actionError = ref(''), dirty = ref(false)
const pickerOpen = ref(false), pickerKind = ref<'project' | 'material' | 'fee'>('project')
const itemOpen = ref(false), draftItem = ref<any>(null), itemLoading = ref(false), itemError = ref(''), unitError = ref('')
let originalItem: any = null, itemSequence = 0
let sequence = 0, active = true, leaving = false, pendingCreate = false, writeUncertain = false
const session = () => String(user.userInfo.token || '')
const caps = computed(() => quotationCapabilities(record.value, access.value, user.userInfo, permission.hasPermission))
const creating = computed(() => !record.value.id)
const allowed = computed(() => permission.loaded && (creating.value ? permission.hasPermission('plan:quotation:add') && !!personnelRoute.value : pricing.value ? caps.value.price : caps.value.edit))
const direct = computed(() => record.value.approvalRoute === 'MARKET' || personnelRoute.value === 'MARKET' && ['-1', '0', '2'].includes(String(record.value.status ?? '-1')))
const canStructure = computed(() => allowed.value && !pricing.value && (creating.value || caps.value.structure))
const canCost = computed(() => allowed.value && !pricing.value && (creating.value || caps.value.cost))
const canPrice = computed(() => allowed.value && (pricing.value || direct.value || access.value.canManage === true))
const showCost = computed(() => creating.value || access.value.canManage === true || access.value.canViewCost === true)
const showRate = computed(() => access.value.canManage === true)
const showQuote = computed(() => creating.value && direct.value || access.value.canManage === true || access.value.canViewQuote === true)
const displayRows = computed(() => [...materials.value.map((row, i) => ({ row, fee: false, key: `m${row.id || row.materialId || i}` })), ...fees.value.map((row, i) => ({ row, fee: true, key: `f${row.id || row.serviceFeeId || i}` }))])
const pages = computed(() => Math.max(1, Math.ceil(displayRows.value.length / 10)))
const visibleRows = computed(() => displayRows.value.slice((page.value - 1) * 10, page.value * 10))
const columns = computed<ReadOnlyColumn[]>(() => [
  { key: 'name', label: '物料 / 服务费', width: 'minmax(140px, 1.7fr)' },
  { key: 'quantity', label: '数量', width: 'minmax(70px, .8fr)', align: 'right' },
  ...(showCost.value ? [{ key: 'cost', label: '成本总价', width: 'minmax(90px, 1fr)', align: 'right' as const }] : []),
  ...(showQuote.value ? [{ key: 'quote', label: '报价总价', width: 'minmax(90px, 1fr)', align: 'right' as const }] : []),
  { key: 'action', label: '操作', width: '60px', align: 'center' },
])
function lineTotal(item: any, cost: boolean) {
  const field = cost ? item.fee ? 'costPrice' : 'basePrice' : item.fee ? 'guidePrice' : 'finalPrice'
  const value = quotationDocumentTotal([{ finalPrice: item.row[field], quantity: item.row.quantity }])
  return value === '—' ? '—' : `¥${value}`
}
async function openItem(item: any) {
  if (busy.value || !allowed.value) return
  originalItem = item
  draftItem.value = { ...item, row: { ...item.row, _units: (item.row._units || []).map((unit: any) => ({ ...unit })) } }
  itemOpen.value = true; itemError.value = ''; unitError.value = ''; itemLoading.value = false; itemSequence++
  if (!item.fee && canStructure.value && !item.row._unitsLoaded) await loadItemUnits()
}
async function loadItemUnits() {
  if (!draftItem.value || itemLoading.value) return
  const request = ++itemSequence, draft = draftItem.value
  itemLoading.value = true; unitError.value = ''
  try { await populateUnits(draft.row) }
  catch (e: any) { if (request === itemSequence) unitError.value = e?.message || '单位加载失败' }
  finally { if (request === itemSequence) itemLoading.value = false }
}
function closeItem() { itemSequence++; itemOpen.value = false; draftItem.value = null; originalItem = null; itemLoading.value = false }
function confirmItem() {
  if (!allowed.value || itemLoading.value || unitError.value || !draftItem.value || !originalItem) return
  try {
    const { row, fee } = draftItem.value
    if (row._error) throw new Error(row._error)
    if (canPrice.value) {
      const field = fee ? 'guidePrice' : 'finalPrice'
      row[field] = decimalInput(row[field] == null || row[field] === '' ? 0 : row[field], '指导价').toFixed(2)
      syncRate(draftItem.value)
    }
    if (pricing.value) pricingPayload(fee ? [] : [row], fee ? [row] : [])
    else if (fee) feePayload(row, { cost: canCost.value, price: canPrice.value, structure: canStructure.value, direct: direct.value })
    else materialPayload(row, { cost: canCost.value, price: canPrice.value, direct: direct.value })
    Object.assign(originalItem.row, row); dirty.value = true; closeItem()
  } catch (e: any) { itemError.value = e?.message || '请检查填写内容' }
}
const amount = (cost: boolean) => {
  const rows = [...materials.value.map(row => ({ finalPrice: cost ? row.basePrice : row.finalPrice, quantity: row.quantity })), ...fees.value.map(row => ({ finalPrice: cost ? row.costPrice : row.guidePrice, quantity: row.quantity }))]
  const result = quotationDocumentTotal(rows)
  return result === '—' ? '价格未填写完整' : `¥${result}`
}
const costTotal = computed(() => amount(true)), quoteTotal = computed(() => amount(false))
async function load() {
  const request = ++sequence, token = session()
  loading.value = true; fatal.value = ''; access.value = {}
  try {
    const departments = unwrapQuotation(await http.get('/sys/sysDepart/queryTreeList'))
    if (!Array.isArray(departments)) throw new Error('部门信息不完整，请重试')
    if (!active || request !== sequence || token !== session()) return
    personnelRoute.value = quotationPersonnelRoute(user.identity.departmentIds, departments)
    if (candidateId.value) {
      const [data, rights] = await Promise.all([quotationPages('/project/materialCandidateItem/list', { candidateId: candidateId.value }, true, periodId.value), getQuotationAccess(periodId.value, candidateId.value)])
      if (!active || request !== sequence || token !== session()) return
      if (!['-1', '0', '1', '2', '4'].includes(String(data.candidate.status)) || !['0', '1'].includes(String(data.candidate.adopted))) throw new Error('报价状态不完整，请刷新')
      record.value = data.candidate; access.value = rights; name.value = record.value.candidateName
      projectLabel.value = [record.value.projectName, record.value.periodName].filter(Boolean).join('-')
      materials.value = data.rows.map(row => ({ ...row, _units: row.unitId ? [{ value: String(row.unitId), label: row.unit || '原单位' }] : [] }))
      fees.value = data.serviceFees.map(row => ({ ...row }))
      for (const item of [...materials.value.map(row => ({ row, fee: false })), ...fees.value.map(row => ({ row, fee: true }))]) syncRate(item)
    } else if (!personnelRoute.value) throw new Error('无法确认报价所属部门，请确认市场部或技术部归属后重试')
    if (!allowed.value) throw new Error('当前状态或账号权限不允许此操作')
    page.value = 1; dirty.value = false; writeUncertain = false
  } catch (e: any) { if (active && request === sequence) fatal.value = e?.message || '报价加载失败' }
  finally { if (active && request === sequence) loading.value = false }
}
function openPicker(kind: 'project' | 'material' | 'fee') { if (busy.value) return; pickerKind.value = kind; pickerOpen.value = true }
async function select(source: any) {
  if (busy.value || !allowed.value) return
  if (pickerKind.value === 'project') {
    if (record.value.id) return
    if (materials.value.length || fees.value.length) {
      const confirmed = await new Promise<boolean>(resolve => uni.showModal({ title: '切换项目？', content: '切换项目会清空当前未保存的物料和服务费。', success: result => resolve(!!result.confirm), fail: () => resolve(false) }))
      if (!confirmed) return
    }
    periodId.value = String(source.periodId); projectLabel.value = [source.projectName, source.periodName].filter(Boolean).join('-')
    name.value = `${source.projectName || ''}${source.periodName || ''}报价单`
    materials.value = []; fees.value = []; page.value = 1; dirty.value = true
    pickerOpen.value = false; return
  }
  if (!canStructure.value) return
  if (pickerKind.value === 'material') {
    if (materials.value.some(row => String(row.materialId) === String(source.id))) return
    const row = { ...source, id: undefined, materialId: source.id, quantity: 1, unitId: '', unit: '', basePrice: direct.value ? 0 : source.costPrice ?? 0, finalPrice: Number(source.guidePrice ?? 0).toFixed(2), _sourceGuidePrice: source.guidePrice ?? 0, markupRate: '0.00', remark: '', _units: [] }
    syncRate({ row, fee: false })
    busy.value = true
    try { await populateUnits(row); materials.value.push(row) }
    catch (e: any) { actionError.value = e?.message || '物料单位加载失败，请重试'; return }
    finally { busy.value = false }
  } else {
    if (fees.value.some(row => String(row.serviceFeeId) === String(source.id))) return
    const row = { serviceFeeId: source.id, name: source.name, description: source.description || '', unit: source.unit || '项', quantity: 1, costPrice: source.costPrice ?? '', markupRate: '0.00', taxRate: source.taxRate ?? source.markupRate, guidePrice: Number(source.guidePrice ?? 0).toFixed(2), remark: '' }
    syncRate({ row, fee: true })
    fees.value.push(row)
  }
  page.value = pages.value; dirty.value = true; pickerOpen.value = false
}
async function populateUnits(row: any) {
  const token = session()
  const detail = Array.isArray(row.unitList) && row.unitList.length ? { ...row, id: row.materialId } : unwrapQuotation(await http.get('/stock/material/queryById', { id: row.materialId }))
  if (!active || token !== session()) throw new Error('登录状态已变化，请重新进入')
  if (String(detail?.id) !== String(row.materialId) || !Array.isArray(detail.unitList)) throw new Error('物料单位信息不完整')
  row._units = detail.unitList.filter((unit: any) => unit.id && unit.unitName).map((unit: any) => ({ value: String(unit.id), label: unit.unitName }))
  row._unitsLoaded = true
  if (row.unitId && !row._units.some((unit: any) => unit.value === String(row.unitId))) row._units.unshift({ value: String(row.unitId), label: row.unit || '原单位' })
  if (!row.unitId) {
    const base = detail.unitList.find((unit: any) => unit.isBaseUnit === true || String(unit.isBaseUnit) === '1')
    const first = row._units.find((unit: any) => unit.value === String(base?.id)) || row._units[0]
    if (!first) throw new Error('该物料尚未配置单位')
    row.unitId = first.value; row.unit = first.label
  }
}
function changeUnit(row: any, event: any) { if (!canStructure.value || busy.value) return; const unit = row._units[Number(event.detail.value)]; if (unit) { row.unitId = unit.value; row.unit = unit.label } }
function syncRate(item: any) {
  const rate = quotationPercent(item.row[item.fee ? 'costPrice' : 'basePrice'], item.row[item.fee ? 'guidePrice' : 'finalPrice'])
  item.row.markupRate = rate === '—' ? '' : rate.replace('%', '')
  item.row._error = ''
}
function normalizeGuide(item: any, rate: boolean) {
  if (!canPrice.value || busy.value) return
  const field = rate ? 'markupRate' : item.fee ? 'guidePrice' : 'finalPrice'
  const value = item.row[field] == null || item.row[field] === '' ? 0 : item.row[field]
  try {
    if (rate) {
      const price = guidancePrice(item.row[item.fee ? 'costPrice' : 'basePrice'], value)
      item.row.markupRate = Number(value).toFixed(2)
      item.row[item.fee ? 'guidePrice' : 'finalPrice'] = price
      item.row._error = ''
    } else {
      item.row[field] = decimalInput(value, '指导价').toFixed(2)
      syncRate(item)
    }
  } catch (e: any) { item.row._error = e.message }
}
function changeRate(item: any) { try { item.row[item.fee ? 'guidePrice' : 'finalPrice'] = guidancePrice(item.row[item.fee ? 'costPrice' : 'basePrice'], item.row.markupRate || 0); item.row._error = '' } catch (e: any) { item.row._error = e.message } }
function remove(item: any) { if (!canStructure.value || busy.value || !originalItem) return; const source = originalItem.row; if (item.fee) fees.value = fees.value.filter(row => row !== source); else materials.value = materials.value.filter(row => row !== source); page.value = Math.min(page.value, pages.value); dirty.value = true; closeItem() }
async function save() {
  if (busy.value || loading.value || fatal.value || !allowed.value || itemOpen.value) return
  if (writeUncertain) { actionError.value = '上次请求结果不确定，请返回列表核实，勿重复提交'; return }
  busy.value = true; actionError.value = ''
  const token = session()
  let attempted = false
  try {
    if (pricing.value) {
      const confirmed = await new Promise<boolean>(resolve => uni.showModal({ title: '确认整单定价', content: '按当前全部物料和服务费的加价比例、指导价保存定价结果？', success: result => resolve(!!result.confirm), fail: () => resolve(false) }))
      if (!confirmed) return
    }
    if (!periodId.value || !name.value.trim()) throw new Error('请选择项目并填写报价单名称')
    const rights = await getQuotationAccess(periodId.value, candidateId.value)
    if (!active || token !== session()) return
    access.value = rights
    if (candidateId.value) {
      const latest = await getQuotationRecord(periodId.value, candidateId.value)
      if (!active || token !== session()) return
      if (quotationVersion(latest.version) !== quotationVersion(record.value.version)) throw new Error('报价已被修改，请返回详情刷新后再编辑')
      record.value = latest
    }
    if (!allowed.value) throw new Error('报价状态或权限已变化，请返回刷新')
    if (pricing.value) {
      const fields = pricingPayload(materials.value, fees.value)
      attempted = true
      await candidateAction('price', record.value, fields)
    } else {
      const records = materials.value.map(row => materialPayload(row, { cost: canCost.value, price: canPrice.value, direct: direct.value }))
      const serviceFees = fees.value.map(row => feePayload(row, { cost: canCost.value, price: canPrice.value, structure: canStructure.value, direct: direct.value }))
      if (!candidateId.value) {
        if (pendingCreate) throw new Error('主单创建结果不确定，请返回列表确认，勿重复新增')
        pendingCreate = true; attempted = true
        const created = unwrapQuotation(await http.post('/project/materialCandidate/add', { periodId: periodId.value, candidateName: name.value.trim() }))
        if (!active || token !== session()) return
        if (!created?.id) throw new Error('主单未返回 ID，请返回列表确认，勿重复新增')
        candidateId.value = String(created.id); record.value = created; quotationVersion(created.version)
      }
      if (!active || token !== session()) return
      attempted = true
      await http.post('/project/materialCandidateItem/editBatch', { candidateId: candidateId.value, version: quotationVersion(record.value.version), records, serviceFees }).then(unwrapQuotation)
    }
    if (!active || token !== session()) return
    dirty.value = false; leaving = true
    uni.showToast({ title: pricing.value ? '定价成功' : '草稿已保存', icon: 'success' })
    const url = `/pages/home/quotationDetail?periodId=${encodeURIComponent(periodId.value)}&candidateId=${encodeURIComponent(candidateId.value)}`
    const stack = getCurrentPages()
    if (stack[stack.length - 2]?.route === 'pages/home/quotationDetail') uni.navigateBack({ delta: 1, fail: () => uni.redirectTo({ url }) })
    else uni.redirectTo({ url })
  } catch (e: any) {
    if (attempted) { writeUncertain = true; actionError.value = `${e?.message || '保存失败'}。请返回列表核实已保存内容，勿重复创建或提交。` }
    else actionError.value = e?.message || '保存失败'
  } finally { busy.value = false }
}
function leaveEditor() {
  leaving = true
  const fallback = () => uni.redirectTo({
    url: '/pages/home/quotationList',
    fail: () => { leaving = false; uni.showToast({ title: '返回失败，请重试', icon: 'none' }) },
  })
  if (getCurrentPages().length > 1) uni.navigateBack({ delta: 1, fail: fallback })
  else fallback()
}
function back() {
  if (itemOpen.value) { closeItem(); return }
  if (pickerOpen.value) { pickerOpen.value = false; return }
  if (busy.value) return
  if (!dirty.value) { leaveEditor(); return }
  uni.showModal({ title: '离开编辑？', content: '未保存的修改将丢失。', confirmText: '离开', success: result => { if (result.confirm) leaveEditor() } })
}
onLoad(query => { periodId.value = String(query?.periodId || ''); candidateId.value = String(query?.candidateId || ''); pricing.value = query?.mode === 'price'; void load() })
onBackPress(() => { if (leaving) return false; if (itemOpen.value) { closeItem(); return true } if (busy.value) return true; if (pickerOpen.value) { pickerOpen.value = false; return true } if (dirty.value) { back(); return true } return false })
onUnload(() => { active = false; sequence++; itemSequence++ })
</script>

<style scoped lang="scss">
.editor-body { flex: 1; height: 0; min-height: 0; background: #f5f7fa; }
.editor-content { max-width: 780px; margin: 0 auto; padding: 12px; }
.section { padding: 16px; margin-bottom: 12px; border-radius: 12px; background: #fff; }
.section-title { font-size: 17px; font-weight: 600; color: #1d2939; }
.section-heading, .line-head, .toolbar, .pagination, .footer-actions { display: flex; align-items: center; gap: 12px; justify-content: space-between; }
.project-name, .project-choice { margin: 14px 0; overflow-wrap: anywhere; font-size: 16px; }
.project-choice { width: 100%; text-align: left; display: flex; align-items: center; justify-content: space-between; }
.field { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; min-width: 0; font-size: 14px; color: #475467; }
.field input, .select-control { box-sizing: border-box; height: 44px; min-height: 44px; padding: 0 12px; background: #f5f7fa; border: 1px solid #d0d5dd; border-radius: 8px; color: #1d2939; font-size: 16px; }
.select-control { display: flex; justify-content: space-between; align-items: center; }
.fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 12px; }
.notice, .secondary { color: #667085; font-size: 13px; line-height: 1.7; overflow-wrap: anywhere; }
.notice { margin-top: 14px; }.secondary { display: block; }
.toolbar { justify-content: flex-start; margin-top: 16px; flex-wrap: wrap; }
button { margin: 0; min-height: 44px; padding: 0 14px; font-size: 14px; line-height: 44px; color: #176ac7; background: #edf4ff; border-radius: 8px; }
button::after { border: none; } button[disabled] { color: #667085; background: #f2f4f7; }
.items-table { margin-top: 16px; }
.item-panel { height: 100%; display: flex; flex-direction: column; background: #fff; }
.item-heading { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; border-bottom: 1px solid #eaecf0; }
.item-body { flex: 1; height: 0; min-height: 0; }.item-form { padding: 16px 16px 24px; }
.line-head { align-items: flex-start; }.line-head > view { min-width: 0; flex: 1; }
.line-name { font-size: 16px; line-height: 1.6; font-weight: 600; overflow-wrap: anywhere; }.danger { color: #b42318; background: #fff; flex-shrink: 0; }
.pagination { margin-top: 20px; font-size: 14px; color: #475467; }
.editor-footer { flex-shrink: 0; background: #fff; padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); border-top: 1px solid #eaecf0; }.footer-actions > button { flex: 1; }.primary { color: #fff; background: #176ac7; }
.error { display: block; color: #b42318; font-size: 14px; line-height: 1.6; margin-bottom: 12px; overflow-wrap: anywhere; }
.totals { display: flex; flex-wrap: wrap; gap: 12px; font-size: 14px; font-variant-numeric: tabular-nums; }.totals strong { margin-left: 8px; }
.text-button { padding: 0; text-align: left; background: transparent; }
@media (min-width: 640px) { .fields { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
</style>
