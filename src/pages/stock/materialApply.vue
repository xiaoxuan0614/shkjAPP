<route lang="json5">
{
  style: {
    navigationBarTitleText: '申请物料记录',
  },
}
</route>
<template>
  <PageLayout :navbarShow="false">
    <view class="tabs">
      <view class="tab" :class="{ on: active === 0 }" @click="switchTab(0)">出库 · 领料申请</view>
      <view class="tab" :class="{ on: active === 1 }" @click="switchTab(1)">入库 · 还料申请</view>
    </view>

    <view class="stock-filters">
      <picker :range="approvalOptions" range-key="label" :value="approvalIndex" @change="changeApproval">
        <view class="stock-filter"><text>审批状态</text><view>{{ approvalOptions[approvalIndex]?.label }} <wd-icon name="arrow-down" size="14px" /></view></view>
      </picker>
      <picker :range="executeOptions" range-key="label" :value="executeIndex" @change="changeExecute">
        <view class="stock-filter"><text>执行状态</text><view>{{ executeOptions[executeIndex]?.label }} <wd-icon name="arrow-down" size="14px" /></view></view>
      </picker>
      <picker :range="usageOptions" range-key="label" :value="usageIndex" @change="changeUsage">
        <view class="stock-filter"><text>用料类型</text><view>{{ usageOptions[usageIndex].label }} <wd-icon name="arrow-down" size="14px" /></view></view>
      </picker>
      <button class="stock-filter-reset" :disabled="!approvalFilter && !executeFilter && !usageFilter && !selectedProject.id" @click="resetFilters">重置</button>
    </view>
    <view class="stock-project-filter">
      <button @click="showProjectSearch = true">{{ selectedProject.label || '输入主项目或分期项目名称查询' }} <wd-icon name="search" size="16px" /></button>
      <button v-if="selectedProject.id" @click="clearProject">清除</button>
    </view>
    <StockProjectSearch v-if="showProjectSearch" @close="showProjectSearch = false" @select="selectProject" />

    <scroll-view class="list" :scroll-y="true" :scroll-top="scrollTop" :lower-threshold="100" @scrolltolower="onReachBottom">
      <view v-if="loading && !list.length" class="empty">正在加载记录…</view>
      <view v-else-if="loadError && !list.length" class="empty"><text>记录加载失败</text><button @click="load(1)">重新加载</button></view>
      <view v-else-if="!list.length" class="empty">暂无符合筛选条件的{{ active === 0 ? '出库' : '入库' }}记录</view>
      <view v-for="a in list" :key="a.id" class="card" @click="goDetail(a)">
        <view class="card__head">
          <text class="card__no">{{ a.applyNo }}</text>
          <StatusBadge :value="a.executeStatus" :dict="statusDict" />
        </view>
        <view class="row">
          <text class="label">审批状态</text>
          <StatusBadge :value="String(a.status ?? '')" :dict="approvalDict" />
        </view>
        <view class="row">
          <text class="label">用料类型</text>
          <text class="val">{{ usageOptions.find(option => option.value === a.usageType)?.label || getMaterialUsageTypeText(a.usageType) }}</text>
        </view>
        <view class="row">
          <text class="label">项目名称</text>
          <text class="val">{{ a.projectLabel }}</text>
        </view>
        <view class="row">
          <text class="label">申请时间</text>
          <text class="val">{{ a.applyTime }}</text>
        </view>
      </view>
      <view v-if="list.length && (loading || loadError || finished)" class="stock-load-more">
        <text v-if="loading">正在加载更多…</text>
        <button v-else-if="loadError" @click="loadMore">加载失败，点击重试</button>
        <text v-else-if="finished">没有更多记录了</text>
      </view>
    </scroll-view>
  </PageLayout>
</template>

<script lang="ts" setup>
import { onLoad, onShow } from '@dcloudio/uni-app'
import { computed, nextTick, ref } from 'vue'
import { http } from '@/utils/http'
import { stockApi, unwrapRecords, formatProjectName } from '@/service/shkj'
import StatusBadge from '@/components/StatusBadge/StatusBadge.vue'
import StockProjectSearch from './components/StockProjectSearch.vue'
import { getMaterialUsageTypeText } from '@/types/business'

