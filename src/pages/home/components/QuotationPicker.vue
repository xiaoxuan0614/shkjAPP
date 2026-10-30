<template>
  <wd-popup :model-value="modelValue" position="bottom" :close-on-click-modal="!loading" :z-index="zIndex ?? 2400" custom-style="height:82vh;border-radius:16px 16px 0 0;overflow:hidden;" @update:model-value="emit('update:modelValue', $event)">
    <view class="picker-panel">
      <view class="picker-head"><text>{{ title }}</text><button @click="emit('update:modelValue', false)">关闭</button></view>
      <view class="picker-search"><input v-model="keyword" :placeholder="kind === 'project' ? '搜索主项目或分期名称' : '输入名称搜索'" confirm-type="search" @confirm="load(true)" /><button @click="load(true)">查询</button></view>
      <scroll-view scroll-y class="picker-body" :lower-threshold="100" @scrolltolower="load(false)">
        <button v-for="row in rows" :key="String(row.periodId || row.id)" class="picker-option" :disabled="excluded.includes(String(row.id))" @click="emit('select', row)">
          <view class="picker-name">{{ kind === 'project' ? row.projectName || '未命名主项目' : kind === 'material' ? row.materialName : row.name }}<text v-if="excluded.includes(String(row.id))" class="secondary">已添加</text></view>
          <text class="secondary">{{ kind === 'project' ? row.periodName || '未命名分期' : kind === 'material' ? [row.materialCode, row.model].filter(Boolean).join(' · ') : row.description || row.unit || '服务费' }}</text>
        </button>
        <view class="picker-state"><text v-if="loading">正在加载…</text><button v-else-if="error" @click="load(rows.length === 0)">{{ error }}，点击重试</button><text v-else-if="!rows.length">暂无匹配数据</text><text v-else-if="!more">没有更多了</text></view>
      </scroll-view>
    </view>
  </wd-popup>
</template>
<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { http } from '@/utils/http'
import { useUserStore } from '@/store/user'
import { unwrapQuotation } from '@/service/quotationApproval'
const props = defineProps<{ modelValue: boolean; kind: 'project' | 'material' | 'fee'; excluded: string[]; zIndex?: number }>()
const emit = defineEmits(['update:modelValue', 'select'])
const user = useUserStore()
const title = computed(() => ({ project: '选择项目', material: '选择物料', fee: '选择服务费' })[props.kind])
const rows = ref<any[]>([]), keyword = ref(''), loading = ref(false), error = ref(''), more = ref(true)
let sequence = 0, page = 0, appliedKeyword = ''
async function load(reset: boolean) {
  if (!props.modelValue || !reset && (loading.value || !more.value)) return
  if (reset) { sequence++; page = 0; rows.value = []; more.value = true; appliedKeyword = keyword.value.trim() }
  const request = sequence, token = user.userInfo.token, next = page + 1
  loading.value = true; error.value = ''
  try {
    const urls = { project: '/project/period/searchByName', material: '/stock/material/list', fee: '/project/serviceFee/list' }
    const field = { project: 'keyword', material: 'materialName', fee: 'name' }[props.kind]
    const data = unwrapQuotation(await http.get(urls[props.kind], { pageNo: next, pageSize: 20, ...(appliedKeyword ? { [field]: appliedKeyword } : {}) }))
    if (request !== sequence || token !== user.userInfo.token || !props.modelValue) return
    const batch = Array.isArray(data) ? data : data?.records
    if (!Array.isArray(batch)) throw new Error('列表返回格式异常')
    const key = (row: any) => String(props.kind === 'project' ? row.periodId || '' : row.id || '')
    if (batch.some(row => !key(row))) throw new Error('记录缺少编号')
    const merged = new Map(rows.value.map(row => [key(row), row]))
    batch.forEach(row => merged.set(key(row), row))
    if (batch.length && next > 1 && merged.size === rows.value.length) throw new Error('接口重复返回同一页')
    rows.value = [...merged.values()]; page = next
    more.value = !Array.isArray(data) && batch.length > 0 && (data.total != null ? next * 20 < Number(data.total) : batch.length === 20)
  } catch (e: any) { if (request === sequence) error.value = e.message || '加载失败' }
  finally { if (request === sequence) loading.value = false }
}
watch(() => [props.modelValue, props.kind], () => { sequence++; loading.value = false; if (props.modelValue) { keyword.value = ''; void load(true) } })
onBeforeUnmount(() => { sequence++ })
</script>
<style scoped>
.picker-panel { height: 100%; display: flex; flex-direction: column; background: #fff; padding-bottom: env(safe-area-inset-bottom); box-sizing: border-box; }
.picker-head { display: flex; justify-content: space-between; align-items: center; padding: 8px 16px; font-size: 17px; font-weight: 600; border-bottom: 1px solid #eaecf0; }
button { margin: 0; min-height: 44px; line-height: 44px; padding: 0 12px; font-size: 14px; background: transparent; color: #176ac7; } button::after { border: none; }
.picker-search { display: flex; gap: 8px; padding: 12px 16px; }.picker-search input { flex: 1; min-width: 0; height: 44px; padding: 0 12px; border-radius: 8px; background: #f2f4f7; font-size: 16px; }
.picker-body { flex: 1; height: 0; }.picker-option { display: block; width: 100%; padding: 16px; border-bottom: 1px solid #eaecf0; border-radius: 0; color: #1d2939; text-align: left; line-height: 1.6; }
.picker-name { display: flex; justify-content: space-between; gap: 12px; font-size: 16px; overflow-wrap: anywhere; }.secondary { display: block; font-size: 13px; color: #667085; overflow-wrap: anywhere; }.picker-state { padding: 24px 16px; text-align: center; color: #667085; font-size: 14px; }
</style>
