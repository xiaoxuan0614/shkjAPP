<template>
  <SectionCard title="用人记录">
    <template v-if="form">
      <wd-select-picker v-model="personKeys" label="参与人员" :columns="personChoices" value-key="key" label-key="label" type="checkbox" filterable :disabled="disabled" :z-index="999" placeholder="点击选择参与人员" />
      <text class="resource-hint">仅记录参与人员，不代替他人签到。已保存但不在候选中的人员仍保留，取消勾选才会移除。</text>
      <button v-if="optionsError" class="resource-submit" @click="loadOptions">{{ optionsError }}，点击重试</button>
    </template>
    <template v-else>
    <view class="resource-row"><text>本次操作人</text><text>{{ record.operatorNameSnapshot || '本人' }}</text></view>
    <view v-for="person in persons" :key="person.id" class="resource-row"><text>{{ person.personNameSnapshot || person.sourcePersonId }}</text><text>{{ person.personType === 'EXTERNAL' ? '外协' : '内协' }}</text></view>
    <text v-if="!persons.length" class="resource-hint">本次未记录其他参与人员。</text>
    <text class="resource-hint">展示本次作业已记录的参与人员，作业时长以签到、签退记录为准。</text>
    </template>
  </SectionCard>
  <SectionCard title="用车记录"><picker v-if="form" :range="vehicleChoices" range-key="label" :disabled="disabled" @change="form.vehicleValue = vehicleChoices[Number($event.detail.value)].value || null"><view class="resource-picker">{{ vehicleChoices.find(v => v.value === (form.vehicleValue || ''))?.label || '请选择车辆' }}<wd-icon name="arrow-down" /></view></picker><view v-else class="resource-row"><text>使用车辆</text><text>{{ record.vehicleUsed ? record.vehiclePlateSnapshot || record.vehicleValue || '已使用车辆' : '未使用车辆' }}</text></view></SectionCard>
  <SectionCard title="用料记录（选填）">
    <view v-for="item in items" :key="item.pickLinkId" class="material-row">
      <view class="material-copy"><view>{{ info(item).materialName || '物料信息未返回' }}</view><text>{{ specification(item) }} · 可用量：{{ balance(item) }} {{ info(item).baseUnitName || '' }}</text><text v-if="locked(item.pickLinkId)">已确认，不可修改</text></view>
      <view class="quantity"><input v-model="item.quantity" type="digit" :disabled="disabled || locked(item.pickLinkId)" :aria-label="(info(item).materialName || '物料') + '本次用量'" placeholder="数量" /><text>{{ info(item).baseUnitName || '' }}</text></view>
      <button class="material-remove" :disabled="disabled || locked(item.pickLinkId)" @click="removeMaterial(item.pickLinkId)">移除</button>
    </view>
    <view v-if="!items.length" class="material-empty">本次未记录用料，可直接提交日志</view>
    <button class="material-select" :disabled="disabled" @click="showPicker=true">{{ items.length ? '重新选择物料' : '选择物料' }}</button>
  </SectionCard>
  <wd-popup v-model="showPicker" position="bottom" :safe-area-inset-bottom="true" :z-index="12000" custom-style="border-radius:16px 16px 0 0;">
    <view class="material-popup">
      <view class="material-popup-header"><text>选择物料</text><button class="material-remove" @click="showPicker=false">关闭</button></view>
      <text class="resource-hint">仅展示本人在本维修单已出库的可用物料</text>
      <input v-model="keyword" class="material-search" placeholder="输入物料编号或名称" aria-label="搜索物料" />
      <view class="material-toolbar"><text>当前显示 {{ filteredSources.length }} 项</text><button class="material-remove" :disabled="disabled || !filteredSources.length" @click="toggleAll">{{ allSelected ? '取消全选' : '全选' }}</button></view>
      <scroll-view scroll-y class="material-list">
        <view v-for="source in filteredSources" :key="source.id" class="material-option" role="checkbox" :aria-checked="selectedIds.includes(source.id)" :aria-disabled="disabled || source.disabled" tabindex="0" @click="toggleMaterial(source)" @keydown.enter="toggleMaterial(source)">
          <view class="material-copy"><view>{{ source.name }}</view><text>{{ source.spec || '暂无规格' }} · 已出库 {{ source.outboundQty ?? '待核实' }} {{ source.unit }}</text><text>可用量：{{ source.availableUseQty ?? '待核实' }} {{ source.unit }}</text></view>
          <wd-icon :name="selectedIds.includes(source.id) ? 'check-circle-filled' : 'circle'" :color="selectedIds.includes(source.id) ? '#176ac7' : '#767676'" size="20px" />
        </view>
        <view v-if="!filteredSources.length" class="material-empty">{{ keyword ? '没有找到匹配的物料' : '暂无本人已出库且有可用余额的物料' }}</view>
      </scroll-view>
      <button class="material-select" @click="showPicker=false">完成</button>
    </view>
  </wd-popup>
