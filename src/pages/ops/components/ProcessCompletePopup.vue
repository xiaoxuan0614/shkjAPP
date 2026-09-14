<template>
  <wd-popup v-model="visible" position="bottom" :root-portal="true" :z-index="2100" :close-on-click-modal="!submitting" :safe-area-inset-bottom="true">
    <view class="completion">
      <view class="completion__head"><text>实施完成</text><button :disabled="submitting" aria-label="关闭" @click="close">关闭</button></view>
      <scroll-view class="completion__body" scroll-y>
        <text class="completion__hint">选择本次完成的工序；已完成工序仅供查看。全部工序完成后，系统自动推进项目状态。</text>
        <text v-if="loading">正在加载工序…</text>
        <button v-else-if="failed" @click="load">加载失败，点击重试</button>
        <template v-else>
          <text v-if="!rows.length">暂无工序</text>
          <radio-group @change="select">
            <label v-for="row in rows" :key="row.id" class="completion__row">
              <radio :value="String(row.id)" :checked="selected === String(row.id)" :disabled="submitting || !selectable(row)" color="#176ac7" />
              <view class="completion__copy">
                <text>{{ names[row.processName] || row.processName_dictText || row.processName || '—' }}</text>
                <text class="completion__hint">{{ statuses[row.status] || row.status }} · {{ row.siteLeaderName || '未配置负责人' }}</text>
                <text class="completion__hint">{{ row.plannedStartTime || '—' }} ~ {{ row.plannedEndTime || '—' }}</text>
              </view>
            </label>
          </radio-group>
        </template>
      </scroll-view>
      <view class="completion__footer">
        <text v-if="confirming" class="completion__hint">确认将“{{ selectedName }}”标记为已完成？</text>
        <view class="completion__actions"><wd-button plain :disabled="submitting" @click="confirming ? confirming = false : close()">取消</wd-button><wd-button :loading="submitting" :disabled="loading || failed || !selected || submitting" @click="complete">{{ confirming ? '确认完成' : '完成' }}</wd-button></view>
      </view>
    </view>
  </wd-popup>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { projectApi, unwrapRecords } from '@/service/shkj'
import { http } from '@/utils/http'
import { usePermissionStore } from '@/store/permission'
import { useUserStore } from '@/store/user'
import { readProjectMembership } from '@/service/projectMembership'
const emit = defineEmits<{ success: [] }>()
const permission = usePermissionStore()
const user = useUserStore()
const userId = computed(() => String(user.userInfo.userid || (user.userInfo as any).id || ''))
const isManager = ref(false), currentReworkId = ref('')
const visible = ref(false), loading = ref(false), failed = ref(false), submitting = ref(false), confirming = ref(false)
const periodId = ref(''), selected = ref('')
const rows = ref<any[]>([])
const names = ref<Record<string, string>>({})
const statuses = ref<Record<string, string>>({ NOT_STARTED: '未开始', IN_PROGRESS: '进行中', COMPLETED: '已完成' })
let sequence = 0
const selectable = (row: any) => row.id && !!userId.value &&
  (isManager.value || String(row.siteLeaderId || '') === userId.value) &&
  (!currentReworkId.value || String(row.reworkId || '') === currentReworkId.value) &&
  String(row.status).toUpperCase() === 'IN_PROGRESS'
const selectedName = computed(() => { const row = rows.value.find(row => String(row.id) === selected.value); return row ? names.value[row.processName] || row.processName_dictText || row.processName : '' })
const select = (event: any) => { if (!submitting.value) { selected.value = event.detail.value; confirming.value = false } }
async function load() {
  const request = ++sequence
  loading.value = true; failed.value = false; selected.value = ''; confirming.value = false
  try {
    const [response, dict, statusDict, access, detail] = await Promise.all([projectApi.processes(periodId.value), http.get('/sys/dict/getDictItems/work_type'), http.get('/sys/dict/getDictItems/project_process_status'), readProjectMembership(periodId.value, userId.value), projectApi.detail(periodId.value)])
    if (request !== sequence) return
    isManager.value = access.manager
    currentReworkId.value = String((detail as any)?.result?.currentReworkId || '')
    rows.value = unwrapRecords(response)
    names.value = Object.fromEntries(unwrapRecords(dict).map(row => [String(row.value), row.text || row.label || row.value]))
    statuses.value = { ...statuses.value, ...Object.fromEntries(unwrapRecords(statusDict).map(row => [String(row.value), row.text || row.label || row.value])) }
  } catch { if (request === sequence) failed.value = true }
  finally { if (request === sequence) loading.value = false }
}
function open(id: string) { if (submitting.value || !id) return; periodId.value = id; rows.value = []; visible.value = true; void load() }
function close() { if (submitting.value) return; sequence++; visible.value = false }
async function complete() {
  if (submitting.value || loading.value || failed.value || !permission.hasPermission('project:implement')) return
  const row = rows.value.find(row => String(row.id) === selected.value)
  if (!row || !selectable(row)) return
  if (!confirming.value) { confirming.value = true; return }
  submitting.value = true
  try {
    const [access, detail, processes] = await Promise.all([
      readProjectMembership(periodId.value, userId.value), projectApi.detail(periodId.value), projectApi.processes(periodId.value),
    ])
    isManager.value = access.manager
    const period = (detail as any)?.result
    currentReworkId.value = String(period?.currentReworkId || '')
    const freshRow = unwrapRecords(processes).find(item => String(item.id) === selected.value)
    if (!['IMPLEMENTING', 'DEBUGGING', 'DEBUG_COMPLETED', 'REWORKING'].includes(String(period?.periodStatus ?? period?.status ?? '').toUpperCase()) || !freshRow || !selectable(freshRow)) {
      uni.showToast({ icon: 'none', title: '工序状态或操作资格已变化' }); await load(); return
    }
    const response: any = await projectApi.processStatus(periodId.value, selected.value)
    const state = response?.result ?? response
    if (String(state?.status).toUpperCase() !== 'IN_PROGRESS') { uni.showToast({ icon: 'none', title: '工序状态已变化，请重新选择' }); await load(); return }
    await http.post('/project/process/status', { processId: selected.value, status: 'COMPLETED' })
    visible.value = false; sequence++; emit('success')
    uni.showToast({ icon: 'success', title: '工序已完成' })
  } catch { /* 保留选项，请求层提示错误 */ }
  finally { submitting.value = false }
}
defineExpose({ open })
</script>
<style scoped>
.completion { display:flex; flex-direction:column; height:75vh; max-width:640px; margin:auto; background:#fff; }
.completion__head { display:flex; align-items:center; justify-content:space-between; padding:8px 16px; font-size:18px; font-weight:600; }
.completion__head button { margin:0; min-height:44px; font-size:14px; background:transparent; }
.completion__body { flex:1; height:0; min-height:0; padding:12px 16px; box-sizing:border-box; }
.completion__hint { display:block; color:#596574; font-size:13px; line-height:1.6; overflow-wrap:anywhere; }
.completion__row { display:flex; align-items:center; gap:10px; padding:14px 0; border-bottom:1px solid #edf0f3; }
.completion__copy { flex:1; min-width:0; font-size:15px; color:#27364a; }
.completion__footer { padding:12px 16px; border-top:1px solid #edf0f3; }
.completion__actions { display:flex; gap:12px; justify-content:flex-end; margin-top:8px; }
</style>