const active = ref(0)
const approvalDict = [
  { value: '-1', label: '待提交', color: '#909399' },
  { value: '0', label: '驳回', color: '#f56c6c' },
  { value: '1', label: '审核通过', color: '#67c23a' },
  { value: '2', label: '待审批', color: '#e6a23c' },
  { value: '3', label: '已撤回', color: '#909399' },
]
const approvalFilter = ref('')
const approvalOptions = [{ value: '', label: '全部状态' }, ...approvalDict]
const approvalIndex = computed(() => Math.max(0, approvalOptions.findIndex(item => item.value === approvalFilter.value)))
const changeApproval = (event: any) => { approvalFilter.value = approvalOptions[Number(event.detail.value)].value; void load(1) }
const list = ref<any[]>([])
const statusDict = ref([
  { value: 'PENDING', label: '待执行', color: '#e6a23c' },
  { value: 'PARTIAL_EXECUTED', label: '部分执行', color: '#409eff' },
  { value: 'EXECUTED', label: '已完成', color: '#67c23a' },
])
const executeFilter = ref(''), usageFilter = ref('')
const showProjectSearch = ref(false)
const selectedProject = ref({ id: '', label: '' })
const selectProject = (value: { id: string; label: string }) => {
  selectedProject.value = value; showProjectSearch.value = false; void load(1)
}
const clearProject = () => { selectedProject.value = { id: '', label: '' }; void load(1) }
const page = ref(1), total = ref(0), loading = ref(false), loadError = ref(false)
const finished = ref(false), scrollTop = ref(0)
let requestId = 0
const usageOptions = [
  { value: '', label: '全部类型' },
  { value: 'PROJECT', label: '项目用料' },
  { value: 'MAINTENANCE', label: '运维用料' },
  { value: 'LABOR_PROTECTION', label: '劳保用品' },
]
const executeOptions = computed(() => [{ value: '', label: '全部状态' }, ...statusDict.value])
const executeIndex = computed(() => Math.max(0, executeOptions.value.findIndex(item => item.value === executeFilter.value)))
const usageIndex = computed(() => Math.max(0, usageOptions.findIndex(item => item.value === usageFilter.value)))
const changeExecute = (event: any) => { executeFilter.value = executeOptions.value[Number(event.detail.value)].value; void load(1) }
const changeUsage = (event: any) => { usageFilter.value = usageOptions[Number(event.detail.value)].value; void load(1) }
const resetFilters = () => { approvalFilter.value = ''; executeFilter.value = ''; usageFilter.value = ''; selectedProject.value = { id: '', label: '' }; void load(1) }
const loadStatusDictionary = async () => {
  try {
    const rows = unwrapRecords(await http.get('/sys/dict/getDictItems/stock_execute_status'))
    if (rows.length) statusDict.value = rows.filter(item => item.value != null).map(item => ({
      value: String(item.value), label: item.text || item.label || String(item.value), color: item.color || '#68788a',
    }))
  } catch { /* 字典失败时保留接口协议对应的执行状态 */ }
}

const normalizeApply = (item: any) => {
  const executed = String(item.executeStatus || '').toUpperCase()
  return {
    ...item,
    applyNo: item.applyNo || item.id,
    orderNo: item.projectNo || item.orderNo || '',
    projectLabel: formatProjectName(item),
    applyTime: item.createTime || item.applyTime || '',
    executeStatus: executed || '未知',
  }
}

