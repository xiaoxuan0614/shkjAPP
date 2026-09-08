import { http } from '@/utils/http'

export type TodoScope = 'ASSIGNED' | 'CLAIMABLE'

export interface TodoQuery {
  pageNo?: number
  pageSize?: number
  scope?: TodoScope
  todoType?: string
}

export interface TodoRecord {
  id?: string
  todoType?: string
  bizModule?: string
  bizId?: string
  bizSubId?: string
  projectName?: string
  periodName?: string
  title?: string
  summary?: string
  scope?: TodoScope
  todoStatus?: string
  priority?: number
  dueTime?: string
  actionKey?: string
  actionParams?: string | Record<string, any>
  createTime?: string
  [key: string]: any
}

export interface TodoPage {
  records: TodoRecord[]
  total: number
}

export interface ProjectInvitationRecord {
  id?: string
  periodId?: string
  userId?: string
  userName?: string
  memberRole?: string | number
  memberRole_dictText?: string
  inviteStatus?: string | number
  inviteTime?: string
  acceptTime?: string
  remark?: string
  projectManagerUserName?: string
  projectManagerName?: string
  [key: string]: any
}

export const todoApi = {
  page: (query: TodoQuery = {}) =>
    http.get('/sys/todo/page', { pageNo: 1, pageSize: 100, ...query }),
}

export const projectInvitationApi = {
  list: (query: { pageNo?: number; pageSize?: number } = {}) =>
    http.get('/project/member/myInvitations', { pageNo: 1, pageSize: 100, ...query }),
  respond: (memberId: string, inviteStatus: '0' | '1') =>
    http.post('/project/member/respond', { memberId, inviteStatus }),
}

export const unwrapTodoPage = (response: any): TodoPage => {
  const result = response?.result ?? response
  const records = Array.isArray(result)
    ? result
    : Array.isArray(result?.records)
      ? result.records
      : []
  const rawTotal = Array.isArray(result) ? result.length : result?.total
  const total = Number(rawTotal)

  return {
    records,
    total: Number.isFinite(total) ? total : records.length,
  }
}

export const parseTodoActionParams = (value: TodoRecord['actionParams']) => {
  if (value && typeof value === 'object') return value
  if (typeof value !== 'string' || !value.trim()) return {}

  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}
