import { http } from '@/utils/http'

export interface CollaborationDraft {
  personType: 'INTERNAL' | 'EXTERNAL'
  targetId?: string
  reason?: string
  departments?: { departmentId: string; reason: string }[]
  personCount?: number
  estimatedTotalHours?: number
}

/** Display-only names never enter the business submission payload. */
export interface CollaborationPrefill extends CollaborationDraft {
  departmentNames?: Record<string, string>
  targetName?: string
}
export type CollaborationManagementAction = { kind: 'memberExit' | 'withdraw'; targetId: string; reason: string }
export function collaborationApplications(detail: Record<string, any>): any[] {
  return (detail.applications || []).filter((a: any) => a.applicationType === 'COLLABORATION')
}
export function collaborationType(application: any): string {
  return application.formData?.personType || (Array.isArray(application.formData?.departments) ? 'INTERNAL' : '')
}
/** Approval copy uses business names, never raw IDs or serialized workflow fields. */
export function collaborationApprovalSummary(application: any, detail: Record<string, any>) {
  const form = application?.formData || {}, type = collaborationType(application || {})
  const departments = Array.isArray(form.departments) ? form.departments : []
  if (type === 'INTERNAL' && departments.length) return {
    typeLabel: '内部协助', targetLabel: '邀请部门', note: '审批通过后，由受邀部门主管指定协助人员。',
    entries: departments.map((d: any) => ({target: d.departmentName || '部门名称未返回，请核对申请', reason: d.reason || form.reason || application.reason || '未填写协助原因'})),
    staffing: '',
  }
  const member = (detail.members || []).find((m: any) => form.sourcePersonId && m.sourcePersonId === form.sourcePersonId)
  const name = form.unitName || form.companyName || form.sourcePersonName || form.personNameSnapshot || form.userNameSnapshot || member?.personNameSnapshot || member?.userNameSnapshot
  return {
    typeLabel: type === 'EXTERNAL' ? '外部协助' : type === 'INTERNAL' ? '内部协助' : '协助申请',
    targetLabel: type === 'EXTERNAL' ? '邀请单位' : '邀请对象', note: '',
    entries: [{target: name || '邀请对象名称未返回，请核对申请', reason: form.reason || application?.reason || '未填写协助原因'}],
    staffing: type === 'EXTERNAL' ? [form.personCount != null ? `${form.personCount} 人` : form.headcount != null ? `${form.headcount} 人` : '', form.estimatedTotalHours != null ? `预计总工时 ${form.estimatedTotalHours} h` : form.hoursPerPerson != null ? `每人预计 ${form.hoursPerPerson} h` : ''].filter(Boolean).join('，') : '',
  }
}
export function isCollaborationOwner(detail: Record<string, any>, actorId: string): boolean {
  return !!actorId && detail.order?.responsibleUserId === actorId
    && !!detail.order?.workStatus && !['DRAFT', 'COMPLETED', 'CLOSED'].includes(detail.order.workStatus)
}
export function canInviteCollaboration(detail: Record<string, any>, actorId: string): boolean {
  return isCollaborationOwner(detail, actorId) && detail.actions?.canOwnerApply === true
}
export function canWithdrawCollaboration(application: any, detail: Record<string, any>, actorId: string): boolean {
  return isCollaborationOwner(detail, actorId) && application?.applicationType === 'COLLABORATION'
    && application.applicantUserId === actorId && application.applicationStatus === 'PENDING'
    && application.canWithdraw !== false
}
export function canReapplyCollaboration(application: any, detail: Record<string, any>, actorId: string): boolean {
  return canInviteCollaboration(detail, actorId) && application?.applicationType === 'COLLABORATION'
    && application.applicantUserId === actorId && ['RETURNED', 'REJECTED', 'WITHDRAWN'].includes(application.applicationStatus)
    && ((collaborationType(application) === 'INTERNAL' && Array.isArray(application.formData?.departments)) || (collaborationType(application) === 'EXTERNAL' && !!application.formData?.sourcePersonId && application.formData.personCount != null && application.formData.estimatedTotalHours != null))
}
export function collaborationPrefill(application: any): CollaborationPrefill {
  // Reapplication is a new request. Never copy IDs, approval state or assignment results.
  const form = application.formData || {}
  if (collaborationType(application) === 'EXTERNAL' && form.sourcePersonId && form.personCount != null && form.estimatedTotalHours != null) return {personType:'EXTERNAL',targetId:form.sourcePersonId,targetName:form.unitName || form.sourcePersonName || '原外协单位',personCount:form.personCount,estimatedTotalHours:form.estimatedTotalHours,reason:form.reason || application.reason || ''}
  if (collaborationType(application) !== 'INTERNAL' || !Array.isArray(form.departments)) throw new Error('此历史申请格式暂不支持修改重提，请重新邀请协助')
  return { personType: 'INTERNAL', departments: form.departments.map((d: any) => ({departmentId: d.departmentId, reason: d.reason || ''})),
    departmentNames: Object.fromEntries(form.departments.map((d: any) => [d.departmentId, d.departmentName || '原受邀部门'])) }
}
export function canExitInternalMember(member: any, detail: Record<string, any>, actorId: string): boolean {
  return isCollaborationOwner(detail, actorId) && member?.personType === 'INTERNAL' && member.memberStatus === 'ACTIVE'
    && !!member.id && !!member.userId && member.userId !== detail.order.responsibleUserId && member.canExit !== false
}
export function collaborationManagementPayload(detail: Record<string, any>, actorId: string, input: CollaborationManagementAction) {
  const reason = String(input.reason || '').trim()
  if (!reason || reason.length > 10000) throw new Error('请填写原因，最多 10000 字')
  if (input.kind === 'memberExit') {
    const member = (detail.members || []).find((m: any) => m.id === input.targetId)
    if (!canExitInternalMember(member, detail, actorId)) throw new Error('该成员已退出或当前无权移除，请刷新详情')
    return {orderId: detail.order.id, memberId: member.id, reason}
  }
  const application = collaborationApplications(detail).find(a => a.id === input.targetId)
  if (input.kind !== 'withdraw' || !canWithdrawCollaboration(application, detail, actorId)) throw new Error('该申请已不可撤回，请刷新详情')
  return {applicationId: application.id, reason}
}

