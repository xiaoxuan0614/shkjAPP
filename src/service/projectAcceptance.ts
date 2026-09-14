import { http } from '@/utils/http'
import { projectApi, unwrapRecords } from '@/service/shkj'
export type AcceptanceType = 'INTERNAL' | 'CUSTOMER'
export const acceptanceApi = {
  list: (periodId: string, acceptType: AcceptanceType, pageNo: number) => http.get('/project/acceptance/list', { periodId, acceptType, pageNo, pageSize: 100 }),
  complete: (data: Record<string, any>) => http.post('/project/acceptance/complete', data),
  recheck: (periodId: string, sourceAcceptanceId: string, reason: string) => http.post('/project/acceptance/submit', { periodId, sourceAcceptanceId, reason }),
}
export async function readAcceptanceRecords(periodId: string, type: AcceptanceType) {
  const all: any[] = []
  for (let pageNo = 1; ; pageNo++) {
    const response: any = await acceptanceApi.list(periodId, type, pageNo)
    if (!Array.isArray(response?.result) && !Array.isArray(response?.result?.records)) throw new Error('验收记录响应异常')
    const rows = unwrapRecords(response)
    all.push(...rows.filter(row => row.id && String(row.periodId) === periodId && String(row.acceptType).toUpperCase() === type))
    const total = response?.result?.total
    if (Array.isArray(response?.result) || !rows.length || (total != null ? pageNo * 100 >= Number(total) : rows.length < 100)) break
  }
  return all.sort((a, b) => String(b.createTime || '').localeCompare(String(a.createTime || '')))
}
export function currentAcceptance(rows: any[], reworkId: string) {
  const round = rows.filter(row => String(row.reworkId || '') === reworkId)
  const sources = new Set(round.map(row => String(row.sourceAcceptanceId || '')))
  return round.find(row => !sources.has(String(row.id)))
}
export async function readAcceptanceContext(periodId: string) {
  const response: any = await projectApi.detail(periodId)
  if (!response?.result) throw new Error('项目详情加载失败')
  return response.result
}
