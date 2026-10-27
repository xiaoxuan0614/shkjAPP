<template>
  <wd-popup v-model="visible" position="bottom" :close-on-click-modal="!busy && !pending" :safe-area-inset-bottom="true" :z-index="11000" custom-style="border-radius:16px 16px 0 0;">
    <view class="approval-panel" role="dialog" aria-label="维修审批">
      <view class="header"><text class="heading">{{ title }}</text><button class="text-button" :disabled="busy || !!pending" @click="close">关闭</button></view>
      <scroll-view scroll-y class="body">
        <text v-if="loading" class="hint" role="status">正在读取审批内容…</text>
        <view v-if="error" class="error" role="alert"><text>{{ error }}</text><button v-if="!pending" class="text-button" :disabled="loading || busy" @click="load()">重新读取</button></view>
        <template v-if="instance && !loading">
          <text class="hint">{{ statusText }}</text>
          <view v-for="(row,index) in rows" :key="index" class="row"><text class="label">{{ row.label }}</text><text class="value">{{ row.value }}</text></view>
          <text v-if="!rows.length && !error" class="hint">本申请未返回可展示的申请内容。</text>
          <picker v-if="tasks.length > 1" :disabled="busy || !!pending" :range="tasks" range-key="name" @change="selectTask">
            <view class="task-picker">当前节点：{{ task?.name || '请选择审批节点' }}<wd-icon name="arrow-down" /></view>
          </picker>
          <text v-else-if="task" class="hint">当前节点：{{ task.departmentName || task.name }}</text>
          <text v-if="!buttons.length && !error" class="hint">{{ taskReason || '当前没有可办理的审批任务，可能已处理或暂无权限。' }}</text>
          <template v-if="decision">
            <text class="field-label">{{ decision === 'REJECT' ? '驳回原因（必填）' : '审批意见（选填）' }}</text>
            <textarea v-model="comment" :disabled="busy || !!pending" class="comment" maxlength="1000" :placeholder="decision === 'REJECT' ? '请填写驳回原因' : '填写审批意见'" />
            <template v-if="decision === 'APPROVE' && isTransfer">
              <text class="field-label">接收人（必选）</text>
              <wd-select-picker v-model="transferTarget" :columns="people" type="radio" filterable title="选择接收人" :z-index="12000" :disabled="busy || !!pending" />
            </template>
            <template v-if="decision === 'APPROVE' && candidates">
              <view v-for="department in candidates.departments" :key="department.departmentId" class="candidate-group">
                <text class="field-label">{{ department.departmentName }} · 指定人员</text>
                <text v-if="!department.members.length" class="hint">暂无可选人员，不能直接通过</text>
                <wd-select-picker v-model="chosen[department.departmentId]" :columns="department.members" type="checkbox" filterable title="选择协助人员" :z-index="12000" :disabled="busy || !!pending" />
              </view>
            </template>
            <text v-if="isInternal && !candidates" class="hint">审批通过后，由受邀部门主管从指定人员待办继续办理。</text>
          </template>
          <text v-if="actionError" class="error" role="alert">{{ actionError }}</text>
        </template>
      </scroll-view>
      <view v-if="instance && !loading && !error && buttons.length" class="footer">
        <template v-if="!decision"><button v-if="buttons.includes('REJECT')" :disabled="busy" @click="prepare('REJECT')">驳回</button><button v-if="buttons.includes('APPROVE')" class="primary" :disabled="busy" @click="prepare('APPROVE')">同意</button></template>
        <template v-else><button :disabled="busy || !!pending" @click="decision='';actionError=''">返回</button><button class="primary" :disabled="busy" @click="submit">{{ busy ? '处理中…' : pending ? '重试本次提交' : decision === 'APPROVE' ? '确认同意' : '确认驳回' }}</button></template>
      </view>
    </view>
  </wd-popup>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { approvalRequest, validateRepairInstance, approvalButtons, approvalRows, snapshotField } from '@/service/repairApproval'
import { repairOrderApi } from '@/service/repairOrder'
import { approvalAssignments, parseApprovalCandidates, type ApprovalCandidates } from '@/service/collaborationApproval'