/** External history is grouped by directory company ID, never by a possibly duplicated name. */
export function collaborationMemberGroups(detail: Record<string, any>): {key: string; external: boolean; name: string; members: any[]}[] {
  const groups = new Map<string, {key: string; external: boolean; name: string; members: any[]}>()
  for (const member of detail.members || []) {
    const external = member.personType === 'EXTERNAL'
    const key = external ? `external:${member.sourcePersonId || member.id}` : `internal:${member.id}`
    const group = groups.get(key) || {key, external, name: member.personNameSnapshot || member.userNameSnapshot || member.sourcePersonName || (external ? '外协单位名称未返回' : '成员名称未返回'), members: []}
    group.members.push(member); groups.set(key, group)
  }
  return [...groups.values()]
}

// Approval and department assignment use separate business APIs.
export function validateCollaborationDraft(draft: CollaborationDraft): string {
  if (!['INTERNAL', 'EXTERNAL'].includes(draft.personType)) return '请选择协助类型'
  if (draft.personType === 'INTERNAL') {
    if (!draft.departments?.length || draft.departments.length > 20) return '请选择1至20个部门'
    const ids = draft.departments.map(d => d.departmentId)
    if (ids.some(id => !id) || new Set(ids).size !== ids.length) return '请勿重复选择部门'
    const index = draft.departments.findIndex(d => !d.reason.trim() || d.reason.trim().length > 10000)
    if (index >= 0) return `请填写第 ${index + 1} 个部门的协助原因（最多 10000 字）`
  }
  if (draft.personType === 'EXTERNAL') {
    if (!draft.targetId) return '请选择一家外协单位'
    if (!draft.reason?.trim() || draft.reason.trim().length > 1000) return '请填写协助原因（最多 1000 字）'
    if (!Number.isSafeInteger(draft.personCount) || draft.personCount! < 1 || draft.personCount! > 10000) return '外协人数须为 1 至 10000 的整数'
    if (!Number.isFinite(draft.estimatedTotalHours) || draft.estimatedTotalHours! <= 0 || draft.estimatedTotalHours! > 999999.99 || !/^\d+(\.\d{1,2})?$/.test(String(draft.estimatedTotalHours))) return '预计总工时须大于 0、不超过 999999.99，最多两位小数'
  }
  return ''
}



