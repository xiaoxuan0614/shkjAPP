import { http } from '@/utils/http'

// 仅用于 stock/apply/queryById：该接口 projectName 为主项目名，periodName 为分期名。
export const formatStockProjectName = (detail: any) =>
  [detail?.projectName, detail?.periodName].map(value => String(value || '').trim()).filter(Boolean).join('-') || '—'

export const unwrapRecords = (response: any): any[] => {
  const result = response?.result
  if (Array.isArray(result)) return result
  return Array.isArray(result?.records) ? result.records : []
}

export const normalizeProjectStatus = (status: unknown) => {
  const value = String(status || '').toUpperCase()
  const statusMap: Record<string, string> = {
    NOT_STARTED: 'notStart',
    PREPARING: 'preparing',
    PENDING_APPROVAL: 'preparing',
    IMPLEMENTING: 'implementing',
    DEBUGGING: 'implementing',
    DEBUG_COMPLETED: 'implementing',
    IMPLEMENT_COMPLETED: 'accepting',
    INTERNAL_ACCEPTING: 'accepting',
    ACCEPTING: 'accepting',
    WARRANTY: 'warranty',
    COMPLETED: 'finished',
    CLOSED: 'closed',
  }
  return statusMap[value] || String(status || '')
}

export const formatProjectName = (item: any) =>
  [item?.projectName, item?.periodName].map(value => String(value ?? '').trim()).filter(Boolean).join('-') || '—'

export const normalizeProject = (item: any) => ({
  ...item,
  projectLabel: formatProjectName(item),
  id: item.periodId || item.id,
  periodId: item.periodId || item.id,
  projectId: item.projectId,
  periodNo: item.periodNo || '',
  projectNo: item.projectNo || item.periodNo || '',
  xmNo: item.projectNo || item.periodNo || '',
  name: item.periodName || item.projectName || '',
  projectName: item.projectName || item.periodName || '',
  customerName: item.customerName || '',
  personInCharge: item.projectManagerName || item.projectLiaisonUserName || item.managerName || '',
  startDate: item.startDate || item.planStartDate || item.implementationStartDate || '',
  endDate: item.endDate || item.planEndDate || item.implementationEndDate || '',
  rawStatus: String(item.status || '').toUpperCase(),
  status: normalizeProjectStatus(item.status),
})

export const normalizeMaterial = (item: any) => ({
  ...item,
  id: item.id || item.materialId,
  materialCode: item.materialCode || item.code || '',
  name: item.materialName || item.name || '',
  spec: item.model || item.specification || item.spec || '',
  unit: item.baseUnitName || item.unitName || item.unit || '',
  stock: Number(
    item.currentStockQty ??
      item.stockQty ??
      item.currentStock ??
      item.inventoryQty ??
      item.stock ??
      0,
  ),
  planQty: Number(item.planQty ?? item.applyQty ?? 0),
  outQty: Number(item.outQty ?? item.executedQty ?? 0),
})

export interface StockApplyExecuteItem {
  itemId: string
  executeQty?: number
  remark?: string
  dispositionType?: string
  dispositionRemark?: string
}

export interface StockApplyExecuteRequest {
  applyId: string
  itemIds?: string[]
  items?: StockApplyExecuteItem[]
}

export const projectApi = {
  list: (params: Record<string, any> = {}) =>
    http.get('/project/project/projectPeriodList', { pageNo: 1, pageSize: 1000, ...params }),
  detail: (periodId: string) => http.get('/project/project/projectPeriodDetail', { periodId }),
  search: (keyword: string) =>
    http.get('/project/period/searchByName', { keyword, pageNo: 1, pageSize: 20 }),
  participatedProjects: (params: { periodStatus?: string; onlyUnfinishedProcess?: boolean; username?: string; keyword?: string } = {}) =>
    http.get('/project/member/participatedProjects', params),
  contractDetail: (periodId: string) => http.get('/project/contract/queryById', { periodId }),
  confirmArrival: (periodId: string) =>
    http.post('/project/period/arrivalStatus', { periodId, arrivalStatus: 1 }),
  members: (periodId: string) =>
    http.get('/project/member/list', { periodId, pageNo: 1, pageSize: 1000 }),
  inviteMembers: (periodId: string, records: { userId: string; memberRole: string }[]) =>
    http.post('/project/member/addBatch', { periodId, records }),
  outsources: (periodId: string) =>
    http.get('/project/memberOutsource/list', { periodId, pageNo: 1, pageSize: 1000 }),
  processes: (periodId: string, params: { onlyUnfinishedProcess?: boolean } = {}) =>
    http.get('/project/process/detail', { periodId, ...params }),
  locations: (periodId: string) =>
    http.get('/project/location/list', { periodId, pageNo: 1, pageSize: 1000 }),
  implementLogs: (periodId: string) =>
    http.get('/project/implementLog/list', { periodId, pageNo: 1, pageSize: 1000 }),
  processStatus: (periodId: string, processId: string) =>
    http.get('/project/process/status', { periodId, processId }),
  unsignedImplementLogStatus: (periodId: string, processId: string) =>
    http.get('/project/implementLog/unsignedStatus', { periodId, processId }),
  materialPlans: (periodId: string, params: Record<string, any> = {}) =>
    http.get('/project/materialPlan/list', { periodId, pageNo: 1, pageSize: 1000, ...params }),
  materialAccounts: (periodId: string, params: Record<string, any> = {}) =>
    http.get('/project/materialAccount/page', { periodId, pageNo: 1, pageSize: 20, ...params }),
  signInImplementLog: (data: Record<string, any>) =>
    http.post('/project/implementLog/signIn', data),
  signOutDraft: (periodId: string, processId: string) =>
    http.get('/project/implementLog/signOutDraft', { periodId, processId }),
  saveSignOutDraft: (data: Record<string, any>) =>
    http.post('/project/implementLog/signOutDraft', data),
  signOutImplementLog: (data: Record<string, any>) =>
    http.post('/project/implementLog/signOut', data),
  backfillSignOutImplementLog: (data: Record<string, any>) =>
    http.post('/project/implementLog/backfillSignOut', data),
  addDelay: (data: Record<string, any>) => http.post('/project/delay/add', data),
}

export const stockApi = {
  materials: (params: Record<string, any> = {}) =>
    http.get('/stock/material/list', { pageNo: 1, pageSize: 1000, ...params }),
  materialDetail: (id: string) => http.get('/stock/material/queryById', { id }),
  addApply: (data: Record<string, any>) => http.post('/stock/apply/add', data),
  applies: (params: Record<string, any> = {}) =>
    http.get('/stock/apply/list', { pageNo: 1, pageSize: 1000, ...params }),
  applyDetail: (id: string) => http.get('/stock/apply/queryById', { id }),
  cancelApply: (id: string) => http({ url: '/stock/apply/cancel', method: 'POST', query: { id } }),
  inboundRecords: (applyId: string, pageNo = 1) =>
    http.get('/stock/ioRecord/list', { sourceType: 'apply', sourceId: applyId, ioType: 'IN', pageNo, pageSize: 20 }),
  applyApprovals: (applyId: string, pageNo = 1) =>
    http.get('/stock/apply/approvals', { applyId, pageNo, pageSize: 100 }),
  applyItems: (applyId: string) =>
    http.get('/stock/apply/items', { applyId, pageNo: 1, pageSize: 1000 }),
  execute: (data: StockApplyExecuteRequest) => http.post('/stock/apply/execute', data),
}

export const vehicleApi = {
  list: (params: Record<string, any> = {}) =>
    http.get('/vehicle/list', { pageNo: 1, pageSize: 1000, ...params }),
}
