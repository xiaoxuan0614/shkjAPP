<template>
  <SectionCard title="用人记录">
    <template v-if="form">
      <wd-select-picker v-model="personKeys" label="参与人员" :columns="personChoices" value-key="key" label-key="label" type="checkbox" filterable :disabled="disabled || busy" :z-index="999" placeholder="点击选择参与人员" />
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
  <SectionCard title="用车记录"><picker v-if="form" :range="vehicleChoices" range-key="label" :disabled="disabled || busy" @change="form.vehicleValue = vehicleChoices[Number($event.detail.value)].value || null"><view class="resource-picker">{{ vehicleChoices.find(v => v.value === (form.vehicleValue || ''))?.label || '请选择车辆' }}<wd-icon name="arrow-down" /></view></picker><view v-else class="resource-row"><text>使用车辆</text><text>{{ record.vehicleUsed ? record.vehiclePlateSnapshot || record.vehicleValue || '已使用车辆' : '未使用车辆' }}</text></view></SectionCard>
  <SectionCard title="用料记录">
    <wd-select-picker v-if="form" v-model="form.materialUseIds" label="关联用料" :columns="useChoices" value-key="id" label-key="label" type="checkbox" filterable :disabled="disabled || busy" :z-index="999" placeholder="点击选择本次用料记录" />
    <text v-if="form" class="resource-hint">勾选本次日志关联的用料记录；取消关联不会删除用料登记。</text>
    <view v-for="use in uses" :key="use.id" class="resource-item">
      <view class="resource-row"><text>{{ nameFor(use.pickLinkId) }}</text><text>{{ use.usedQuantity }} {{ unitFor(use.pickLinkId) }}</text></view>
      <text class="resource-hint">{{ statuses[use.useStatus] || use.useStatus }} · {{ use.useDescription }}</text>
    </view>
    <text v-if="!uses.length" class="resource-hint">本次暂无用料记录。</text>
    <template v-if="sources.length">
      <text class="resource-label">选择已领物料<text class="required"> *</text></text>
      <picker :range="sources" range-key="label" :disabled="busy || disabled" @change="pickId = sources[Number($event.detail.value)].id"><view class="resource-picker">{{ sources.find(item => item.id === pickId)?.label || '请选择原领料明细' }}<wd-icon name="arrow-down" /></view></picker>
      <text class="resource-label">实际用量<text class="required"> *</text></text>
      <input v-model="quantity" class="resource-input" type="digit" :disabled="busy || disabled" aria-label="实际用量" placeholder="大于 0，最多 4 位小数" />
      <text class="resource-label">用料说明<text class="required"> *</text></text>
      <textarea v-model="description" class="resource-input resource-description" :disabled="busy || disabled" maxlength="10000" aria-label="用料说明" placeholder="填写本次使用位置或用途" />
      <text class="resource-hint">按原领料明细登记，实际出库可用余额由后台核验；提交后仍需确认。</text>
      <button class="resource-submit" :disabled="busy || disabled || uncertain" @click="submit">{{ busy ? '正在处理…' : refreshOnly ? '刷新已提交记录' : '添加用料记录' }}</button>
    </template>
    <text v-else class="resource-hint">暂无本人领料明细，请先领料并完成出库。</text>
    <text v-if="error" class="resource-error" role="alert">{{ error }}</text>
    <text v-if="message" class="resource-hint" role="status">{{ message }}</text>
  </SectionCard>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import SectionCard from '@/components/SectionCard/SectionCard.vue'
