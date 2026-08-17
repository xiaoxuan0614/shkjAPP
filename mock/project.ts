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
]
