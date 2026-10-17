import { peopleOptions, type PreviewOrder, type RepairMode } from './previewData'
import dayjs from 'dayjs'

export type IntakeStage = '待受理' | '待勘查' | '待报价' | '待内部确认' | '待维修' | '已关闭'
export type IntakeView = 'create' | 'reports' | 'quotes'
export interface QuoteItem { name: string; qty: number; price: number }
export interface IntakeReport {
  id: string; customer: string; equipment: string; contact: string; phone: string; address: string; fault: string
  customerId: string; projectId: string; projectName: string; reportedAt: string; remark: string
  photos?: string[]; videos?: string[]
  applicant: string; applicantId: string; createdAt: string; stage: IntakeStage
  isFault?: boolean; needsQuote?: boolean; handling: string; surveyor: string; survey: string
  quoteId: string; items: QuoteItem[]; quoteReason: string; quoteConfirmed: boolean
  owner: string; ownerId?: string; dutyDate?: string; mode: RepairMode; orderId: string; events: string[]
}
// UI-only duty roster simulation; replace with server assignment when the formal API exists.
export function assignDemoDuty(report: IntakeReport) {
  const date = dayjs(report.reportedAt)
  const index = date.day() % peopleOptions.length
  report.owner = peopleOptions[index]
  report.ownerId = `DEMO-DUTY-${index + 1}`
  report.dutyDate = date.format('YYYY-MM-DD')
  report.events.push(`按 ${report.dutyDate} 示例值班表自动分配给 ${report.owner}`)
}
export function quoteTotal(items: QuoteItem[]) {
  return items.reduce((sum, item) => sum + Math.round(Number(item.qty) * Number(item.price) * 100), 0) / 100
}
export function assessReport(report: IntakeReport, isFault: boolean, needsQuote: boolean, reason: string) {
  if (report.stage !== '待受理') throw new Error('当前报修已受理')
  if (!reason.trim()) throw new Error('请填写受理说明')
  Object.assign(report, { isFault, needsQuote: isFault && needsQuote, handling: reason.trim(), stage: !isFault ? '已关闭' : needsQuote ? '待勘查' : '待维修' })
  report.events.push(`受理：${!isFault ? '非故障，关闭报修' : needsQuote ? '需要报价，先勘查现场' : '无需报价，进入维修'}；${reason.trim()}`)
}
export function finishSurvey(report: IntakeReport, surveyor: string, result: string) {
  if (report.stage !== '待勘查') throw new Error('当前报修不在勘查阶段')
  if (!surveyor || !result.trim()) throw new Error('请选择勘查人员并填写现场情况')
  Object.assign(report, { surveyor, survey: result.trim(), stage: '待报价' })
  report.events.push(`现场勘查完成：${surveyor}；${result.trim()}`)
}
export function submitQuote(report: IntakeReport, items: QuoteItem[]) {
  if (report.stage !== '待报价' || !report.survey) throw new Error('请先完成现场勘查')
  if (!items.length || items.some(i => !i.name.trim() || !Number.isFinite(Number(i.qty)) || Number(i.qty) <= 0 || !Number.isFinite(Number(i.price)) || Number(i.price) < 0) || !Number.isFinite(quoteTotal(items)) || quoteTotal(items) <= 0)
    throw new Error('请填写报价项目、有效数量和单价，合计须大于 0')
  report.items = items.map(i => ({ name: i.name.trim(), qty: Number(i.qty), price: Number(i.price) }))
  report.quoteId ||= report.id.replace('BX', 'BJ')
  report.quoteConfirmed = false
  report.stage = '待内部确认'
  report.events.push(`报价单 ${report.quoteId} 提交内部确认：¥${quoteTotal(items).toFixed(2)}`)
}
export function confirmQuote(report: IntakeReport, approved: boolean, reason: string) {
  if (report.stage !== '待内部确认') throw new Error('当前报价不在待确认状态')
  if (!approved && !reason.trim()) throw new Error('请填写退回原因')
  report.quoteConfirmed = approved
  report.quoteReason = reason.trim()
  report.stage = approved ? '待维修' : '待报价'
  report.events.push(approved ? '报价已内部确认，进入维修' : `报价退回修改：${reason.trim()}`)
}
export function createRepairOrder(report: IntakeReport): PreviewOrder {
  if (report.stage !== '待维修' || !report.isFault || (report.needsQuote && !report.quoteConfirmed) || report.orderId)
    throw new Error('当前报修尚不满足维修条件，或维修单已生成')
  if (!report.owner || !report.ownerId) throw new Error('尚未取得值班人员，请等待自动分配结果')
  const id = report.id.replace('BX', 'WX')
  report.orderId = id
  report.events.push(`自动生成维修单 ${id}，由值班运维 ${report.owner} 处理`)
  return {
    id, customer: report.customer, equipment: report.equipment, fault: report.fault,
    projectId: report.projectId, projectName: report.projectName,
    contact: report.contact, phone: report.phone, address: report.address, owner: report.owner, mode: report.mode,
    ownerId: report.ownerId, quoteStatus: report.needsQuote ? '内部已确认' : '无需报价',
    status: '未开始', nature: '待确认', appointment: '', returnState: '无需还料', logs: [],
    events: [`关联报修 ${report.id}`, ...(report.quoteId ? [`关联报价 ${report.quoteId}，内部已确认`] : ['无需报价']), `沿用报修单值班人员 ${report.owner}（演示）`],
  }
}
