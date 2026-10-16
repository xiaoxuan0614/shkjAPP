<route lang="json5">
{
  style: {
    navigationBarTitleText: '项目管理',
    navigationStyle: 'custom',
  },
}
</route>
<template>
  <PageLayout navTitle="项目管理" navLeftText="返回" navBackgroundColor="#176ac7" type="popup" @navBack="goBack">
    <view class="filters">
      <view class="search-row">
        <input v-model="keyword" class="search-input" placeholder="主项目或分期名称" confirm-type="search" @confirm="search" />
        <button class="search-button" @click="search">查询</button>
      </view>
      <view class="status-row">
        <picker class="status-picker" :range="filterOptions" range-key="label" :value="statusIndex" @change="changeStatus">
          <view class="status-control"><text>项目状态：{{ filterOptions[statusIndex].label }}</text><wd-icon name="arrow-down" size="14px" /></view>
        </picker>
        <button class="reset-button" :disabled="!keyword && !statusFilter && !appliedKeyword" @click="resetFilters">重置</button>
      </view>
    </view>
    <scroll-view class="list" :scroll-y="true" :scroll-top="scrollTop" :lower-threshold="100" @scrolltolower="loadMore">
      <view v-if="loading && !list.length" class="empty">正在加载项目…</view>
      <view v-else-if="loadError && !list.length" class="empty"><button @click="load()">项目加载失败，点击重试</button></view>
      <view v-else-if="!list.length" class="empty">暂无符合条件的项目</view>
      <view v-for="p in list" :key="p.id" class="card" @click="goDetail(p)">
        <view class="card__head">
          <text class="card__no">{{ p.xmNo }}</text>
          <StatusBadge :value="p.rawStatus" :dict="projectStatusOptions" />
        </view>
        <view class="card__name">{{ p.projectLabel }}</view>
        <view class="row"><text class="label">客户</text><text class="val">{{ p.customerName }}</text></view>
        <view v-if="p.personInCharge" class="row"><text class="label">负责人</text><text class="val">{{ p.personInCharge }}</text></view>
        <view v-if="p.startDate || p.endDate" class="row"><text class="label">周期</text><text class="val">{{ p.startDate || '—' }} ~ {{ p.endDate || '—' }}</text></view>
        <!-- 实施中：当前工序 + 剩余工时/延期 -->
        <view v-if="p.status === 'implementing' && p.currentProcess" class="progress">
          <view class="progress__item">
            <text class="progress__label">当前工序</text>
            <text class="progress__val">{{ p.currentProcess }}</text>
          </view>
          <view class="progress__item">
            <text class="progress__label">工序周期</text>
            <text class="progress__val">{{ p.processPlan }}</text>
          </view>
          <view class="progress__item">
            <text class="progress__label">{{ p.remainDays < 0 ? '延期' : '剩余' }}</text>
            <text class="progress__val" :class="{ warn: p.remainDays < 0 }">{{ p.remainDays < 0 ? -p.remainDays + ' 天' : p.remainDays + ' 天' }}</text>
          </view>
        </view>
        <!-- 已完结/质保中：交付信息 -->
        <view v-if="p.status === 'warranty'" class="row"><text class="label">质保至</text><text class="val">{{ p.warrantyPeriod }}</text></view>
      </view>
      <view v-if="list.length" class="load-state">
        <text v-if="loading">正在加载更多…</text>
        <button v-else-if="loadError" @click="loadMore">加载失败，点击重试</button>
        <text v-else-if="!hasMore">没有更多项目了</text>
      </view>
    </scroll-view>
  </PageLayout>
</template>

<script lang="ts" setup>
import { onShow } from '@dcloudio/uni-app'
import { computed, nextTick, ref } from 'vue'
import { normalizeProject, projectApi, unwrapRecords } from '@/service/shkj'
import { http } from '@/utils/http'
import { useUserStore } from '@/store/user'
import StatusBadge from '@/components/StatusBadge/StatusBadge.vue'

const list = ref<any[]>([])
const userStore = useUserStore()
const goBack = () => {
  const fallback = () => uni.switchTab({ url: '/pages/home/index' })
  if (getCurrentPages().length > 1) uni.navigateBack({ delta: 1, fail: fallback })
  else fallback()
}
const projectStatusOptions = ref<{ value: string; label: string; color: string }[]>([])
const keyword = ref(''), appliedKeyword = ref(''), statusFilter = ref('')
const loading = ref(false), loadError = ref(false), hasMore = ref(true), scrollTop = ref(0)
const filterOptions = computed(() => [{ value: '', label: '全部状态' }, ...projectStatusOptions.value])
const statusIndex = computed(() => Math.max(0, filterOptions.value.findIndex(item => item.value === statusFilter.value)))
let generation = 0, page = 0, mainMore = true, periodMore = true
const pageSize = 20
const search = () => { appliedKeyword.value = keyword.value.trim(); void load() }
const changeStatus = (event: any) => {
  statusFilter.value = filterOptions.value[Number(event.detail.value)]?.value || ''
  search()
}
const resetFilters = () => { keyword.value = ''; statusFilter.value = ''; search() }
const loadMore = () => { if (!loading.value && hasMore.value) void load(false) }

