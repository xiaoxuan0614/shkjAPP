<template>
  <wd-popup v-model="visible" position="bottom" :close-on-click-modal="!busy && !pending" :safe-area-inset-bottom="true" :z-index="11000" custom-style="border-radius:16px 16px 0 0;">
    <view class="approval-panel" role="dialog" aria-label="维修审批">
      <view class="header"><text class="heading">{{ title }}</text><button class="text-button" :disabled="busy || !!pending" @click="close">关闭</button></view>
      <scroll-view scroll-y class="body">
        <text v-if="loading" class="hint" role="status">正在读取审批内容…</text>
        <view v-if="error" class="error" role="alert"><text>{{ error }}</text><button v-if="!pending" class="text-button" :disabled="loading || busy" @click="load()">重新读取</button></view>
        <template v-if="instance && !loading">
          <view class="status-line"><text class="hint">{{ statusText }}</text><button class="text-button" :disabled="!reportOrderId || busy || !!pending || openingReport" @click="openReport">查看维修单</button></view>
          <text v-if="!reportOrderId" class="hint">待办未返回维修单编号，暂无法查看维修单。</text>
          <view v-if="isInternal && invitedDepartments.length" class="invitation-content">
            <text class="invitation-title">受邀部门与协助原因</text>
            <view v-for="department in invitedDepartments" :key="department.index" class="invitation-department">
              <text class="department-name">{{ department.name || '部门名称未提供或不可见' }}</text>
              <text class="department-reason">{{ department.reason || '协助原因未提供或不可见' }}</text>
            </view>
          </view>
          <template v-if="isCompletion">
            <view v-for="group in completionGroups" :key="group.title" class="completion-group">
              <text class="field-label">{{ group.title }}</text>
              <text v-if="group.title === '费用信息' && completionNoQuotation" class="hint">无需报价</text>
              <template v-else><view v-for="(row,index) in group.rows" :key="index" class="row" :class="{ 'completion-reason': /amountChangeReason$/.test(row.path || '') }"><text class="label">{{ row.label }}</text><text class="value">{{ row.value }}</text></view></template>
            </view>
          </template>
          <template v-else><view v-for="(row,index) in summaryRows" :key="index" class="row" :class="{ 'quote-total': isQuotation && row.label === '合计' }"><text class="label">{{ isQuotation && row.label === '合计' ? '报价总额（元）' : row.label }}</text><text class="value">{{ row.value }}</text></view></template>
          <template v-if="isQuotation && quoteItems.length">
            <text class="field-label">报价明细<text class="detail-count">共 {{ quoteItems.length }} 项 · 金额单位：元</text></text>
            <view class="quote-table" role="table" aria-label="报价审批明细">
              <view class="quote-line quote-head" role="row"><text role="columnheader">名称</text><text role="columnheader">数量</text><text role="columnheader">单价</text><text role="columnheader">金额</text></view>
              <view v-for="item in quoteItems.slice((quotePage-1)*5, quotePage*5)" :key="item.index" class="quote-line" role="row"><text role="cell">{{ item.name || '—' }}</text><text role="cell">{{ item.qty || '—' }}</text><text role="cell">{{ item.price || '—' }}</text><text role="cell">{{ item.amount || '—' }}</text></view>
            </view>
            <view v-if="calculatedTotal !== undefined" class="row quote-total"><text class="label">报价合计（元）</text><text class="value">{{ calculatedTotal }}</text></view>
            <view v-if="quoteItems.length > 5" class="quote-pager"><button :disabled="quotePage === 1" @click="quotePage--">上一页</button><text>{{ quotePage }} / {{ Math.ceil(quoteItems.length/5) }} 页</text><button :disabled="quotePage >= Math.ceil(quoteItems.length/5)" @click="quotePage++">下一页</button></view>
          </template>
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
import { computed, ref, onMounted } from 'vue'
import { repairApprovalReturn } from '@/service/repairApprovalReturn'
import { onShow } from '@dcloudio/uni-app'
import { quotationLineTotal } from '@/service/quotationApproval'
import { approvalRequest, validateRepairInstance, approvalButtons, approvalRows, snapshotField } from '@/service/repairApproval'
import { repairOrderApi } from '@/service/repairOrder'
import { approvalAssignments, parseApprovalCandidates, type ApprovalCandidates } from '@/service/collaborationApproval'

