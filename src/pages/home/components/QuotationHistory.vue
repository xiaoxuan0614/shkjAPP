<template>
  <wd-popup :model-value="modelValue" position="bottom" :z-index="2300" custom-style="height:75vh;border-radius:16px 16px 0 0;overflow:hidden;" @update:model-value="emit('update:modelValue', $event)">
    <view class="history"><view class="history-head"><text>报价操作记录</text><button @click="emit('update:modelValue', false)">关闭</button></view>
      <view class="scope"><switch :checked="wholePeriod" :disabled="loading" @change="wholePeriod = $event.detail.value; load(true)" /><text>本分期全部记录（含授权）</text></view>
      <scroll-view scroll-y class="history-body" @scrolltolower="load(false)">
        <view v-for="(row, index) in rows" :key="row.id || index" class="history-row"><view class="history-row-head"><text>{{ dict(actions, row.action) }}</text><text>{{ dict(results, row.result) }}</text></view><view class="secondary">{{ row.actorName || '—' }} · {{ row.createTime || '—' }}</view><view v-if="row.reason" class="reason">{{ row.reason }}</view></view>
        <view class="state"><text v-if="loading">正在加载…</text><button v-else-if="error" @click="load(!rows.length)">{{ error }}，重试</button><text v-else-if="!rows.length">暂无操作记录</text><text v-else-if="!more">没有更多记录</text></view>
      </scroll-view>
    </view>
  </wd-popup>
</template>
<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import { http } from '@/utils/http'
import { useUserStore } from '@/store/user'
import { unwrapQuotation } from '@/service/quotationApproval'
const props = defineProps<{ modelValue: boolean; periodId: string; candidateId: string }>()
const emit = defineEmits(['update:modelValue'])
const user = useUserStore(), rows = ref<any[]>([]), actions = ref<any[]>([]), results = ref<any[]>([])
const wholePeriod = ref(false), loading = ref(false), more = ref(true), error = ref('')
let page = 0, sequence = 0
const dict = (options: any[], value: unknown) => { const option = options.find(item => String(item.value) === String(value)); return option?.text || option?.label || String(value ?? '—') }
async function load(reset: boolean) {
  if (!props.modelValue || !reset && (loading.value || !more.value)) return
  if (reset) { sequence++; page = 0; rows.value = []; more.value = true }
  const request = sequence, token = user.userInfo.token
  loading.value = true; error.value = ''
  try {
    const data = unwrapQuotation(await http.get('/project/materialCandidate/history', { periodId: props.periodId, ...(!wholePeriod.value ? { candidateId: props.candidateId } : {}), pageNo: page + 1, pageSize: 20 }))
    if (request !== sequence || token !== user.userInfo.token) return
    if (!Array.isArray(data)) throw new Error('操作记录格式异常')
    rows.value.push(...data); page++; more.value = data.length === 20
  } catch (e: any) { if (request === sequence) error.value = e.message || '加载失败' }
  finally { if (request === sequence) loading.value = false }
}
watch(() => props.modelValue, async open => {
  sequence++; loading.value = false
  if (!open) return
  wholePeriod.value = false; void load(true)
  const request = sequence
  const values = await Promise.all(['operation_log', 'approval_status'].map(code => http.get(`/sys/dict/getDictItems/${code}`).then(unwrapQuotation).catch(() => [])))
  if (request === sequence) { actions.value = Array.isArray(values[0]) ? values[0] : []; results.value = Array.isArray(values[1]) ? values[1] : [] }
})
onBeforeUnmount(() => { sequence++ })
</script>
<style scoped>
.history { height:100%; display:flex; flex-direction:column; padding-bottom:env(safe-area-inset-bottom); box-sizing:border-box; }
.history-head { display:flex; justify-content:space-between; align-items:center; padding:8px 16px; font-size:17px; font-weight:600; }
button { margin:0; background:transparent; color:#176ac7; min-height:44px; line-height:44px; font-size:14px; } button::after { border:none; }
.scope { display:flex; align-items:center; gap:8px; padding:8px 16px; font-size:14px; background:#f5f7fa; }
.history-body { flex:1; height:0; }.history-row { padding:16px; border-bottom:1px solid #eaecf0; }.history-row-head { display:flex; justify-content:space-between; gap:12px; font-size:16px; color:#1d2939; }.secondary { margin-top:8px; color:#667085; font-size:13px; }.reason { margin-top:12px; font-size:14px; line-height:1.6; white-space:pre-wrap; overflow-wrap:anywhere; }.state { padding:24px 16px; color:#667085; text-align:center; font-size:14px; }
</style>
