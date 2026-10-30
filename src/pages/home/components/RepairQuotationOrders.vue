<template>
  <scroll-view scroll-y class="orders" :lower-threshold="100" @scrolltolower="load(false)">
    <view class="intro">选择我负责的维修单，办理报价或查看已提交报价。报价权限以维修单当前状态为准。</view>
    <button v-for="row in rows" :key="row.id" class="order" :disabled="opening" @click="open(row)">
      <text class="name">{{ row.customerNameSnapshot || row.customerName || row.projectNameSnapshot || row.projectName || '维修单' }}</text>
      <text class="secondary">{{ row.productNames || row.productName || row.faultDescription || '查看报修信息' }}</text>
      <view class="meta"><text>{{ String(row.reportTime || row.createTime || '').replace('T', ' ').slice(0, 16) }}</text><text class="link">查看／办理报价 ›</text></view>
    </button>
    <view class="state"><text v-if="loading">正在加载…</text><button v-else-if="error" @click="load(!rows.length)">{{ error }}，点击重试</button><text v-else-if="!rows.length">暂无我负责的维修单</text><text v-else-if="!more">没有更多了</text></view>
  </scroll-view>
</template>
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { repairOrderApi } from '@/service/repairOrder'
import { useUserStore } from '@/store/user'
const rows = ref<any[]>([]), loading = ref(false), error = ref(''), more = ref(true), opening = ref(false)
const user = useUserStore()
let page = 0, alive = true
async function load(reset: boolean) {
  if (loading.value || !reset && !more.value) return
  if (reset) { page = 0; rows.value = []; more.value = true }
  loading.value = true; error.value = ''
  const token = user.userInfo.token
  try {
    const data = await repairOrderApi.list({ scope: 'RESPONSIBLE', pageNo: page + 1, pageSize: 20 })
    if (!alive || token !== user.userInfo.token) return
    if (!Array.isArray(data.records) || data.records.some(row => !row.id)) throw new Error('维修列表返回异常')
    const merged = new Map(rows.value.map(row => [row.id, row]))
    data.records.forEach(row => merged.set(row.id, row))
    if (data.records.length && page && merged.size === rows.value.length) throw new Error('接口重复返回同一页')
    rows.value = [...merged.values()]; page++
    more.value = data.records.length > 0 && (data.total == null ? data.records.length === 20 : page * 20 < Number(data.total))
  } catch (e: any) { if (alive) error.value = e.message || '加载失败' }
  finally { if (alive) loading.value = false }
}
function open(row: any) {
  if (opening.value) return
  opening.value = true
  uni.navigateTo({ url: `/pages/ops/repairDetail?id=${encodeURIComponent(row.id)}&view=quote`, complete: () => { opening.value = false } })
}
onMounted(() => load(true))
onBeforeUnmount(() => { alive = false })
</script>
<style scoped>
.orders{flex:1;height:0;min-height:0;background:#f3f5f8}.intro{padding:16px;color:#667085;font-size:13px;line-height:1.6}.order{display:block;text-align:left;margin:0 12px 12px;padding:16px;background:#fff;border-radius:10px;line-height:1.6}.order::after{border:0}.name{display:block;font-size:16px;color:#27364a;font-weight:600;overflow-wrap:anywhere}.secondary{display:block;font-size:14px;color:#667085;margin-top:6px;overflow-wrap:anywhere}.meta{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;margin-top:12px;font-size:12px;color:#667085}.link{color:#176ac7}.state{padding:24px 16px calc(24px + env(safe-area-inset-bottom));text-align:center;color:#667085;font-size:14px}
</style>