const emit = defineEmits(['processed'])
const props = withDefaults(defineProps<{returnKey?:string}>(), {returnKey:'workflow'})
const visible = ref(false), loading = ref(false), busy = ref(false), error = ref(''), actionError = ref('')
const instance = ref<any>(), actions = ref<any>(), schema = ref<any>(), taskId = ref('')
const decision = ref<''|'APPROVE'|'REJECT'>(''), comment = ref(''), pending = ref<any>()
const candidates = ref<ApprovalCandidates>(), chosen = ref<Record<string,string[]>>({})
const people = ref<{value:string;label:string}[]>([]), transferTarget = ref('')
let context: Record<string,any> = {}, instanceId = '', generation = 0
const isInternal = computed(() => instance.value?.processKey === 'repair_ops_collaboration')
const isTransfer = computed(() => instance.value?.processKey === 'repair_ops_transfer')
const isQuotation = computed(() => instance.value?.processKey === 'repair_ops_quotation' || instance.value?.snapshot?.applicationType === 'QUOTATION')
const isCompletion = computed(() => instance.value?.processKey === 'repair_ops_completion' || instance.value?.snapshot?.applicationType === 'COMPLETION')
const quotePage = ref(1)
const openingReport = ref(false)
const reportOrderId = computed(() => String(instance.value?.snapshot?.orderId || context.orderId || ''))
let reportNextOpenAt = 0
let returnToApproval = false
function restoreApproval() {
  const saved = repairApprovalReturn.draft
  const route = getCurrentPages().slice(-1)[0]?.route
  if (saved && saved.route === route && saved.returnKey === props.returnKey) {
    repairApprovalReturn.draft = undefined
    instanceId=saved.instanceId;context=saved.context;taskId.value=saved.taskId
    decision.value=saved.decision;comment.value=saved.comment;chosen.value=saved.chosen
    candidates.value=saved.candidates;people.value=saved.people;transferTarget.value=saved.transferTarget
  } else if (!returnToApproval) return
  returnToApproval = false
  visible.value = true
  void load(undefined, true)
}
onShow(restoreApproval)
onMounted(restoreApproval)
function openReport() {
  if (!reportOrderId.value || busy.value || pending.value || openingReport.value || Date.now() < reportNextOpenAt) return
  openingReport.value = true
  reportNextOpenAt = Date.now() + 1000
  context = {...context, taskId:taskId.value}
  repairApprovalReturn.draft = {returnKey:props.returnKey,route:getCurrentPages().slice(-1)[0]?.route,instanceId,context:{...context},taskId:taskId.value,decision:decision.value,comment:comment.value,chosen:JSON.parse(JSON.stringify(chosen.value)),candidates:candidates.value,people:people.value,transferTarget:transferTarget.value}
  visible.value = false
  uni.navigateTo({
    url: `/pages/ops/repairDetail?id=${encodeURIComponent(reportOrderId.value)}`,
    success: () => { returnToApproval = true },
    fail: () => { repairApprovalReturn.draft=undefined;visible.value = true; reportNextOpenAt = 0; uni.showToast({title:'维修单打开失败，请重试',icon:'none'}) },
    complete: () => { openingReport.value = false },
  })
}
const title = computed(() => isCompletion.value ? '维修完结审批' : isQuotation.value ? '维修报价审批' : ({repair_ops_collaboration:'内协邀请审批',repair_ops_external:'外协邀请审批',repair_ops_transfer:'维修转单审批',repair_ops_close:'维修关闭审批'}[instance.value?.processKey] || '维修审批'))
const statusText = computed(() => ({RUNNING:'审批中',APPROVED:'审批完成',REJECTED:'已驳回',RETURNED:'已退回',WITHDRAWN:'已撤回',TERMINATED:'已终止'}[instance.value?.status] || '审批详情'))
const rows = computed(() => instance.value && schema.value ? approvalRows(instance.value,schema.value,true) : [])
const detailQuotationRequired = ref<boolean>()
const completionNoQuotation = computed(() => detailQuotationRequired.value === false || rows.value.some(row =>
  /(?:^|\.)quotationRequired$/.test(row.path || '') && snapshotField(instance.value?.snapshot, row.path!) === false,
))
const completionGroups = computed(() => {
  const groups = [{title:'维修信息',rows:[] as any[]},{title:'完工说明',rows:[] as any[]},{title:'费用信息',rows:[] as any[]}]
  // Use permission-filtered rows only; never expose raw snapshot fields.
  for (const row of summaryRows.value) {
    const path = row.path || ''
    const index = /(?:quotationRequired|noQuoteReason|totalAmount|customerConfirmedAmount|finalAmount|amountChangeReason)$/.test(path) ? 2 : /(?:description|completionDescription)$/.test(path) ? 1 : 0
    groups[index].rows.push(row)
  }
  return groups.filter(group => group.rows.length)
})
const quoteField = (path = '') => /(?:^|\.)items\[\]\.(itemName|name|quantity|unitPrice|amount|totalAmount)$/.exec(path)?.[1]
const departmentField = (path = '') => /(?:^|\.)departments\[\]\.(departmentName|reason)(?:\[\])?$/.exec(path)?.[1]
const invitedDepartments = computed(() => {
  const groups = new Map<number, {index:number;name?:string;reason?:string}>()
  for (const row of rows.value) {
    const field = departmentField(row.path)
    if (!field || !row.itemIndex) continue
    const group = groups.get(row.itemIndex) || {index:row.itemIndex}
    group[field === 'departmentName' ? 'name' : 'reason'] = row.value
    groups.set(row.itemIndex,group)
  }
  return [...groups.values()]
})
const summaryRows = computed(() => isQuotation.value ? rows.value.filter(row => !quoteField(row.path) && !/(?:^|\.)productNames(?:\[\])?$/.test(row.path || '') && !/^(?:报修产品|产品)(?:\s*\d+)?$/.test(row.label.trim())) : isInternal.value ? rows.value.filter(row => !departmentField(row.path)) : rows.value)
// Missing amounts can be calculated from visible values; explicitly hidden amounts cannot.
const amountHidden = computed(() => Object.entries(schema.value?.fieldPermissions || {}).some(([path,permission]) => permission === 'HIDDEN' && /(?:^|\.)(?:amount|totalAmount)$/.test(path)))
const quoteItems = computed(() => {
  const items = new Map<number, {index:number;name?:string;qty?:string;price?:string;amount?:string}>()
  for (const row of rows.value) {
    const field = quoteField(row.path)
    if (!field || !row.itemIndex) continue
    const item = items.get(row.itemIndex) || {index:row.itemIndex}
    const key = ({itemName:'name',name:'name',quantity:'qty',unitPrice:'price',amount:'amount',totalAmount:'amount'} as const)[field]
    item[key] = row.value
    items.set(row.itemIndex,item)
  }
  return [...items.values()].map(item => {
    if (item.amount == null && !amountHidden.value) {
      const amount = quotationLineTotal(item.price,item.qty)
      if (amount !== '—') item.amount = amount.replace('¥','')
    } else if (item.amount != null) item.amount = quotationLineTotal(item.amount,1).replace('¥','')
    if (item.price != null) item.price = quotationLineTotal(item.price,1).replace('¥','')
    return item
  })
})
const calculatedTotal = computed(() => {
  if (amountHidden.value || !quoteItems.value.length || summaryRows.value.some(row => /(?:^|\.)totalAmount$/.test(row.path || ''))) return undefined
  let cents = 0
  for (const item of quoteItems.value) {
    if (item.amount == null || !/^\d+\.\d{2}$/.test(item.amount)) return undefined
    cents += Number(item.amount.replace('.',''))
    if (!Number.isSafeInteger(cents)) return undefined
  }
  return (cents / 100).toFixed(2)
})
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
async function load(initial?:any, preserveDraft = false) {
  if(loading.value || busy.value || pending.value)return
  const current=++generation
  const previousTask = taskId.value
  loading.value=true;error.value='';if(!preserveDraft)decision.value='';schema.value=undefined;actions.value=undefined;quotePage.value=1
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
    detailQuotationRequired.value=undefined
    if (isCompletion.value && reportOrderId.value) {
      const orderDetail=await repairOrderApi.detail(reportOrderId.value)
      if(current!==generation || !visible.value)return
      if(typeof orderDetail.order?.quotationRequired==='boolean')detailQuotationRequired.value=orderDetail.order.quotationRequired
    }
    // Match PC: do not approve unseen attachments.
    if(form.fields.some((f:any)=>f.type==='attachment' && form.fieldPermissions?.[f.key]!=='HIDDEN' && snapshotField(detail.snapshot,f.key)))throw new Error('本申请包含附件，请在 PC 查看附件后办理')
    taskId.value=context.taskId ? String(context.taskId) : tasks.value.length===1 ? String(tasks.value[0].id) : ''
    if (preserveDraft && (previousTask !== taskId.value || (decision.value && !buttons.value.includes(decision.value)))) {
      decision.value=''
      actionError.value='审批状态或权限已变化，已保留填写内容，请核对后重新选择审批操作。'
    }
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
      if(instance.value?.businessType!=='REPAIR_OPS_APPLICATION' || !instance.value.businessId || !instanceId || !taskId.value)throw new Error('缺少维修申请或审批任务信息，请刷新')
      if(comment.value.trim().length>1000)throw new Error('审批意见最多1000字')
      const extra:Record<string,any>=isInternal.value && candidates.value ? approvalAssignments(candidates.value,chosen.value,decision.value==='APPROVE') : {}
      if(isTransfer.value && decision.value==='APPROVE') {
        if(!people.value.some(p=>p.value===transferTarget.value))throw new Error('请选择有效的接收人')
        if(transferTarget.value!==snapshotField(instance.value.snapshot,'form.targetUserId'))extra.transferTargetUserId=transferTarget.value
      }
      pending.value={path:'/repair/application/review',body:{...base,applicationId:instance.value.businessId,approve:decision.value==='APPROVE',...extra}}
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
.invitation-title{display:block;font-size:14px;color:#667085;margin:12px 0 4px}.invitation-department{padding:16px 0;border-bottom:1px solid #edf0f3}.department-name{display:block;font-size:16px;font-weight:600;color:#344054;overflow-wrap:anywhere}.department-reason{display:block;margin-top:8px;font-size:15px;line-height:1.7;white-space:pre-wrap;overflow-wrap:anywhere}.invitation-content{margin-bottom:16px}
.status-line{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px}.status-line .hint{margin-bottom:0}.status-line .text-button{flex-shrink:0}
.header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #edf0f3;gap:16px}
.heading{font-size:17px;font-weight:600}.text-button{margin:0;background:transparent;color:#176ac7;font-size:14px;min-height:44px;line-height:44px;padding:0 8px}
button::after{border:0}.body{min-height:0;max-height:65vh;padding:16px;box-sizing:border-box}.hint{display:block;font-size:14px;color:#667085;line-height:1.7;margin-bottom:12px}
.row{display:flex;gap:16px;padding:14px 0;border-bottom:1px solid #edf0f3;font-size:15px;line-height:1.7}.label{flex:0 0 96px;color:#667085}.value{flex:1;min-width:0;white-space:pre-wrap;overflow-wrap:anywhere}
.field-label{display:block;font-size:15px;margin:20px 0 10px}.comment{box-sizing:border-box;width:100%;height:110px;border:1px solid #dce2ea;border-radius:8px;padding:12px;font-size:16px;background:#f8fafc}
.task-picker{display:flex;justify-content:space-between;gap:12px;padding:14px 0;font-size:15px}.error{display:block;color:#b42318;font-size:14px;line-height:1.7;margin:12px 0;overflow-wrap:anywhere}
.footer{display:flex;gap:12px;padding:12px 16px;border-top:1px solid #edf0f3}.footer button{flex:1;margin:0;font-size:16px;line-height:44px;background:#f2f4f7;color:#344054}.footer .primary{background:#176ac7;color:#fff}button[disabled]{opacity:.5}
.detail-count{display:block;margin-top:6px;font-size:12px;color:#667085;font-weight:400}.quote-table{border:1px solid #e3e8ef;border-radius:8px;overflow:hidden}.quote-line{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,.65fr) minmax(0,.9fr) minmax(0,1fr);gap:8px;padding:12px 8px;border-top:1px solid #eaecf0;font-size:12px;line-height:1.6;font-variant-numeric:tabular-nums}.quote-line:first-child{border-top:0}.quote-line>text{min-width:0;overflow-wrap:anywhere;text-align:right}.quote-line>text:first-child{text-align:left}.quote-head{background:#f2f6fc;color:#475467}.quote-total .value{font-weight:600;color:#176ac7;text-align:right;font-variant-numeric:tabular-nums}.quote-pager{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;font-size:12px;color:#667085}.quote-pager button{margin:0;padding:0 10px;line-height:44px;font-size:13px;background:#edf5ff;color:#176ac7}button:focus-visible{outline:2px solid #176ac7;outline-offset:2px}
.completion-group { padding:4px 0 16px; border-bottom:1px solid #edf0f3; margin-bottom:12px; }
.completion-group .row { align-items:flex-start; }
.completion-group .value { overflow-wrap:anywhere; white-space:pre-wrap; }
.completion-reason { padding:12px; background:#fff7ed; border-radius:8px; color:#9a3412; }
</style>
