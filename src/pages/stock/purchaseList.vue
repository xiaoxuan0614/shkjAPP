<route lang="json5">
{ style: { navigationBarTitleText: '采购管理', navigationStyle: 'custom', disableScroll: true } }
</route>
<template>
  <PageLayout navTitle="采购管理" navLeftText="返回" navBackgroundColor="#176ac7" type="popup" @navBack="back">
    <view class="filters">
      <view class="search"><picker :range="searchFields" range-key="label" :value="searchIndex" @change="searchIndex = Number($event.detail.value)"><view class="search-kind">{{ searchFields[searchIndex].label }}<wd-icon name="arrow-down" size="12px" /></view></picker><input v-model="keyword" :placeholder="searchFields[searchIndex].placeholder" confirm-type="search" @confirm="search" /><button @click="search">查询</button></view>
      <view class="filter-row"><picker :range="types" range-key="label" :value="typeIndex" @change="type = types[Number($event.detail.value)].value; search()"><view class="filter-control">{{ types[typeIndex].label }}<wd-icon name="arrow-down" size="12px" /></view></picker><picker :range="statuses" range-key="label" :value="statusIndex" @change="status = statuses[Number($event.detail.value)].value; search()"><view class="filter-control">{{ statuses[statusIndex].label }}<wd-icon name="arrow-down" size="12px" /></view></picker><button class="text-button" @click="reset">重置</button></view>
      <button v-if="dictError" class="text-button error" @click="loadDictionaries">字典加载失败，点击重试</button>
    </view>
    <scroll-view scroll-y class="list" :scroll-top="scrollTop" :lower-threshold="100" @scrolltolower="load(false)">
      <view class="list-inner">
        <view v-if="loading && !rows.length" class="state">正在加载采购记录…</view>
        <view v-else-if="error && !rows.length" class="state error">{{ error }}<button @click="load(true)">重新加载</button></view>
        <view v-else-if="!rows.length" class="state">暂无符合条件的采购记录</view>
        <button v-for="row in rows" :key="row.id" class="purchase-record" @click="openDetail(row)">
          <view class="record-head"><text class="record-title">{{ row.orderNo || '采购订单' }}</text><text class="status">{{ dictLabel(statuses, row.status, row.status_dictText) }}</text></view>
          <text class="project">{{ projectName(row) }}</text>
          <text class="muted">{{ row.supplierName || '供应商未提供' }} · {{ dictLabel(types, row.purchaseType, row.purchaseType_dictText) }}</text>
          <view class="meta"><text>{{ row.orderDate || row.createTime || '—' }}</text><text class="amount">{{ money(row.totalAmount) }}</text></view>
          <view class="record-foot"><text>申请人：{{ row.createBy_dictText || row.createBy || '—' }}</text><text class="link">查看详情 <wd-icon name="arrow-right" size="12px" /></text></view>
        </button>
        <view v-if="rows.length" class="state"><text v-if="loading">正在加载更多…</text><button v-else-if="error" @click="load(false)">加载失败，点击重试</button><text v-else-if="!more">没有更多记录了</text></view>
      </view>
    </scroll-view>
    <view v-if="allowed" class="footer"><button class="primary" @click="create">新建采购申请</button></view>
    <wd-popup :model-value="detailOpen" position="bottom" :z-index="2400" custom-style="height:88vh;border-radius:16px 16px 0 0;overflow:hidden" @update:model-value="closeDetail">
      <view class="detail-panel">
        <view class="detail-head"><text class="section-title">采购详情</text><button class="text-button" @click="closeDetail">关闭</button></view>
        <scroll-view scroll-y class="detail-body">
          <view v-if="detailLoading" class="state">正在加载详情…</view>
          <view v-else-if="detailError" class="state error">{{ detailError }}<button @click="openDetail(selected)">重新加载</button></view>
          <view v-else-if="detail" class="detail-content">
            <text class="record-title">{{ detail.orderNo || '采购订单' }}</text>
            <view class="information"><view v-for="field in detailFields" :key="field.label" class="info-row"><text>{{ field.label }}</text><text>{{ field.value }}</text></view></view>
            <view class="section-heading"><text class="section-title">采购明细 · {{ detail.itemList.length }} 项</text><text class="muted">每页 10 项</text></view>
            <ReadOnlyTable label="采购订单明细" :columns="columns" :rows="detailRows" min-width="620px">
              <template #cell="{ row, column }"><view v-if="column.key === 'material'"><text>{{ row.materialName || '—' }}</text><text class="muted">{{ [row.materialCode, row.brand_dictText, row.model].filter(Boolean).join(' · ') }}</text></view><text v-else-if="column.key === 'quantity'">{{ row.quantity ?? '—' }} {{ row.unit || '' }}</text><text v-else-if="column.key === 'unitPrice'">{{ money(row.unitPrice) }}</text><text v-else-if="column.key === 'amount'">{{ row.amount == null ? quotationLineTotal(row.unitPrice, row.quantity) : money(row.amount) }}</text><text v-else>{{ row[column.key] ?? '—' }}</text></template>
            </ReadOnlyTable>
            <view v-if="detail.itemList.length > 10" class="pagination"><button :disabled="detailPage <= 1" @click="detailPage--">上一页</button><text>{{ detailPage }} / {{ detailPages }}</text><button :disabled="detailPage >= detailPages" @click="detailPage++">下一页</button></view>
            <view v-if="detail.remark" class="remark"><text class="section-title">采购备注</text><text>{{ detail.remark }}</text></view>
          </view>
        </scroll-view>
      </view>
    </wd-popup>
  </PageLayout>
