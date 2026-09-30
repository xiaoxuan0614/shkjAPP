<template>
  <wd-popup v-model="visible" position="bottom" :root-portal="true" :z-index="2100" :safe-area-inset-bottom="false" custom-style="border-radius:16px 16px 0 0;overflow:hidden;">
    <view class="quotation-detail">
      <view class="quotation-detail__head"><text>报价详情</text><button aria-label="关闭报价详情" @click="close"><wd-icon name="close" size="20px" /></button></view>
      <scroll-view scroll-y class="quotation-detail__body">
        <view class="quotation-detail__content">
          <view v-if="loading" class="quotation-detail__hint">正在加载报价详情…</view>
          <view v-else-if="error" class="quotation-detail__hint">{{ error }}<button @click="load">重新加载</button></view>
          <template v-else>
            <view class="quotation-detail__title">{{ record.candidateName || '报价单' }}</view>
            <view class="quotation-detail__hint">{{ projectLabel }}</view>
            <view class="quotation-detail__meta"><text>报价状态</text><text>{{ statusText }}</text></view>
            <view class="quotation-detail__meta"><text>审批线路</text><text>{{ record.approvalRoute === 'MARKET' ? '市场审批' : record.approvalRoute === 'TECHNICAL' ? '技术审批' : record.approvalRoute || '—' }}</text></view>
            <view class="quotation-detail__meta"><text>创建时间</text><text>{{ record.createTime || '—' }}</text></view>
            <view v-if="record.remark" class="quotation-detail__meta"><text>备注</text><text>{{ record.remark }}</text></view>
            <view class="quotation-detail__section-title">报价明细</view>
            <view v-if="itemsLoading" class="quotation-detail__hint">正在加载明细…</view>
            <view v-else-if="itemsError" class="quotation-detail__hint">{{ itemsError }}<button @click="loadItems(page)">重试明细</button></view>
            <template v-else>
              <view v-if="!items.length" class="quotation-detail__hint">暂无报价明细</view>
              <view v-for="item in items" :key="item.id" class="quotation-detail__item">
                <view class="quotation-detail__item-head"><text>{{ item.materialName || '未命名物料' }}</text><text>{{ item.materialCode || '' }}</text></view>
                <view class="quotation-detail__hint">{{ [item.brand, item.model].filter(Boolean).join(' · ') || '暂无品牌规格' }}</view>
                <view class="quotation-detail__meta"><text>数量</text><text>{{ item.quantity ?? '—' }}{{ item.unit || '' }}</text></view>
                <view class="quotation-detail__meta"><text>成本单价</text><text>{{ money(item.basePrice) }}</text></view>
                <view v-if="record.approvalRoute === 'MARKET' || String(record.priced) === '1'" class="quotation-detail__meta"><text>报价单价</text><text>{{ money(item.finalPrice) }}</text></view>
                <view v-if="item.approvalOpinion" class="quotation-detail__meta"><text>审批意见</text><text>{{ item.approvalOpinion }}</text></view>
              </view>
            </template>
            <view class="quotation-detail__pages"><button :disabled="itemsLoading || page <= 1" @click="loadItems(page - 1)">上一页</button><text>第 {{ page }} 页</text><button :disabled="itemsLoading || !hasMore" @click="loadItems(page + 1)">下一页</button></view>
          </template>
        </view>
      </scroll-view>
      <view class="quotation-detail__footer"><text>此处仅查看，报价审批请在 PC 端办理</text><button @click="close">关闭详情</button></view>
    </view>
  </wd-popup>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { http } from '@/utils/http'
import { parseTodoActionParams, type TodoRecord } from '@/service/todo'

