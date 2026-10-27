<template>
  <SectionCard title="用料统计" @header-click="toggle">
    <template #extra><button class="toggle" :aria-expanded="expanded" @click.stop="toggle">{{ expanded ? '收起' : '展开' }}<wd-icon :name="expanded ? 'arrow-up' : 'arrow-down'" size="14px" /></button></template>
    <template v-if="expanded">
      <text v-if="loading" class="hint" role="status">正在加载用料统计…</text>
      <button v-else-if="failed" class="retry" @click="load(page)">用料统计加载失败，点击重试</button>
      <template v-else-if="rows.length">
        <view class="table-container">
          <view class="table" role="table" aria-label="维修单用料统计">
            <view class="table-row table-head" role="row"><text role="columnheader">物料</text><text v-for="column in columns" :key="column.key" role="columnheader">{{ column.label }}</text></view>
            <view v-for="row in rows" :key="JSON.stringify([row.materialId,row.baseUnitId])" class="table-row" role="row">
              <view class="name" role="cell"><text>{{ row.materialName || '—' }}</text><text class="hint">{{ [row.brand_dictText || row.brand,row.model].filter(Boolean).join(' / ') }}</text><text class="hint">{{ row.baseUnitName || '单位未返回' }}</text></view>
              <text v-for="column in columns" :key="column.key" class="number" role="cell">{{ quantity(row[column.key]) }}</text>
            </view>
          </view>
        </view>
        <view class="pagination"><button :disabled="page <= 1" @click="load(page - 1)">上一页</button><text>{{ page }} / {{ Math.max(1, Math.ceil(total / 5)) }} · 共 {{ total }} 条</text><button :disabled="page * 5 >= total" @click="load(page + 1)">下一页</button></view>
        <text class="hint">整单汇总，数量按基准单位统计；使用包含已提交待确认用料，可还已扣除占用。</text>
      </template>
      <text v-else class="hint">暂无用料统计</text>
    </template>
  </SectionCard>
</template>
<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import SectionCard from '@/components/SectionCard/SectionCard.vue'
import { repairOrderApi } from '@/service/repairOrder'
const props = defineProps<{orderId:string}>()
const expanded=ref(false), loading=ref(false), failed=ref(false), loaded=ref(false)
const rows=ref<any[]>([]), page=ref(1), total=ref(0)
const columns=[{key:'outboundQty',label:'出库'},{key:'actualReturnQty',label:'已还'},{key:'consumedQty',label:'使用'},{key:'availableReturnQty',label:'可还'}]
const quantity=(value:any)=>value == null || value === '' ? '—' : value
let generation=0
async function load(next=1) {
  const current=++generation, orderId=props.orderId
  loading.value=true;failed.value=false;page.value=next
  try {
    const result=await repairOrderApi.materialStatistics(orderId,next,5)
    if(current!==generation)return
    if(!Array.isArray(result?.records) || result.total == null || !Number.isFinite(Number(result.total)) || Number(result.total)<0 || (result.orderId && result.orderId!==orderId))throw Error('统计响应异常')
    rows.value=result.records;total.value=Number(result.total);loaded.value=true
  } catch {if(current===generation){failed.value=true;rows.value=[]}}
  finally {if(current===generation)loading.value=false}
}
function toggle(){expanded.value=!expanded.value;if(expanded.value && !loaded.value && !loading.value)void load(1)}
watch(()=>props.orderId,()=>{++generation;rows.value=[];total.value=0;page.value=1;loaded.value=false;loading.value=false;failed.value=false;if(expanded.value)void load(1)})
onBeforeUnmount(()=>{++generation})
</script>
<style scoped>
.toggle { display:flex; align-items:center; gap:6px; margin:0; padding:0 4px 0 12px; min-height:44px; background:transparent; color:#176ac7; font-size:13px; }
.toggle::after { border:0; }
.table-container,.table { width:100%; min-width:0; }
.table-row { display:grid; grid-template-columns:minmax(0,2fr) repeat(4,minmax(0,1fr)); align-items:start; border-bottom:1px solid #edf0f3; font-size:12px; }
.table-row > * { padding:8px 2px; box-sizing:border-box; min-width:0; overflow-wrap:anywhere; line-height:1.5; }
.table-head { background:#f5f7fa; color:#536176; font-weight:600; text-align:center; }
.table-head > :first-child { text-align:left; }
.name { display:flex; flex-direction:column; gap:4px; color:#303133; }
.name > text { min-width:0; overflow-wrap:anywhere; }
.number { text-align:center; font-variant-numeric:tabular-nums; }
.hint { display:block; color:#536176; font-size:12px; line-height:1.7; }
.pagination { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:12px 0; font-size:12px; }
.pagination button,.retry { margin:0; min-height:44px; font-size:13px; }
</style>