</template>
<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { onShow, onUnload, onBackPress } from '@dcloudio/uni-app'
import { http } from '@/utils/http'
import { unwrapQuotation, quotationLineTotal } from '@/service/quotationApproval'
import { ensureCurrentAuthorization } from '@/service/permission'
import { usePermissionStore } from '@/store/permission'
import { useUserStore } from '@/store/user'
import ReadOnlyTable from '@/components/ReadOnlyTable/ReadOnlyTable.vue'
import type { ReadOnlyColumn } from '@/components/ReadOnlyTable/types'
const user = useUserStore(), permission = usePermissionStore()
const allowed = computed(() => permission.loaded && permission.hasPageAccess('/pages/stock/purchaseList'))
const rows = ref<any[]>([]), loading = ref(false), error = ref(''), more = ref(true), scrollTop = ref(0)
const searchFields = [{ value: 'keyword', label: '项目名称', placeholder: '主项目或分期名称' }, { value: 'orderNo', label: '采购单号', placeholder: '请输入采购单号' }, { value: 'supplierName', label: '供应商', placeholder: '请输入供应商名称' }]
const keyword = ref(''), searchIndex = ref(0), type = ref(''), status = ref('')
const types = ref<any[]>([{ value: '', label: '全部类型' }]), statuses = ref<any[]>([{ value: '', label: '全部状态' }]), dictError = ref(false)
const typeIndex = computed(() => Math.max(0, types.value.findIndex(item => item.value === type.value))), statusIndex = computed(() => Math.max(0, statuses.value.findIndex(item => item.value === status.value)))
const detailOpen = ref(false), detailLoading = ref(false), detailError = ref(''), detail = ref<any>(null), selected = ref<any>(null), detailPage = ref(1)
let generation = 0, detailGeneration = 0, dictGeneration = 0, page = 0, active = true, leaving = false, applied: Record<string, string> = {}
const money = (value: any) => quotationLineTotal(value, 1)
const projectName = (row: any) => [row.projectName, row.periodName].filter(Boolean).join('-') || (String(row.purchaseType) === '1' ? '项目名称未提供' : '非项目采购')
const dictLabel = (options: any[], value: any, fallback?: string) => options.find(item => item.value !== '' && item.value === String(value))?.label || fallback || (value == null || value === '' ? '—' : String(value))
function search() { const text = keyword.value.trim(); applied = { ...(text ? { [searchFields[searchIndex.value].value]: text } : {}), ...(type.value ? { purchaseType: type.value } : {}), ...(status.value ? { status: status.value } : {}) }; void load(true) }
function reset() { keyword.value = ''; searchIndex.value = 0; type.value = ''; status.value = ''; search() }
async function loadDictionaries() {
  const request = ++dictGeneration, token = user.userInfo.token
  try {
    const values = await Promise.all(['purchase_order_type', 'purchase_order_status'].map(async code => {
      const data = unwrapQuotation(await http.get(`/sys/dict/getDictItems/${code}`)); if (!Array.isArray(data) || !data.length) throw Error('字典为空')
      return data.map(item => ({ value: String(item.value), label: String(item.text || item.label || item.value) }))
    }))
    if (!active || request !== dictGeneration || token !== user.userInfo.token) return
    types.value = [{ value: '', label: '全部类型' }, ...values[0]]; statuses.value = [{ value: '', label: '全部状态' }, ...values[1]]; dictError.value = false
  } catch { if (active && request === dictGeneration && token === user.userInfo.token) dictError.value = true }
}
async function load(reset = false) {
  if (!active || !reset && (loading.value || !more.value)) return
  if (reset) { generation++; page = 0; rows.value = []; more.value = true; scrollTop.value = 1; void nextTick(() => { scrollTop.value = 0 }) }
  const request = generation, token = user.userInfo.token, next = page + 1
  const current = () => active && request === generation && token === user.userInfo.token
  loading.value = true; error.value = ''
  try {
    await ensureCurrentAuthorization(user.userInfo)
    if (!current()) return
    if (!allowed.value) throw Error('当前账号暂无采购查看权限')
    const data = unwrapQuotation(await http.get('/project/purchaseOrder/list', { ...applied, pageNo: next, pageSize: 20 }))
    if (!current()) return
    if (!Array.isArray(data?.records)) throw Error('采购列表格式异常')
    const merged = new Map(rows.value.map(row => [String(row.id), row]))
    for (const row of data.records) { if (!row.id) throw Error('采购记录缺少编号'); merged.set(String(row.id), row) }
    if (data.records.length && merged.size === rows.value.length) throw Error('分页未前进，请刷新')
    rows.value = [...merged.values()]; page = next
    more.value = data.records.length > 0 && (data.total != null ? next * 20 < Number(data.total) : data.records.length === 20)
  } catch (e: any) { if (current()) error.value = e?.message || '采购列表加载失败' }
  finally { if (current()) loading.value = false }
}
async function openDetail(row: any) {
  if (!allowed.value || !row?.id) return
  selected.value = row; detailOpen.value = true; detail.value = null; detailPage.value = 1; detailLoading.value = true; detailError.value = ''
  const request = ++detailGeneration, token = user.userInfo.token
  try {
    const data = unwrapQuotation(await http.get('/project/purchaseOrder/queryById', { id: row.id }))
    if (!active || request !== detailGeneration || token !== user.userInfo.token || !detailOpen.value) return
    if (String(data?.id) !== String(row.id) || !Array.isArray(data.itemList)) throw Error('采购详情不完整，请重试')
    detail.value = { ...row, ...data, projectName: data.projectName || row.projectName, periodName: data.periodName || row.periodName }
  } catch (e: any) { if (active && request === detailGeneration && token === user.userInfo.token) detailError.value = e?.message || '采购详情加载失败' }
  finally { if (active && request === detailGeneration) detailLoading.value = false }
}
function closeDetail() { detailGeneration++; detailOpen.value = false; detail.value = null; detailLoading.value = false }
const detailPages = computed(() => Math.max(1, Math.ceil((detail.value?.itemList.length || 0) / 10)))
const detailRows = computed(() => (detail.value?.itemList || []).slice((detailPage.value - 1) * 10, detailPage.value * 10))
const detailFields = computed(() => {
  const row = detail.value || {}
  return [{ label: '状态', value: dictLabel(statuses.value, row.status, row.status_dictText) }, { label: '采购类型', value: dictLabel(types.value, row.purchaseType, row.purchaseType_dictText) }, { label: '供应商', value: row.supplierName || '—' }, { label: '项目名称', value: projectName(row) }, { label: '下单日期', value: row.orderDate || '—' }, { label: '预计到货', value: row.expectedArrivalDate || '—' }, { label: '采购总价', value: money(row.totalAmount) }, { label: '申请人', value: row.createBy_dictText || row.createBy || '—' }, { label: '申请时间', value: row.createTime || '—' }]
})
const columns: ReadOnlyColumn[] = [{ key: 'material', label: '物料信息', width: 'minmax(150px, 1.8fr)' }, { key: 'quantity', label: '采购数量', width: '90px', align: 'right' }, { key: 'unitPrice', label: '单价', width: '90px', align: 'right' }, { key: 'amount', label: '金额', width: '100px', align: 'right' }, { key: 'inboundQty', label: '已入库', width: '80px', align: 'right' }, { key: 'remainingQty', label: '未入库', width: '80px', align: 'right' }]
function create() { if (allowed.value) uni.navigateTo({ url: '/pages/stock/purchaseApply' }) }
function back() { if (detailOpen.value) { closeDetail(); return } leaving = true; const fallback = () => uni.switchTab({ url: '/pages/home/index', fail: () => { leaving = false } }); if (getCurrentPages().length > 1) uni.navigateBack({ delta: 1, fail: fallback }); else fallback() }
onShow(() => { void load(true); void loadDictionaries() })
onBackPress(() => { if (leaving) return false; if (detailOpen.value) { closeDetail(); return true } return false })
onUnload(() => { active = false; generation++; detailGeneration++; dictGeneration++ })
</script>
<style scoped>
.filters { padding:12px 16px; background:#fff; }.search,.filter-row { display:flex; align-items:center; gap:10px; }.search input { flex:1; min-width:0; height:44px; font-size:16px; }.search-kind,.filter-control { display:flex; align-items:center; gap:6px; min-height:44px; color:#475467; font-size:14px; }.filter-row { justify-content:space-between; border-top:1px solid #eaecf0; margin-top:8px; }.filter-row picker { min-width:0; }
button { margin:0; padding:0 12px; min-height:44px; line-height:44px; font-size:14px; color:#176ac7; background:#edf4ff; border-radius:8px; }button::after { border:none; }button[disabled] { color:#667085; background:#f2f4f7; }.text-button { background:transparent; }.primary { width:100%; color:#fff; background:#176ac7; }
.list { flex:1; height:0; min-height:0; background:#f5f7fa; }.list-inner { max-width:780px; margin:0 auto; padding:12px; }.purchase-record { display:block; width:100%; padding:16px; margin-bottom:12px; background:#fff; color:#1d2939; line-height:1.6; text-align:left; border-radius:12px; }.record-head,.meta,.record-foot,.section-heading,.pagination,.detail-head { display:flex; justify-content:space-between; align-items:center; gap:12px; }.record-title { min-width:0; font-size:16px; font-weight:600; overflow-wrap:anywhere; }.status { flex-shrink:0; font-size:12px; color:#176ac7; background:#edf4ff; border-radius:6px; padding:3px 8px; }.project { display:block; font-size:15px; margin:10px 0 4px; overflow-wrap:anywhere; }.muted,.meta,.record-foot { font-size:13px; color:#667085; overflow-wrap:anywhere; }.muted { display:block; line-height:1.6; }.meta { margin-top:10px; }.amount { font-size:16px; font-weight:600; color:#1d2939; font-variant-numeric:tabular-nums; }.record-foot { border-top:1px solid #eaecf0; padding-top:10px; margin-top:12px; }.link { color:#176ac7; flex-shrink:0; }
.state { padding:26px 16px; text-align:center; font-size:14px; color:#667085; }.error { color:#b42318; }.footer { padding:12px 16px calc(12px + env(safe-area-inset-bottom)); border-top:1px solid #eaecf0; background:#fff; }
.detail-panel { height:100%; display:flex; flex-direction:column; background:#fff; padding-bottom:env(safe-area-inset-bottom); box-sizing:border-box; }.detail-head { padding:8px 16px; border-bottom:1px solid #eaecf0; }.detail-body { flex:1; min-height:0; height:0; }.detail-content { max-width:780px; margin:auto; padding:16px 16px 28px; }.section-title { font-size:17px; font-weight:600; color:#1d2939; }.information { margin:12px 0 24px; }.info-row { display:grid; grid-template-columns:84px minmax(0,1fr); gap:16px; padding:10px 0; border-bottom:1px solid #f2f4f7; font-size:14px; line-height:1.6; }.info-row > text:first-child { color:#667085; }.info-row > text:last-child { text-align:right; color:#1d2939; overflow-wrap:anywhere; }.section-heading { margin-bottom:12px; }.pagination { margin-top:16px; font-size:14px; }.remark { display:flex; flex-direction:column; gap:12px; margin-top:24px; font-size:14px; line-height:1.7; overflow-wrap:anywhere; }
button:focus-visible { outline:2px solid #176ac7; outline-offset:2px; }
</style>