const visible = ref(false), loading = ref(false), error = ref('')
const record = ref<any>({}), projectLabel = ref('')
const items = ref<any[]>([]), itemsLoading = ref(false), itemsError = ref('')
const page = ref(1), hasMore = ref(false)
let periodId = '', candidateId = '', version = 0, itemVersion = 0
const statusLabels: Record<string, string> = { '-1': '草稿', '0': '已驳回', '1': '审批通过', '2': '待审批', '4': '已作废' }
const statusText = computed(() => statusLabels[String(record.value.status)] || String(record.value.status ?? '—'))
const money = (value: any) => value == null || value === '' || !Number.isFinite(Number(value)) ? '—' : `¥${Number(value).toFixed(2)}`
function pageData(response: any) {
  const result = response?.result ?? response
  if (response?.success === false || (!Array.isArray(result) && !Array.isArray(result?.records))) throw new Error('报价数据格式异常，请重试')
  return { rows: Array.isArray(result) ? result : result.records, total: Array.isArray(result) ? result.length : result.total, array: Array.isArray(result) }
}
async function loadItems(nextPage = 1) {
  const request = ++itemVersion
  itemsLoading.value = true; itemsError.value = ''; items.value = []; page.value = nextPage
  try {
    const response = await http.get('/project/materialCandidateItem/list', { candidateId, pageNo: nextPage, pageSize: 10 })
    if (request !== itemVersion || !visible.value) return
    const data = pageData(response)
    items.value = data.array ? data.rows.slice((nextPage - 1) * 10, nextPage * 10) : data.rows
    hasMore.value = data.total != null ? nextPage * 10 < Number(data.total) : data.rows.length === 10
  } catch (e: any) { if (request === itemVersion) { itemsError.value = e?.message || '明细加载失败'; hasMore.value = false } }
  finally { if (request === itemVersion) itemsLoading.value = false }
}
async function load() {
  const request = ++version
  itemVersion++; loading.value = true; error.value = ''; record.value = {}; items.value = []
  try {
    if (!periodId || !candidateId) throw new Error('待办缺少项目分期或报价单 ID，请刷新待办核实')
    // 与 PC 保持一致：按分期分页查找准确报价单，不拿第一条代替。
    const seenPages = new Set<string>()
    for (let pageNo = 1; ; pageNo++) {
      const response = await http.get('/project/materialCandidate/list', { periodId, pageNo, pageSize: 100 })
      if (request !== version || !visible.value) return
      const data = pageData(response)
      const signature = JSON.stringify(data.rows.map((row: any) => row.id))
      if (seenPages.has(signature)) throw new Error('报价列表分页返回重复，请刷新后重试')
      seenPages.add(signature)
      const found = data.rows.find((row: any) => String(row.id) === candidateId)
      if (found) {
        if (found.periodId && String(found.periodId) !== periodId) throw new Error('报价单不属于当前项目分期')
        record.value = found; break
      }
      if (data.array || !data.rows.length || (data.total != null ? pageNo * 100 >= Number(data.total) : data.rows.length < 100)) throw new Error('未找到当前报价单，请刷新待办核实')
    }
    await loadItems(1)
  } catch (e: any) { if (request === version) error.value = e?.message || '报价详情加载失败' }
  finally { if (request === version) loading.value = false }
}
function close() { visible.value = false; version++; itemVersion++ }
function open(todo: TodoRecord) {
  const params = parseTodoActionParams(todo.actionParams)
  periodId = String(params.periodId || todo.bizSubId || '').trim()
  candidateId = String(params.candidateId || todo.bizId || '').trim()
  projectLabel.value = [todo.projectName, todo.periodName].filter(Boolean).join('-') || todo.summary || '未提供项目名称'
  visible.value = true; page.value = 1; hasMore.value = false; void load()
}
defineExpose({ open })
</script>

<style scoped>
.quotation-detail { display:flex; flex-direction:column; height:78vh; height:78dvh; max-height:720px; max-width:720px; margin:auto; background:#fff; color:#333; font-size:14px; line-height:1.6; box-sizing:border-box; padding-bottom:env(safe-area-inset-bottom, 0px); }
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
.quotation-detail__item { padding:16px 0; border-bottom:1px solid #edf0f3; }
.quotation-detail__item-head { display:flex; align-items:baseline; gap:12px; justify-content:space-between; overflow-wrap:anywhere; }
.quotation-detail__item-head > text:first-child { font-weight:500; }
.quotation-detail__item-head > text:last-child { color:#667085; font-size:12px; }
.quotation-detail__pages { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-top:16px; }
.quotation-detail__footer { flex-shrink:0; padding:12px 16px; border-top:1px solid #edf0f3; }
.quotation-detail__footer > text { display:block; color:#667085; font-size:12px; margin-bottom:8px; text-align:center; }
.quotation-detail__footer button { width:100%; color:#fff; background:#176ac7; }
.quotation-detail button:focus-visible { outline:2px solid #176ac7; outline-offset:2px; }
</style>
