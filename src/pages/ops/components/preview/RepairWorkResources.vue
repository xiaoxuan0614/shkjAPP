<template>
  <SectionCard title="用人记录（选填）">
    <template v-if="form">
      <view v-for="group in peopleGroups" :key="group.type">
        <view class="people-form-row"><text class="people-label">{{ group.type === 'INTERNAL' ? '内协参与' : '外协参与' }}</text><view class="people-toggle" role="radiogroup" :aria-label="group.title"><button v-for="choice in [false,true]" :key="String(choice)" :class="{ selected: form[group.flag] === choice }" role="radio" :aria-checked="form[group.flag] === choice" :disabled="disabled" @click="setParticipation(group.type,group.flag,choice)"><wd-icon :name="form[group.flag] === choice ? 'check-circle-filled' : 'circle'" size="18px" /><text>{{ choice ? '是' : '否' }}</text></button></view></view>
        <template v-if="form[group.flag]">
          <view v-if="group.type === 'INTERNAL'" class="people-form-row people-form-row--top"><text class="people-label">选择人员</text><view class="people-chips"><button v-for="person in personChoices.filter(p => p.personType === 'INTERNAL')" :key="person.key" class="people-chip" :class="{ selected: selectedPeople('INTERNAL').includes(person.key) }" :aria-pressed="selectedPeople('INTERNAL').includes(person.key)" :disabled="disabled || optionsBusy || !!optionsError" @click="togglePerson(person.key)">{{ person.label }}</button></view></view>
          <wd-select-picker v-else :model-value="selectedPeople(group.type)" :columns="personChoices.filter(p => p.personType === group.type)" value-key="key" label-key="label" type="checkbox" filterable :disabled="disabled || optionsBusy || !!optionsError" :z-index="12000" title="选择本次外协单位" @confirm="selectPersons(group.type,$event.value)"><view class="material-select">{{ selectedPeople('EXTERNAL').length ? '调整本次外协单位' : '＋ 添加本次外协' }}</view></wd-select-picker>
          <text v-if="optionsBusy" class="resource-hint" role="status">正在加载已生效协助…</text>
          <text v-else-if="!optionsError && !personChoices.some(p => p.personType === group.type)" class="resource-hint">暂无审批通过且生效的{{ group.type === 'INTERNAL' ? '内协人员' : '外协单位' }}</text>
          <view v-if="group.type === 'EXTERNAL'" v-for="person in form.persons.filter(p => p.personType === 'EXTERNAL')" :key="personKey(person)" class="outsourcing-row">
            <view class="people-form-row"><text class="people-label">外协单位</text><text class="outsourcing-name">{{ person.name || '外协单位' }}</text></view>
            <view class="outsourcing-fields">
              <view><text class="outsourcing-field-label">实际人数</text><view class="outsourcing-input"><input v-model="person.headcount" type="number" :disabled="disabled" aria-label="外协实际人数" placeholder="请输入" /><text>人</text></view></view>
              <view><text class="outsourcing-field-label">实际工时</text><view class="outsourcing-input"><input v-model="person.workHours" type="digit" :disabled="disabled" aria-label="外协实际工时" placeholder="请输入" /><text>h</text></view></view>
            </view>
            <view class="outsourcing-remark"><text class="outsourcing-field-label">备注（选填）</text><input v-model="person.remark" class="resource-input" :disabled="disabled" maxlength="1000" aria-label="外协备注" placeholder="填写本次参与说明" /></view>
            <view class="outsourcing-footer"><button class="resource-remove" :disabled="disabled" @click="removePerson(person)">删除本条</button></view>
          </view>
        </template>
      </view>
      <view v-for="person in unavailablePeople" :key="personKey(person)" class="resource-row"><text>{{ person.name || '历史参与者' }}（当前不可新增）</text><button class="resource-remove" :disabled="disabled" @click="removePerson(person)">移除</button></view>
      <text class="resource-hint">只选择本次实际参与的协助；未选择的不计入本次记录。负责人无需重复选择，也不代替内协人员签到。历史记录保留，移除后不可重新选择失效协助。</text>
      <button v-if="optionsError" class="resource-submit" :disabled="optionsBusy" @click="loadOptions">{{ optionsError }}，点击重试</button>
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
import { isWorkSelf, workPersonKey as personKey, workPersonChoices, selectWorkPeople } from '@/service/repairWorkPeople'
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
const personOptions = ref<any[]>([]), vehicleOptions = ref<{value:string;label:string}[]>([]), optionsError = ref(''), optionsBusy = ref(false)
const peopleGroups = [{type:'INTERNAL',flag:'hasInternalParticipants',title:'本次是否有内协参与',label:'内协人员'},{type:'EXTERNAL',flag:'hasExternalParticipants',title:'本次是否有外协参与',label:'外协单位'}]
const personChoices = computed(() => workPersonChoices(personOptions.value, props.detail.order.responsibleUserId, props.actorId))
const unavailablePeople = computed(() => !optionsBusy.value && !optionsError.value ? (props.form?.persons || []).filter((p:any) => !personChoices.value.some(c => c.key === personKey(p))) : [])
const selectedPeople = (type:string) => (props.form?.persons || []).filter((p:any) => p.personType === type && personChoices.value.some(c => c.key === personKey(p))).map(personKey)
function togglePerson(key:string) { const keys=selectedPeople('INTERNAL'); selectPersons('INTERNAL',keys.includes(key) ? keys.filter((id:string)=>id!==key) : [...keys,key]) }
function setParticipation(type:string,flag:string,value:boolean) { if (props.disabled || !props.form) return; props.form[flag]=value; if (!value) props.form.persons=props.form.persons.filter((p:any)=>p.personType!==type) }
function removePerson(person:any) { if (!props.disabled && props.form) props.form.persons=props.form.persons.filter((p:any)=>personKey(p)!==personKey(person)) }
watch([() => props.form, () => props.detail.order.responsibleUserId, () => props.actorId], () => {
  const form = props.form
  if (!form) return
  form.persons=(form.persons || []).filter((p:any)=>!isWorkSelf(p,props.actorId) && !isWorkSelf(p,props.detail.order.responsibleUserId))
  for (const group of peopleGroups) form[group.flag]=form.persons.some((p:any)=>p.personType===group.type)
}, {immediate:true})
const vehicleChoices = computed(() => [{value:'',label:'未使用车辆'},...(props.form?.vehicleValue && !vehicleOptions.value.some(v => v.value === props.form.vehicleValue) ? [{value:props.form.vehicleValue,label:`已保存车辆：${props.form.vehicleValue}`}] : []),...vehicleOptions.value])
function selectPersons(type:string,keys:string[]) { if (!props.disabled && !optionsBusy.value && !optionsError.value && props.form) {
  const historical=props.form.persons.filter((p:any)=>p.personType===type&&!personChoices.value.some(c=>c.key===personKey(p)))
  props.form.persons=[...selectWorkPeople(props.form.persons,personChoices.value,type,keys),...historical]
} }
let optionsGeneration = 0
async function loadOptions() {
  const generation = ++optionsGeneration, id = props.detail.order.id
  optionsError.value = ''; optionsBusy.value = true
  try {
    const [people,vehicles] = await Promise.all([repairOrderApi.personOptions(id),repairOrderApi.options('vehicles')])
    if (generation !== optionsGeneration || id !== props.detail.order.id) return
    personOptions.value = people; vehicleOptions.value = vehicles
  } catch { if (generation === optionsGeneration) optionsError.value = '人员或车辆加载失败' }
  finally { if (generation === optionsGeneration) optionsBusy.value = false }
}
watch(() => props.detail.order.id, () => { personOptions.value = []; vehicleOptions.value = []; if (props.form) void loadOptions() }, {immediate:true})
onBeforeUnmount(() => { optionsGeneration++ })
</script>
<style scoped>
.resource-row { display:flex; justify-content:space-between; gap:16px; padding:10px 0; font-size:16px; overflow-wrap:anywhere; }
.resource-row > text:last-child { text-align:right; }
.people-form-row { display:flex; align-items:center; gap:8px; padding:11px 0; border-bottom:1px solid #f0f0f0; }
.people-form-row--top { align-items:flex-start; }
.people-label { width:88px; flex:none; font-size:13px; color:#555; }
.people-toggle { display:flex; gap:12px; flex:1; justify-content:flex-end; }
.people-toggle button { display:flex; align-items:center; justify-content:center; gap:6px; margin:0; padding:0 12px; min-width:72px; min-height:44px; line-height:24px; font-size:14px; background:#fff; color:#566579; border:1px solid #dce3ed; border-radius:8px; }
.people-toggle button.selected { background:#edf5ff; color:#176ac7; border-color:#176ac7; font-weight:600; }
.people-toggle button:focus-visible { outline:2px solid #176ac7; outline-offset:2px; }
.people-toggle button[disabled] { opacity:.5; }
.people-toggle button::after { border:0; }
.people-chips { display:flex; flex:1; min-width:0; flex-wrap:wrap; gap:8px; }
.people-chip { margin:0; padding:6px 13px; min-height:44px; font-size:13px; line-height:30px; color:#555; background:#fff; border:1px solid #ccc; border-radius:16px; overflow-wrap:anywhere; }
.people-chip::after { border:0; }
.people-chip.selected { color:#176ac7; background:#eaf4ff; border-color:#79afea; }
.outsourcing-row { padding:0 12px 10px; margin:10px 0; background:#f7f9fb; border-radius:12px; }
.outsourcing-name { min-width:0; flex:1; overflow-wrap:anywhere; font-size:13px; line-height:1.55; color:#222; }
.outsourcing-fields { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; margin-top:12px; }
.outsourcing-fields > view { min-width:0; }
.outsourcing-field-label { display:block; margin-bottom:7px; font-size:13px; font-weight:500; color:#475569; }
.outsourcing-input { display:flex; min-height:48px; padding:0 12px; background:#fff; border:1px solid #cfd8e3; border-radius:10px; align-items:center; gap:8px; }
.outsourcing-input input { min-width:0; height:48px; padding:0; font-size:16px; color:#222; flex:1; }
.outsourcing-input > text { font-size:13px; color:#64748b; flex:none; }
.outsourcing-remark { margin-top:12px; }
.outsourcing-remark input { background:#fff; font-size:13px; border-color:#cfd8e3; }
.outsourcing-footer { display:flex; justify-content:flex-end; min-height:44px; }
.outsourcing-footer button { color:#a13a3a; font-size:13px; }
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