const emit = defineEmits(['processed'])
const visible = ref(false), loading = ref(false), busy = ref(false), error = ref(''), actionError = ref('')
const instance = ref<any>(), actions = ref<any>(), schema = ref<any>(), taskId = ref('')
const decision = ref<''|'APPROVE'|'REJECT'>(''), comment = ref(''), pending = ref<any>()
const candidates = ref<ApprovalCandidates>(), chosen = ref<Record<string,string[]>>({})
const people = ref<{value:string;label:string}[]>([]), transferTarget = ref('')
let context: Record<string,any> = {}, instanceId = '', generation = 0
const isInternal = computed(() => instance.value?.processKey === 'repair_ops_collaboration')
const isTransfer = computed(() => instance.value?.processKey === 'repair_ops_transfer')
const title = computed(() => ({repair_ops_collaboration:'内协邀请审批',repair_ops_external:'外协邀请审批',repair_ops_transfer:'维修转单审批',repair_ops_close:'维修关闭审批'}[instance.value?.processKey] || '维修审批'))
const statusText = computed(() => ({RUNNING:'审批中',APPROVED:'审批完成',REJECTED:'已驳回',RETURNED:'已退回',WITHDRAWN:'已撤回',TERMINATED:'已终止'}[instance.value?.status] || '审批详情'))
const rows = computed(() => instance.value && schema.value ? approvalRows(instance.value,schema.value) : [])
const tasks = computed<any[]>(() => (instance.value?.tasks || []).filter((t:any) => approvalButtons(instance.value,actions.value,String(t.id)).length))
const task = computed(() => tasks.value.find(t => String(t.id) === taskId.value))
const buttons = computed(() => approvalButtons(instance.value,actions.value,taskId.value))
const taskReason = computed(() => actions.value?.tasks?.find((t:any) => String(t.taskId)===taskId.value)?.reason)
function close() { if(busy.value || pending.value)return; visible.value=false;generation++;loading.value=false }
function selectTask(event:any) {taskId.value=String(tasks.value[Number(event.detail.value)]?.id || '');decision.value='';actionError.value=''}
async function open(id:string, params:Record<string,any> = {}, initial?:any) {
  if(visible.value || loading.value || busy.value)return
  instanceId=id;context=params;instance.value=undefined;schema.value=undefined;actions.value=undefined
  decision.value='';comment.value='';actionError.value='';pending.value=undefined
  visible.value=true
  await load(initial)
}
async function load(initial?:any) {
  if(loading.value || busy.value || pending.value)return
  const current=++generation
  loading.value=true;error.value='';decision.value='';schema.value=undefined;actions.value=undefined
  try {
    if(!instanceId)throw new Error('待办缺少审批实例编号，请刷新待办')
    const [detail,allowed,form] = await Promise.all([
      initial || approvalRequest('/workflow/instance/detail',{instanceId}),
      approvalRequest('/workflow/instance/actions',{instanceId}),
      approvalRequest('/workflow/instance/form',{instanceId}),
    ])
    if(current!==generation || !visible.value)return
    instance.value=validateRepairInstance(detail,instanceId,context)
    if(form.instanceId!==detail.id || form.processKey!==detail.processKey || form.version!==detail.version || !Array.isArray(form.fields))throw new Error('审批表单版本不一致，请重新读取')
    schema.value=form;actions.value=allowed
    // Match PC: do not approve unseen attachments.
    if(form.fields.some((f:any)=>f.type==='attachment' && form.fieldPermissions?.[f.key]!=='HIDDEN' && snapshotField(detail.snapshot,f.key)))throw new Error('本申请包含附件，请在 PC 查看附件后办理')
    taskId.value=context.taskId ? String(context.taskId) : tasks.value.length===1 ? String(tasks.value[0].id) : ''
  } catch(e:any) {if(current===generation)error.value=e.message || '审批内容读取失败，请重试'}
  finally {if(current===generation)loading.value=false}
}
async function prepare(action:'APPROVE'|'REJECT') {
  if(busy.value || !buttons.value.includes(action) || error.value)return
  busy.value=true;actionError.value='';candidates.value=undefined;chosen.value={};people.value=[];transferTarget.value=''
  try {
    if(isInternal.value) {
      const detail=await repairOrderApi.detail(String(instance.value.snapshot?.orderId || ''))
      const application=detail.applications?.find((a:any)=>a.id===instance.value.businessId)
      if(!application)throw new Error('未找到本次协助申请，请重新读取')
      if(application.formData?.assignmentMode==='WITH_APPROVAL') {
        candidates.value=parseApprovalCandidates(await repairOrderApi.approvalCandidates(application.id,taskId.value),taskId.value)
        candidates.value.departments.forEach(d=>{chosen.value[d.departmentId]=[]})
      }
    }
    if(isTransfer.value && action==='APPROVE') {
      people.value=await repairOrderApi.options('internal')
      if(!Array.isArray(people.value) || people.value.some(p=>!p.value || !p.label))throw new Error('接收人候选数据无效')
      const original=String(snapshotField(instance.value.snapshot,'form.targetUserId') || '')
      transferTarget.value=people.value.some(p=>p.value===original)?original:''
    }
    decision.value=action;comment.value=''
  } catch(e:any) {actionError.value=e.message || '办理信息读取失败，请重试'}
  finally {busy.value=false}
}
async function submit() {
  if(busy.value || !decision.value)return
  actionError.value=''
  if(decision.value==='REJECT' && !comment.value.trim()){actionError.value='请填写驳回原因';return}
  busy.value=true
  try {
    if(!pending.value) {
      const fresh=await approvalRequest('/workflow/instance/actions',{instanceId})
      actions.value=fresh
      if(!buttons.value.includes(decision.value))throw new Error('该任务已处理或权限已变化，请关闭后刷新待办')
      const base={instanceId,taskId:taskId.value,requestId:`mobile-review-${Date.now()}-${Math.random().toString(36).slice(2)}`,comment:comment.value.trim()}
      if(isInternal.value || isTransfer.value) {
        const extra:Record<string,any>=isInternal.value && candidates.value ? approvalAssignments(candidates.value,chosen.value,decision.value==='APPROVE') : {}
        if(isTransfer.value && decision.value==='APPROVE') {
          if(!people.value.some(p=>p.value===transferTarget.value))throw new Error('请选择有效的接收人')
          if(transferTarget.value!==snapshotField(instance.value.snapshot,'form.targetUserId'))extra.transferTargetUserId=transferTarget.value
        }
        pending.value={path:'/repair/application/review',body:{...base,applicationId:instance.value.businessId,approve:decision.value==='APPROVE',...extra}}
      } else pending.value={path:'/workflow/instance/handle',body:{...base,action:decision.value}}
    }
    await approvalRequest(pending.value.path,pending.value.body,true)
    pending.value=undefined;visible.value=false;emit('processed')
    uni.showToast({title:'审批提交成功',icon:'success'})
  } catch(e:any) {
    if(e.definite)pending.value=undefined
    actionError.value=pending.value ? '提交结果尚未确认，请重试本次提交（将保留原请求，避免重复审批）' : e.message || '审批失败，请重试'
  } finally {busy.value=false}
}
defineExpose({open})
</script>

