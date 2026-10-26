<template>
  <SectionCard title="协助管理">
    <template #extra><button class="text-action" @click="showDetails">查看详情</button></template>
    <view class="people-summary">
      <view v-if="activePeople.length" class="summary-line"><text class="summary-label">内协</text><text class="summary-names">{{ activePeople.map(p => p.name).join('、') }}</text><text class="summary-count">{{ activePeople.length }} 人</text></view>
      <view v-if="activeUnits.length" class="summary-line"><text class="summary-label">外协</text><text class="summary-names">{{ activeUnits.map(p => p.name).join('、') }}</text><text class="summary-count">{{ activeUnits.length }} 家</text></view>
      <text v-if="!activePeople.length && !activeUnits.length" class="summary-empty">暂无生效的协助人员</text>
    </view>
  </SectionCard>
  <wd-popup v-model="detailsOpen" position="bottom" :close-on-click-modal="!busy && !managing && !pending && !open && !managementOpen" :safe-area-inset-bottom="true" custom-style="border-radius:16px 16px 0 0;" :z-index="11000">
    <view class="details-panel">
      <view class="details-header"><text class="heading">协助详情</text><button class="text-action" :disabled="busy || managing || !!pending || open || managementOpen" @click="detailsOpen=false">关闭</button></view>
    <view class="tabs" role="tablist" aria-label="协助记录分类">
      <button role="tab" :aria-selected="tab === 'members'" :class="{active:tab === 'members'}" @click="tab='members';page=1">当前协助（{{ activeGroups.length }}）</button>
      <button role="tab" :aria-selected="tab === 'invitations'" :class="{active:tab === 'invitations'}" @click="tab='invitations';page=1">邀请记录（{{ applications.length }}）</button>
    </view>
    <scroll-view scroll-y class="details-scroll">
    <template v-if="tab === 'invitations'">
    <text v-if="!applications.length" class="empty">暂无协助邀请。发起邀请后，可在这里查看审批和人员指定进度。</text>
    <view v-for="application in visibleApplications" :key="application.id" class="application">
      <button class="summary" :aria-expanded="expanded === application.id" @click="expanded = expanded === application.id ? '' : application.id">
        <view class="row"><text class="heading">{{ applicationTitle(application) }}</text><text class="status">{{ statusText(application.applicationStatus) }}</text></view>
        <view class="row"><text class="hint">{{ collaborationType(application) === 'INTERNAL' ? '内协' : collaborationType(application) === 'EXTERNAL' ? '外协' : '协助' }} · {{ formatTime(application.createTime) }}</text><wd-icon :name="expanded === application.id ? 'arrow-up' : 'arrow-down'" /></view>
      </button>
      <view v-if="expanded === application.id" class="expanded">
      <text v-if="application.applicationNo" class="hint">申请编号：{{ application.applicationNo }}</text>
      <text v-if="application.applicantName || application.applicantUserName" class="hint">申请人：{{ application.applicantName || application.applicantUserName }}</text>
      <view v-for="department in departments(application)" :key="department.departmentId" class="department">
        <view class="row"><text>{{ department.departmentName || '受邀部门' }}</text><text>{{ statusText(department.status) }}</text></view>
        <text class="reason">{{ department.reason }}</text>
        <ApprovalReuseInfo :department="department" :detail="detail" />
        <text v-if="application.applicationStatus === 'APPROVED'" class="hint">人员指定：{{ statusText(department.assignmentStatus || application.formData?.assignmentStatus || 'NOT_READY') }}</text>
        <text v-if="department.assignedUserIds?.length" class="hint">已指定 {{ department.assignedUserIds.length }} 人{{ assignedNames(department) ? `：${assignedNames(department)}` : '' }}</text>
        <button v-if="canOfferAssignment(application, department, actorId, detail.order)" class="text-action" :disabled="locked" @click="openAssignment(application.id, department.departmentId)">指定内协人员</button>
      </view>
      <template v-if="!departments(application).length">
        <text class="reason">协助原因：{{ application.formData?.reason || application.reason || '—' }}</text>
        <text v-if="application.formData?.headcount != null" class="hint">人数：{{ application.formData.headcount }} 人</text>
        <text v-if="application.formData?.hoursPerPerson != null" class="hint">人均预计工时：{{ application.formData.hoursPerPerson }} h</text>
      </template>
      <view v-if="approvalTasks(application).length" class="approval">
        <text class="subheading">审批信息</text>
        <view v-for="task in approvalTasks(application)" :key="task.id" class="approval-row">
          <text>{{ task.departmentName || task.name || '审批节点' }} · {{ statusText(task.status || task.taskStatus) }}</text>
          <text v-if="task.assigneeName || task.approverName" class="hint">{{ task.assigneeName || task.approverName }}</text>
          <text v-if="task.comment || task.reason" class="hint">{{ task.comment || task.reason }}</text>
        </view>
      </view>
      <text v-if="application.reason" class="hint">处理说明：{{ application.reason }}</text>
      <view class="actions">
        <button v-if="canWithdrawCollaboration(application, detail, actorId)" class="text-action" :disabled="locked" @click="openManagement('withdraw',application.id,applicationTitle(application))">撤回申请</button>
        <button v-if="canReapplyCollaboration(application, detail, actorId)" class="text-action" :disabled="locked" @click="editInvitation(application.id)">修改重提</button>
      </view>
      <text v-if="canWithdrawCollaboration(application, detail, actorId)" class="hint">需要修改时，请先撤回；撤回成功后可修改重提，原记录保留。</text>
      </view>
    </view>
    </template>
    <template v-else>
      <view v-if="historyGroups.length || showHistory" class="history-switch"><button class="text-action" @click="showHistory=!showHistory;page=1">{{ showHistory ? '返回当前协助' : `查看历史协助（${historyGroups.length}）` }}</button></view>
      <text v-if="showHistory" class="subheading">已结束的协助</text>
      <text v-if="!listedGroups.length" class="empty">{{ showHistory ? '暂无已结束的协助记录' : '暂无生效协助。可在邀请记录中查看审批及人员指定进度。' }}</text>
      <view v-for="group in visibleGroups" :key="group.key" class="application">
        <view class="row"><text class="heading">{{ group.name }}</text><text class="status">{{ group.external ? '外协单位' : '内协' }}</text></view>
        <view v-for="member in group.members" :key="member.id" class="member-history">
          <view class="row"><text>{{ memberStatus(member.memberStatus) }}</text><button v-if="canExitInternalMember(member,detail,actorId)" class="text-action danger" :disabled="locked" @click="openManagement('memberExit',member.id,group.name)">移除</button></view>
          <text v-if="member.effectiveFrom" class="hint">加入：{{ formatTime(member.effectiveFrom) }}</text>
          <text v-if="member.effectiveTo" class="hint">结束：{{ formatTime(member.effectiveTo) }}</text>
          <text v-if="member.exitReason" class="hint">移除 / 结束原因：{{ member.exitReason }}</text>
          <text v-if="member.exitByName" class="hint">操作人：{{ member.exitByName }}</text>
        </view>
        <template v-if="group.external && group.members.some(m => m.memberStatus === 'ACTIVE') && isCollaborationOwner(detail,actorId)">
          <button disabled class="text-action">结束该单位协助（待接口）</button>
          <text class="hint">按单位整体结束的接口尚未确认，暂不支持办理，不会逐人移除代替。</text>
        </template>
      </view>
    </template>
    </scroll-view>
    <view v-if="pageCount > 1" class="pagination"><button :disabled="page <= 1" @click="page--">上一页</button><text>{{ page }} / {{ pageCount }}</text><button :disabled="page >= pageCount" @click="page++">下一页</button></view>
    </view>
  </wd-popup>
    <wd-popup v-model="managementOpen" position="bottom" :close-on-click-modal="!managing" :safe-area-inset-bottom="true" custom-style="border-radius:16px 16px 0 0;" :z-index="12000">
      <view class="assignment">
        <view class="row"><text class="heading">{{ managementKind === 'memberExit' ? '移除内协人员' : '撤回协助申请' }}</text><button class="text-action" :disabled="managing" @click="managementOpen=false">取消</button></view>
        <text class="reason">{{ managementName }}</text>
        <text class="hint">{{ managementKind === 'memberExit' ? '负责人确认后直接移除，无需审批。历史维修、打卡和工时记录保留；在途作业及物料由后端校验。' : '撤回成功后，可修改重提。原申请及审批记录不会删除。' }}</text>
        <label for="collaboration-reason" class="reason">{{ managementKind === 'memberExit' ? '移除原因' : '撤回原因' }}<text class="error"> *</text></label>
        <textarea id="collaboration-reason" v-model="managementReason" :disabled="managing" maxlength="10000" placeholder="请填写具体原因" />
        <text v-if="managementError" class="error" role="alert">{{ managementError }}</text>
        <button class="primary" :disabled="locked || !managementReason.trim()" @click="submitManagement">{{ managing ? '正在提交…' : managementKind === 'memberExit' ? '确认移除' : '确认撤回' }}</button>
      </view>
    </wd-popup>
    <wd-popup v-model="open" position="bottom" :close-on-click-modal="!busy && !pending" :safe-area-inset-bottom="true" custom-style="border-radius:16px 16px 0 0;" :z-index="12000">
      <view class="assignment">
        <view class="row"><text class="heading">{{ candidates?.departmentName || '指定内协人员' }}</text><button :disabled="busy || !!pending" @click="open=false">关闭</button></view>
        <text class="hint">{{ candidates?.reason }}</text>
        <text v-if="loading">正在读取可指定人员…</text>
        <text v-if="error" class="error" role="alert">{{ error }}</text>
        <template v-if="candidates && !loading">
          <input v-model="keyword" placeholder="搜索本部门人员" :disabled="busy || !!pending" />
          <scroll-view scroll-y class="members">
            <label v-for="member in filteredMembers" :key="member.value" class="member" @click="toggle(member.value)"><checkbox :checked="chosen.includes(member.value)" :disabled="busy || !!pending" /><text>{{ member.label }}</text></label>
            <text v-if="!filteredMembers.length" class="hint">暂无匹配的可指定人员</text>
          </scroll-view>
          <button class="primary" :disabled="busy || (!pending && !chosen.length)" @click="submit">{{ busy ? '正在提交…' : pending ? '重试本次指派' : `确认指定（${chosen.length}人）` }}</button>
          <text v-if="pending" class="hint">上次结果未确认，重试会复用同一请求和人员，不会重复入组。</text>
        </template>
      </view>
    </wd-popup>
