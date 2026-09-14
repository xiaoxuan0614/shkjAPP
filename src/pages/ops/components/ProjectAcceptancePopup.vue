<template>
  <wd-popup v-model="visible" position="bottom" :root-portal="true" :close-on-click-modal="false" :safe-area-inset-bottom="true">
    <view class="acceptance">
      <view class="acceptance__head"><text>项目验收</text><button :disabled="busy" @click="close">关闭</button></view>
      <scroll-view scroll-y class="acceptance__body">
        <text class="acceptance__muted">{{ formatProjectName(project) }}</text>
        <text v-if="loading">正在加载验收记录…</text>
        <view v-else-if="error"><text>{{ error }}</text><button @click="load">重新加载</button></view>
        <template v-else>
          <view v-for="type in types" :key="type" class="acceptance__section">
            <view class="acceptance__title">{{ type === 'INTERNAL' ? '内部验收' : '客户验收' }}</view>
            <text v-if="!forms[type].id">当前施工轮次暂无验收记录</text>
            <template v-else>
              <text class="acceptance__muted">{{ statusText(forms[type]) }}</text>
              <view class="acceptance__field"><text>验收日期</text><picker mode="date" :value="forms[type].acceptDate" :disabled="!canEdit(type) || busy" @change="forms[type].acceptDate = $event.detail.value"><view class="acceptance__input">{{ forms[type].acceptDate || '请选择验收日期' }} <wd-icon name="arrow-down" size="14px" /></view></picker></view>
              <view class="acceptance__field"><text>验收负责人</text><text>{{ canEdit(type) ? userName : forms[type].acceptUnitLeader || forms[type].acceptLeaderName || '—' }}</text></view>
              <view class="acceptance__field"><text>联系电话</text><input v-model="forms[type].acceptUnitPhone" :disabled="!canEdit(type) || busy" class="acceptance__input" placeholder="选填" /></view>
              <view class="acceptance__field"><text>验收结果</text><picker :range="resultOptions" range-key="label" :value="forms[type].result === 'FAILED' ? 1 : 0" :disabled="!canEdit(type) || busy" @change="forms[type].result = resultOptions[Number($event.detail.value)].value"><view class="acceptance__input">{{ resultText(forms[type].result) }} <wd-icon name="arrow-down" size="14px" /></view></picker></view>
              <view v-for="field in fileFields(type)" :key="field.key" class="acceptance__field">
                <text>{{ field.label }}</text>
                <view v-for="path in files(forms[type][field.key])" :key="path" class="acceptance__file">
                  <button @click="preview(path)">{{ fileName(path) }} · 预览</button>
                  <button v-if="canEdit(type)" :disabled="busy" @click="removeFile(type, field.key, path)">移除</button>
                </view>
                <button v-if="canEdit(type) && files(forms[type][field.key]).length < field.limit" :disabled="busy" @click="upload(type, field.key, field.limit)">上传{{ field.label }}</button>
              </view>
              <view class="acceptance__field"><text>{{ forms[type].result === 'FAILED' ? '不通过原因（必填）' : '验收说明' }}</text><textarea v-model="forms[type].remark" :disabled="!canEdit(type) || busy" class="acceptance__textarea" placeholder="请输入说明" /></view>
              <button v-if="canEdit(type)" type="primary" :loading="submitting" :disabled="busy" @click="submit(type)">提交{{ type === 'INTERNAL' ? '内部' : '客户' }}验收</button>
              <view v-if="type === 'INTERNAL' && canRecheck" class="acceptance__field"><text>重新内验原因</text><textarea v-model="recheckReason" class="acceptance__textarea" :disabled="busy" placeholder="说明无需施工整改的原因" /><button :disabled="busy" @click="recheck">申请重新内验</button></view>
            </template>
          </view>
          <text class="acceptance__muted">报告最多 3 个，每次上传 1 个；支持图片、Word、PDF、Excel。附件随验收结果统一提交，关闭前未提交的内容不保存。</text>
          <view class="acceptance__section"><view class="acceptance__title">历史验收记录</view>
            <view v-for="row in history" :key="row.id" class="acceptance__history">
              <text>{{ row.acceptType === 'INTERNAL' ? '内部' : '客户' }} · {{ row.acceptEndDate || row.createTime || '—' }} · {{ statusText(row) }}</text>
              <text v-if="row.remark">{{ row.remark }}</text><text v-if="row.resubmitReason">复验原因：{{ row.resubmitReason }}</text>
              <button v-for="path in files([row.completionReportFileId, row.acceptanceFormFileId].filter(Boolean).join(','))" :key="path" @click="preview(path)">{{ fileName(path) }} · 预览</button>
            </view>
          </view>
        </template>
      </scroll-view>
    </view>
  </wd-popup>
  <ContractFilePreview ref="filePreview" />
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import { useToast } from 'wot-design-uni'
import { useUserStore } from '@/store/user'
import { usePermissionStore } from '@/store/permission'
import { http } from '@/utils/http'
import { formatProjectName } from '@/service/shkj'
import { readProjectMembership } from '@/service/projectMembership'
import { acceptanceApi, currentAcceptance, readAcceptanceContext, readAcceptanceRecords, type AcceptanceType } from '@/service/projectAcceptance'
import ContractFilePreview from '../../home/components/ContractFilePreview.vue'
const emit = defineEmits<{ changed: [] }>()
const toast = useToast(), user = useUserStore(), permission = usePermissionStore()
const visible = ref(false), loading = ref(false), submitting = ref(false), uploading = ref(false), error = ref('')
const busy = computed(() => loading.value || submitting.value || uploading.value)
const periodId = ref(''), project = ref<any>({}), manager = ref(false), recheckReason = ref('')
const types: AcceptanceType[] = ['INTERNAL', 'CUSTOMER']
const forms = ref<Record<AcceptanceType, any>>({ INTERNAL: {}, CUSTOMER: {} })
const records = ref<Record<AcceptanceType, any[]>>({ INTERNAL: [], CUSTOMER: [] })
const history = computed(() => [...records.value.INTERNAL, ...records.value.CUSTOMER].sort((a,b) => String(b.createTime || '').localeCompare(String(a.createTime || ''))))
const userId = computed(() => String(user.userInfo.userid || (user.userInfo as any).id || ''))
const userName = computed(() => String((user.userInfo as any).realname || (user.userInfo as any).realName || user.userInfo.username || ''))
const admin = computed(() => user.userInfo.username === 'admin')
const round = () => String(project.value.currentReworkId || '')
const canOperate = (type: AcceptanceType, context = project.value) => admin.value || (type === 'INTERNAL' ? permission.hasPermission('project:internalAccept') : permission.hasPermission('project:accept') && !!userId.value && userId.value === String(context.projectManagerUserId || context.projectManagerId || ''))
const canEdit = (type: AcceptanceType) => !error.value && String(project.value.periodStatus ?? project.value.status).toUpperCase() === 'ACCEPTING' && forms.value[type].id && forms.value[type].acceptStatus === 'IN_PROGRESS' && canOperate(type)
const canRecheck = computed(() => String(project.value.periodStatus ?? project.value.status).toUpperCase() === 'ACCEPTING' && manager.value && permission.hasPermission('project:acceptance:submit') && forms.value.INTERNAL.acceptStatus === 'COMPLETED' && forms.value.INTERNAL.result === 'FAILED')
const resultOptions = [{ label: '通过', value: 'PASSED' }, { label: '不通过', value: 'FAILED' }]
const resultText = (value: string) => value === 'PASSED' ? '通过' : value === 'FAILED' ? '不通过' : '请选择结果'
const statusText = (row: any) => row.acceptStatus === 'COMPLETED' ? resultText(row.result) : row.acceptStatus === 'IN_PROGRESS' ? '验收中' : row.acceptStatus === 'CANCELLED' ? '已取消' : '未开始'
const files = (value: string) => [...new Set(String(value || '').split(',').map(path => path.trim()).filter(Boolean))]
const fileName = (path: string) => { try { return decodeURIComponent(path.split('/').pop() || '附件') } catch { return '附件' } }
const fileFields = (type: AcceptanceType) => [{ key: 'completionReportFileId', label: '验收报告', limit: 3 }, ...(type === 'CUSTOMER' ? [{ key: 'acceptanceFormFileId', label: '验收单', limit: 1 }] : [])].filter(field => forms.value[type].result === 'PASSED' || (!canEdit(type) && files(forms.value[type][field.key]).length))
const filePreview = ref<InstanceType<typeof ContractFilePreview>>()
const preview = (path: string) => filePreview.value?.open({ path, name: fileName(path) })
let version = 0
async function load() {
  const request = ++version
  loading.value = true; error.value = ''
  try {
    const [context, internal, customer, access] = await Promise.all([readAcceptanceContext(periodId.value), readAcceptanceRecords(periodId.value, 'INTERNAL'), readAcceptanceRecords(periodId.value, 'CUSTOMER'), readProjectMembership(periodId.value, userId.value)])
    if (request !== version) return
    project.value = context; manager.value = access.manager
    records.value = { INTERNAL: internal, CUSTOMER: customer }
    for (const type of types) {
      const row = currentAcceptance(records.value[type], round()) || {}
      forms.value[type] = { ...row, acceptDate: String(row.acceptEndDate || row.acceptDate || '').slice(0,10), result: row.result || '', remark: row.remark || '' }
    }
  } catch (e: any) { if (request === version) error.value = e?.message || '验收加载失败，请重试' }
  finally { if (request === version) loading.value = false }
}
function open(id: string) { if (busy.value) return; periodId.value = id; visible.value = true; project.value = {}; forms.value = { INTERNAL: {}, CUSTOMER: {} }; records.value = { INTERNAL: [], CUSTOMER: [] }; recheckReason.value = ''; void load() }
async function close() {
  if (busy.value) return
  const result = await new Promise<boolean>(resolve => uni.showModal({ title: '关闭验收', content: '未提交的内容不会保存，确定关闭？', success: r => resolve(!!r.confirm), fail: () => resolve(false) }))
  if (result) { visible.value = false; version++ }
}
function removeFile(type: AcceptanceType, key: string, path: string) { if (!busy.value && canEdit(type)) forms.value[type][key] = files(forms.value[type][key]).filter(item => item !== path).join(',') }
async function upload(type: AcceptanceType, key: string, limit: number) {
  if (busy.value || !canEdit(type)) return
  uploading.value = true
  try {
    const file: any = await new Promise((resolve, reject) => {
      const options = { count: 1, type: 'all' as const, success: (r: any) => resolve(r.tempFiles[0]), fail: reject }
      // #ifdef H5
      uni.chooseFile(options)
      // #endif
      // #ifdef MP-WEIXIN
      uni.chooseMessageFile(options)
      // #endif
      // #ifndef H5 || MP-WEIXIN
      reject(new Error('当前端暂不支持文件选择，请使用 H5 或微信小程序'))
      // #endif
    })
    if (!/\.(png|jpe?g|webp|gif|bmp|docx?|pdf|xlsx?)$/i.test(file.name || file.path || '') || Number(file.size) > 20 * 1024 * 1024) throw new Error('请选择 20MB 以内的图片、Word、PDF 或 Excel')
    const response: any = await http.upload('/sys/common/upload', { filePath: file.path, name: 'file', formData: { biz: `${periodId.value}/` },
      // #ifdef H5
      file: file.file,
      // #endif
    })
    const data = response?.data
    if (!data?.success || ![0,200].includes(Number(data.code)) || !String(data.message || '').trim()) throw new Error(data?.message || '上传失败')
    const next = [...files(forms.value[type][key]), String(data.message).trim()]
    if (next.length > limit) throw new Error('附件数量超过上限')
    forms.value[type][key] = next.join(',')
  } catch (e: any) { if (!String(e?.errMsg || '').includes('cancel')) toast.warning(e?.message || '附件未上传，请重试') }
  finally { uploading.value = false }
}
async function assertCurrent(type: AcceptanceType, id: string, expected: string) {
  const [context, rows] = await Promise.all([readAcceptanceContext(periodId.value), readAcceptanceRecords(periodId.value, type)])
  const latest = currentAcceptance(rows, String(context.currentReworkId || ''))
  if (String(context.periodStatus ?? context.status).toUpperCase() !== 'ACCEPTING' || !latest || String(latest.id) !== id || latest.acceptStatus !== expected || String(context.currentReworkId || '') !== round()) throw new Error('验收记录或施工轮次已变化，请关闭后重新打开')
  return context
}
async function submit(type: AcceptanceType) {
  if (busy.value || !canEdit(type)) return
  const row = forms.value[type]
  if (!row.acceptDate || !dayjs(row.acceptDate).isValid()) return toast.warning('请选择验收日期')
  if (!['PASSED','FAILED'].includes(row.result)) return toast.warning('请选择验收结果')
  if (row.result === 'PASSED' && !files(row.completionReportFileId).length) return toast.warning('验收通过必须上传报告')
  if (row.result === 'FAILED' && !row.remark.trim()) return toast.warning('请填写不通过原因')
  if (!userId.value || !userName.value) return toast.warning('登录人信息缺失，请重新登录')
  submitting.value = true
  let completed = false
  try {
    const context = await assertCurrent(type, String(row.id), 'IN_PROGRESS')
    if (!canOperate(type, context)) throw new Error('当前账号已无验收办理权限')
    await acceptanceApi.complete({ acceptanceId: String(row.id), periodId: periodId.value, acceptType: type, acceptEndDate: `${row.acceptDate} 00:00:00`, result: row.result, acceptUnitLeader: userName.value, acceptUnitPhone: row.acceptUnitPhone || '', completionReportFileId: row.result === 'PASSED' ? row.completionReportFileId || '' : '', ...(type === 'CUSTOMER' ? { acceptanceFormFileId: row.result === 'PASSED' ? row.acceptanceFormFileId || '' : '' } : {}), remark: row.remark.trim(), ...(round() ? { reworkId: round() } : {}) })
    completed = true; row.acceptStatus = 'COMPLETED'; toast.success('验收已提交'); emit('changed')
    await load()
  } catch (e: any) { toast.warning(e?.message || (completed ? '已提交，刷新失败，请重新打开' : '提交失败，内容已保留')) }
  finally { submitting.value = false }
}
async function recheck() {
  if (busy.value || !canRecheck.value) return
  if (!recheckReason.value.trim()) return toast.warning('请填写重新内验原因')
  submitting.value = true
  try {
    await assertCurrent('INTERNAL', String(forms.value.INTERNAL.id), 'COMPLETED')
    if (!(await readProjectMembership(periodId.value, userId.value)).manager || !permission.hasPermission('project:acceptance:submit')) throw new Error('当前账号已无重新内验资格')
    const response: any = await acceptanceApi.recheck(periodId.value, String(forms.value.INTERNAL.id), recheckReason.value.trim())
    if (!response?.result?.id) { error.value = '请求已返回但缺少新记录，请刷新核实，勿重复申请'; return }
    forms.value.INTERNAL = response.result; recheckReason.value = ''; toast.success('重新内验已开始'); emit('changed'); await load()
  } catch (e: any) { toast.warning(e?.message || '申请失败，请核实后重试') }
  finally { submitting.value = false }
}
defineExpose({ open })
</script>
<style scoped>
.acceptance { height: 86vh; max-width: 720px; margin: auto; display: flex; flex-direction: column; background: #fff; color: #253247; }
.acceptance__head { display:flex; align-items:center; justify-content:space-between; padding:8px 16px; font-size:18px; font-weight:600; }
.acceptance__head button { margin:0; }
.acceptance__body { height:0; flex:1; min-height:0; padding:16px; box-sizing:border-box; }
.acceptance__section { margin:24px 0; padding-bottom:24px; border-bottom:1px solid #e3e8ee; }
.acceptance__title { font-size:18px; font-weight:600; margin-bottom:12px; }
.acceptance__field { display:flex; flex-direction:column; gap:8px; margin:16px 0; font-size:16px; }
.acceptance__input { min-height:44px; padding:8px 10px; box-sizing:border-box; border:1px solid #cbd5e1; border-radius:6px; font-size:16px; }
.acceptance__textarea { width:100%; height:96px; box-sizing:border-box; padding:10px; border:1px solid #cbd5e1; border-radius:6px; font-size:16px; }
.acceptance__muted { display:block; color:#536176; font-size:14px; line-height:1.7; }
.acceptance button { min-height:44px; font-size:14px; line-height:1.6; padding:10px; white-space:normal; overflow-wrap:anywhere; }
.acceptance__file { display:flex; align-items:center; gap:8px; }
.acceptance__file button:first-child { flex:1; min-width:0; margin:0; text-align:left; }
.acceptance__history { display:flex; flex-direction:column; gap:8px; padding:12px 0; font-size:14px; border-bottom:1px solid #e3e8ee; }
</style>
