/** Shared view models for live repair records. No fixture data or local workflow mutations. */
export type RepairRole = 'reporter' | 'technician' | 'supervisor' | 'director'
export type MainState = '待处理' | '进行中' | '已完成' | '已关闭'
export interface QuoteLine { name: string; qty: number; price: number }
export interface AssistUser { id: string; name: string }
export interface AssistanceRequest { users: AssistUser[]; reason: string; status: '待双主管审批' }
export interface RepairMaterial { id: string; name: string; spec: string; unit: string; stock: number; code?: string; brand?: string }
export interface MaterialLine { id: string; qty: number; reason: string; unitPrice?: number; material?: RepairMaterial }
export interface RepairMaterialRequest { type: '领料' | '还料'; lines: MaterialLine[]; remark: string; status: string }
export interface RepairLog {
  id: string; actorId: string; startedAt: number; endedAt?: number
  mode: '线上' | '线下' | '检修'; position: string; fault: string; needsQuote: '' | '是' | '否'
  description: string; result: '' | '维修完成' | '需要复修'; reason: string
  photos: string[]; videos: string[]; vehicle: string; people: string
}
export interface RepairCase {
  id: string; orderId: string; customer: string; projectId: string; project: string; product: string; warranty: string
  fault: string; reportedAt: string; createdAt: number; applicantId: string; applicant: string
  remark: string; photos: string[]; videos: string[]; ownerId: string; owner: string
  previousOwners: string[]; assistants: string[]; state: MainState; firstStartedAt?: number
  logs: RepairLog[]; quotationStatus: string
  quoteItems: QuoteLine[]; confirmedPrice?: number; finalPrice?: number; quoteReason: string
  completion: '未提交' | '待审批' | '已驳回' | '已通过'; completionReason: string
  pendingRequest?: { type: '转单' | '关闭'; reason: string; remark: string }
  materialOpen: boolean; events: string[]
  assistanceRequests?: AssistanceRequest[]
  materialRequests?: RepairMaterialRequest[]
}
export function isOwner(c: RepairCase, a: { id: string }) { return c.ownerId === a.id }
export function quoteTotal(items: QuoteLine[]) { return items.reduce((sum, i) => sum + Math.round(i.qty * i.price * 100), 0) / 100 }
export function waitText(c: RepairCase, now = Date.now()) {
  const minutes = Math.max(0, Math.floor(((c.firstStartedAt ?? now) - c.createdAt) / 60000))
  return minutes < 60 ? `${minutes} 分钟` : `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`
}
export interface ReportDraft { customerId: string; projectId: string; product: string; fault: string; reportedAt: string; remark: string; photos: string[]; videos: string[] }