</template>
<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import SectionCard from '@/components/SectionCard/SectionCard.vue'
import { repairOrderApi } from '@/service/repairOrder'
import { materialInfo, confirmedMaterial } from '@/service/repairWorkMaterials'
const props = defineProps<{detail:Record<string,any>;recordId:string;actorId:string;disabled:boolean;form?:any}>()
const record = computed(() => props.detail.workRecords?.find((r:any) => r.id === props.recordId) || {})
const persons = computed(() => (props.detail.workPersons || []).filter((p:any) => p.workRecordId === props.recordId))
const items = computed<any[]>(() => props.form?.materialItems || [])
const info = (item:any) => materialInfo(props.detail,item.pickLinkId)
const locked = (id:string) => confirmedMaterial(props.detail,props.recordId,id)
const specification = (item:any) => [info(item).brand,info(item).model || info(item).spec].filter(Boolean).join(' / ') || '暂无规格'
function balance(item:any) { const value=info(item).availableUseQty; return value != null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : '待核实' }
const sources = computed(() => {
  const rows = (props.detail.materialLinks || []).filter((m:any) => m.linkType === 'PICK' && m.handlerUserId === props.actorId && Number(m.outboundQty) > 0 && (Number(m.availableUseQty) > 0 || items.value.some(i => i.pickLinkId === m.id)))
  const candidates = rows.map((m:any) => ({id:m.id,name:m.materialName || m.material?.materialName || '物料',spec:[m.brand,m.model].filter(Boolean).join(' / '),code:m.materialCode || '',unit:m.baseUnitName || '',outboundQty:m.outboundQty,availableUseQty:m.availableUseQty,disabled:locked(m.id)}))
  for (const item of items.value) if (!candidates.some(c => c.id === item.pickLinkId)) candidates.push({id:item.pickLinkId,name:'已保存物料（当前不可新增）',spec:'',code:'',unit:'',outboundQty:null,availableUseQty:null,disabled:locked(item.pickLinkId)})
  return candidates
})
const selectedIds = computed({get:() => items.value.map(i => i.pickLinkId),set:(ids:string[]) => {
  if (props.disabled || !props.form) return
  const keep = new Set([...ids,...items.value.filter(i => locked(i.pickLinkId)).map(i => i.pickLinkId)])
  props.form.materialItems = [...keep].map(id => items.value.find(i => i.pickLinkId === id) || {pickLinkId:id,quantity:1})
}})
function removeMaterial(id:string) { if (!props.disabled && !locked(id)) selectedIds.value = selectedIds.value.filter(i => i !== id) }
const showPicker = ref(false), keyword = ref('')
const filteredSources = computed(() => sources.value.filter(s => `${s.name} ${s.code} ${s.spec}`.toLowerCase().includes(keyword.value.trim().toLowerCase())))
const allSelected = computed(() => filteredSources.value.length > 0 && filteredSources.value.every(s => selectedIds.value.includes(s.id)))
function toggleMaterial(source:any) { if (props.disabled || source.disabled) return; selectedIds.value = selectedIds.value.includes(source.id) ? selectedIds.value.filter(id => id !== source.id) : [...selectedIds.value,source.id] }
function toggleAll() { if (props.disabled) return; const ids=filteredSources.value.filter(s=>!s.disabled).map(s=>s.id); selectedIds.value=allSelected.value ? selectedIds.value.filter(id=>!ids.includes(id)) : [...new Set([...selectedIds.value,...ids])] }
const personOptions = ref<any[]>([]), vehicleOptions = ref<{value:string;label:string}[]>([]), optionsError = ref('')
function personKey(p:any) { return `${p.personType}:${p.sourcePersonId}` }
const personChoices = computed(() => [...new Map([...(props.form?.persons || []),...personOptions.value].map(p => [personKey(p),{...p,key:personKey(p),label:`${p.name || p.sourcePersonId} · ${p.personType === 'EXTERNAL' ? '外协' : '内部'}${p.roleName ? ` · ${p.roleName}` : ''}`}])).values()])
const personKeys = computed({get:() => (props.form?.persons || []).map(personKey),set:(keys:string[]) => selectPersons(keys)})
const vehicleChoices = computed(() => [{value:'',label:'未使用车辆'},...(props.form?.vehicleValue && !vehicleOptions.value.some(v => v.value === props.form.vehicleValue) ? [{value:props.form.vehicleValue,label:`已保存车辆：${props.form.vehicleValue}`}] : []),...vehicleOptions.value])
function selectPersons(keys:string[]) { if (props.form) props.form.persons = personChoices.value.filter(p => keys.includes(p.key)).map(({key,...person}) => person) }
let optionsGeneration = 0
async function loadOptions() {
  const generation = ++optionsGeneration, id = props.detail.order.id
  optionsError.value = ''
  try {
    const [people,vehicles] = await Promise.all([repairOrderApi.personOptions(id),repairOrderApi.options('vehicles')])
    if (generation !== optionsGeneration || id !== props.detail.order.id) return
    personOptions.value = people; vehicleOptions.value = vehicles
  } catch { if (generation === optionsGeneration) optionsError.value = '人员或车辆加载失败' }
}
watch(() => props.detail.order.id, () => { personOptions.value = []; vehicleOptions.value = []; if (props.form) void loadOptions() }, {immediate:true})
onBeforeUnmount(() => { optionsGeneration++ })
</script>
<style scoped>
.resource-row { display:flex; justify-content:space-between; gap:16px; padding:10px 0; font-size:16px; overflow-wrap:anywhere; }
.resource-row > text:last-child { text-align:right; }
.resource-item { padding:8px 0; border-bottom:1px solid #edf0f3; }
.resource-hint { display:block; color:#536176; font-size:14px; line-height:1.6; margin-top:8px; }
.resource-label { display:block; margin:18px 0 8px; font-size:16px; }
.required,.resource-error { color:#b42318; }
.resource-error { display:block; margin-top:12px; }
.resource-input,.resource-picker { width:100%; box-sizing:border-box; min-height:44px; padding:10px 12px; border:1px solid #b8c0cc; border-radius:8px; font-size:16px; }
.resource-picker { display:flex; justify-content:space-between; gap:12px; }
.resource-description { height:88px; }
.resource-submit { margin-top:16px; font-size:16px; color:#1769c2; background:#f5f9ff; }
.resource-submit[disabled] { opacity:.55; }
.resource-remove { flex-shrink:0; margin:0; padding:0 12px; min-height:44px; line-height:44px; color:#1769c2; background:transparent; font-size:14px; }
.resource-remove::after { border:0; }
.material-empty { padding:8px 0 12px; font-size:13px; color:#666; text-align:center; }
.material-select { width:100%; box-sizing:border-box; min-height:44px; padding:10px 12px; margin:8px 0 0; font-size:13px; font-weight:600; line-height:24px; color:#176ac7; text-align:center; background:#edf5ff; border-radius:8px; }
.material-select::after,.material-retry::after { border:0; }
.material-select[disabled] { color:#777; background:#f1f1f1; }
.material-retry { margin:8px 0 0; min-height:44px; padding:10px 0; line-height:24px; font-size:13px; color:#b42318; background:transparent; }
.material-row { display:flex; align-items:center; gap:10px; padding:12px 0; border-bottom:1px solid #ededed; }
.material-copy { flex:1; min-width:0; font-size:14px; overflow-wrap:anywhere; }
.material-copy text { display:block; margin-top:4px; font-size:12px; color:#666; line-height:1.5; }
.quantity { display:flex; align-items:center; gap:6px; flex-shrink:0; font-size:13px; }
.quantity input { width:58px; min-height:44px; border:1px solid #ddd; border-radius:6px; text-align:center; box-sizing:border-box; }
.material-remove { flex-shrink:0; padding:0 4px; margin:0; min-height:44px; line-height:44px; background:transparent; color:#176ac7; font-size:13px; }
.material-remove::after { border:0; }
.material-remove[disabled] { color:#777; }
.material-popup { padding:16px; }
.material-popup-header,.material-toolbar { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.material-popup-header > text { font-size:17px; font-weight:600; }
.material-toolbar { color:#606266; font-size:13px; }
.material-search { margin-top:12px; padding:0 12px; min-height:44px; border:1px solid #ddd; border-radius:8px; font-size:14px; }
.material-list { height:44vh; }
.material-option { display:flex; align-items:center; gap:12px; padding:12px 0; border-bottom:1px solid #ededed; min-height:44px; }
.material-option[aria-checked="true"] { background:#edf5ff; }
</style>