import { repairOrderApi } from '@/service/repairOrder'
const props = defineProps<{detail:Record<string,any>;recordId:string;actorId:string;disabled:boolean;form?:any}>()
const emit = defineEmits<{busy:[value:boolean];updated:[detail:any]}>()
const record = computed(() => props.detail.workRecords?.find((r:any) => r.id === props.recordId) || {})
const persons = computed(() => (props.detail.workPersons || []).filter((p:any) => p.workRecordId === props.recordId))
const uses = computed(() => (props.detail.materialUses || []).filter((u:any) => u.workRecordId === props.recordId))
function nameFor(id:string) { const m = props.detail.materialLinks?.find((l:any) => l.id === id); return m?.material?.materialName || m?.material?.name || m?.materialId || '物料' }
function unitFor(id:string) { const m = props.detail.materialLinks?.find((l:any) => l.id === id); return m?.material?.baseUnitName || m?.material?.unitName || '' }
const sources = computed(() => (props.detail.materialLinks || []).filter((m:any) => m.linkType === 'PICK' && m.handlerUserId === props.actorId).map((m:any, i:number) => ({...m,label:`${nameFor(m.id)}${m.material?.spec ? ` · ${m.material.spec}` : ''}（领料明细 ${i + 1}）`})))
const statuses:Record<string,string> = {DRAFT:'草稿',PENDING_CONFIRM:'待确认',CONFIRMED:'已确认',VOIDED:'已作废'}
const pickId = ref(''), quantity = ref(''), description = ref(''), busy = ref(false), error = ref(''), message = ref('')
const personOptions = ref<any[]>([]), vehicleOptions = ref<{value:string;label:string}[]>([]), optionsError = ref('')
function personKey(p:any) { return `${p.personType}:${p.sourcePersonId}` }
const personChoices = computed(() => [...new Map([...(props.form?.persons || []),...personOptions.value].map(p => [personKey(p),{...p,key:personKey(p),label:`${p.name || p.sourcePersonId} · ${p.personType === 'EXTERNAL' ? '外协' : '内部'}${p.roleName ? ` · ${p.roleName}` : ''}`}])).values()])
const personKeys = computed({get:() => (props.form?.persons || []).map(personKey),set:(keys:string[]) => selectPersons(keys)})
const vehicleChoices = computed(() => [{value:'',label:'未使用车辆'},...(props.form?.vehicleValue && !vehicleOptions.value.some(v => v.value === props.form.vehicleValue) ? [{value:props.form.vehicleValue,label:`已保存车辆：${props.form.vehicleValue}`}] : []),...vehicleOptions.value])
const useChoices = computed(() => [...new Map([...(props.form?.materialUseIds || []).map((id:string) => ({id})),...(props.detail.materialUses || []).filter((u:any) => props.form?.materialUseIds.includes(u.id) || ((!u.workRecordId || u.workRecordId === props.recordId) && sources.value.some(s => s.id === u.pickLinkId)))].map((u:any) => [u.id,{...u,label:`${u.pickLinkId ? nameFor(u.pickLinkId) : '已关联用料'} · ${u.usedQuantity ?? u.id}`}])).values()] as any[])
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
const refreshOnly = ref(false), uncertain = ref(false)
async function submit() {
  if (busy.value || props.disabled || uncertain.value) return
  error.value = ''; message.value = ''
  if (refreshOnly.value) {
    busy.value = true; emit('busy',true)
    try { emit('updated',await repairOrderApi.detail(props.detail.order.id)); refreshOnly.value = false; quantity.value = ''; description.value = ''; message.value = '已同步用料记录，请勾选需要关联的记录。' }
    catch { error.value = '刷新失败，稍后可继续刷新，不会重新提交用料。' }
    finally { busy.value = false; emit('busy',false) }
    return
  }
  if (!sources.value.some((s:any) => s.id === pickId.value)) { error.value = '请选择本人的原领料明细'; return }
  if (!/^\d+(\.\d{1,4})?$/.test(quantity.value.trim()) || !Number.isFinite(Number(quantity.value)) || Number(quantity.value) <= 0) { error.value = '实际用量必须大于 0，最多 4 位小数'; return }
  if (!description.value.trim()) { error.value = '请填写用料说明'; return }
  const payload = {orderId:props.detail.order.id,workRecordId:props.recordId,pickLinkId:pickId.value,quantity:Number(quantity.value),description:description.value.trim()}
  busy.value = true; emit('busy',true)
  let saved = false
  try {
    await repairOrderApi.materialUse(payload)
    saved = true
    emit('updated',await repairOrderApi.detail(props.detail.order.id))
    quantity.value = ''; description.value = ''; message.value = '用料记录已提交，请留意确认状态。'
  } catch (e:any) {
    if (saved) { refreshOnly.value = true; error.value = '用料已提交，但刷新失败。请点击刷新已提交记录，不要重新登记。' }
    else if (e.success !== false) { uncertain.value = true; error.value = '提交结果不确定，已暂停登记。请返回详情核对用料记录后再操作。' }
    else error.value = e.message || '提交被拒绝，请修改后重试'
  }
  finally { busy.value = false; emit('busy',false) }
}
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
</style>
