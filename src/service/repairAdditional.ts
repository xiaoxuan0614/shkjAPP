import dayjs from 'dayjs'

export const repairActionTitles = {
  confirmUse:'确认用料',writeoff:'物料损耗核销',closeRemainder:'终止未出库余量',withdraw:'撤回申请',memberExit:'移出协作成员',contact:'修改联系资料',clockCorrection:'申请补卡',missingClock:'登记缺卡作业',evaluation:'回访评价',
} as const
export type RepairAdditionalKind = keyof typeof repairActionTitles
type Detail = Record<string,any>
export function additionalCandidates(detail:Detail, actorId:string) {
  const picks = (detail.materialLinks || []).filter((r:any) => r.linkType === 'PICK')
  return {
    picks:picks.filter((r:any) => r.handlerUserId === actorId),
    uses:(detail.materialUses || []).filter((r:any) => r.useStatus === 'PENDING_CONFIRM'),
    applications:(detail.applications || []).filter((r:any) => r.applicantUserId === actorId && r.applicationStatus === 'PENDING'),
    members:(detail.members || []).filter((r:any) => r.memberStatus === 'ACTIVE'),
    records:(detail.workRecords || []).filter((r:any) => r.operatorUserId === actorId),
    stockApplies:[...new Map(picks.filter((r:any) => r.handlerUserId === actorId && r.stockApplyId).map((r:any) => [r.stockApplyId,r])).values()] as any[],
  }
}
export function canAdditional(kind:RepairAdditionalKind, detail:Detail, actorId:string) {
  const a=detail.actions || {}, c=additionalCandidates(detail,actorId)
  const live=!['DRAFT','COMPLETED','CLOSED'].includes(detail.order?.workStatus)
  switch(kind) {
    case 'evaluation': return a.canEvaluate === true
    case 'contact': return a.canEditContact === true
    case 'withdraw': return c.applications.length > 0
    case 'memberExit': return live && a.canEditContact === true && c.members.length > 0
    case 'clockCorrection': return live && c.records.length > 0 && (a.canOwnerApply === true || (detail.members || []).some((m:any) => m.userId === actorId && m.memberStatus === 'ACTIVE'))
    case 'missingClock': return a.canStartWork === true
    case 'confirmUse': return a.canOwnerApply === true && c.uses.length > 0
    case 'writeoff': return live && c.picks.length > 0 && (a.canOwnerApply === true || (detail.members || []).some((m:any) => m.userId === actorId && m.memberStatus === 'ACTIVE'))
    case 'closeRemainder': return a.canOwnerApply === true && c.stockApplies.length > 0
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
  const reason=kind==='confirmUse' && form.confirm===true ? undefined : required(form.reason,'原因',kind==='contact'?1000:10000)
  switch(kind) {
    case 'contact': return {orderId,serviceAddress:required(form.serviceAddress,'服务地址',500),contactPerson:required(form.contactPerson,'联系人',100),contactPhone:required(form.contactPhone,'联系电话',50),reason}
    case 'withdraw': return {applicationId:target(c.applications,form.targetId),reason}
    case 'memberExit': return {orderId,memberId:target(c.members,form.targetId),reason}
    case 'confirmUse':
      if(typeof form.confirm!=='boolean') throw new Error('请选择确认使用或作废')
      return {orderId,useId:target(c.uses,form.targetId),confirm:form.confirm,...(form.confirm?{}:{reason})}
    case 'closeRemainder': return {orderId,stockApplyId:target(c.stockApplies,form.targetId,'stockApplyId'),reason}
    case 'clockCorrection': {
      const start=Number(form.startedAt),end=Number(form.endedAt)
      if(!Number.isFinite(start)||!Number.isFinite(end)||start<=0||end<start||end>Date.now()) throw new Error('补卡时间须有效，结束不得早于开始或晚于当前时间')
      return {orderId,recordId:target(c.records,form.targetId),effectiveStartedAt:dayjs(start).format('YYYY-MM-DD HH:mm:ss'),effectiveEndedAt:dayjs(end).format('YYYY-MM-DD HH:mm:ss'),reason,fileIds}
    }
    case 'writeoff': {
      if(!form.items?.length) throw new Error('请添加核销物料')
      const keys=new Set()
      const items=form.items.map((i:any)=>{
        const pickLinkId=target(c.picks,i.pickLinkId)
        if(!['DAMAGE','LOSS'].includes(i.writeoffType)) throw new Error('请选择损坏或遗失')
        const key=`${pickLinkId}:${i.writeoffType}`; if(keys.has(key)) throw new Error('同一领料明细和核销类型请合并填写'); keys.add(key)
        if(!/^\d+(\.\d{1,4})?$/.test(String(i.quantity))||Number(i.quantity)<=0||!Number.isFinite(Number(i.quantity))) throw new Error('核销数量必须大于 0，最多 4 位小数')
        return {pickLinkId,writeoffType:i.writeoffType,quantity:Number(i.quantity),reason:required(i.reason,'明细原因')}
      })
      return {orderId,reason,items,fileIds}
    }
    case 'missingClock':
      if(!['INITIAL_INSPECTION','REPAIR','REWORK'].includes(form.activityKind)||!['ONLINE','OFFLINE','INSPECTION'].includes(form.repairMethod)||!['REPAIRED','NEEDS_REWORK'].includes(form.repairResult)) throw new Error('请选择作业阶段、维修方式及本次结果')
      if(form.repairResult==='REPAIRED'&&!fileIds.length) throw new Error('已修复时至少上传一张照片或一段视频')
      return {orderId,activityKind:form.activityKind,repairMethod:form.repairMethod,faultLocation:required(form.faultLocation,'故障位置',500),faultDescription:required(form.faultDescription,'故障描述'),repairDescription:required(form.repairDescription,'维修内容'),repairResult:form.repairResult,reason,afterFileIds:fileIds}
  }
}
