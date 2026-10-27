/** Server permission is required; local lifecycle checks never grant missing permissions. */
export function quotationLockReason(detail: Record<string, any>): string {
  const order = detail.order || {}
  if (order.quotationStatus === 'CONFIRMED' || (detail.quotations || []).some((q:any) => q.stage === 'CONFIRMED' || q.customerConfirmedAmount != null)) return '客户已确认报价，报价信息不可再修改。'
  const noQuotation = order.quotationRequired === false || order.quotationStatus === 'NOT_REQUIRED'
  const completionSubmitted = (detail.completions || []).length > 0 || (detail.applications || []).some((a:any) => a.applicationType === 'COMPLETION' && a.applicationStatus && a.applicationStatus !== 'DRAFT')
  if (noQuotation && completionSubmitted) return '已提交完工，报价信息不可再修改。'
  if (['COMPLETED','CLOSED'].includes(order.workStatus)) return '维修单已结束，报价信息不可再修改。'
  return ''
}
export function canChangeRepairQuotation(detail: Record<string, any>): boolean {
  return detail.canChangeQuotationDecision === true && !quotationLockReason(detail)
}
