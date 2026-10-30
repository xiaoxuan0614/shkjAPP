<template>
  <SectionCard title="今日值班运维人员">
    <view class="duty-header"><text>{{ day ? `${day.date} ${day.weekday || ''}` : '按北京时间查询' }}</text><button :disabled="loading" @click="load">{{ loading ? '加载中…' : '刷新' }}</button></view>
    <text v-if="loading" role="status" class="duty-hint">正在查询值班人员…</text>
    <view v-else-if="error" role="alert" class="duty-hint">{{ error }}，请点击刷新重试。</view>
    <template v-else-if="day">
      <text v-if="!day.dayUsers.length && !day.nightUsers.length" class="duty-hint">今日暂无值班安排</text>
      <template v-else>
        <view v-for="shift in shifts" :key="shift.key" class="duty-row"><text class="duty-label">{{ shift.label }}</text><text class="duty-names">{{ shift.people.map(person => person.name || '姓名未提供').join('、') || '未安排' }}</text></view>
      </template>
    </template>
  </SectionCard>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import SectionCard from '@/components/SectionCard/SectionCard.vue'
import { queryTodayDutyRoster, type DutyRosterDay } from '@/service/dutyRoster'
const day = ref<DutyRosterDay | null>(null), loading = ref(false), error = ref('')
const shifts = computed(() => [
  { key: 'day', label: '白班', people: day.value?.dayUsers || [] },
  { key: 'night', label: '夜班', people: day.value?.nightUsers || [] },
])
let active = true
async function load() {
  if (loading.value || !active) return
  loading.value = true; error.value = ''; day.value = null
  try { const result = await queryTodayDutyRoster(); if (active) day.value = result }
  catch { if (active) error.value = '值班信息暂时加载失败' }
  finally { if (active) loading.value = false }
}
onMounted(load)
onShow(load)
onBeforeUnmount(() => { active = false })
</script>

<style scoped>
.duty-header { display:flex; align-items:center; justify-content:space-between; gap:12px; color:#606875; font-size:13px; }
.duty-header button { margin:0; padding:0 10px; min-height:44px; background:transparent; color:#1765b6; font-size:14px; flex-shrink:0; }
.duty-header button::after { border:0; }
.duty-header button[disabled] { color:#606875; }
.duty-row { display:flex; gap:16px; padding:8px 0; font-size:14px; line-height:1.6; }
.duty-label { flex:0 0 32px; color:#606875; }
.duty-names { min-width:0; overflow-wrap:anywhere; color:#303640; }
.duty-hint { display:block; padding:8px 0; font-size:14px; line-height:1.6; color:#606875; }
</style>
