<route lang="json5">
{ style: { navigationBarTitleText: '报价管理', navigationStyle: 'custom', disableScroll: true } }
</route>
<template>
  <PageLayout navTitle="报价管理" navLeftText="返回" navBackgroundColor="#176ac7" type="popup" @navBack="back">
    <view class="quote-types"><button :class="{ active: quoteType === 'project' }" @click="quoteType = 'project'">项目报价</button><button :class="{ active: quoteType === 'repair' }" @click="quoteType = 'repair'">维修报价</button></view>
    <RepairQuotationOrders v-if="quoteType === 'repair'" :key="repairRefresh" />
    <view v-if="quoteType === 'project'" class="quote-filters">
      <view class="quote-search">
        <input v-model="keyword" placeholder="搜索项目或报价名称" confirm-type="search" @confirm="search" />
        <button @click="search">查询</button>
      </view>
      <view class="quote-filter-row">
        <picker :range="statuses" range-key="label" :value="statusIndex" @change="changeStatus">
          <view class="quote-status-picker">{{ statuses[statusIndex].label }}<wd-icon name="arrow-down" size="14px" /></view>
        </picker>
        <button :disabled="!keyword && !appliedKeyword && !status" @click="reset">重置</button>
      </view>
    </view>
    <scroll-view v-if="quoteType === 'project'" class="quote-list" scroll-y :scroll-top="scrollTop" :lower-threshold="100" @scrolltolower="loadMore">
      <view v-if="loading && !rows.length" class="quote-state">正在加载报价…</view>
      <view v-else-if="error && !rows.length" class="quote-state"><text>{{ error }}</text><button @click="load(true)">重新加载</button></view>
      <view v-else-if="!rows.length" class="quote-state">暂无符合条件的报价</view>
      <button v-for="row in rows" :key="row.id" class="quote-card" @click="openDetail(row)">
        <view class="quote-card__head"><text class="quote-card__name">{{ row.candidateName || '未命名报价' }}</text><StatusBadge :value="String(row.status ?? '')" :dict="statusBadges" /></view>
        <text class="quote-card__project">{{ projectName(row) }}</text>
        <view class="quote-card__meta"><text>提交人：{{ row.createBy_dictText || row.createBy || '—' }}</text><text>{{ row.createTime || '—' }}</text></view>
        <view class="quote-card__link">查看报价<wd-icon name="arrow-right" size="14px" /></view>
      </button>
      <view v-if="rows.length" class="quote-state quote-state--footer">
        <text v-if="loading">正在加载更多…</text>
        <button v-else-if="error" @click="loadMore">加载失败，点击重试</button>
        <text v-else-if="!hasMore">没有更多报价了</text>
      </view>
    </scroll-view>
    <view v-if="quoteType === 'project' && permission.loaded && permission.hasPermission('plan:quotation:add')" class="quote-create"><button @click="createQuotation">新建项目报价单</button></view>
  </PageLayout>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { onShow, onUnload } from '@dcloudio/uni-app'
import { http } from '@/utils/http'
import { unwrapQuotation } from '@/service/quotationApproval'
import { useUserStore } from '@/store/user'
import { usePermissionStore } from '@/store/permission'
import StatusBadge from '@/components/StatusBadge/StatusBadge.vue'
import RepairQuotationOrders from './components/RepairQuotationOrders.vue'

const quoteType = ref<'project' | 'repair'>('project'), repairRefresh = ref(0)

