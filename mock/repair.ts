// mock/repair.ts —— 客户报修域（报修申请 / 报修记录 / 详情 / 确认签字评价）
import { ok, fail, proxyPrefix, CUSTOMERS } from './_data'

const now = '2026-08-16 10:34'

// 报修记录（多状态演示数据）
const records = [
  {
    id: 'bx1',
    repairNo: 'BX202608160934',
    customerName: '上海首汇信息科技有限公司',
    address: '上海市闵行区联航路1588号',
    contact: '王经理',
    phone: '13911112222',
    project: '机房网络设备',
    faultType: 'network',
    faultTypeText: '网络故障',
    faultDesc: '核心交换机 2 口掉线，办公区部分电脑无法上网，需要现场排查。',
    status: 'pending',
    createTime: '2026-08-16 09:20',
    images: ['https://picsum.photos/seed/repair1/400/300'],
    videos: [],
  },
  {
    id: 'bx2',
    repairNo: 'BX202608151012',
    customerName: '杭州云栖数据有限公司',
    address: '杭州市西湖区云栖小镇',
    contact: '李工',
    phone: '13822223333',
    project: '门禁系统',
    faultType: 'hardware',
    faultTypeText: '硬件故障',
    faultDesc: '3 楼门禁无法刷卡开门，指示灯不亮。',
    status: 'processing',
    repairerName: '李伟',
    repairerPhone: '13712345678',
    createTime: '2026-08-15 10:12',
    images: ['https://picsum.photos/seed/repair2/400/300'],
    videos: [],
  },
  {
    id: 'bx3',
    repairNo: 'BX202608141534',
    customerName: '苏州工业园区科技园',
    address: '苏州市工业园区星湖街328号',
    contact: '陈主管',
    phone: '13733334444',
    project: '监控系统',
    faultType: 'hardware',
    faultTypeText: '硬件故障',
    faultDesc: '地下车库 3 个摄像头画面黑屏，需要更换。',
    status: 'confirming',
    repairerName: '王强',
    repairerPhone: '13723456789',
    repairPhotos: ['https://picsum.photos/seed/repair3a/400/300', 'https://picsum.photos/seed/repair3b/400/300'],
    price: { labor: 200, material: 680, total: 880 },
    createTime: '2026-08-14 15:34',
    images: ['https://picsum.photos/seed/repair3/400/300'],
    videos: [],
  },
  {
    id: 'bx4',
    repairNo: 'BX202608131021',
    customerName: '南京金陵大厦物业',
    address: '南京市鼓楼区中山北路45号',
    contact: '赵经理',
    phone: '13644445555',
    project: '办公电脑',
    faultType: 'software',
    faultTypeText: '软件故障',
    faultDesc: '财务部 2 台电脑系统卡顿，软件无法打开。',
    status: 'done',
    repairerName: '赵磊',
    repairerPhone: '13734567890',
    evaluate: { speed: 5, attitude: 4, suggestion: '响应很快，处理及时，建议后续定期巡检。' },
    finishTime: '2026-08-13 15:40',
    createTime: '2026-08-13 10:21',
    images: ['https://picsum.photos/seed/repair4/400/300'],
    videos: [],
  },
  {
    id: 'bx5',
    repairNo: 'BX202608121645',
    customerName: '上海首汇信息科技有限公司',
    address: '上海市闵行区联航路1588号',
    contact: '王经理',
    phone: '13911112222',
    project: 'UPS 电源',
    faultType: 'hardware',
    faultTypeText: '硬件故障',
    faultDesc: '2 楼机房 UPS 电池告警，需要检查更换电池组。',
    status: 'withdrawn',
    reason: '客户自行恢复，无需上门。',
    createTime: '2026-08-12 16:45',
    images: [],
    videos: [],
  },
  {
    id: 'bx6',
    repairNo: 'BX202608110933',
    customerName: '杭州云栖数据有限公司',
    address: '杭州市西湖区云栖小镇',
    contact: '李工',
    phone: '13822223333',
    project: '会议室视频',
    faultType: 'other',
    faultTypeText: '其他',
    faultDesc: '会议室投影无法投屏，需要排查。',
    status: 'rejected',
    reason: '报修项目不在维保范围内，已电话沟通。',
    createTime: '2026-08-11 09:33',
    images: [],
    videos: [],
  },
]

