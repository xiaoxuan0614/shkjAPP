<route lang="json5">
{ style: { navigationBarTitleText: '实施记录' } }
</route>
<template>
  <PageLayout :navbarShow="false">
    <view class="records-page">
      <view class="records-top">
        <button class="text-button" @click="back">返回上一级</button>
        <text class="project-name">{{ projectName || '项目实施记录' }}</text>
      </view>
      <view class="records-layout">
        <scroll-view scroll-y class="process-nav">
          <button :class="{ active: !processId }" @click="chooseProcess('')">全部工序</button>
          <button v-for="process in processes" :key="process.id" :class="{ active: processId === String(process.id) }" @click="chooseProcess(String(process.id))">
            {{ processLabel(process) }}
          </button>
          <button v-if="processError" @click="loadProcesses">工序加载失败，重试</button>
        </scroll-view>
        <scroll-view scroll-y class="record-list" :scroll-top="scrollTop" :lower-threshold="120" @scrolltolower="loadMore">
            <text v-if="!loading && !error && !records.length" class="state">该工序暂无实施记录</text>
            <view v-for="record in records" :key="record.id" class="implementation-entry">
              <view class="record-header">
                <text class="record-title">{{ dateText(record.logDate || record.signInTime) }} 实施日志</text>
                <text class="record-meta">{{ labelById(record.processId) }}</text>
              </view>
              <text class="record-content">{{ record.workContent || '暂未填写实施内容' }}</text>
              <view class="record-footer">
                <text>{{ record.submitterName || '未返回提交人' }} · {{ record.signOutTime ? '已签退' : '未签退' }}</text>
                <button class="text-button" :disabled="!record.id" @click="openDetail(record)">查看详情</button>
              </view>
            </view>
          <view class="load-status" role="status">
            <text v-if="loading">正在加载…</text>
            <template v-else-if="error"><text>{{ error }}</text><button @click="loadRecords(page + 1)">点击重试</button></template>
            <button v-else-if="hasMore" @click="loadMore">继续加载</button>
            <text v-else-if="records.length">已加载全部记录</text>
          </view>
        </scroll-view>
      </view>
      <view class="records-bottom"><button type="primary" :disabled="!periodId" @click="startImplement">开始实施</button></view>
    </view>
  </PageLayout>
