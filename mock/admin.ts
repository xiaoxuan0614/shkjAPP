// mock/admin.ts —— 管理员域（工单审批）
import { ok, proxyPrefix } from './_data'

const approvals = [
  {
    id: 'ap1',
    orderNo: 'GZ202608141020',
    customerName: '苏州工业园区科技园',
    project: '监控系统',
    status: 'pending',
    statusText: '审批中',
    waitingHours: 6,
    submitTime: '2026-08-14 16:20',
    repairerName: '王强',
    price: { labor: 300, material: 2040, total: 2340 },
    timeline: [
      { title: '发起审批', desc: '王强 提交工单审批', time: '2026-08-14 16:20' },
      { title: '审批中', desc: '已等待 6 小时', time: '进行中' },
    ],
  },
  {
    id: 'ap2',
    orderNo: 'GZ202608131030',
    customerName: '上海首汇信息科技有限公司',
    project: 'UPS 电源',
    status: 'pending',
    statusText: '审批中',
    waitingHours: 20,
    submitTime: '2026-08-13 12:20',
    repairerName: '赵磊',
    price: { labor: 400, material: 3200, total: 3600 },
    timeline: [
      { title: '发起审批', desc: '赵磊 提交工单审批', time: '2026-08-13 12:20' },
      { title: '审批中', desc: '已等待 20 小时', time: '进行中' },
    ],
  },
]

export default [
  { url: `${proxyPrefix}/admin/approvalList`, method: 'get', response: () => ok(approvals) },
  {
    url: `${proxyPrefix}/admin/approvalDetail`,
    method: 'get',
    response: ({ query }: any) => ok(approvals.find((a) => a.id === query?.id) || approvals[0]),
  },
  { url: `${proxyPrefix}/admin/approval/approve`, method: 'post', response: () => ok('success') },
  { url: `${proxyPrefix}/admin/approval/reject`, method: 'post', response: () => ok('success') },
]
