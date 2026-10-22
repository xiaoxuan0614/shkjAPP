<template>
  <SectionCard title="协助人员">
    <view class="assistance-types"><button :class="{ active: personType === 'INTERNAL' }" :disabled="loading" @click="changeType('INTERNAL')">内部协助</button><button :class="{ active: personType === 'EXTERNAL' }" :disabled="loading" @click="changeType('EXTERNAL')">外部协助</button></view>
    <text class="label">{{ personType === 'INTERNAL' ? '选择内部人员' : '选择外协单位' }}<text class="required"> *</text></text>
    <button class="people-select" :aria-expanded="showPicker" @click="openPicker"><text>{{ chosen.length ? `已选择 ${chosen.length} 项，点击调整` : '请选择，可多选' }}</text><wd-icon name="arrow-down" /></button>
    <view v-if="chosen.length" class="chosen"><text>已选 {{ chosen.length }} 人</text><button v-for="u in chosen" :key="u.id" size="mini" @click="toggle(u)">{{ u.name }} · 移除</button></view>
  </SectionCard>
  <wd-popup v-model="showPicker" position="bottom" :z-index="12000" :safe-area-inset-bottom="true" custom-style="border-radius:16px 16px 0 0;" @close="cancelPicker">
    <view class="people-panel">
      <view class="people-panel__head"><text>{{ personType === 'INTERNAL' ? '选择协助人员' : '选择外协单位' }}</text><button aria-label="取消选择" @click="cancelPicker"><wd-icon name="close" /></button></view>
      <view class="search"><input v-model="keyword" :placeholder="personType === 'INTERNAL' ? '输入姓名搜索' : '输入单位名称搜索'" confirm-type="search" @confirm="search" /><button size="mini" :disabled="loading" @click="search">查询</button></view>
      <scroll-view scroll-y class="people-panel__list">
    <text v-if="loading" class="hint">正在加载候选列表…</text>
    <button v-else-if="failed" @click="load(page)">用户加载失败，点击重试</button>
    <template v-else>
      <label v-for="u in users" :key="u.id" class="user" @click="!excluded.includes(u.id) && toggleDraft(u)">
        <checkbox :checked="draftChosen.some(p => p.id === u.id)" :disabled="excluded.includes(u.id)" color="#1769c2" /><text>{{ u.name }}<text v-if="u.account" class="hint">（{{ u.account }}）</text><text v-if="excluded.includes(u.id)" class="hint"> · 已参与或待审批</text></text>
      </label>
      <text v-if="!users.length" class="hint">未找到用户，请更换姓名查询。</text>
    </template>
      </scroll-view>
    <view class="pages"><button size="mini" :disabled="loading || page <= 1" @click="load(page - 1)">上一页</button><text>第 {{ page }} 页</text><button size="mini" :disabled="loading || failed || !hasMore" @click="load(page + 1)">下一页</button></view>
      <view class="people-panel__footer"><button @click="cancelPicker">取消</button><button class="people-confirm" :disabled="loading" @click="confirmPicker">{{ `确定（${draftChosen.length}）` }}</button></view>
    </view>
  </wd-popup>
  <SectionCard title="申请原因">
    <label for="assist-reason" class="label">协助原因<text class="required"> *</text></label>
    <textarea id="assist-reason" v-model="reason" maxlength="1000" placeholder="请说明需要协助的工作和原因" />
    <text class="hint">多选时按人分别提交，审批通过后加入维修单。</text>
  </SectionCard>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import { repairOrderApi } from '@/service/repairOrder'
import SectionCard from '@/components/SectionCard/SectionCard.vue'
import type { AssistUser } from './repairWorkflow'
defineProps<{ excluded: string[] }>()
type Selection = AssistUser & {personType: 'INTERNAL' | 'EXTERNAL'}
const emit = defineEmits<{ submit: [users: Selection[], reason: string] }>()
const keyword = ref(''), query = ref(''), reason = ref('')
const chosen = ref<Selection[]>([]), users = ref<(AssistUser & { account: string })[]>([])
const showPicker = ref(false), draftChosen = ref<Selection[]>([])
async function openPicker() {
  draftChosen.value = chosen.value.map(u => ({...u})); keyword.value = ''; query.value = ''
  showPicker.value = true; await load(1)
}
function cancelPicker() { showPicker.value = false; draftChosen.value = [] }
function toggleDraft(u: AssistUser) {
  draftChosen.value = draftChosen.value.some(p => p.id === u.id) ? draftChosen.value.filter(p => p.id !== u.id) : [...draftChosen.value,{id:u.id,name:u.name,personType:personType.value}]
}
function confirmPicker() {
  if (loading.value) return
  chosen.value = draftChosen.value.map(u => ({...u})); showPicker.value = false
}
const personType = ref<'INTERNAL' | 'EXTERNAL'>('INTERNAL')
let allUsers: {id:string;name:string;account:string}[] = []
const page = ref(1), hasMore = ref(false), loading = ref(false), failed = ref(false)
let request = 0
async function load(next = 1) {
  const id = ++request
  loading.value = true; failed.value = false; page.value = next
  try {
    const response = await repairOrderApi.options(personType.value === 'INTERNAL' ? 'internal' : 'external')
    if (id !== request) return
    allUsers = response.map(r => ({id:r.value,name:r.label,account:''}))
    paginate(next)
  } catch { if (id === request) failed.value = true }
  finally { if (id === request) loading.value = false }
}
function paginate(next: number) { page.value = next; const rows = allUsers.filter(u => u.name.includes(query.value)); users.value = rows.slice((next - 1) * 10,next * 10); hasMore.value = next * 10 < rows.length }
function search() { query.value = keyword.value.trim(); paginate(1) }
function changeType(type: 'INTERNAL' | 'EXTERNAL') { if (personType.value === type) return; cancelPicker(); personType.value = type; chosen.value = []; ++request; users.value = []; keyword.value = ''; query.value = ''; loading.value = false }
async function toggle(u: AssistUser) {
  if (chosen.value.some(p => p.id === u.id)) { chosen.value = chosen.value.filter(p => p.id !== u.id); return }
  chosen.value.push({id:u.id,name:u.name,personType:personType.value})
}
defineExpose({ submit: () => emit('submit', chosen.value, reason.value), remove: (id: string) => { chosen.value = chosen.value.filter(u => u.id !== id) } })
</script>
<style scoped>
.people-select { display:flex; align-items:center; justify-content:space-between; gap:12px; width:100%; padding:10px 12px; border:1px solid #d5dce5; border-radius:8px; background:#f8fafc; color:#536176; font-size:16px; text-align:left; line-height:1.6; }
.people-select::after { border:0; }
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
