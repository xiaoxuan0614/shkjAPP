import type { AssignmentInput, AssignmentOptions } from './repairCollaboration'
import { http } from '@/utils/http'
import { useUserStore } from '@/store/user'
import { isH5 } from '@/utils/platform'
import { getEnvBaseUrl } from '@/utils/index'

/** Current repair contract: a report is created and submitted in one request. */
export interface RepairReportInput {
  customerId: string
  periodId: string
  productNames: string[]
  faultDescription: string
  reportTime: string
  reporterName: string
  reportRemark?: string
  fileIds?: string[]
}

export function repairReportPayload(input: RepairReportInput) {
  const customerId = input.customerId.trim()
  const periodId = input.periodId.trim()
  const faultDescription = input.faultDescription.trim()
  const reporterName = input.reporterName.trim()
  const names = input.productNames.map(name => name.trim())
  if (!customerId || !periodId) throw new Error('请选择客户和项目')
  if (!names.length || names.some(name => !name || name.includes(',')) || new Set(names).size !== names.length)
    throw new Error('请选择有效且不重复的项目产品')
  if (!faultDescription) throw new Error('请填写故障现象')
  if (!reporterName) throw new Error('请填写报修人姓名')
  if (names.some(name => name.length > 500) || faultDescription.length > 10000 || reporterName.length > 100 || (input.reportRemark?.length || 0) > 10000)
    throw new Error('填写内容超过接口允许长度')
  if ((input.fileIds?.length || 0) > 8 || input.fileIds?.some(id => !id?.trim()))
    throw new Error('附件信息无效，最多支持 8 个附件')
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(input.reportTime))
    throw new Error('请选择完整的报修日期和时间')
  const date = new Date(input.reportTime.replace(' ', 'T') + '+08:00')
  if (!Number.isFinite(date.getTime()) || new Date(date.getTime() + 8 * 3600000).toISOString().slice(0,19).replace('T',' ') !== input.reportTime)
    throw new Error('报修日期和时间无效')
  return {
    customerId, periodId, productNames: names.join(','), faultDescription,
    reportTime: input.reportTime, reporterName,
    ...(input.reportRemark?.trim() ? { reportRemark: input.reportRemark.trim() } : {}),
    ...(input.fileIds?.length ? { fileIds: [...new Set(input.fileIds)] } : {}),
  }
}

function result<T>(response: any): T {
  if (response?.success === false || (response?.code != null && ![0, 200].includes(Number(response.code))))
    throw Object.assign(new Error(response.message || '请求失败'), { code: response.code, success: false })
  if (response?.result == null) throw new Error('接口未返回有效数据，请刷新后重试')
  return response.result as T
}

export type RepairScope = 'ALL' | 'REPORTED' | 'RESPONSIBLE' | 'HELPING' | 'HISTORY'

async function mutate(path: string, payload: Record<string, unknown>) {
  try { return result<any>(await http.post(path,payload)) }
  catch (error: any) {
    // A transport failure is not evidence that a non-idempotent write failed.
    if (error?.success !== false) throw Object.assign(new Error(error?.message || error?.errMsg || '请求结果不确定'), {uncertain:true})
    throw error
  }
}

