<template>
  <wd-popup :model-value="modelValue" position="bottom" :z-index="2400" custom-style="height:80vh;border-radius:16px 16px 0 0;overflow:hidden" @update:model-value="emit('update:modelValue', $event)">
    <view class="panel">
      <view class="head"><text>{{ kind === 'project' ? '选择项目' : kind === 'supplier' ? '选择供应商' : '选择物料' }}</text><button @click="emit('update:modelValue', false)">关闭</button></view>
      <view class="search"><input v-model="keyword" :placeholder="kind === 'project' ? '搜索主项目或分期名称' : '输入名称搜索'" confirm-type="search" @confirm="search" /><button @click="search">查询</button></view>
      <scroll-view scroll-y class="body" :lower-threshold="100" @scrolltolower="load(false)">
        <button v-for="row in visibleRows" :key="String(row.periodId || row.id)" class="option" :disabled="excluded.includes(String(row.id))" @click="emit('select', row)">
          <text>{{ label(row) }}</text><text class="muted">{{ kind === 'material' ? [row.materialCode, row.model].filter(Boolean).join(' · ') : '' }}</text>
        </button>
        <view class="state"><text v-if="loading">正在加载…</text><button v-else-if="error" @click="load(kind === 'project' || !rows.length)">{{ error }}，点击重试</button><text v-else-if="!visibleRows.length">暂无匹配数据</text><text v-else-if="!more">没有更多了</text></view>
      </scroll-view>
    </view>
  </wd-popup>
</template>
<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { http } from '@/utils/http'
import { unwrapQuotation } from '@/service/quotationApproval'
import { useUserStore } from '@/store/user'
const props = defineProps<{ modelValue: boolean; kind: 'project' | 'supplier' | 'material'; excluded: string[] }>()
const emit = defineEmits(['update:modelValue', 'select'])
const user = useUserStore(), rows = ref<any[]>([]), keyword = ref(''), applied = ref(''), loading = ref(false), error = ref(''), more = ref(true)
let generation = 0, page = 0
const label = (row: any) => props.kind === 'project' ? [row.projectName, row.periodName].filter(Boolean).join('-') : props.kind === 'supplier' ? row.supplierName : row.materialName
const visibleRows = computed(() => props.kind === 'project' ? rows.value.filter(row => label(row).toLowerCase().includes(applied.value.toLowerCase())) : rows.value)
function search() { applied.value = keyword.value.trim(); if (props.kind !== 'project') void load(true) }
async function load(reset = false) {
  if (!props.modelValue || !reset && (loading.value || !more.value)) return
  if (reset) { generation++; page = 0; rows.value = []; more.value = true }
  const request = generation, token = user.userInfo.token, kind = props.kind
  const current = () => request === generation && token === user.userInfo.token && props.modelValue
  loading.value = true; error.value = ''
  try {
    // PC 项目选择使用完整可见分期列表，本地同时匹配主项目及分期名称。
    const accumulated = kind === 'project' ? new Map<string, any>() : new Map(rows.value.map(row => [String(row.id), row]))
    do {
      const next = page + 1, pageSize = kind === 'project' ? 100 : 20
      const url = { project: '/project/project/projectPeriodList', supplier: '/project/supplier/list', material: '/stock/material/list' }[kind]
      const filter = kind === 'supplier' ? 'supplierName' : 'materialName'
      const data = unwrapQuotation(await http.get(url, { pageNo: next, pageSize, ...(kind !== 'project' && applied.value ? { [filter]: applied.value } : {}) }))
      if (!current()) return
      const batch = Array.isArray(data) ? data : data?.records
      if (!Array.isArray(batch)) throw new Error('列表格式异常')
      const previous = accumulated.size
      for (const row of batch) { const key = String(kind === 'project' ? row.periodId || '' : row.id || ''); if (!key) throw new Error('记录缺少编号'); accumulated.set(key, row) }
      if (batch.length && accumulated.size === previous) throw new Error('分页未前进')
      page = next; more.value = !Array.isArray(data) && batch.length > 0 && (data.total != null ? next * pageSize < Number(data.total) : batch.length === pageSize)
    } while (kind === 'project' && more.value)
    rows.value = [...accumulated.values()]
  } catch (e: any) { if (current()) error.value = e?.message || '加载失败' }
  finally { if (current()) loading.value = false }
}
watch(() => [props.modelValue, props.kind], () => { generation++; loading.value = false; if (props.modelValue) { keyword.value = ''; applied.value = ''; void load(true) } })
onBeforeUnmount(() => { generation++ })
</script>
<style scoped>
.panel { height:100%; display:flex; flex-direction:column; background:#fff; padding-bottom:env(safe-area-inset-bottom); box-sizing:border-box; }
.head,.search { display:flex; align-items:center; justify-content:space-between; padding:8px 16px; gap:12px; }.head { font-size:17px; font-weight:600; border-bottom:1px solid #eaecf0; }
.search input { flex:1; min-width:0; font-size:16px; height:44px; padding:0 12px; background:#f5f7fa; border-radius:8px; }
.body { flex:1; height:0; }button { margin:0; min-height:44px; line-height:44px; padding:0 12px; font-size:14px; background:transparent; color:#176ac7; }button::after { border:none; }
.option { display:block; width:100%; padding:14px 16px; text-align:left; border-bottom:1px solid #eaecf0; border-radius:0; font-size:16px; line-height:1.6; color:#1d2939; overflow-wrap:anywhere; }.option[disabled] { color:#667085; background:#f5f7fa; }
.muted { display:block; font-size:13px; color:#667085; }.state { padding:24px 16px; text-align:center; color:#667085; font-size:14px; }
</style>
