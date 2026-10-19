<template>
  <wd-popup :model-value="true" position="bottom" :z-index="11000" custom-style="border-radius:16px 16px 0 0;" @close="emit('close')">
    <view class="popup">
      <text class="title">选择物料</text>
      <view class="search"><input v-model="keyword" placeholder="输入编码、名称、品牌或型号" confirm-type="search" /><button size="mini" @click="keyword = ''">清空</button></view>
      <view class="toolbar"><text>共 {{ filtered.length }} 项 · 已选 {{ chosen.length }} 项</text><button size="mini" :disabled="!paged.length || loading || failed" @click="togglePage">{{ allSelected ? '取消本页全选' : '本页全选' }}</button></view>
      <scroll-view scroll-y class="list">
        <text v-if="loading" class="hint">正在加载物料…</text>
        <button v-else-if="failed" @click="load">物料加载失败，点击重试</button>
        <template v-else><view v-for="m in paged" :key="m.id" class="material" :class="{ on: chosen.some(s => s.id === m.id) }" @click="toggle(m)"><view class="body"><view class="heading"><text>{{ m.name }}</text><text class="hint">{{ m.code || '暂无编码' }}</text></view><text class="hint">{{ [m.brand, m.spec].filter(Boolean).join(' · ') || '暂无规格' }}</text><text class="hint">库存 {{ m.stock }} {{ m.unit }}</text></view><checkbox :checked="chosen.some(s => s.id === m.id)" color="#1769c2" /></view><text v-if="!filtered.length" class="hint">{{ keyword ? '没有找到匹配的物料' : '暂无可选物料' }}</text></template>
      </scroll-view>
      <view class="toolbar"><button size="mini" :disabled="loading || failed || page <= 1" @click="page--">上一页</button><text>{{ page }} / {{ pages }}</text><button size="mini" :disabled="loading || failed || page >= pages" @click="page++">下一页</button></view>
      <view class="actions"><button @click="emit('close')">取消</button><button type="primary" :disabled="loading || failed" @click="emit('confirm', chosen)">确定（{{ chosen.length }}）</button></view>
    </view>
  </wd-popup>
</template>
<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { stockApi, normalizeMaterial, unwrapRecords } from '@/service/shkj'
import type { RepairMaterial } from './repairWorkflow'
const props = defineProps<{ selected: RepairMaterial[] }>()
const emit = defineEmits<{ close: []; confirm: [materials: RepairMaterial[]] }>()
const chosen = ref(props.selected.map(m => ({ ...m }))), materials = ref<RepairMaterial[]>([])
const keyword = ref(''), page = ref(1), loading = ref(false), failed = ref(false)
const filtered = computed(() => materials.value.filter(m => [m.code, m.name, m.brand, m.spec].some(s => s?.toLowerCase().includes(keyword.value.trim().toLowerCase()))))
const pages = computed(() => Math.max(1, Math.ceil(filtered.value.length / 10)))
const paged = computed(() => filtered.value.slice((page.value - 1) * 10, page.value * 10))
const allSelected = computed(() => !!paged.value.length && paged.value.every(m => chosen.value.some(s => s.id === m.id)))
watch(keyword, () => { page.value = 1 })
let version = 0
onBeforeUnmount(() => { version++ })
async function load() {
  const current = ++version
  loading.value = true; failed.value = false
  const rows: RepairMaterial[] = []
  try {
    // Same directory and local keyword matching as the existing non-project application.
    // Continue beyond its default 1000-row page so search covers the complete directory.
    for (let pageNo = 1; ; pageNo++) {
      const res: any = await stockApi.materials({ pageNo, pageSize: 1000 })
      if (current !== version) return
      if (res?.success === false) throw new Error('物料查询失败')
      const raw = unwrapRecords(res), payload = res?.result ?? res
      const previousCount = rows.length
      const known = new Set(rows.map(m => m.id))
      for (const item of raw) {
        const m = normalizeMaterial(item)
        if (m.id == null || known.has(String(m.id))) continue
        known.add(String(m.id)); rows.push({ id: String(m.id), name: m.name, code: m.materialCode, brand: m.brand || '', spec: m.spec, unit: m.unit, stock: m.stock })
      }
      const total = Number(payload?.total)
      if (Array.isArray(payload) || (Number.isFinite(total) ? rows.length >= total : raw.length < 1000)) break
      if (!raw.length || rows.length === previousCount) throw new Error('物料分页未返回完整数据')
      materials.value = [...rows]
    }
    materials.value = rows; page.value = 1
  } catch { if (current === version) { failed.value = true; materials.value = [] } }
  finally { if (current === version) loading.value = false }
}
function toggle(m: RepairMaterial) { chosen.value = chosen.value.some(s => s.id === m.id) ? chosen.value.filter(s => s.id !== m.id) : [...chosen.value, { ...m }] }
function togglePage() { if (allSelected.value) { const ids = new Set(paged.value.map(m => m.id)); chosen.value = chosen.value.filter(m => !ids.has(m.id)) } else for (const m of paged.value) if (!chosen.value.some(s => s.id === m.id)) chosen.value.push({ ...m }) }
onMounted(load)
</script>
<style scoped>
.popup { padding: 20px 16px calc(16px + env(safe-area-inset-bottom)); background: #fff; color: #344054; }
.title { display: block; font-size: 18px; font-weight: 600; margin-bottom: 16px; }
.search, .toolbar, .actions, .heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.search input { flex: 1; min-width: 0; height: 44px; padding: 0 12px; border: 1px solid #b8c0cc; border-radius: 8px; font-size: 16px; }
.toolbar { margin: 12px 0; font-size: 14px; }
.list { height: 38vh; }
.material { display: flex; align-items: center; gap: 12px; padding: 14px 8px; border-bottom: 1px solid #edf0f3; }
.material.on { background: #edf5ff; }
.body { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.hint { display: block; color: #536176; font-size: 14px; line-height: 1.6; }
.heading { align-items: flex-start; font-size: 16px; margin-bottom: 6px; }
button { margin: 0; min-height: 44px; line-height: 44px; }
.actions button { flex: 1; border-radius: 24px; }
input:focus, button:focus-visible { outline: 2px solid #1769c2; outline-offset: 2px; }
</style>