const user = useUserStore()
const permission = usePermissionStore()
function createQuotation() {
  if (!permission.loaded || !permission.hasPermission('plan:quotation:add')) return
  uni.navigateTo({ url: '/pages/home/quotationEdit' })
}
const statusBadges = [
  { value: '-1', label: '草稿', color: '#667085' },
  { value: '2', label: '待审批', color: '#a46616' },
  { value: '1', label: '已通过', color: '#267b54' },
  { value: '0', label: '已驳回', color: '#b42318' },
  { value: '4', label: '已作废', color: '#667085' },
]
const statuses = [{ value: '', label: '全部状态' }, ...statusBadges]
const rows = ref<any[]>([]), keyword = ref(''), appliedKeyword = ref(''), status = ref('')
const statusIndex = computed(() => Math.max(0, statuses.findIndex(item => item.value === status.value)))
const loading = ref(false), error = ref(''), hasMore = ref(true), scrollTop = ref(0)
let generation = 0, page = 0
const pageSize = 20
const projectName = (row: any) => [row.projectName, row.periodName].filter(Boolean).join('-') || '项目名称未提供'
const load = async (reset = false) => {
  if (!reset && (loading.value || !hasMore.value)) return
  if (reset) {
    generation++; page = 0; rows.value = []; hasMore.value = true
    scrollTop.value = 1; void nextTick(() => { scrollTop.value = 0 })
  }
  const request = generation, token = user.userInfo.token, nextPage = page + 1
  loading.value = true; error.value = ''
  try {
    const data = unwrapQuotation(await http.get('/project/materialCandidate/list', {
      pageNo: nextPage, pageSize,
      ...(appliedKeyword.value ? { keyword: appliedKeyword.value } : {}),
      ...(status.value ? { status: status.value } : {}),
    }))
    if (request !== generation || token !== user.userInfo.token) return
    if (!Array.isArray(data?.records)) throw new Error('报价列表返回异常，请重试')
    const merged = new Map(rows.value.map(row => [String(row.id), row]))
    for (const row of data.records) {
      if (!row.id) throw new Error('报价记录缺少编号，请重试')
      merged.set(String(row.id), row)
    }
    rows.value = [...merged.values()]; page = nextPage
    const total = data.total == null ? NaN : Number(data.total)
    hasMore.value = data.records.length > 0 && (Number.isFinite(total) ? nextPage * pageSize < total : data.records.length === pageSize)
  } catch (e: any) {
    if (request === generation) error.value = e?.message || '报价加载失败，请重试'
  } finally { if (request === generation) loading.value = false }
}
const search = () => { appliedKeyword.value = keyword.value.trim(); void load(true) }
const reset = () => { keyword.value = ''; status.value = ''; search() }
const changeStatus = (event: any) => { status.value = statuses[Number(event.detail.value)]?.value || ''; search() }
const loadMore = () => { void load() }
const openDetail = (row: any) => {
  if (!row.periodId || !row.id) return uni.showToast({ title: '报价缺少分期信息，暂无法查看', icon: 'none' })
  const query = { candidateId: row.id, periodId: row.periodId, projectLabel: projectName(row), submitterName: row.createBy_dictText || row.createBy || '' }
  uni.navigateTo({ url: '/pages/home/quotationDetail?' + Object.entries(query).map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`).join('&') })
}
const back = () => {
  const fallback = () => uni.switchTab({ url: '/pages/home/index' })
  if (getCurrentPages().length > 1) uni.navigateBack({ delta: 1, fail: fallback })
  else fallback()
}
onShow(() => { repairRefresh.value++; void load(true) })
onUnload(() => { generation++ })
</script>

<style scoped lang="scss">
.quote-types { display:flex; gap:8px; padding:12px 16px; background:#fff; }
.quote-types button { flex:1; margin:0; min-height:44px; line-height:44px; font-size:14px; color:#667085; background:#f3f5f8; }
.quote-types button.active { color:#176ac7; background:#eaf3ff; font-weight:600; }
.quote-types button::after { border:0; }
.quote-filters { padding: 12px 16px 4px; background: #fff; }
.quote-search { display:flex; gap:8px; }
.quote-search input { flex:1; min-width:0; height:44px; padding:0 12px; border-radius:8px; background:#f3f5f8; color:#27364a; font-size:16px; }
.quote-search button { margin:0; padding:0 16px; min-height:44px; line-height:44px; color:#fff; background:#176ac7; font-size:14px; }
.quote-filter-row { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.quote-status-picker { display:flex; align-items:center; gap:8px; min-height:44px; color:#344054; font-size:14px; }
.quote-filter-row button { margin:0; min-height:44px; padding:0 8px; line-height:44px; background:transparent; color:#176ac7; font-size:14px; }
.quote-filter-row button[disabled] { color:#98a2b3; }
.quote-list { flex:1; height:0; min-height:0; background:#f3f5f8; }
.quote-card { display:block; margin:12px; padding:16px; border-radius:12px; background:#fff; text-align:left; line-height:1.5; }
.quote-card::after, .quote-filters button::after { border:0; }
.quote-card__head { display:flex; align-items:flex-start; gap:12px; }
.quote-card__name { flex:1; min-width:0; color:#27364a; font-size:16px; font-weight:600; overflow-wrap:anywhere; }
.quote-card__project { display:block; margin-top:8px; color:#475467; font-size:14px; overflow-wrap:anywhere; }
.quote-card__meta { display:flex; justify-content:space-between; flex-wrap:wrap; gap:4px 12px; margin-top:12px; color:#667085; font-size:12px; overflow-wrap:anywhere; }
.quote-card__link { display:flex; align-items:center; justify-content:flex-end; gap:4px; margin-top:12px; color:#176ac7; font-size:13px; }
.quote-state { padding:32px 16px; text-align:center; color:#667085; font-size:14px; }
.quote-state button { margin-top:12px; min-height:44px; font-size:14px; color:#176ac7; background:#fff; }
.quote-state--footer { padding:12px 16px calc(24px + env(safe-area-inset-bottom)); }
button:focus-visible, input:focus-visible { outline:2px solid #176ac7; outline-offset:2px; }
.quote-create { padding:12px 16px calc(12px + env(safe-area-inset-bottom)); background:#fff; border-top:1px solid #eaecf0; }
.quote-create button { min-height:44px; line-height:44px; font-size:16px; color:#fff; background:#176ac7; border-radius:8px; }
</style>