<style scoped>
.approval-panel{display:flex;flex-direction:column;max-height:88vh;background:#fff;color:#344054}
.header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #edf0f3;gap:16px}
.heading{font-size:17px;font-weight:600}.text-button{margin:0;background:transparent;color:#176ac7;font-size:14px;min-height:44px;line-height:44px;padding:0 8px}
button::after{border:0}.body{min-height:0;max-height:65vh;padding:16px;box-sizing:border-box}.hint{display:block;font-size:14px;color:#667085;line-height:1.7;margin-bottom:12px}
.row{display:flex;gap:16px;padding:14px 0;border-bottom:1px solid #edf0f3;font-size:15px;line-height:1.7}.label{flex:0 0 96px;color:#667085}.value{flex:1;min-width:0;white-space:pre-wrap;overflow-wrap:anywhere}
.field-label{display:block;font-size:15px;margin:20px 0 10px}.comment{box-sizing:border-box;width:100%;height:110px;border:1px solid #dce2ea;border-radius:8px;padding:12px;font-size:16px;background:#f8fafc}
.task-picker{display:flex;justify-content:space-between;gap:12px;padding:14px 0;font-size:15px}.error{display:block;color:#b42318;font-size:14px;line-height:1.7;margin:12px 0;overflow-wrap:anywhere}
.footer{display:flex;gap:12px;padding:12px 16px;border-top:1px solid #edf0f3}.footer button{flex:1;margin:0;font-size:16px;line-height:44px;background:#f2f4f7;color:#344054}.footer .primary{background:#176ac7;color:#fff}button[disabled]{opacity:.5}
</style>
