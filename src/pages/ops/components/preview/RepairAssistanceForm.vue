<template>
  <SectionCard title="邀请协助">
    <text v-if="initial" class="prefill-note">已带入原申请内容。修改后将重新发起审批，原邀请和审批记录保留。</text>
    <view class="assistance-types"><button :class="{ active: personType === 'INTERNAL' }" :disabled="loading" @click="changeType('INTERNAL')">内部协助</button><button :class="{ active: personType === 'EXTERNAL' }" :disabled="loading" @click="changeType('EXTERNAL')">外部协助</button></view>
    <text class="label">{{ personType === 'INTERNAL' ? '选择部门' : '选择外协单位' }}<text class="required"> *</text></text>
    <button class="people-select" :aria-expanded="showPicker" @click="openPicker"><text>{{ personType === 'INTERNAL' ? (chosen.length ? `已选 ${chosen.length} 个部门，点击调整` : '请选择部门，可多选') : (chosen[0]?.name || '请选择一家外协单位') }}</text><wd-icon name="arrow-down" /></button>
    <template v-if="personType === 'INTERNAL'">
      <view v-for="department in chosen" :key="department.id" class="department-row">
        <view class="department-heading"><text>{{ department.name }}</text><button :aria-label="`移除${department.name}`" @click="removeDepartment(department.id)">移除</button></view>
        <label :for="`department-reason-${department.id}`" class="label">协助原因<text class="required"> *</text></label>
        <textarea :id="`department-reason-${department.id}`" v-model="departmentReasons[department.id]" maxlength="10000" :placeholder="`请说明需要${department.name}协助的工作`" />
      </view>
    </template>
    <view v-if="personType === 'EXTERNAL'" class="external-fields">
      <label for="assist-count" class="label">人数<text class="required"> *</text></label><input id="assist-count" v-model="headcount" type="number" placeholder="填写人数" />
      <label for="assist-hours" class="label">人均预计工时（h）<text class="required"> *</text></label><input id="assist-hours" v-model="hoursPerPerson" type="digit" placeholder="填写每人预计工时" />
      <text class="hint">预计总工时：{{ totalHours }} h，实际工时以维修记录为准。</text>
    </view>
  </SectionCard>
  <wd-popup v-model="showPicker" position="bottom" :z-index="12000" :safe-area-inset-bottom="true" custom-style="border-radius:16px 16px 0 0;" @close="cancelPicker">
    <view class="people-panel">
      <view class="people-panel__head"><text>{{ personType === 'INTERNAL' ? '选择协助部门（可多选）' : '选择一家外协单位' }}</text><button aria-label="取消选择" @click="cancelPicker"><wd-icon name="close" /></button></view>
      <view class="search"><input v-model="keyword" :placeholder="personType === 'INTERNAL' ? '输入部门名称搜索' : '输入单位名称搜索'" confirm-type="search" @confirm="search" /><button size="mini" :disabled="loading" @click="search">查询</button></view>
      <scroll-view scroll-y class="people-panel__list">
    <text v-if="loading" class="hint">正在加载候选列表…</text>
    <button v-else-if="failed" @click="load(page)">候选列表加载失败，点击重试</button>
    <template v-else>
      <label v-for="u in users" :key="u.id" class="user" @click="toggleDraft(u)">
        <checkbox v-if="personType === 'INTERNAL'" :checked="draftChosen.some(p => p.id === u.id)" color="#1769c2" /><radio v-else :checked="draftChosen.some(p => p.id === u.id)" color="#1769c2" /><text>{{ u.name }}</text>
      </label>
      <text v-if="!users.length" class="hint">未找到匹配项，请更换名称查询。</text>
    </template>
      </scroll-view>
    <view class="pages"><button size="mini" :disabled="loading || page <= 1" @click="load(page - 1)">上一页</button><text>第 {{ page }} 页</text><button size="mini" :disabled="loading || failed || !hasMore" @click="load(page + 1)">下一页</button></view>
      <view class="people-panel__footer"><button @click="cancelPicker">取消</button><button class="people-confirm" :disabled="loading || failed || !draftChosen.length" @click="confirmPicker">确定（{{ draftChosen.length }}）</button></view>
    </view>
  </wd-popup>
  <SectionCard :title="personType === 'INTERNAL' ? '办理说明' : '申请原因'">
    <template v-if="personType === 'EXTERNAL'"><label for="assist-reason" class="label">协助原因<text class="required"> *</text></label>
    <textarea id="assist-reason" v-model="reason" maxlength="1000" placeholder="请说明需要协助的工作和原因" /></template>
    <text class="hint">{{ personType === 'INTERNAL' ? '运维主管先审批，再由各受邀部门主管并行审批；全部通过后，各部门主管单独指定成员。任一部门驳回，本次内协申请结束；指定人员不在审批流内。' : '每次申请一家外协单位，由运维主管审批。' }}</text>
    <text v-if="personType === 'EXTERNAL'" class="pending-note">外协人数和工时协议尚未接入，暂不能提交外协申请</text>
  </SectionCard>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { collaborationDepartments, validateCollaborationDraft, type CollaborationDraft, type CollaborationPrefill } from '@/service/repairCollaboration'
