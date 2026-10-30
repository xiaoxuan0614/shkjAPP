export type StockCancelMode = '' | 'withdraw' | 'cancel'

/** UI eligibility only; backend must validate authorization and execution atomically. */
export function stockCancelMode(head: any, user: any): StockCancelMode {
  if (!head?.id || !['IN','OUT'].includes(String(head.applyType).toUpperCase())) return ''
  const userId = user?.userid || user?.id || user?.userId
  // 姓名可能重复，缺少身份 ID 时不授予本人操作入口。
  const own = !!userId && !!head.applyUserId && String(head.applyUserId) === String(userId)
  const execution = String(head.executeStatus || '').toUpperCase()
  if (['CLOSED','EXECUTED','COMPLETED','DONE'].includes(execution)) return ''
  if (String(head.status) === '2') return own ? 'withdraw' : ''
  if (String(head.status) !== '1' || !own) return ''
  // 所有业务的领料单，仅本人且审批通过、待执行可取消。
  if (String(head.applyType).toUpperCase() === 'OUT' && execution === 'PENDING') return 'cancel'
  return ''
}
