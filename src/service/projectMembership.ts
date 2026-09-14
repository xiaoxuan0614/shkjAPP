import { http } from '@/utils/http'
import { unwrapRecords } from '@/service/shkj'

// 系统角色不等于当前分期角色；仅接受有效且已确认邀请的成员关系。
export async function readProjectMembership(periodId: string, userId: string) {
  const access = { participant: false, manager: false }
  if (!periodId || !userId) return access
  const pageSize = 100
  for (let pageNo = 1; ; pageNo++) {
    const response: any = await http.get('/project/member/list', { periodId, pageNo, pageSize })
    const rows = unwrapRecords(response)
    for (const row of rows) {
      if (String(row.userId || '') !== userId || (row.periodId && String(row.periodId) !== periodId) ||
        (row.delFlag != null && Number(row.delFlag) !== 0) || String(row.inviteStatus) !== '1') continue
      access.participant = true
      if (String(row.memberRole || '').split(',').map(role => role.trim()).includes('2')) access.manager = true
    }
    const total = response?.result?.total
    if (!rows.length || (total != null ? pageNo * pageSize >= Number(total) : rows.length < pageSize)) return access
  }
}