const load = async (reset = true) => {
  if (reset) {
    generation++; page = 0; mainMore = true; periodMore = true
    list.value = []; hasMore.value = true
    scrollTop.value = 1
    void nextTick(() => { scrollTop.value = 0 })
  }
  const request = generation, nextPage = page + 1
  // 数据范围由后端按登录态判断，令牌快照仅用于丢弃切换账号前的响应。
  const sessionToken = userStore.userInfo.token
  const query = appliedKeyword.value
  const params = { pageNo: nextPage, pageSize, ...(statusFilter.value ? { status: statusFilter.value } : {}) }
  loading.value = true; loadError.value = false
  try {
    // 名称字段为 AND 条件，分别查询后按分期去重，实现主项目或分期名称匹配。
    const [mainResult, periodResult] = await Promise.all([
      mainMore ? projectApi.list({ ...params, ...(query ? { projectName: query } : {}) }) : null,
      query && periodMore ? projectApi.list({ ...params, periodName: query }) : null,
    ])
    if (request !== generation || sessionToken !== userStore.userInfo.token) return
    const more = (result: any) => result != null && (result.result?.total != null
      ? nextPage * pageSize < Number(result.result.total) : unwrapRecords(result).length === pageSize)
    mainMore = more(mainResult); periodMore = more(periodResult)
    hasMore.value = mainMore || periodMore; page = nextPage
    const rows = [...unwrapRecords(mainResult), ...unwrapRecords(periodResult)]
    const options = new Map(projectStatusOptions.value.map(item => [item.value, item]))
    rows.forEach((row: any) => {
      const value = String(row.periodStatus ?? row.status ?? '').trim().toUpperCase()
      if (value && !options.has(value)) options.set(value, { value, label: row.periodStatus_dictText || row.status_dictText || value, color: '#68788a' })
    })
    projectStatusOptions.value = [...options.values()]
    const merged = new Map(list.value.map(item => [String(item.id), item]))
    rows.forEach(row => {
      const item = normalizeProject({ ...row, status: String(row.periodStatus ?? row.status ?? '').trim().toUpperCase() })
      merged.set(String(item.id), {
        ...item,
      })
    })
    list.value = [...merged.values()]
  } catch (e) {
    if (request === generation) loadError.value = true
  } finally {
    if (request === generation) loading.value = false
  }
}

const loadDictionary = async () => {
  try {
    const result = await http.get('/sys/dict/getDictItems/project_period_status')
    const options = new Map(projectStatusOptions.value.map(item => [item.value, item]))
    unwrapRecords(result).forEach((item: any) => {
      const value = String(item.value ?? '').trim().toUpperCase()
      if (value && (item.text || item.label)) options.set(value, {
        value, label: item.text || item.label,
        color: /^#[0-9a-f]{6}$/i.test(item.color || '') ? item.color : '#176ac7',
      })
    })
    projectStatusOptions.value = [...options.values()]
  } catch { uni.showToast({ title: '状态字典加载失败，请稍后重进', icon: 'none' }) }
}

const goDetail = (p: any) => uni.navigateTo({ url: `/pages/ops/projectDetail?id=${p.id}` })

onShow(() => { void load(); void loadDictionary() })
</script>

<style lang="scss" scoped>
.list {
  height: calc(100vh - 128px);
  min-height: 0;
  box-sizing: border-box;
  padding: 12px;
}

.filters { flex: none; padding: 12px; background: #fff; }
.search-row, .status-row, .status-control { display: flex; align-items: center; gap: 12px; }
.search-input { flex: 1; min-width: 0; height: 44px; padding: 0 12px; font-size: 16px; background: #f4f6f8; border-radius: 8px; }
.filters button { margin: 0; padding: 0 16px; font-size: 14px; line-height: 44px; flex: none; }
.filters button::after { border: 0; }
.search-button { color: #fff; background: #176ac7; }
.status-row { margin-top: 8px; }
.status-picker { flex: 1; min-width: 0; }
.status-control { min-height: 44px; justify-content: space-between; font-size: 14px; color: #333; }
.status-control text { overflow-wrap: anywhere; }
.reset-button { background: #f4f6f8; color: #176ac7; }
.load-state { padding: 12px 0 24px; text-align: center; font-size: 14px; color: #68788a; }

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
    font-size: 14px;
    font-weight: 600;
    color: #333;
  }

  &__name {
    font-size: 16px;
    font-weight: 600;
    color: #222;
    margin-bottom: 8px;
  }
}

.row {
  display: flex;
  margin-top: 6px;

  .label {
    width: 60px;
    font-size: 13px;
    color: #999;
    flex: none;
  }

  .val {
    flex: 1;
    font-size: 13px;
    color: #333;
  }
}

.progress {
  display: flex;
  background: #f0f7ff;
  border-radius: 8px;
  padding: 10px;
  margin-top: 10px;

  &__item {
    flex: 1;

    &__label {
      display: block;
      font-size: 12px;
      color: #999;
    }
  }

  &__label {
    font-size: 12px;
    color: #999;
  }

  &__val {
    display: block;
    font-size: 13px;
    color: #2f86ff;
    font-weight: 600;
    margin-top: 4px;

    &.warn {
      color: #f56c6c;
    }
  }
}
</style>
