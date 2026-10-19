/** Isolated in-memory demo. Never send these IDs or mutations to business APIs. */
export type DemoRole = 'reporter' | 'technician' | 'supervisor' | 'director'
export interface DemoActor { id: string; name: string; role: DemoRole }
export const demoActors: DemoActor[] = [
  { id: 'DEMO-REPORTER', name: '普通报修人', role: 'reporter' },
  { id: 'DEMO-TECH-A', name: '运维甲', role: 'technician' },
  { id: 'DEMO-TECH-B', name: '运维乙', role: 'technician' },
  { id: 'DEMO-SUPERVISOR', name: '运维主管', role: 'supervisor' },
  { id: 'DEMO-DIRECTOR', name: '总经理', role: 'director' },
]
/** A demo default only: never grants a role to the signed-in account. */
export function defaultDemoActorIndex(canManage: boolean) { return canManage ? 3 : 1 }
export const demoCustomers = [
  { id: 'DEMO-C1', name: '滨海堆场（示例）', projects: [
    { id: 'DEMO-P1', name: '闸口设备维护', warranty: '质保', products: ['铅封机', '道闸'] },
    { id: 'DEMO-P2', name: '堆场系统维护', warranty: '维保', products: ['监控终端'] },
  ] },
  { id: 'DEMO-C2', name: '港区物流（示例）', projects: [
    { id: 'DEMO-P3', name: '车辆识别系统', warranty: '维保', products: ['车牌摄像头', '识别终端'] },
  ] },
  { id: 'DEMO-C3', name: '智慧园区（示例）', projects: [
    { id: 'DEMO-P4', name: '园区安防维护', warranty: '质保', products: ['视频摄像机', '门禁控制器'] },
    { id: 'DEMO-P5', name: '机房环境监控', warranty: '维保', products: ['温湿度传感器', '监控主机'] },
  ] },
]
export type MainState = '待处理' | '进行中' | '已完成' | '已关闭'
export type QuoteState = '未判断' | '待报价' | '无需报价' | '报价审批中' | '审批通过待客户确认' | '审批驳回' | '报价已确认'
export interface QuoteLine { name: string; qty: number; price: number }
export interface AssistUser { id: string; name: string }
export interface AssistanceRequest { users: AssistUser[]; reason: string; status: '待双主管审批' }
export const repairMaterials = [
  { id: 'DEMO-M1', name: '开关电源', spec: '通用 · 12V / 5A', unit: '件', stock: 20 },
  { id: 'DEMO-M2', name: '网络线', spec: '通用 · 六类', unit: '米', stock: 100 },
  { id: 'DEMO-M3', name: '接线端子', spec: '通用 · 2.5mm²', unit: '个', stock: 50 },
]
export interface RepairMaterial { id: string; name: string; spec: string; unit: string; stock: number; code?: string; brand?: string }
export interface MaterialLine { id: string; qty: number; reason: string; material?: RepairMaterial }
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
  logs: RepairLog[]; quoteState: QuoteState; quoteStep: '主管' | '总经理' | ''
  quoteItems: QuoteLine[]; confirmedPrice?: number; finalPrice?: number; quoteReason: string
  completion: '未提交' | '待审批' | '已驳回' | '已通过'; completionReason: string
  pendingRequest?: { type: '转单' | '关闭'; reason: string; remark: string }
  materialOpen: boolean; events: string[]
  assistanceRequests?: AssistanceRequest[]
  materialRequests?: RepairMaterialRequest[]
}
export function requestAssistance(c: RepairCase, a: DemoActor, users: AssistUser[], reason: string) {
  requireOwner(c, a); requireOpen(c)
  if (!users.length || !reason.trim()) throw new Error('请选择协助人员并填写申请原因')
  const ids = users.map(u => u.id)
  if (new Set(ids).size !== ids.length || users.some(u => !u.id || !u.name.trim() || u.id === c.ownerId || c.assistants.includes(u.id) || c.assistanceRequests?.some(r => r.users.some(p => p.id === u.id)))) throw new Error('所选人员重复、已加入或已有待审批申请，请重新选择')
  ;(c.assistanceRequests ??= []).push({ users: users.map(u => ({ ...u })), reason: reason.trim(), status: '待双主管审批' })
  c.events.push('提交协助申请，等待运维主管与所选人员角色主管审批（模拟）')
}
export function returnAvailable(c: RepairCase, id: string) {
  const balance = c.materialOpen && id === 'DEMO-M1' ? 1 : 0
  const pending = (c.materialRequests ?? []).filter(r => r.type === '还料').flatMap(r => r.lines).filter(l => l.id === id).reduce((n, l) => n + l.qty, 0)
  return Math.max(0, balance - pending)
}
export function requestRepairMaterials(c: RepairCase, a: DemoActor, type: '领料' | '还料', lines: MaterialLine[], remark: string) {
  requireOwner(c, a); requireOpen(c)
  if (!lines.length || !lines.some(l => l.qty > 0) || new Set(lines.map(l => l.id)).size !== lines.length) throw new Error('请选择物料，至少一项数量须大于 0')
  for (const line of lines) {
    const material = type === '领料' ? line.material : repairMaterials.find(m => m.id === line.id)
    const max = type === '还料' ? returnAvailable(c, line.id) : material?.stock ?? 0
    if (!material || material.id !== line.id || !material.name || !Number.isFinite(line.qty) || line.qty < 0 || (type === '领料' && line.qty === 0) || (type === '还料' && (max <= 0 || line.qty > max)) || Math.abs(line.qty * 10000 - Math.round(line.qty * 10000)) > 0.000001) throw new Error('请选择有效物料并填写有效数量，还料不得超过可申请范围，最多 4 位小数')
    if (type === '还料' && line.qty !== max && !line.reason.trim()) throw new Error('还料数量与应还数量不一致，请填写差异原因')
  }
  ;(c.materialRequests ??= []).push({ type, lines: lines.map(l => ({ ...l, ...(l.material ? { material: { ...l.material } } : {}) })), remark: remark.trim(), status: type === '领料' ? '待运维主管审批' : '待库管核对' })
  c.events.push(`提交${type}申请（模拟），不直接变更库存或结清物料`)
}
export function canSeeReport(c: RepairCase, a: DemoActor) {
  if (a.role === 'supervisor') return true
  if (a.role === 'technician') return c.ownerId === a.id || c.previousOwners.includes(a.id)
  return c.applicantId === a.id
}
export function canSeeRepair(c: RepairCase, a: DemoActor) {
  return a.role === 'supervisor' || c.ownerId === a.id || c.assistants.includes(a.id) || c.previousOwners.includes(a.id)
    || (a.role === 'director' && c.quoteState === '报价审批中' && c.quoteStep === '总经理')
}
export function isOwner(c: RepairCase, a: DemoActor) { return c.ownerId === a.id }
export function activeLog(c: RepairCase) { return c.logs.find(l => !l.endedAt) }
export function quoteAllowsWork(c: RepairCase) { return ['未判断', '无需报价', '报价已确认'].includes(c.quoteState) }
export function blockReason(c: RepairCase) {
  if (['已完成', '已关闭'].includes(c.state)) return `维修单${c.state}，仅可查看`
  if (c.pendingRequest) return `${c.pendingRequest.type}申请待运维主管审批，本轮暂不演示审批处理`
  if (c.completion === '待审批') return '等待运维主管完工审批'
  if (!quoteAllowsWork(c)) return c.quoteState === '报价审批中' ? `等待${c.quoteStep === '主管' ? '运维主管' : '总经理'}报价审批` : c.quoteState
  return ''
}
function requireOwner(c: RepairCase, a: DemoActor) { if (!isOwner(c, a)) throw new Error('仅当前维修负责人可以执行此操作') }
function requireOpen(c: RepairCase) {
  if (['已完成', '已关闭'].includes(c.state) || c.pendingRequest || c.completion === '待审批') throw new Error('当前维修单不可办理，请查看处理状态')
}
export function startLog(c: RepairCase, a: DemoActor, now = Date.now()) {
  requireOwner(c, a); requireOpen(c)
  if (activeLog(c)) throw new Error('已有未结束的维修记录，请继续填写')
  if (!quoteAllowsWork(c)) throw new Error('报价尚未确认，不能开始后续维修')
  c.firstStartedAt ??= now; c.state = '进行中'
  c.logs.push({ id: `${c.orderId}-LOG-${c.logs.length + 1}`, actorId: a.id, startedAt: now,
    mode: '线下', position: '', fault: c.fault, needsQuote: c.quoteState === '未判断' ? '' : c.quoteState === '无需报价' ? '否' : '是',
    description: '', result: '', reason: '', photos: [], videos: [], vehicle: '', people: a.name })
  c.events.push(`${a.name} 开始维修打卡（模拟，不获取定位）`)
}
export function finishLog(c: RepairCase, a: DemoActor, now = Date.now()) {
  requireOwner(c, a); requireOpen(c)
  const log = activeLog(c)
  if (!log || log.actorId !== a.id) throw new Error('请先开始维修打卡')
  if (!log.position.trim() || !log.fault.trim() || !log.description.trim()) throw new Error('请填写故障位置、故障描述和维修记录')
  if (!log.needsQuote) throw new Error('请选择是否需要报价')
  const quotePending = c.quoteState === '未判断' && log.needsQuote === '是'
  if (!quotePending && !log.result) throw new Error('请选择本次维修结果')
  if (!quotePending && log.result === '需要复修' && !log.reason.trim()) throw new Error('请填写复修原因')
  if (now < log.startedAt) throw new Error('结束时间不能早于开始时间')
  if (c.quoteState === '未判断') c.quoteState = quotePending ? '待报价' : '无需报价'
  if (quotePending) { log.result = ''; log.reason = '' }
  log.endedAt = now
  c.events.push(quotePending ? '首次检查结束，等待填写报价；报价确认后可继续维修' : `本次维修结束：${log.result}`)
}
export function quoteTotal(items: QuoteLine[]) { return items.reduce((sum, i) => sum + Math.round(i.qty * i.price * 100), 0) / 100 }
export function submitQuote(c: RepairCase, a: DemoActor, items: QuoteLine[]) {
  requireOwner(c, a); requireOpen(c)
  if (activeLog(c) || !['待报价', '审批驳回'].includes(c.quoteState)) throw new Error('请结束首次检查，或等待当前报价处理完成')
  if (!items.length || items.some(i => !i.name.trim() || !Number.isFinite(i.qty) || i.qty <= 0 || !Number.isFinite(i.price) || i.price < 0) || !Number.isFinite(quoteTotal(items)) || quoteTotal(items) <= 0) throw new Error('请填写有效的报价项目、数量和单价，合计须大于 0')
  c.quoteItems = items.map(i => ({ ...i, name: i.name.trim() })); c.quoteState = '报价审批中'; c.quoteStep = '主管'; c.quoteReason = ''
  c.events.push(`提交报价 ¥${quoteTotal(items).toFixed(2)}，等待运维主管审批`)
}
export function canApproveQuote(c: RepairCase, a: DemoActor) {
  return c.quoteState === '报价审批中' && ((c.quoteStep === '主管' && a.role === 'supervisor') || (c.quoteStep === '总经理' && a.role === 'director'))
}
export function approveQuote(c: RepairCase, a: DemoActor, approved: boolean, reason: string) {
  requireOpen(c)
  if (!canApproveQuote(c, a)) throw new Error('当前身份不能审批此报价')
  if (!approved && !reason.trim()) throw new Error('驳回必须填写原因')
  c.events.push(`${a.name}${approved ? '通过' : '驳回'}报价${reason.trim() ? `：${reason.trim()}` : ''}`)
  c.quoteReason = reason.trim()
  if (!approved) { c.quoteState = '审批驳回'; c.quoteStep = '' }
  else if (c.quoteStep === '主管') c.quoteStep = '总经理'
  else { c.quoteState = '审批通过待客户确认'; c.quoteStep = '' }
}
export function confirmCustomer(c: RepairCase, a: DemoActor, price: number) {
  requireOwner(c, a); requireOpen(c)
  if (c.quoteState !== '审批通过待客户确认') throw new Error('报价两级审批通过后才能登记客户确认')
  if (!Number.isFinite(price) || price < 0) throw new Error('请填写有效的维修价格')
  c.confirmedPrice = price; c.quoteState = '报价已确认'; c.events.push(`登记客户确认维修，价格 ¥${price.toFixed(2)}`)
}
export function completionBlock(c: RepairCase) {
  if (activeLog(c)) return '请先结束维修打卡'
  if (!['无需报价', '报价已确认'].includes(c.quoteState)) return '报价需为无需报价或报价已确认'
  if (c.logs[c.logs.length - 1]?.result !== '维修完成') return '最近一次维修尚未完成，请继续维修'
  if (c.materialOpen || c.materialRequests?.length) return '存在未结清物料或待处理申请，暂不能提交完工'
  return ''
}
export function submitCompletion(c: RepairCase, a: DemoActor, price?: number) {
  requireOwner(c, a); requireOpen(c)
  const reason = completionBlock(c); if (reason) throw new Error(reason)
  if (c.quoteState === '报价已确认' && (price == null || !Number.isFinite(price) || price < 0)) throw new Error('请核对最终维修价格')
  c.finalPrice = c.quoteState === '报价已确认' ? price : undefined; c.completion = '待审批'
  c.events.push('提交完工，等待运维主管审批（模拟）')
}
export function approveCompletion(c: RepairCase, a: DemoActor, approved: boolean, reason: string) {
  if (a.role !== 'supervisor' || c.completion !== '待审批' || c.state !== '进行中') throw new Error('当前身份或状态不能审批完工')
  if (!approved && !reason.trim()) throw new Error('驳回必须填写原因')
  if (approved) { const blocked = completionBlock(c); if (blocked) throw new Error(blocked) }
  c.completion = approved ? '已通过' : '已驳回'; c.completionReason = reason.trim()
  if (approved) c.state = '已完成'
  c.events.push(approved ? '完工审批通过，待对接客户评价单生成' : `完工驳回，可继续维修：${reason.trim()}`)
}
export function requestException(c: RepairCase, a: DemoActor, type: '转单' | '关闭', reason: string, remark: string) {
  requireOwner(c, a); requireOpen(c)
  if (activeLog(c)) throw new Error('请先结束维修打卡')
  if (type === '关闭' && (c.materialOpen || c.materialRequests?.length)) throw new Error('物料未结清，不能申请关闭')
  const reasons = type === '关闭' ? ['客户弃修', '不是问题', '其他'] : ['个人问题', '病假']
  if (!reasons.includes(reason) || !remark.trim()) throw new Error('请选择原因并填写备注')
  c.pendingRequest = { type, reason, remark: remark.trim() }; c.events.push(`${type}申请待主管审批：${reason}；${remark.trim()}`)
}
export function totalHours(c: RepairCase) { return c.logs.reduce((n, l) => n + (l.endedAt ? l.endedAt - l.startedAt : 0), 0) / 3600000 }
export function waitText(c: RepairCase, now = Date.now()) {
  const minutes = Math.max(0, Math.floor(((c.firstStartedAt ?? now) - c.createdAt) / 60000))
  return minutes < 60 ? `${minutes} 分钟` : `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`
}
export interface ReportDraft { customerId: string; projectId: string; product: string; fault: string; reportedAt: string; remark: string; photos: string[]; videos: string[] }
export function createCase(d: ReportDraft, a: DemoActor, sequence: number, now = Date.now()): RepairCase {
  const customer = demoCustomers.find(c => c.id === d.customerId)
  const project = customer?.projects.find(p => p.id === d.projectId)
  if (!project || !project.products.includes(d.product)) throw new Error('请选择客户、对应项目和项目产品')
  if (!d.fault.trim()) throw new Error('请填写故障现象')
  const reportDate = new Date(`${d.reportedAt}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.reportedAt) || !Number.isFinite(reportDate.getTime()) || reportDate.toISOString().slice(0, 10) !== d.reportedAt) throw new Error('请选择有效的报修日期')
  if (d.photos.length > 6 || d.videos.length > 2) throw new Error('最多 6 张照片、2 个视频')
  // Demo roster intentionally uses submission time, never the editable reported date.
  const duty = demoActors[1 + Math.floor(now / 86400000) % 2]
  const id = `DEMO-BX-${now}-${sequence}`
  return { id, orderId: id.replace('BX', 'WX'), customer: customer!.name, projectId: project.id, project: project.name, product: d.product, warranty: project.warranty,
    fault: d.fault.trim(), reportedAt: d.reportedAt, createdAt: now, applicantId: a.id, applicant: a.name, remark: d.remark.trim(), photos: [...d.photos], videos: [...d.videos],
    ownerId: duty.id, owner: duty.name, previousOwners: [], assistants: [], state: '待处理', logs: [], quoteState: '未判断', quoteStep: '', quoteItems: [], quoteReason: '',
    completion: '未提交', completionReason: '', materialOpen: false, events: [`${a.name} 提交报修`, `按示例值班表分配给${duty.name}，已生成关联维修任务`] }
}
export function createWorkflowFixtures(now = Date.now()): RepairCase[] {
  const projects = demoCustomers.flatMap(customer => customer.projects.map(project => ({ customer, project })))
  const faults = ['设备间歇断电，重启后仍出现，请检查供电线路。', '通行记录未同步，现场识别正常但后台查询不到。', '画面间歇卡顿，夜间出现较明显。', '设备持续告警，现场检查未发现明显异常。', '终端连接超时，影响现场作业，请协助排查。', '设备外壳受损，需要检修并确认是否更换配件。']
  return Array.from({ length: 30 }, (_, i) => {
    const scenario = i % 15
    const { customer, project } = projects[i % projects.length]
    const createdAt = now - (i + 1) * 7200000
    const c = createCase({ customerId: customer.id, projectId: project.id, product: project.products[Math.floor(i / projects.length) % project.products.length], fault: faults[i % faults.length], reportedAt: new Date(createdAt + 8 * 3600000).toISOString().slice(0, 10), remark: ['白天可到场，请提前联系（示例）。', '线上检查后再确定是否需要到场（示例）。', '现场设备较多，请核对项目产品后处理（示例）。'][i % 3], photos: [], videos: [] }, i === 0 || i % 3 ? demoActors[0] : demoActors[2], i, createdAt)
    c.ownerId = demoActors[1 + i % 2].id; c.owner = demoActors[1 + i % 2].name
    c.events[1] = `示例排班分配给${c.owner}，已生成关联维修任务`
    if (i % 5 === 3) {
      const assistant = demoActors[1 + (i + 1) % 2]
      c.assistants = [assistant.id]
      c.events.push(`${assistant.name}已通过双主管审批加入（预置历史示例，不表示本轮已实现协助审批）`)
    }
    if (scenario === 0) return c
    const owner = demoActors.find(a => a.id === c.ownerId)!
    startLog(c, owner, c.createdAt + 600000)
    Object.assign(activeLog(c)!, { mode: (['线下', '线上', '检修'] as const)[i % 3], position: ['一号作业区', '控制室设备柜', '北侧出入口'][i % 3], description: ['检查连接线路并重新固定端子，设备已恢复（示例）。', '远程核对配置与通信日志，完成连接测试（示例）。', '完成设备巡查，发现配件老化并记录更换建议（示例）。'][i % 3], needsQuote: scenario >= 7 ? '否' : '是', result: '维修完成', vehicle: i % 3 === 0 ? '运维车辆（示例） · 往返 18km' : '' })
    if (scenario === 10) return c // Active draft, visible only to its owner for editing.
    if (scenario === 11) Object.assign(activeLog(c)!, { result: '需要复修', reason: '等待替换配件到货，需再次到场调试（示例）。' })
    finishLog(c, owner, c.createdAt + 4200000)
    const price = 180 + i * 30
    if (scenario >= 2 && scenario <= 6) submitQuote(c, owner, [{ name: `${c.product}检修服务（示例）`, qty: 1, price }, { name: '配件更换（示例）', qty: 2, price: 50 }])
    if (scenario >= 3 && scenario <= 5) approveQuote(c, demoActors[3], true, '维护范围已核对（示例）')
    if (scenario >= 4 && scenario <= 5) approveQuote(c, demoActors[4], true, '同意报价（示例）')
    if (scenario === 5) confirmCustomer(c, owner, price + 100)
    if (scenario === 6) approveQuote(c, demoActors[3], false, '请补充配件规格和数量依据（示例）')
    if (scenario === 7) { c.materialOpen = true; c.events.push('尚有 1 件电源未结清（示例）') }
    if (scenario === 8) { submitCompletion(c, owner); approveCompletion(c, demoActors[3], true, '维修结果符合要求（示例）') }
    if (scenario === 9) { const previous = demoActors[1 + (i + 1) % 2]; c.previousOwners = [previous.id]; c.events.push(`历史转单：${previous.name} → ${c.owner}（示例）`); c.state = '已关闭'; c.events.push('主管审批关闭通过：客户弃修（历史示例）') }
    if (scenario === 12 || scenario === 13) submitCompletion(c, owner)
    if (scenario === 13) approveCompletion(c, demoActors[3], false, '请补充连续运行测试结果后重新提交（示例）')
    if (scenario === 14) requestException(c, owner, i < 15 ? '转单' : '关闭', i < 15 ? '病假' : '不是问题', i < 15 ? '需主管安排其他负责人继续跟进（示例）。' : '确认是操作设置问题，申请关闭（示例）。')
    return c
  })
}