export const repairOrderApi = {
  async reportEdit(orderId: string, input: RepairReportInput, reason: string) {
    if (!orderId || !reason.trim() || reason.trim().length > 1000) throw new Error('请填写修改原因，最多 1000 字符')
    return mutate('/repair/order/reportEdit',{...repairReportPayload(input),fileIds:input.fileIds || [],orderId,reason:reason.trim()})
  },
  async reportCancel(orderId: string, reason: string) {
    if (!orderId || !reason.trim() || reason.trim().length > 1000) throw new Error('请填写取消原因，最多 1000 字符')
    return mutate('/repair/order/reportCancel',{orderId,reason:reason.trim()})
  },
  async withdraw(payload: Record<string, unknown>) { return mutate('/repair/application/withdraw',payload) },
  async memberExit(payload: Record<string, unknown>) { return mutate('/repair/member/exit',payload) },
  async clockCorrection(payload: Record<string, unknown>) { return mutate('/repair/clockCorrection/submit',payload) },
  async missingClock(payload: Record<string, unknown>) { return mutate('/repair/work/missingClock',payload) },
  async evaluation(payload: Record<string, unknown>) { return mutate('/repair/evaluation/submit',payload) },
  async materialApply(payload: Record<string, unknown>) { return mutate('/stock/apply/add', payload) },
  async materialAccounts(orderId: string, handlerUserId: string, pageNo = 1, pageSize = 10, keyword = '') {
    if (!orderId || !handlerUserId) throw new Error('缺少维修单或领料人信息')
    return result<any>(await http.get('/repair/materialAccount/page', { orderId, handlerUserId, pageNo, pageSize, ...(keyword ? { keyword } : {}) }))
  },
  async materialStatistics(orderId: string, pageNo = 1, pageSize = 5) {
    if (!orderId) throw new Error('缺少维修单信息')
    return result<any>(await http.get('/repair/materialAccount/page', {orderId,pageNo,pageSize}))
  },
  async options(type: 'vehicles' | 'internal' | 'external' | 'roles' | 'collaborationMembers', sourcePersonId?: string) {
    return result<{value: string; label: string; departmentId?: string; departmentName?: string}[]>(await http.get('/repair/options', { type, ...(sourcePersonId ? { sourcePersonId } : {}) }))
  },
  async begin(payload: Record<string, unknown>) { return mutate('/repair/work/begin', payload) },
  async workDetail(orderId: string, recordId?: string) { return result<any>(await http.get('/repair/work/detail', {orderId, ...(recordId ? {recordId} : {})})) },
  async personOptions(orderId: string) { return result<any[]>(await http.get('/repair/work/personOptions', {orderId})) },
  async saveDraft(payload: Record<string, unknown>) { return mutate('/repair/work/saveDraft', payload) },
  async submitWork(payload: Record<string, unknown>) { return mutate('/repair/work/submit', payload) },
  async updateWork(payload: Record<string, unknown>) { return mutate('/repair/work/update', payload) },
  // The guide explicitly guarantees idempotency for end; allow a retry after transport failure.
  async end(payload: Record<string, unknown>) { return result<any>(await http.post('/repair/work/end', payload)) },
  async quotation(payload: Record<string, unknown>) { return mutate('/repair/quotation/decision', payload) },
  async customerPrice(payload: Record<string, unknown>) { return mutate('/repair/quotation/customerPrice', payload) },
  async completion(payload: Record<string, unknown>) { return mutate('/repair/completion/submit', payload) },
  async transfer(payload: Record<string, unknown>) { return mutate('/repair/transfer/submit', payload) },
  async close(payload: Record<string, unknown>) { return mutate('/repair/close/submit', payload) },
  async assignmentOptions(applicationId:string,departmentId:string):Promise<AssignmentOptions> {
    const response:any = await http.get('/repair/collaboration/assignmentOptions',{applicationId,departmentId})
    if(response?.success !== true || response.code !== 200) throw Object.assign(new Error(response?.message || '当前不可指定人员'),{success:false})
    const data=response.result
    if(data?.departmentId !== departmentId || !Array.isArray(data.members)) throw new Error('人员候选响应不完整')
    return data
  },
  async assignCollaboration(payload:AssignmentInput) {
    const response:any = await http.post('/repair/collaboration/assign',payload)
    if(response?.success === false || (response?.code != null && response.code !== 200)) throw Object.assign(new Error(response?.message || '指定人员失败'),{success:false})
    if(response?.success !== true || response.code !== 200) throw new Error('指派响应不完整，请重试同一请求核对结果')
    return response.result
  },
  async collaboration(payload: Record<string, unknown>) { return mutate('/repair/collaboration/submit', payload) },
  async approvalCandidates(applicationId:string,taskId:string) { return result<any>(await http.get('/repair/collaboration/assignmentOptions',{applicationId,taskId})) },
  async review(payload: Record<string, unknown>) { return mutate('/repair/application/review', payload) },
  async reportOptions(query: { keyword?: string; customerId?: string; periodId?: string } = {}) {
    return result<{ customers: Record<string, any>[]; projects: Record<string, any>[]; products: Record<string, any>[] }>(
      await http.get('/repair/order/reportOptions', query),
    )
  },
  async list(query: { scope: RepairScope; pageNo: number; pageSize: number; periodId?: string; workStatus?: string }) {
    return result<{ records: Record<string, any>[]; total: number; pageNo: number; pageSize: number }>(
      await http.get('/repair/order/list', query),
    )
  },
  async detail(id: string) {
    return result<Record<string, any>>(await http.get('/repair/order/detail', { id }))
  },
  async logs(id: string, pageNo = 1, pageSize = 20) {
    return result<Record<string, any>>(await http.get('/repair/order/logs', { id, pageNo, pageSize }))
  },
  async submit(input: RepairReportInput) {
    // Deliberately no retry: each successful POST creates a distinct repair order.
    return result<Record<string, any>>(await http.post('/repair/order/submit', repairReportPayload(input)))
  },
}