// 详情时间线
const timeline = (r: any) => {
  const lines = [
    { title: '发起报修', desc: `${r.contact} 提交了报修申请`, time: r.createTime },
    { title: '信息部门派单', desc: '已派单给运维人员', time: '2026-08-16 09:40' },
  ]
  if (['processing', 'confirming', 'done'].includes(r.status)) {
    lines.push({ title: '运维接单', desc: `接单人：${r.repairerName}`, time: '2026-08-16 09:50' })
  }
  if (['confirming', 'done'].includes(r.status)) {
    lines.push({ title: '维修完成', desc: '已完成维修，等待客户确认', time: '2026-08-16 11:30' })
  }
  if (r.status === 'done') {
    lines.push({ title: '客户确认签字', desc: '已签字确认并完成评价', time: r.finishTime })
  }
  if (r.status === 'withdrawn' || r.status === 'rejected') {
    lines.push({ title: r.status === 'withdrawn' ? '客户撤回' : '已驳回', desc: r.reason, time: '2026-08-16 10:00' })
  }
  return lines
}

export default [
  // ===== 报修申请提交 =====
  {
    url: `${proxyPrefix}/repair/apply`,
    method: 'post',
    response: () => ok({ repairNo: `BX${new Date().toISOString().slice(0, 10).replace(/-/g, '')}${String(records.length + 1).padStart(4, '0')}` }),
  },
  // ===== 报修记录列表 =====
  {
    url: `${proxyPrefix}/repair/list`,
    method: 'get',
    response: ({ query }: any) => {
      const { status } = query || {}
      const list = status ? records.filter((r) => r.status === status) : records
      return ok(list)
    },
  },
  // ===== 报修记录详情 =====
  {
    url: `${proxyPrefix}/repair/detail`,
    method: 'get',
    response: ({ query }: any) => {
      const r = records.find((x) => x.id === query?.id) || records[0]
      return ok({ ...r, timeline: timeline(r) })
    },
  },
  // ===== 撤回 =====
  {
    url: `${proxyPrefix}/repair/withdraw`,
    method: 'post',
    response: () => ok('success'),
  },
  // ===== 删除 =====
  {
    url: `${proxyPrefix}/repair/remove`,
    method: 'post',
    response: () => ok('success'),
  },
  // ===== 修改报修（回显客户信息）=====
  {
    url: `${proxyPrefix}/repair/customer`,
    method: 'get',
    response: ({ query }: any) => {
      const name = query?.name || ''
      const list = CUSTOMERS.filter((c) => c.name.includes(name))
      return ok(list)
    },
  },
  // ===== 维修确认签字评价提交 =====
  {
    url: `${proxyPrefix}/repair/confirm`,
    method: 'post',
    response: () => ok('success'),
  },
  // ===== 维修确认单详情（三步用）=====
  {
    url: `${proxyPrefix}/repair/confirmInfo`,
    method: 'get',
    response: ({ query }: any) => {
      const r = records.find((x) => x.id === query?.id) || records[2]
      return ok({
        id: r.id,
        repairNo: r.repairNo,
        customerName: r.customerName,
        address: r.address,
        contact: r.contact,
        phone: r.phone,
        project: r.project,
        repairerName: r.repairerName,
        repairerPhone: r.repairerPhone,
        faultDesc: r.faultDesc,
        beforePhotos: r.images,
        afterPhotos: r.repairPhotos || ['https://picsum.photos/seed/after1/400/300'],
        price: r.price || { labor: 200, material: 680, total: 880 },
        signImage: '',
        evaluate: { speed: 0, attitude: 0, suggestion: '' },
      })
    },
  },
]