const load = async (nextPage = 1) => {
  const reset = nextPage === 1
  if (!reset && (loading.value || finished.value)) return
  // 同一筛选条件的追加页共用代次，切换筛选时忽略旧响应。
  if (reset) {
    ++requestId
    list.value = []; page.value = 0; total.value = 0; finished.value = false
    scrollTop.value = 1
    void nextTick(() => { scrollTop.value = 0 })
  }
  const request = requestId
  loading.value = true
  loadError.value = false
  try {
    const applyType = active.value === 0 ? 'OUT' : 'IN'
    const res: any = await stockApi.applies({
      applyType, pageNo: nextPage, pageSize: 20,
      ...(approvalFilter.value ? { status: approvalFilter.value } : {}),
      ...(executeFilter.value ? { executeStatus: executeFilter.value } : {}),
      ...(usageFilter.value ? { usageType: usageFilter.value } : {}),
      ...(selectedProject.value.id ? { periodId: selectedProject.value.id } : {}),
    })
    if (request !== requestId) return
    if (!Array.isArray(res.result?.records)) throw new Error('列表响应异常')
    total.value = Number(res.result.total || 0)
    const rows = unwrapRecords(res)
      .filter((item: any) => !item.applyType || item.applyType === applyType)
      .map(normalizeApply)
    const existing = new Set(list.value.map(item => item.id))
    const additions = rows.filter(item => !existing.has(item.id))
    list.value.push(...additions)
    page.value = nextPage
    finished.value = res.result.records.length === 0 || nextPage * 20 >= total.value
  } catch (e) {
    if (request === requestId) loadError.value = true
  } finally { if (request === requestId) loading.value = false }
}
const loadMore = () => { if (!loading.value && !finished.value) void load(page.value + 1) }
const onReachBottom = () => { if (!loadError.value) void loadMore() }

const switchTab = (i: number) => {
  active.value = i
  load()
}

const goDetail = (a: any) => uni.navigateTo({ url: `/pages/stock/materialDetail?id=${a.id}` })

onLoad((query) => {
  if ((query as any)?.tab === 'in') active.value = 1
})
onShow(() => { void loadStatusDictionary(); void load(1) })
</script>

<style lang="scss" scoped>
.tabs {
  display: flex;
  background: #fff;

  .tab {
    flex: 1;
    text-align: center;
    padding: 13px 0;
    font-size: 14px;
    color: #666;
    position: relative;

    &.on {
      color: #2f86ff;
      font-weight: 600;

      &::after {
        content: '';
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        bottom: 5px;
        width: 28px;
        height: 3px;
        border-radius: 2px;
        background: #2f86ff;
      }
    }
  }
}

.list {
  height: calc(100vh - 44px - 48px - 82px - 64px);
  padding: 12px;
  box-sizing: border-box;
}
.stock-project-filter { display: flex; align-items: center; gap: 8px; padding: 0 12px 12px; background: #fff; }
.stock-project-filter button { min-width: 0; margin: 0; min-height: 44px; padding: 10px; line-height: 24px; font-size: 14px; color: #596574; }
.stock-project-filter button:first-child { flex: 1; display: flex; justify-content: space-between; align-items: center; gap: 8px; text-align: left; overflow-wrap: anywhere; }

.stock-filters { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 10px 12px; background: #fff; border-top: 1px solid #edf0f4; }
.stock-filters picker { flex: 1 1 100px; min-width: 0; }
.stock-filter { min-height: 52px; display: flex; flex-direction: column; justify-content: center; gap: 5px; }
.stock-filter > text { font-size: 12px; color: #596574; }
.stock-filter > view { display: flex; align-items: center; justify-content: space-between; gap: 4px; font-size: 14px; color: #253247; }
.stock-filter-reset { flex-shrink: 0; margin: 0; padding: 0 8px; min-height: 44px; line-height: 44px; font-size: 13px; color: #176ac7; }
.stock-load-more { text-align: center; color: #596574; font-size: 13px; padding: 16px 0 calc(16px + env(safe-area-inset-bottom)); }
.stock-load-more button { display: inline-block; margin: 0; padding: 0 12px; min-height: 44px; line-height: 44px; font-size: 13px; }

.empty {
  text-align: center;
  color: #999;
  font-size: 13px;
  padding: 60px 0;
}

.card {
  background: #fff;
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 12px;

  &__head {
    display: flex;
    justify-content: space-between;
    margin-bottom: 6px;
  }

  &__no {
    font-size: 15px;
    font-weight: 600;
    color: #333;
  }
}

.row {
  display: flex;
  margin-top: 6px;

  .label {
    width: 70px;
    font-size: 13px;
    color: #999;
    flex: none;
  }

  .val {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
    font-size: 13px;
    color: #333;
  }
}

</style>