export function uploadRepairAttachment(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const path = '/sys/common/upload'
    const url = isH5 && import.meta.env.MODE === 'development' && JSON.parse(import.meta.env.VITE_APP_PROXY)
      ? import.meta.env.VITE_APP_PROXY_PREFIX.replace(/\/$/, '') + path
      : getEnvBaseUrl().replace(/\/$/, '') + path
    uni.uploadFile({
      url,
      filePath, name: 'file',
      formData: { biz: 'repair' },
      timeout: 180000,
      header: { 'X-Access-Token': useUserStore().userInfo.token },
      success(response) {
        try {
          if (response.statusCode < 200 || response.statusCode >= 300) throw new Error('附件上传失败')
          const file = JSON.parse(response.data)
          if (file.success === false || (file.code != null && ![0, 200].includes(Number(file.code)))) throw new Error(file.message || '附件上传失败')
          const relativePath = typeof file.message === 'string' ? file.message.trim() : ''
          // New uploads are local relative paths; saved snapshot IDs remain unchanged during edits.
          if (!relativePath || !relativePath.includes('/') || /^(?:[a-z][a-z\d+.-]*:|\/)/i.test(relativePath) || relativePath.includes('..') || relativePath.includes('\\')) throw new Error('附件未返回有效的相对路径，请重新上传')
          resolve(relativePath)
        } catch (error) { reject(error) }
      },
      fail: reject,
    })
  })
}

export function downloadRepairAttachment(id: string): Promise<string> {
  const path = `/repair/order/attachment/download?id=${encodeURIComponent(id)}`
  const url = isH5 && import.meta.env.MODE === 'development' && JSON.parse(import.meta.env.VITE_APP_PROXY)
    ? import.meta.env.VITE_APP_PROXY_PREFIX.replace(/\/$/, '') + path
    : getEnvBaseUrl().replace(/\/$/, '') + path
  return new Promise((resolve, reject) => uni.downloadFile({
    url, header: { 'X-Access-Token': useUserStore().userInfo.token },
    success: response => response.statusCode === 200 && response.tempFilePath ? resolve(response.tempFilePath) : reject(new Error('附件不存在或无权查看')),
    fail: reject,
  }))
}

const stateLabels: Record<string, string> = {
  DRAFT: '草稿', PENDING: '待处理', PROCESSING: '进行中', COMPLETED: '已完成', CLOSED: '已关闭',
}

/** Translate server fields into the incumbent card view, without deriving permissions. */
export function repairCaseView(data: Record<string, any>) {
  const order = data.order || data
  if (!order.id) throw new Error('维修记录缺少工单ID')
  const quotation = (data.quotations || []).find((q: any) => q.id === order.latestQuotationId)
  const logs = (data.workRecords || []).map((r: any) => ({
    id: r.id, actorId: r.operatorUserId,
    startedAt: Date.parse(r.effectiveStartedAt || r.rawStartedAt),
    endedAt: r.recordStatus === 'ACTIVE' ? undefined : Date.parse(r.effectiveEndedAt || r.rawEndedAt),
    mode: ({ ONLINE: '线上', OFFLINE: '线下', INSPECTION: '检修' } as any)[r.repairMethod] || '',
    position: r.faultLocation || '', fault: r.faultDescription || '',
    needsQuote: '', description: r.repairDescription || '',
    result: ({ REPAIRED: '维修完成', NEEDS_REWORK: '需要复修' } as any)[r.repairResult] || '',
    reason: r.reworkReason || '', photos: [], videos: [],
    vehicle: r.vehiclePlateSnapshot || r.vehicleValue || '', people: r.operatorNameSnapshot || '',
  }))
  return {
    id: order.id, orderId: order.orderNo || order.id,
    customer: order.customerNameSnapshot || '', projectId: order.periodId,
    project: order.projectName || [order.projectNameSnapshot, order.periodNameSnapshot].filter(Boolean).join('-'),
    product: order.productNames || (data.products || []).map((p: any) => p.productNameSnapshot).filter(Boolean).join('、'),
    warranty: order.warrantyTypeSnapshot || order.warrantyType || '—',
    fault: order.faultDescription || '', reportedAt: order.reportTimeDisplay || order.reportTime || order.reportDate || '',
    createdAt: Date.parse(order.submittedAt || order.createTime) || 0,
    applicantId: order.reporterUserId || '', applicant: order.reporterNameDisplay || order.reporterName || '—',
    remark: order.reportRemark || '', photos: [] as string[], videos: [] as string[],
    ownerId: order.responsibleUserId || '', owner: order.responsibleUserName || '—',
    previousOwners: [] as string[], assistants: [] as string[],
    state: stateLabels[order.workStatus] || order.workStatus || '—',
    logs, quotationStatus: order.quotationStatus == null ? '' : String(order.quotationStatus),
    quoteItems: (data.quotationItems || []).filter((i: any) => i.quotationId === order.latestQuotationId).map((i: any) => ({ name: i.itemName, qty: Number(i.quantity), price: Number(i.unitPrice) })),
    confirmedPrice: quotation?.customerConfirmedAmount == null ? undefined : Number(quotation.customerConfirmedAmount),
    finalPrice: order.finalAmount == null ? undefined : Number(order.finalAmount),
    quoteReason: '', completion: '未提交', completionReason: '', materialOpen: false, events: [] as string[],
    raw: data, actions: data.actions || {},
  }
}
