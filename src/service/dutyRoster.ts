import { http } from '@/utils/http'

export interface DutyRosterPerson { userId: string; name: string; phone?: string | null; tel?: string | null }
export interface DutyRosterDay { date: string; weekday: string; dayUsers: DutyRosterPerson[]; nightUsers: DutyRosterPerson[]; restUsers: DutyRosterPerson[] }

export function readDutyRosterResponse(response: any): DutyRosterDay {
  if (response?.success === false || (response?.code != null && ![0, 200].includes(Number(response.code))))
    throw new Error(response.message || '值班信息加载失败')
  const day = response?.result
  if (!day || typeof day.date !== 'string' || !Array.isArray(day.dayUsers) || !Array.isArray(day.nightUsers) || !Array.isArray(day.restUsers))
    throw new Error('值班信息返回不完整，请重试')
  return day
}

/** Omit date entirely: the server defines today in Asia/Shanghai. */
export async function queryTodayDutyRoster(): Promise<DutyRosterDay> {
  return readDutyRosterResponse(await http.get('/operation/dutyRoster/queryByDate'))
}