</template>
<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { projectApi, unwrapRecords } from '@/service/shkj'
import { implementationRecordsApi } from '@/service/implementationRecords'
import { http } from '@/utils/http'
const periodId = ref(''), projectName = ref(''), processId = ref('')
const processes = ref<any[]>([]), records = ref<any[]>([])
const dict = ref<Record<string, string>>({})
const hasMore = ref(true)
const page = ref(0), total = ref(0), scrollTop = ref(0)
const loading = ref(false), processError = ref(false), error = ref('')
let requestId = 0
const dateText = (value: unknown) => String(value || '日期未返回').slice(0, 10)
const processLabel = (process: any) => dict.value[String(process.processName)] || process.processName_dictText || process.processName || '未命名工序'
const labelById = (id: unknown) => {
  const process = processes.value.find((item) => String(item.id) === String(id))
  return process ? processLabel(process) : '工序信息未返回'
}
const loadProcesses = async () => {
  processError.value = false
  try {
    const [processResponse, dictionary] = await Promise.all([
      projectApi.processes(periodId.value), http.get('/sys/dict/getDictItems/work_type').catch(() => null),
    ])
    processes.value = unwrapRecords(processResponse)
    dict.value = Object.fromEntries(unwrapRecords(dictionary).map((row: any) => [String(row.value), row.text || row.label]))
  } catch { processError.value = true }
}
const loadRecords = async (nextPage = 1) => {
  if (nextPage > 1 && (loading.value || !hasMore.value)) return
  const request = ++requestId
  loading.value = true; error.value = ''
  if (nextPage === 1) { records.value = []; page.value = 0; total.value = 0; hasMore.value = true; scrollTop.value = 1; await nextTick(); if (request !== requestId) return; scrollTop.value = 0 }
  try {
    if (!periodId.value) throw new Error('缺少项目分期信息，请返回项目详情重新进入')
    const response: any = await implementationRecordsApi.list(periodId.value, processId.value, nextPage)
    if (request !== requestId) return
    const result = response?.result
    if (!Array.isArray(result?.records)) throw new Error('实施记录响应格式异常')
    if (result.records.some((row: any) => String(row.periodId) !== periodId.value || (processId.value && String(row.processId) !== processId.value))) {
      throw new Error('接口未按当前项目工序返回记录，请联系管理员核对')
    }
    records.value = [...new Map([...records.value, ...result.records].map(row => [row.id, row])).values()]
    total.value = Number(result.total || 0); page.value = nextPage
    hasMore.value = result.records.length > 0 && nextPage * 10 < total.value
  } catch (reason: any) {
    if (request === requestId) { error.value = reason?.message || '实施记录加载失败，请重试' }
  } finally { if (request === requestId) loading.value = false }
}
const loadMore = () => { if (!loading.value && !error.value && hasMore.value) return loadRecords(page.value + 1) }
const chooseProcess = (id: string) => { processId.value = id; void loadRecords(1) }
const openDetail = (record: any) => uni.navigateTo({ url: `/pages/ops/implementRecordDetail?id=${encodeURIComponent(record.id)}&periodId=${encodeURIComponent(periodId.value)}&projectName=${encodeURIComponent(projectName.value)}&processName=${encodeURIComponent(labelById(record.processId))}` })
const startImplement = () => uni.navigateTo({ url: `/pages/ops/implementLog?projectId=${encodeURIComponent(periodId.value)}` })
const back = () => {
  if (getCurrentPages().length > 1) uni.navigateBack()
  else uni.redirectTo({ url: `/pages/ops/projectDetail?id=${encodeURIComponent(periodId.value)}` })
}
onLoad((query) => {
  periodId.value = String(query?.periodId || ''); projectName.value = String(query?.projectName || '')
  processId.value = String(query?.processId || '')
  if (periodId.value) void loadProcesses()
  void loadRecords()
})
</script>
<style scoped>
.records-page { height: calc(100vh - 44px); display: flex; flex-direction: column; background: #f5f7fa; color: #253247; }
.records-top { padding: 8px 12px; }
.text-button { background: transparent; color: #176ac7; border: 0; margin: 0; padding: 0 4px; font-size: 14px; min-height: 44px; line-height: 44px; }
.text-button::after { border: 0; }
.records-top .text-button { display: inline-block; }
.project-name { display: block; font-size: 16px; font-weight: 600; margin: 4px 0 8px; overflow-wrap: anywhere; }
.records-layout { display: flex; flex: 1; min-height: 0; }
.records-layout .process-nav { width: 92px; flex: 0 0 92px; height: 100%; }
.process-nav button { font-size: 14px; margin: 0; padding: 12px 8px; line-height: 1.5; border-radius: 0; background: transparent; min-height: 48px; color: #536176; }
.process-nav button::after { border: 0; }
.process-nav button.active { color: #176ac7; background: #fff; font-weight: 600; }
.record-list { flex: 1; min-width: 0; height: 100%; background: #fff; }
.implementation-entry { padding: 14px 12px; border-bottom: 1px solid #e3e8ee; }
.record-header { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.record-title { display: block; flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: 16px; font-weight: 600; }
.record-meta { display: block; flex-shrink: 0; max-width: 40%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; text-align: right; color: #536176; font-size: 14px; }
.record-content { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; overflow-wrap: anywhere; font-size: 15px; line-height: 1.6; max-height: 3.2em; }
.record-footer { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; margin-top: 8px; gap: 4px; font-size: 13px; color: #536176; }
.load-status { padding: 20px 12px; text-align: center; color: #536176; font-size: 13px; }
.load-status text { display: block; }
.load-status button { min-height: 44px; line-height: 44px; padding: 0 12px; margin: 4px auto 0; background: transparent; color: #176ac7; font-size: 14px; }
.load-status button::after { border: 0; }
.state { display: block; padding: 24px 12px; font-size: 15px; color: #536176; line-height: 1.7; }
.state button { margin-top: 12px; font-size: 15px; }
.records-bottom { padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); background: #fff; border-top: 1px solid #e3e8ee; }
.records-bottom button { background: #176ac7; font-size: 16px; min-height: 48px; }
</style>