import { repairOrderApi } from '@/service/repairOrder'
import SectionCard from '@/components/SectionCard/SectionCard.vue'
import type { AssistUser } from './repairView'
type Selection = AssistUser & {personType: 'INTERNAL' | 'EXTERNAL'}
const props = defineProps<{initial?: CollaborationPrefill}>()
const emit = defineEmits<{ submit: [draft: CollaborationDraft] }>()
const headcount = ref(''), hoursPerPerson = ref('')
const totalHours = computed(() => { const total = Number(headcount.value) * Number(hoursPerPerson.value); return Number.isFinite(total) && total > 0 ? Number(total.toFixed(2)) : '—' })
const keyword = ref(''), query = ref(''), reason = ref('')
const departmentReasons = ref<Record<string,string>>({})
const internalChosen = ref<Selection[]>([]), externalChosen = ref<Selection[]>([])
const chosen = ref<Selection[]>([]), users = ref<(AssistUser & { account: string })[]>([])
const showPicker = ref(false), draftChosen = ref<Selection[]>([])
async function openPicker() {
  draftChosen.value = chosen.value.map(u => ({...u})); keyword.value = ''; query.value = ''
  showPicker.value = true; await load(1)
}
function cancelPicker() { showPicker.value = false; draftChosen.value = [] }
function toggleDraft(u: AssistUser) {
  const selection = {id:u.id,name:u.name,personType:personType.value}
  draftChosen.value = personType.value === 'EXTERNAL' ? [selection] : draftChosen.value.some(p => p.id === u.id) ? draftChosen.value.filter(p => p.id !== u.id) : [...draftChosen.value, selection]
}
function confirmPicker() {
  if (loading.value || failed.value || !draftChosen.value.length) return
  chosen.value = draftChosen.value.map(u => ({...u})); showPicker.value = false
}
const personType = ref<'INTERNAL' | 'EXTERNAL'>('INTERNAL')
if (props.initial?.personType === 'INTERNAL') {
  chosen.value = (props.initial.departments || []).map(d => ({id:d.departmentId,name:props.initial!.departmentNames?.[d.departmentId] || '原受邀部门',personType:'INTERNAL'}))
  departmentReasons.value = Object.fromEntries((props.initial.departments || []).map(d => [d.departmentId,d.reason]))
}
let allUsers: {id:string;name:string;account:string}[] = []
const page = ref(1), hasMore = ref(false), loading = ref(false), failed = ref(false)
let request = 0
onBeforeUnmount(() => { request++ })
async function load(next = 1) {
  const id = ++request
  loading.value = true; failed.value = false; page.value = next
  try {
    const response = personType.value === 'INTERNAL' ? await collaborationDepartments() : await repairOrderApi.options('external')
    if (id !== request) return
    allUsers = response.map(r => ({id:r.value,name:r.label,account:''}))
    paginate(next)
  } catch { if (id === request) failed.value = true }
  finally { if (id === request) loading.value = false }
}
function paginate(next: number) { page.value = next; const rows = allUsers.filter(u => u.name.includes(query.value)); users.value = rows.slice((next - 1) * 10,next * 10); hasMore.value = next * 10 < rows.length }
function search() { query.value = keyword.value.trim(); paginate(1) }
function changeType(type: 'INTERNAL' | 'EXTERNAL') {
  if (personType.value === type) return
  if (personType.value === 'INTERNAL') internalChosen.value = chosen.value
  else externalChosen.value = chosen.value
  cancelPicker(); personType.value = type
  chosen.value = type === 'INTERNAL' ? internalChosen.value : externalChosen.value
  ++request; users.value = []; keyword.value = ''; query.value = ''; loading.value = false
}
function removeDepartment(id: string) { chosen.value = chosen.value.filter(d => d.id !== id) }
function submit() {
  const draft: CollaborationDraft = personType.value === 'INTERNAL'
    ? {personType:'INTERNAL',departments:chosen.value.map(d => ({departmentId:d.id,reason:(departmentReasons.value[d.id] || '').trim()}))}
    : {personType:'EXTERNAL',targetId:chosen.value[0]?.id || '',reason:reason.value.trim(),headcount:Number(headcount.value),hoursPerPerson:Number(hoursPerPerson.value)}
  const error = validateCollaborationDraft(draft)
  if (error) { uni.showToast({title:error,icon:'none'}); return }
  emit('submit', draft)
}
defineExpose({ submit })
</script>
<style scoped>
.people-select { display:flex; align-items:center; justify-content:space-between; gap:12px; width:100%; padding:10px 12px; border:1px solid #d5dce5; border-radius:8px; background:#f8fafc; color:#536176; font-size:16px; text-align:left; line-height:1.6; }
.people-select::after { border:0; }
.department-row { margin-top:20px; padding-top:16px; border-top:1px solid #edf0f3; }
.department-heading { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px; }
.department-heading text { min-width:0; overflow-wrap:anywhere; font-size:16px; color:#344054; }
.department-heading button { flex-shrink:0; background:transparent; color:#b42318; font-size:14px; padding:0 12px; }
.department-heading button::after { border:0; }
.department-row textarea { margin-bottom:0; height:100px; }
.people-select text { min-width:0; overflow-wrap:anywhere; }
.external-fields { margin-top:24px; }
.external-fields input { box-sizing:border-box; width:100%; min-height:48px; border:1px solid #d5dce5; border-radius:8px; padding:0 12px; margin-bottom:16px; font-size:16px; }
.pending-note { display:block; margin-top:16px; color:#92400e; font-size:14px; line-height:1.7; }
.prefill-note { display:block; margin-bottom:20px; color:#536176; font-size:14px; line-height:1.7; }
.people-panel { padding:16px; color:#303133; }
.people-panel__head { display:flex; align-items:center; justify-content:space-between; font-size:18px; font-weight:600; }
.people-panel__head button { width:44px; padding:0; background:transparent; }
.people-panel__list { height:38vh; min-height:120px; }
.people-panel__footer { display:flex; gap:12px; padding-top:12px; border-top:1px solid #edf0f3; }
.people-panel__footer button { flex:1; font-size:16px; border-radius:8px; }
.people-panel__footer .people-confirm { color:#fff; background:#176ac7; }
.label { display: block; margin-bottom: 12px; font-size: 15px; color: #344054; }
.assistance-types { display:flex; gap:8px; padding:4px; margin-bottom:24px; background:#f2f4f7; border-radius:8px; }
.assistance-types button { flex:1; min-width:0; font-size:15px; color:#536176; background:transparent; border-radius:6px; }
.assistance-types button.active { background:#eaf4ff; color:#176ac7; font-weight:600; }
.required { color: #b42318; }
.search, .pages { display: flex; align-items: center; gap: 10px; margin: 12px 0; }
.search input { flex: 1; min-width: 0; height: 48px; padding: 0 12px; border: 1px solid #d5dce5; border-radius: 8px; background:#f8fafc; font-size:16px; }
button { margin: 0; min-height: 44px; line-height: 44px; }
.pages { justify-content: space-between; font-size: 14px; }
.chosen { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 12px 0; }
.user { display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 8px 0; border-bottom: 1px solid #edf0f3; overflow-wrap: anywhere; }
.hint { color: #536176; font-size: 14px; line-height: 1.7; }
textarea { width: 100%; height: 144px; box-sizing: border-box; padding: 12px; border: 1px solid #d5dce5; border-radius: 8px; background:#f8fafc; margin-bottom: 16px; font-size: 16px; line-height:1.65; }
input:focus, textarea:focus, button:focus-visible { outline: 2px solid #1769c2; outline-offset: 2px; }
</style>
