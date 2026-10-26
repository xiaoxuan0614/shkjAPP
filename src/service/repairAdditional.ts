import dayjs from 'dayjs'

export const repairActionTitles = {
  withdraw:'撤回申请',memberExit:'移出协作成员',clockCorrection:'申请补卡',missingClock:'登记缺卡作业',evaluation:'回访评价',
} as const
export type RepairAdditionalKind = keyof typeof repairActionTitles
type Detail = Record<string,any>
export function additionalCandidates(detail:Detail, actorId:string) {
  return {
    // Collaboration withdrawal/removal is managed in the dedicated collaboration section.
    applications:(detail.applications || []).filter((r:any) => r.applicationType !== 'COLLABORATION' && r.applicantUserId === actorId && r.applicationStatus === 'PENDING'),
    members:(detail.members || []).filter((r:any) => r.personType === 'INTERNAL' && r.memberStatus === 'ACTIVE' && r.userId && r.userId !== detail.order?.responsibleUserId && r.canExit !== false),
    records:(detail.workRecords || []).filter((r:any) => r.operatorUserId === actorId),
  }
}
export function canAdditional(kind:RepairAdditionalKind, detail:Detail, actorId:string) {
  const a=detail.actions || {}, c=additionalCandidates(detail,actorId)
  const live=!['DRAFT','COMPLETED','CLOSED'].includes(detail.order?.workStatus)
  switch(kind) {
    case 'evaluation': return a.canEvaluate === true
    case 'withdraw': return c.applications.length > 0
    case 'memberExit': return live && !!actorId && detail.order?.responsibleUserId === actorId && c.members.length > 0
    // Retain historical types, but do not expose these retired mobile actions.
    case 'clockCorrection': return false
    case 'missingClock': return false
    default: return false
  }
}
export function additionalPayload(kind:RepairAdditionalKind, detail:Detail, actorId:string, form:Detail, fileIds:string[]=[]) {
  if (!canAdditional(kind,detail,actorId)) throw new Error('当前无此操作权限或无可办理记录，请刷新详情')
  const c=additionalCandidates(detail,actorId), orderId=detail.order.id
  const required=(value:any,label:string,max=10000) => { const v=String(value ?? '').trim(); if(!v || v.length>max) throw new Error(`请填写${label}（最多 ${max} 字符）`); return v }
  const target=(rows:any[],value:any,key='id') => { if(!rows.some(r=>r[key]===value)) throw new Error('所选记录已失效或不属于当前可办理范围'); return value }
  if(kind==='evaluation') {
    const scores=Object.fromEntries(['serviceAttitudeScore','repairQualityScore','responseEfficiencyScore'].map(k=>{ const n=Number(form[k]); if(!Number.isInteger(n)||n<1||n>5) throw new Error('请为三项评价分别选择 1 至 5 分'); return [k,n] }))
    if(String(form.opinion||'').length>10000) throw new Error('评价意见最多 10000 字符')
    return {orderId,...scores,opinion:String(form.opinion||'').trim()}
  }
  const reason=required(form.reason,'原因')
  switch(kind) {
    case 'withdraw': return {applicationId:target(c.applications,form.targetId),reason}
    case 'memberExit': return {orderId,memberId:target(c.members,form.targetId),reason}
    case 'clockCorrection': {
      const start=Number(form.startedAt),end=Number(form.endedAt)
      if(!Number.isFinite(start)||!Number.isFinite(end)||start<=0||end<start||end>Date.now()) throw new Error('补卡时间须有效，结束不得早于开始或晚于当前时间')
      return {orderId,recordId:target(c.records,form.targetId),effectiveStartedAt:dayjs(start).format('YYYY-MM-DD HH:mm:ss'),effectiveEndedAt:dayjs(end).format('YYYY-MM-DD HH:mm:ss'),reason,fileIds}
    }
    case 'missingClock':
      if(!['INITIAL_INSPECTION','REPAIR','REWORK'].includes(form.activityKind)||!['ONLINE','OFFLINE','INSPECTION'].includes(form.repairMethod)||!['REPAIRED','NEEDS_REWORK'].includes(form.repairResult)) throw new Error('请选择作业阶段、维修方式及本次结果')
      if(form.repairResult==='REPAIRED'&&!fileIds.length) throw new Error('已修复时至少上传一张照片或一段视频')
      return {orderId,activityKind:form.activityKind,repairMethod:form.repairMethod,faultLocation:required(form.faultLocation,'故障位置',500),faultDescription:required(form.faultDescription,'故障描述'),repairDescription:required(form.repairDescription,'维修内容'),repairResult:form.repairResult,reason,afterFileIds:fileIds}
  }
}
