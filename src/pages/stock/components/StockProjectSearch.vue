<template>
  <wd-popup :model-value="true" position="bottom" custom-style="border-radius:16px 16px 0 0;" @close="emit('close')">
    <view class="project-search">
      <view class="project-search__head"><text>按项目名称查询</text><button @click="emit('close')">关闭</button></view>
      <view class="project-search__input">
        <input v-model="keyword" placeholder="输入主项目或分期项目名称" confirm-type="search" @confirm="search" />
        <button @click="search">查询</button>
      </view>
      <text class="project-search__hint">选择项目后查看对应出入库记录</text>
      <scroll-view scroll-y class="project-search__results">
        <button v-for="item in rows" :key="item.periodId || item.id" class="project-search__row" @click="choose(item)">
          <text>{{ item.projectName || '主项目名称未返回' }}</text><text>{{ item.periodName || '分期名称未返回' }}</text>
        </button>
        <text v-if="loading" class="project-search__state">正在查询…</text>
        <button v-else-if="error" @click="fetchPage">项目查询失败，点击重试</button>
        <text v-else-if="!rows.length" class="project-search__state">未找到匹配项目，请更换名称查询</text>
        <button v-if="!loading && !error && hasMore" @click="fetchPage">加载更多项目</button>
      </scroll-view>
    </view>
  </wd-popup>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { projectApi, unwrapRecords } from '@/service/shkj'
const emit = defineEmits<{ close: []; select: [value: { id: string; label: string }] }>()
const keyword = ref(''), rows = ref<any[]>([]), loading = ref(false), error = ref(false), hasMore = ref(true)
let query = '', page = 1, requestId = 0
let mainMore = true, periodMore = true
const fetchPage = async () => {
  const request = ++requestId
  loading.value = true; error.value = false
  const currentPage = page
  try {
    // 两路分页查询实现主项目名 OR 分期名；不能同时传两个字段变成 AND。
    const [mainResponse, periodResponse]: any[] = await Promise.all([
      mainMore ? projectApi.list({ pageNo: currentPage, pageSize: 10, ...(query ? { projectName: query } : {}) }) : null,
      query && periodMore ? projectApi.list({ pageNo: currentPage, pageSize: 10, periodName: query }) : null,
    ])
    if (request !== requestId) return
    for (const response of [mainResponse, periodResponse]) {
      if (response && !Array.isArray(response.result?.records)) throw new Error('项目列表响应异常')
    }
    const merged = new Map(rows.value.map(item => [String(item.periodId || item.id), item]))
    for (const item of [...unwrapRecords(mainResponse), ...unwrapRecords(periodResponse)]) {
      const id = String(item.periodId || item.id || '')
      if (id) merged.set(id, item)
    }
    rows.value = [...merged.values()]
    mainMore = Boolean(mainResponse && currentPage * 10 < Number(mainResponse.result.total || 0))
    periodMore = Boolean(periodResponse && currentPage * 10 < Number(periodResponse.result.total || 0))
    hasMore.value = mainMore || periodMore
    page++
  } catch { if (request === requestId) error.value = true }
  finally { if (request === requestId) loading.value = false }
}
const search = () => {
  query = keyword.value.trim(); page = 1; mainMore = true; periodMore = true
  rows.value = []; hasMore.value = true; void fetchPage()
}
const choose = (item: any) => emit('select', {
  id: String(item.periodId || item.id),
  label: [item.projectName, item.periodName].filter(Boolean).join('-'),
})
onMounted(search)
</script>
<style scoped>
.project-search { display: flex; flex-direction: column; height: 75vh; padding: 16px 16px calc(16px + env(safe-area-inset-bottom)); box-sizing: border-box; background: #fff; color: #253247; }
.project-search__head { display: flex; justify-content: space-between; align-items: center; font-size: 18px; font-weight: 600; }
.project-search button { min-height: 44px; font-size: 14px; }
.project-search__head button, .project-search__input button { margin: 0; padding: 0 12px; line-height: 44px; }
.project-search__input { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
.project-search__input input { flex: 1; min-width: 0; height: 44px; padding: 0 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 16px; }
.project-search__hint { font-size: 14px; color: #596574; margin: 12px 0; }
.project-search .project-search__results { flex: 1; min-height: 0; height: 0; }
.project-search .project-search__row { display: flex; justify-content: space-between; align-items: center; gap: 12px; width: 100%; text-align: left; padding: 12px 0; margin: 0; background: #fff; border-radius: 0; border-bottom: 1px solid #edf0f4; line-height: 1.6; }
.project-search__row::after { border: 0; }
.project-search__row text:first-child { font-size: 16px; flex: 1; min-width: 0; overflow-wrap: anywhere; }
.project-search__row text:last-child { font-size: 14px; color: #596574; max-width: 45%; overflow-wrap: anywhere; text-align: right; }
.project-search__state { display: block; padding: 24px 0; font-size: 14px; color: #596574; text-align: center; }
</style>