export async function collaborationDepartments(): Promise<{value:string;label:string}[]> {
  const response: any = await http.get('/repair/options', {type:'collaborationDepartments'})
  if (response?.success !== true || response.code !== 200 || !Array.isArray(response.result)) throw new Error(response?.message || '部门列表加载失败')
  return response.result
}
export function collaborationPayload(orderId:string, draft:CollaborationDraft) {
  const error = validateCollaborationDraft(draft)
  if (error) throw new Error(error)
  if (!orderId) throw new Error('缺少维修单ID')
  if (draft.personType === 'EXTERNAL') return {orderId,personType:'EXTERNAL',sourcePersonId:draft.targetId,personCount:draft.personCount,estimatedTotalHours:draft.estimatedTotalHours,reason:draft.reason!.trim()}
  return {orderId,personType:'INTERNAL',departments:draft.departments!.map(d=>({departmentId:d.departmentId,reason:d.reason.trim()}))}
}
export interface AssignmentOptions {departmentId:string;departmentName:string;reason:string;members:{value:string;label:string}[]}
export interface AssignmentInput {applicationId:string;departmentId:string;requestId:string;assignedUserIds:string[]}
export function internalApplications(detail:Record<string,any>) {
  return (detail.applications || []).filter((a:any)=>a.applicationType==='COLLABORATION' && Array.isArray(a.formData?.departments))
}
export function canOfferAssignment(application:any, department:any, actorId:string, order:any):boolean {
  return application.formData?.assignmentMode !== 'WITH_APPROVAL' && !!actorId && !['DRAFT','RETURNED','REJECTED','WITHDRAWN','CANCELLED','CANCELED','CLOSED','TERMINATED'].includes(application.applicationStatus) && !['COMPLETED','CLOSED'].includes(order?.workStatus)
    && department.assignmentStatus==='PENDING_ASSIGNMENT' && Array.isArray(department.approverIds) && department.approverIds.includes(actorId)
}
/** Server department assignment state is authoritative even while other departments are pending. */
export function availableAssignments(detail:Record<string,any>,actorId:string,applicationId:string) {
  return internalApplications(detail).filter((a:any)=>a.id===applicationId).flatMap((application:any)=>
    application.formData.departments.filter((department:any)=>canOfferAssignment(application,department,actorId,detail.order))
      .map((department:any)=>({applicationId:application.id,departmentId:department.departmentId})))
}
export function repairReviewTasks(detail:Record<string,any>) {
  return (detail.workflows || []).flatMap((workflow:any)=> {
    const application=(detail.applications || []).find((a:any)=>a.id===workflow.businessId)
    return application ? (workflow.tasks || []).filter((task:any)=>task.canHandle===true).map((task:any)=>({task,workflow,application})) : []
  })
}
/** Completion comes from the application result, never an empty permission-filtered task list. */
export function collaborationApprovalProgress(application:any, detail:Record<string,any>):string {
  const status = String(application.applicationStatus || '').toUpperCase()
  if (status === 'APPROVED') return '已完成'
  if (['RETURNED','REJECTED','WITHDRAWN','CANCELLED','CANCELED','TERMINATED','CLOSED'].includes(status)) return collaborationStatusText(status)
  const tasks = (detail.workflows || []).filter((w:any)=>w.businessId===application.id).flatMap((w:any)=>w.tasks || [])
    .filter((t:any)=>!t.status && !t.taskStatus || ['PENDING','RUNNING','ACTIVE','TODO'].includes(String(t.status || t.taskStatus).toUpperCase()))
  const names = [...new Set(tasks.map((t:any)=>t.assigneeName || t.approverName || `${t.departmentName || t.name || '当前节点'}（审批人未返回）`))]
  return `当前审批节点：${names.length ? names.join('、') : '审批信息待返回'}`
}
export function collaborationStatusText(status:unknown):string {
  const labels:Record<string,string>={PENDING:'待审批',RUNNING:'审批中',APPROVED:'已通过',RETURNED:'已驳回',REJECTED:'已驳回',WITHDRAWN:'已撤回',CANCELLED:'已取消',CANCELED:'已取消',CLOSED:'已结束',NOT_READY:'审批通过后指定',PENDING_ASSIGNMENT:'待指定人员',PARTIALLY_ASSIGNED:'部分部门已指定',ASSIGNED:'已指定并入组',COMPLETED:'已完成',WAITING:'等待审批',SKIPPED:'已结束'}
  return labels[String(status)] || ({TERMINATED:'已终止',ACTIVE:'协助中',ENDED:'已结束',EXITED:'已移除',DRAFT:'草稿'} as Record<string,string>)[String(status)] || String(status || '—')
}

