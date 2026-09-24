import { http } from '@/utils/http'

export const planResult = (response: any) => response?.result ?? response

export interface PeriodApprovalRecord {
  id: string
  periodId: string
  roundNo: number
  approvalStatus: string
  submitUserId?: string
  submitUserName?: string
  submitTime?: string
  approvalUserName?: string
  approvalTime?: string
  approvalReason?: string
  withdrawUserName?: string
  withdrawTime?: string
  withdrawReason?: string
  submittedSnapshot?: string
}

export interface PeriodApprovalState {
  current?: PeriodApprovalRecord
  waiting: boolean
  legacy: boolean
}

const requireSuccess = <T>(response: any): T => {
  if (response?.success !== true || Number(response?.code) !== 200)
    throw new Error(response?.message || '计划审批请求失败，请刷新后重试')
  return response.result as T
}

export function resolvePeriodApproval(period: Record<string, any>, history: PeriodApprovalRecord[]): PeriodApprovalState {
  const currentId = String(period.currentApprovalId || '')
  const pending = history.filter(row => String(row.approvalStatus) === '2')
  const current = currentId
    ? history.find(row => String(row.id) === currentId)
    : pending.length === 1 ? pending[0] : undefined
  return {
    current,
    waiting: String(period.status) === 'PENDING_APPROVAL' &&
      String(period.approvalStatus) === '2' &&
      String(current?.approvalStatus) === '2',
    legacy: String(period.status) === 'PENDING_APPROVAL' && !currentId && history.length === 0,
  }
}

// 审批必须读取完整清单，不能把第一页误认为整个计划。
export async function planList(url: string, periodId: string) {
  const records: any[] = []
  const seen = new Set<string>()
  for (let pageNo = 1; pageNo <= 1000; pageNo++) {
    const result = planResult(await http.get(url, { periodId, pageNo, pageSize: 100 }))
    const rows = Array.isArray(result) ? result : result?.records
    if (!Array.isArray(rows)) throw new Error('计划清单响应格式异常')
    const fingerprint = JSON.stringify(rows)
    if (rows.length && seen.has(fingerprint)) throw new Error('计划分页重复，请刷新后重试')
    seen.add(fingerprint)
    records.push(...rows)
    if (Array.isArray(result) ||
      (result.total != null ? records.length >= Number(result.total) : rows.length < 100)) return records
    if (!rows.length) throw new Error('计划清单未完整返回')
  }
  throw new Error('计划清单过大，请在 PC 端核对')
}

export const planApprovalApi = {
  context: async (periodId: string) => {
    const result: any = planResult(await http.get('/project/project/projectPeriodDetail', { periodId }))
    if (!result || typeof result !== 'object') throw new Error('项目信息加载失败')
    return result
  },
  state: async (periodId: string) => {
    const page = requireSuccess<{ records: Record<string, any>[]; total: number }>(
      await http.get('/project/period/list', { id: periodId, pageNo: 1, pageSize: 2 }),
    )
    if (!Array.isArray(page?.records) || page.records.length !== 1 ||
      String(page.records[0].id) !== periodId || Number(page.total) !== 1)
      throw new Error('分期审批状态不匹配，请刷新后重试')
    return page.records[0]
  },
  history: async (periodId: string) => {
    const rows = requireSuccess<PeriodApprovalRecord[]>(
      await http.get('/project/period/approval/history', { periodId }),
    )
    if (!Array.isArray(rows) || rows.some(row => !row?.id || String(row.periodId) !== periodId))
      throw new Error('审批历史数据不匹配，请刷新后重试')
    return rows
  },
  decide: async (periodId: string, approvalId: string, approve: boolean, reason: string) => {
    const response = await http.post('/project/period/approval/approve', {
      periodId,
      approvalId,
      approvalStatus: approve ? '1' : '0',
      ...(reason ? { approvalReason: reason } : {}),
    })
    const record = requireSuccess<PeriodApprovalRecord>(response)
    if (!record?.id || String(record.periodId) !== periodId || String(record.id) !== approvalId)
      throw new Error('审批返回轮次不匹配，请刷新确认结果')
    return record
  },
}