</template>
<script setup lang="ts">
import ApprovalReuseInfo from './ApprovalReuseInfo.vue'
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import SectionCard from '@/components/SectionCard/SectionCard.vue'
import { repairOrderApi } from '@/service/repairOrder'
import { canOfferAssignment, collaborationStatusText as statusText, collaborationApplications, collaborationType, collaborationMemberGroups, canWithdrawCollaboration, canReapplyCollaboration, canExitInternalMember, isCollaborationOwner, type CollaborationManagementAction, type AssignmentInput, type AssignmentOptions } from '@/service/repairCollaboration'
const props = defineProps<{detail:Record<string,any>;actorId:string;disabled?:boolean;actionError?:string;manage?:(input:CollaborationManagementAction)=>Promise<boolean>}>()
const emit = defineEmits<{changed:[];edit:[applicationId:string]}>()
const applications = computed(() => collaborationApplications(props.detail))
const memberGroups = computed(() => collaborationMemberGroups(props.detail))
const detailsOpen=ref(false),showHistory=ref(false)
const activeGroups=computed(()=>memberGroups.value.map(g=>({...g,members:g.members.filter(m=>m.memberStatus==='ACTIVE' && (g.external || m.userId!==props.detail.order?.responsibleUserId))})).filter(g=>g.members.length))
const historyGroups=computed(()=>memberGroups.value.map(g=>({...g,members:g.members.filter(m=>m.memberStatus!=='ACTIVE')})).filter(g=>g.members.length))
const activePeople=computed(()=>[...new Map(activeGroups.value.filter(g=>!g.external).map(g=>[g.members[0].userId || g.key,g])).values()])
const activeUnits=computed(()=>activeGroups.value.filter(g=>g.external))
const listedGroups=computed(()=>showHistory.value?historyGroups.value:activeGroups.value)
const tab=ref<'invitations'|'members'>('members'),page=ref(1),expanded=ref('')
function showDetails(){if(detailsOpen.value)return;tab.value='members';showHistory.value=false;page.value=1;detailsOpen.value=true}
function showInvitation(applicationId:string,departmentId?:string){
  const index=applications.value.findIndex(a=>a.id===applicationId)
  if(index<0 || (departmentId && !departments(applications.value[index]).some((d:any)=>d.departmentId===departmentId)))return false
  tab.value='invitations';page.value=Math.floor(index/5)+1;expanded.value=applicationId;detailsOpen.value=true
  return true
}
defineExpose({showInvitation})
function editInvitation(id:string){if(locked.value)return;detailsOpen.value=false;emit('edit',id)}
const pageCount=computed(()=>Math.max(1,Math.ceil((tab.value==='invitations'?applications.value.length:listedGroups.value.length)/5)))
const visibleApplications=computed(()=>applications.value.slice((page.value-1)*5,page.value*5))
const visibleGroups=computed(()=>listedGroups.value.slice((page.value-1)*5,page.value*5))
watch(pageCount,count=>{page.value=Math.min(page.value,count)})
const formatTime=(value:unknown)=>String(value || '时间未返回').replace('T',' ').replace(/\.\d+(Z)?$/,'')
const memberStatus=(status:string)=>({ACTIVE:'协助中',ENDED:'已结束',EXITED:'已移除'}[status] || status || '状态未返回')
function applicationTitle(application:any) {
  const form=application.formData || {}
  return departments(application).map((d:any)=>d.departmentName || '受邀部门').join('、') || form.sourcePersonName || form.personNameSnapshot || form.companyName || application.applicationNo || '协助邀请'
}
function approvalTasks(application:any):any[]{return (props.detail.workflows || []).filter((w:any)=>w.businessId===application.id).flatMap((w:any)=>w.tasks || [])}
const managementOpen=ref(false),managing=ref(false),managementReason=ref(''),managementError=ref(''),managementName=ref(''),managementId=ref('')
const managementKind=ref<CollaborationManagementAction['kind']>('memberExit')
const locked=computed(()=>!!props.disabled || busy.value || loading.value || managing.value || !!pending.value)
function openManagement(kind:CollaborationManagementAction['kind'],id:string,name:string){
  if(locked.value)return
  managementKind.value=kind;managementId.value=id;managementName.value=name;managementReason.value='';managementError.value='';managementOpen.value=true
}
async function submitManagement(){
  if(locked.value || !props.manage)return
  if(!managementReason.value.trim()){managementError.value='请填写原因';return}
  const current=generation
  managing.value=true;managementError.value=''
  try {
    const saved=await props.manage({kind:managementKind.value,targetId:managementId.value,reason:managementReason.value})
    if(current!==generation)return
    if(saved)managementOpen.value=false
    else managementError.value=props.actionError || '操作未完成，请关闭弹窗查看页面提示后核对'
  } catch(e:any){if(current===generation)managementError.value=e.message || '操作未完成，请刷新核对'}
  finally{if(current===generation)managing.value=false}
}
const departments = (application:any) => Array.isArray(application.formData?.departments) ? application.formData.departments : []
function assignedNames(department:any) {
  return (props.detail.members || []).filter((m:any) => department.assignedUserIds?.includes(m.userId || m.sourcePersonId)).map((m:any) => m.userNameSnapshot || m.personNameSnapshot).filter(Boolean).join('、')
}
const open=ref(false),loading=ref(false),busy=ref(false),error=ref(''),keyword=ref('')
const chosen=ref<string[]>([]),candidates=ref<AssignmentOptions>(),pending=ref<AssignmentInput>()
let target={applicationId:'',departmentId:''},generation=0
onBeforeUnmount(()=>{generation++})
watch([()=>props.detail.order?.id,()=>props.actorId],()=>{generation++;open.value=false;candidates.value=undefined;pending.value=undefined;loading.value=false;busy.value=false;managementOpen.value=false;managing.value=false;expanded.value='';page.value=1;detailsOpen.value=false;showHistory.value=false})
const filteredMembers=computed(()=>(candidates.value?.members || []).filter(m=>m.label.includes(keyword.value.trim())))
async function openAssignment(applicationId:string,departmentId:string) {
  if(locked.value)return
  const current=++generation
  target={applicationId,departmentId};open.value=true;loading.value=true;error.value='';candidates.value=undefined;chosen.value=[];keyword.value='';pending.value=undefined
  try { const result=await repairOrderApi.assignmentOptions(applicationId,departmentId);if(current===generation)candidates.value=result }
  catch(e:any){if(current===generation)error.value=e.message || '无法读取本部门可指定人员'}
  finally{if(current===generation)loading.value=false}
}
function toggle(id:string){if(busy.value || pending.value)return;chosen.value=chosen.value.includes(id)?chosen.value.filter(v=>v!==id):chosen.value.length<20?[...chosen.value,id]:chosen.value}
async function submit(){
  if(props.disabled || busy.value || !candidates.value)return
  if(!pending.value){
    if(!chosen.value.length || chosen.value.length>20){error.value='请选择1至20名人员';return}
    pending.value={...target,requestId:`assign-${Date.now()}-${Math.random().toString(36).slice(2)}`,assignedUserIds:[...chosen.value]}
  }
  const current=generation
  busy.value=true;error.value=''
  try{await repairOrderApi.assignCollaboration(pending.value);if(current!==generation)return;pending.value=undefined;open.value=false;emit('changed')}
  catch(e:any){if(current!==generation)return;error.value=e.message || '指派结果未确认，请重试本次请求';if(e.success===false)pending.value=undefined}
  finally{if(current===generation)busy.value=false}
}
</script>
<style scoped>
.people-summary { display:flex;flex-direction:column;gap:8px; }
.summary-line { display:flex;align-items:center;gap:10px;min-width:0;font-size:14px;line-height:24px; }
.summary-label,.summary-count { flex-shrink:0;color:#667085; }
.summary-names { flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#344054; }
.summary-empty { color:#667085;font-size:14px;line-height:24px; }
.details-panel { display:flex;flex-direction:column;height:76vh;max-height:760px;box-sizing:border-box;padding:8px 20px 20px;background:#fff; }
.details-header { display:flex;align-items:center;justify-content:space-between;flex-shrink:0;margin-bottom:12px; }
.details-scroll { flex:1;min-height:0;height:0; }
.history-switch { display:flex;justify-content:flex-end;margin-bottom:12px; }
.details-panel .tabs,.details-panel .pagination { flex-shrink:0; }
.application + .application { margin-top:20px; border-top:1px solid #e5e7eb; padding-top:16px; }
.heading { font-size:16px; font-weight:600; color:#344054; }
.department { padding:14px 0; border-bottom:1px solid #edf0f3; }
.row { display:flex; justify-content:space-between; gap:12px; align-items:center; }
.reason,.hint,.error { display:block; margin-top:8px; font-size:14px; line-height:1.7; overflow-wrap:anywhere; }
.hint { color:#667085; }.error { color:#b42318; }
button { margin:10px 0 0; font-size:14px; min-height:44px; }.primary{background:#176ac7;color:white;}
.assignment { padding:20px; }.assignment input { margin-top:16px;padding:12px;border:1px solid #d5dce5;border-radius:8px; }
.members { height:35vh; }.member { display:flex;align-items:center;gap:12px;min-height:48px;border-bottom:1px solid #edf0f3; }
.tabs { display:flex;gap:8px;margin:0 0 16px;border-bottom:1px solid #e5e7eb; }
.tabs button { flex:1;min-width:0;margin:0;padding:8px 2px;background:transparent;color:#667085;font-size:14px;line-height:1.6;border-radius:0; }
.tabs .active { color:#176ac7;box-shadow:0 2px 0 #176ac7;font-weight:600; }
button::after { border:0; }
button:focus-visible,input:focus,textarea:focus { outline:2px solid #176ac7;outline-offset:2px; }
.summary { width:100%;padding:0;background:transparent;text-align:left;line-height:1.6;margin:0;border-radius:0; }
.summary .heading { min-width:0;overflow-wrap:anywhere; }
.status { flex-shrink:0;font-size:13px;color:#536176; }
.row > text:first-child { min-width:0;overflow-wrap:anywhere; }
.text-action { display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;background:transparent;color:#176ac7;min-height:44px;line-height:1.4;padding:0 8px;margin:0;font-size:14px; }
.text-action[disabled] { color:#737d8c;background:transparent; }
.danger { color:#b42318; }
.expanded { padding-top:8px; }
.approval { margin-top:20px; }
.subheading { font-size:15px;font-weight:600;color:#344054; }
.approval-row { padding:12px 0;font-size:14px;line-height:1.7;border-bottom:1px solid #edf0f3;overflow-wrap:anywhere; }
.actions { display:flex;justify-content:flex-end;gap:12px;flex-wrap:wrap;margin-top:12px; }
.member-history { padding:12px 0;border-bottom:1px solid #edf0f3; }
.empty { display:block;padding:16px 0;color:#667085;font-size:14px;line-height:1.8; }
.pagination { display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:20px;font-size:14px; }
.pagination button { margin:0;font-size:14px; }
.assignment { max-height:80vh;overflow-y:auto; }
.assignment textarea { box-sizing:border-box;width:100%;height:120px;margin-top:12px;padding:12px;border:1px solid #d5dce5;border-radius:8px;background:#f8fafc;font-size:16px;line-height:1.7; }
.assignment input { box-sizing:border-box;width:100%;height:48px;font-size:16px; }
.assignment label .error { display:inline; }
</style>
