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
        <scroll-view scroll-y class="record-list" :scroll-top="scrollTop">
          <text v-if="loading" class="state">正在加载实施记录…</text>
          <view v-else-if="error" class="state"><text>{{ error }}</text><button @click="loadRecords(page)">重新加载</button></view>
          <template v-else>
            <text v-if="!records.length" class="state">该工序暂无实施记录</text>
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
          </template>
          <view class="pagination">
            <button :disabled="loading || page <= 1" @click="loadRecords(page - 1)">上一页</button>
            <text>{{ page }} / {{ Math.max(1, Math.ceil(total / 10)) }}</text>
            <button :disabled="loading || page * 10 >= total" @click="loadRecords(page + 1)">下一页</button>
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
const page = ref(1), total = ref(0), scrollTop = ref(0)
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
  const request = ++requestId
  loading.value = true; error.value = ''; page.value = nextPage
  try {
    if (!periodId.value) throw new Error('缺少项目分期信息，请返回项目详情重新进入')
    const response: any = await implementationRecordsApi.list(periodId.value, processId.value, nextPage)
    if (request !== requestId) return
    const result = response?.result
    if (!Array.isArray(result?.records)) throw new Error('实施记录响应格式异常')
    if (result.records.some((row: any) => String(row.periodId) !== periodId.value || (processId.value && String(row.processId) !== processId.value))) {
      throw new Error('接口未按当前项目工序返回记录，请联系管理员核对')
    }
    records.value = result.records; total.value = Number(result.total || 0)
    scrollTop.value = 1; await nextTick(); scrollTop.value = 0
  } catch (reason: any) {
    if (request === requestId) { records.value = []; error.value = reason?.message || '实施记录加载失败，请重试' }
  } finally { if (request === requestId) loading.value = false }
}
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
.pagination { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 4px; padding: 12px 6px; font-size: 13px; }
.pagination button { margin: 0; padding: 0 6px; min-height: 44px; font-size: 13px; line-height: 44px; }
.state { display: block; padding: 24px 12px; font-size: 15px; color: #536176; line-height: 1.7; }
.state button { margin-top: 12px; font-size: 15px; }
.records-bottom { padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); background: #fff; border-top: 1px solid #e3e8ee; }
.records-bottom button { background: #176ac7; font-size: 16px; min-height: 48px; }
</style>