export interface RepairTodoTarget { orderId:string; view:'detail'|'approval'|'collaboration'|'assignment'; taskId?:string; instanceId?:string; applicationId?:string; departmentId?:string; initialDetail?:any }
/** Read-only routing context; never substitutes for permissions in the repair detail. */
export async function repairTodoTarget(item:Record<string,any>, params:Record<string,any>):Promise<RepairTodoTarget | undefined> {
  const text=(value:any)=>typeof value==='string'||typeof value==='number'?String(value).trim():''
  if ([item.actionKey,item.todoType].some(v=>text(v).toUpperCase()==='REPAIR_COLLABORATION_ASSIGN')) {
    const applicationId=text(params.applicationId), departmentId=text(params.departmentId)
    if(!applicationId || !departmentId)throw new Error('指定人员待办缺少申请或部门信息，请刷新核对')
    return {orderId:'',view:'assignment',applicationId,departmentId}
  }
  const workflow=[item.actionKey,item.todoType].some(v=>text(v).toUpperCase()==='WORKFLOW_APPROVAL')
  const repair=text(item.bizModule).toUpperCase()==='REPAIR' || params.businessType==='REPAIR_OPS_APPLICATION'
  if(!workflow && !repair)return
  const instanceId=text(params.instanceId) || (workflow?text(item.bizSubId):'')
  let orderId=repair?text(params.orderId):'',applicationId=text(params.applicationId)
  let initialDetail:any
  if(workflow){
    if(!instanceId)throw new Error('待办缺少审批实例编号')
    const response:any=await http.get('/workflow/instance/detail',{instanceId})
    if(response?.success!==true || response.code!==200)throw new Error(response?.message || '审批详情读取失败')
    if(text(response.result?.id)!==instanceId)throw new Error('待办审批实例不匹配')
    if(response.result?.businessType!=='REPAIR_OPS_APPLICATION')return
    initialDetail=response.result
    let snapshot=response.result.snapshot
    if(typeof snapshot==='string'){try{snapshot=JSON.parse(snapshot)}catch{throw new Error('审批快照格式无效，请刷新核对')}}
    const snapshotOrder=text(snapshot?.orderId)
    const instanceApplication=text(response.result.businessId) || text(snapshot?.applicationId)
    if(orderId && orderId!==snapshotOrder)throw new Error('待办维修单与审批实例不匹配')
    if(applicationId && instanceApplication && applicationId!==instanceApplication)throw new Error('待办申请与审批实例不匹配')
    orderId=snapshotOrder;applicationId=instanceApplication || applicationId
    if(!orderId)throw new Error('审批详情未返回维修单信息，请刷新核对')
  }
  if(!orderId){if(repair)throw new Error('维修待办缺少维修单信息，请刷新核对');return}
  const taskId=text(params.taskId),departmentId=text(params.departmentId)
  const view=workflow || taskId || (instanceId && !departmentId)?'approval':applicationId && departmentId?'collaboration':'detail'
  return {orderId,view,...(taskId?{taskId}:{}),...(instanceId?{instanceId}:{}),...(applicationId?{applicationId}:{}),...(departmentId?{departmentId}:{}),...(initialDetail?{initialDetail}:{})}
}
export function repairTodoUrl(target:RepairTodoTarget):string {
  const params={id:target.orderId,view:target.view,taskId:target.taskId,instanceId:target.instanceId,applicationId:target.applicationId,departmentId:target.departmentId}
  return '/pages/ops/repairDetail?'+Object.entries(params).filter(([,value])=>!!value).map(([key,value])=>`${key}=${encodeURIComponent(value!)}`).join('&')
}
export async function repairTodoOrder(item:Record<string,any>, params:Record<string,any>):Promise<string | undefined> {
  return (await repairTodoTarget(item,params))?.orderId
}

/** Only server-confirmed reuse is shown; this never changes task eligibility. */
export function isApprovalReused(record:Record<string,any>):boolean {
  return record?.automatic === true && record.approvalSource === 'FIRST_LEVEL_REUSE'
}
