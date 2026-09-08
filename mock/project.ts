// mock/project.ts —— 项目域（列表 / 详情 / 延期 / 实施日志）
import { ok, proxyPrefix } from './_data'

const projects = [
  {
    id: 'p1',
    xmNo: 'XM00000001',
    name: '苏州工业园区监控项目',
    customerName: '苏州工业园区科技园',
    status: 'implementing',
    startDate: '2026-08-01',
    endDate: '2026-08-30',
    currentProcess: '设备安装',
    processPlan: '2026-08-10 ~ 08-20',
    remainDays: 2,
    personInCharge: '张三',
    contact: '陈主管 13733334444',
    customerAddress: '苏州市工业园区星湖街328号',
    latitude: 31.3143,
    longitude: 120.7052,
    deliverDate: '',
    warrantyPeriod: '',
    remark: '',
    delay: null,
  },
  {
    id: 'p2',
    xmNo: 'XM00000002',
    name: '上海首汇网络改造',
    customerName: '上海首汇信息科技有限公司',
    status: 'implementing',
    startDate: '2026-07-20',
    endDate: '2026-08-20',
    currentProcess: '线路敷设',
    processPlan: '2026-08-08 ~ 08-18',
    remainDays: -2,
    delayedReason: '配电间装修延期，施工面无法入场。',
    personInCharge: '李伟',
    contact: '王经理 13911112222',
    customerAddress: '上海市闵行区联航路1588号',
    latitude: 31.0807,
    longitude: 121.5018,
    deliverDate: '',
    warrantyPeriod: '',
    remark: '',
    delay: { reason: '配电间装修延期', expectTime: '2026-08-25', status: 'approved' },
  },
  {
    id: 'p3',
    xmNo: 'XM00000003',
    name: '杭州云栖门禁升级',
    customerName: '杭州云栖数据有限公司',
    status: 'warranty',
    startDate: '2026-05-10',
    endDate: '2026-06-20',
    currentProcess: '已交付',
    processPlan: '',
    remainDays: 0,
    personInCharge: '王强',
    contact: '李工 13822223333',
    customerAddress: '杭州市西湖区云栖小镇',
    latitude: 30.1324,
    longitude: 120.0874,
    deliverDate: '2026-06-20',
    warrantyPeriod: '2026-06-20 ~ 2027-06-20',
    remark: '',
    delay: null,
  },
  {
    id: 'p4',
    xmNo: 'XM00000004',
    name: '南京金陵门禁改造',
    customerName: '南京金陵大厦物业',
    status: 'notStart',
    startDate: '2026-08-25',
    endDate: '2026-09-10',
    currentProcess: '未开始',
    processPlan: '',
    remainDays: 0,
    personInCharge: '赵磊',
    contact: '赵经理 13644445555',
    customerAddress: '南京市鼓楼区中山北路45号',
    latitude: 32.0798,
    longitude: 118.7726,
    deliverDate: '',
    warrantyPeriod: '',
    remark: '',
    delay: null,
  },
]

const projectDetail = (p: any) => ({
  ...p,
  info: { xmNo: p.xmNo, name: p.name, customerName: p.customerName, startDate: p.startDate, endDate: p.endDate, personInCharge: p.personInCharge },
  plan: {
    persons: ['张三', '王强', '赵磊'],
    planMaterials: [
      { name: '摄像头 400W', spec: '枪机', planQty: 20, outQty: 14 },
      { name: '交换机', spec: '24口千兆', planQty: 4, outQty: 2 },
      { name: '网线 超五类', spec: '305米/箱', planQty: 15, outQty: 9 },
    ],
  },
  progress: { currentProcess: p.currentProcess, processPlan: p.processPlan, remainDays: p.remainDays, delayedReason: p.delayedReason || '', planPeriod: `${p.startDate} ~ ${p.endDate}` },
  records: [
    { date: '2026-08-12', content: '完成 5 个摄像头安装、布线 120 米。', sgNo: 'SG20260812090001' },
    { date: '2026-08-10', content: '进场勘测，确定点位。', sgNo: 'SG20260810110001' },
  ],
  materialStat: [
    { name: '摄像头 400W', planQty: 20, outQty: 14, usedQty: 12, returnQty: 0 },
    { name: '交换机', planQty: 4, outQty: 2, usedQty: 2, returnQty: 0 },
  ],
})

let activeSession: any = null

const sessionDuration = (start: string, end: string) => {
  const minutes = Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000))
  return minutes < 60 ? `${minutes} 分钟` : `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`
}

export default [
  { url: `${proxyPrefix}/project/list`, method: 'get', response: () => ok(projects) },
  {
    url: `${proxyPrefix}/project/detail`,
    method: 'get',
    response: ({ query }: any) => {
      const p = projects.find((x) => x.id === query?.id) || projects[0]
      return ok(projectDetail(p))
    },
  },
  { url: `${proxyPrefix}/project/delay/save`, method: 'post', response: () => ok('success') },
  // ============ 项目实施闭环：签到 -> 日志 -> 签退 ============
  {
    url: `${proxyPrefix}/project/implementationSession/current`,
    method: 'get',
    response: () => ok(activeSession && activeSession.status !== 'COMPLETED' ? activeSession : null),
  },
  {
    url: `${proxyPrefix}/project/implementationSession/checkIn`,
    method: 'post',
    response: ({ body }: any) => {
      if (activeSession && activeSession.status !== 'COMPLETED') return ok(activeSession)
      const project = projects.find((item) => item.id === body?.projectId) || projects[0]
      const now = new Date().toISOString()
      activeSession = {
        id: `IS${Date.now()}`,
        projectId: project.id,
        project,
        status: 'CHECKED_IN',
        checkInTime: now,
        checkInLocation: body?.location,
        checkInLocationStatus: body?.location?.status || 'NORMAL',
      }
      return ok(activeSession)
    },
  },
  {
    url: `${proxyPrefix}/project/implementationSession/log/draft`,
    method: 'post',
    response: ({ body }: any) => {
      if (!activeSession || activeSession.id !== body?.sessionId) return ok(null)
      activeSession = { ...activeSession, status: 'LOG_DRAFT', logStep: body?.logStep || 1, logData: body?.logData }
      return ok(activeSession)
    },
  },
  {
    url: `${proxyPrefix}/project/implementationSession/log/submit`,
    method: 'post',
    response: ({ body }: any) => {
      if (!activeSession || activeSession.id !== body?.sessionId) return ok(null)
      activeSession = { ...activeSession, status: 'LOG_SUBMITTED', logStep: 2, logData: body?.logData, sgNo: `SG${Date.now()}` }
      return ok(activeSession)
    },
  },
  {
    url: `${proxyPrefix}/project/implementationSession/checkOut`,
    method: 'post',
    response: ({ body }: any) => {
      if (!activeSession || activeSession.id !== body?.sessionId || activeSession.status !== 'LOG_SUBMITTED') return ok(null)
      const checkOutTime = new Date().toISOString()
      activeSession = {
        ...activeSession,
        status: 'COMPLETED',
        checkOutTime,
        checkOutLocation: body?.location,
        checkOutLocationStatus: body?.location?.status || 'FAILED',
        abnormalReason: body?.abnormalReason || '',
        duration: sessionDuration(activeSession.checkInTime, checkOutTime),
      }
      return ok(activeSession)
    },
  },
]
