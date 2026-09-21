import { http } from '@/utils/http'
import { unwrapRecords } from '@/service/shkj'


// 仅供页面身份展示；业务提交继续使用未缓存的 readProjectMembership 再校验。
let membershipOwner = '';
const membershipCache = new Map<string, { expires: number; value: Promise<{participant: boolean; manager: boolean}> }>();
export function readCachedProjectMembership(periodId: string, userId: string, sessionKey: string) {
  const owner = JSON.stringify([userId, sessionKey]);
  if (owner !== membershipOwner) { membershipCache.clear(); membershipOwner = owner; }
  if (!userId || !periodId || !sessionKey) return Promise.resolve({participant:false, manager:false});
  const cached = membershipCache.get(periodId);
  if (cached && cached.expires > Date.now()) return cached.value;
  const value = readProjectMembership(periodId, userId).catch(error => {
    if (membershipOwner === owner && membershipCache.get(periodId)?.value === value) membershipCache.delete(periodId);
    throw error;
  });
  membershipCache.set(periodId, {expires: Date.now() + 60_000, value});
  return value;
}

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
