import { http } from '@/utils/http'

export interface DelayApproval {
  id: string
  periodId?: string
  applyNo?: string
  applyUserName?: string
  applyTime?: string
  originalEndTime?: string
  expectedEndTime?: string
  delayDays?: number
  delayReason?: string
  remark?: string
  status?: string | number
  approvalUserName?: string
  approvalTime?: string
  approvalReason?: string
}

async function request<T>(url: string, method: 'GET' | 'POST', value: Record<string, unknown>) {
  const response = await http<T>({
    url, method, hideErrorToast: true,
    ...(method === 'GET' ? { query: value } : { data: value }),
  })
  if (response.success === false) throw new Error(response.message || '请求失败')
  return response.result as T
}

export const delayApprovalApi = {
  detail: (id: string) => request<DelayApproval>('/project/delay/queryById', 'GET', { id }),
  project: (periodId: string) => request<{ projectName?: string; periodName?: string }>('/project/project/projectPeriodDetail', 'GET', { periodId }),
  approve: (id: string) => request('/project/delay/approve', 'POST', { id }),
  reject: (id: string, approvalReason: string) => request('/project/delay/reject', 'POST', { id, approvalReason }),
}
