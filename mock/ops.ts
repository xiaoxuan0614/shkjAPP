// mock/ops.ts —— 运维域（工作台 / 接单 / 预约 / 用料还料 / 维修记录 / 工单详情 / 车辆 / 打卡 / 待办）
import { ok } from './_data'
import { CUSTOMERS, REPAIRERS, MATERIALS, VEHICLES, proxyPrefix } from './_data'

// ============ 待接单列表 ============
const acceptList = [
  {
    id: 'ac1',
    repairNo: 'BX202608161001',
    customerName: '上海首汇信息科技有限公司',
    address: '上海市闵行区联航路1588号',
    contact: '王经理',
    phone: '13911112222',
    faultTypeText: '网络故障',
    faultDesc: '办公区部分电脑无法上网，需要现场排查。',
    createTime: '2026-08-16 10:01',
  },
  {
    id: 'ac2',
    repairNo: 'BX202608160922',
    customerName: '南京金陵大厦物业',
    address: '南京市鼓楼区中山北路45号',
    contact: '赵经理',
    phone: '13644445555',
    faultTypeText: '硬件故障',
    faultDesc: '地下车库 3 个摄像头画面黑屏。',
    createTime: '2026-08-16 09:22',
  },
]

// ============ 维修记录（工单） ============
const workOrders = [
  {
    id: 'wo1',
    orderNo: 'GZ202608160940',
    yyNo: 'YY20260816094201',
    wxNo: '',
    repairNo: 'BX202608151012',
    repairType: 'offline', // 线下
    customerName: '杭州云栖数据有限公司',
    address: '杭州市西湖区云栖小镇',
    contact: '李工',
    phone: '13822223333',
    project: '门禁系统',
    faultTypeText: '硬件故障',
    faultDesc: '3 楼门禁无法刷卡开门，指示灯不亮。',
    maintenanceNature: 'half',
    maintenanceNatureText: '半包',
    maintenanceType: '线下预约',
    personInCharge: '李伟',
    status: 'processing', // 进行中
    reservation: {
      yyNo: 'YY20260816094201',
      reserveDate: '2026-08-16 14:00',
      faultTime: '2026-08-15 10:00',
      maintenanceNature: 'half',
      maintenanceTypeText: '线下预约',
      assistant: true,
      assistantType: 'inner', // 内协
      assistantPersons: ['王强', '赵磊'],
      signTime: '2026-08-16 14:00',
      signLocation: '杭州云栖小镇 2F 门禁机房',
      signLocationOk: true,
    },
    planMaterials: [
      { name: '门禁控制器', spec: '双门', planQty: 1, outQty: 0 },
      { name: '网线 超五类', spec: '305米/箱', planQty: 1, outQty: 1 },
    ],
    repairLogs: [
      {
        step: 1,
        title: '基本信息',
        content: '已到达现场，门禁控制器电源指示灯不亮，疑似电源模块损坏。',
        time: '2026-08-16 14:05',
      },
      {
        step: 2,
        title: '维修记录',
        content: '更换门禁电源模块后恢复正常，刷卡测试通过。维修状态：维修完成。',
        time: '2026-08-16 15:20',
        status: 'done',
        statusText: '维修完成',
      },
    ],
    vehicles: [{ plate: '沪A·8H213', purpose: '上门维修' }],
    participants: ['李伟', '王强'],
  },
  {
    id: 'wo2',
    orderNo: 'GZ202608141020',
    yyNo: 'YY20260814102101',
    repairNo: 'BX202608141534',
    repairType: 'offline',
    customerName: '苏州工业园区科技园',
    address: '苏州市工业园区星湖街328号',
    contact: '陈主管',
    phone: '13733334444',
    project: '监控系统',
    faultTypeText: '硬件故障',
    faultDesc: '地下车库 3 个摄像头画面黑屏，需要更换。',
    maintenanceNature: 'warranty',
    maintenanceNatureText: '质保',
    maintenanceType: '线下预约',
    personInCharge: '王强',
    status: 'pendingAudit', // 待审批
    reservation: {
      yyNo: 'YY20260814102101',
      reserveDate: '2026-08-14 14:00',
      faultTime: '2026-08-14 10:00',
      maintenanceNature: 'warranty',
      maintenanceTypeText: '线下预约',
      assistant: false,
      signTime: '2026-08-14 14:05',
      signLocation: '苏州工业园区科技园 B2 车库',
      signLocationOk: true,
    },
    planMaterials: [
      { name: '摄像头 400W', spec: '枪机', planQty: 3, outQty: 3 },
    ],
    repairLogs: [
      { step: 1, title: '基本信息', content: '已到达现场，3 个摄像头画面黑屏。', time: '2026-08-14 14:05' },
      { step: 2, title: '维修记录', content: '更换 3 个摄像头，画面恢复正常。维修状态：维修完成。', time: '2026-08-14 16:00', status: 'done', statusText: '维修完成' },
      { step: 3, title: '结束打卡', content: '位置正常，未填写异常原因。', time: '2026-08-14 16:10' },
    ],
    vehicles: [{ plate: '沪B·3K556', purpose: '上门维修' }],
    participants: ['王强'],
    submitAudit: {
      submitTime: '2026-08-14 16:20',
      remark: '3 个摄像头已更换完毕，申请审核。',
      price: { labor: 300, material: 2040, total: 2340 },
    },
  },
  {
    id: 'wo3',
    orderNo: 'GZ202608131030',
    yyNo: 'YY20260813103101',
    repairNo: 'BX202608121645',
    repairType: 'offline',
    customerName: '上海首汇信息科技有限公司',
    address: '上海市闵行区联航路1588号',
    contact: '王经理',
    phone: '13911112222',
    project: 'UPS 电源',
    faultTypeText: '硬件故障',
    faultDesc: '2 楼机房 UPS 电池告警。',
    maintenanceNature: 'full',
    maintenanceNatureText: '全包',
    maintenanceType: '线下预约',
    personInCharge: '赵磊',
    status: 'pendingEvaluate', // 待评价
    reservation: {
      yyNo: 'YY20260813103101',
      reserveDate: '2026-08-13 09:30',
      faultTime: '2026-08-12 16:45',
      maintenanceNature: 'full',
      maintenanceTypeText: '线下预约',
      assistant: true,
      assistantType: 'outer',
      assistantOrg: '杭州电池有限公司',
      assistantCount: 2,
      assistantHours: 4,
      signTime: '2026-08-13 09:35',
      signLocation: '上海首汇科技 2F 机房',
      signLocationOk: true,
    },
    planMaterials: [{ name: '电源模块', spec: '48V', planQty: 4, outQty: 4 }],
    repairLogs: [
      { step: 1, title: '基本信息', content: '已到达现场。', time: '2026-08-13 09:35' },
      { step: 2, title: '维修记录', content: '更换 UPS 电池组，测试正常。维修状态：维修完成。', time: '2026-08-13 12:00', status: 'done', statusText: '维修完成' },
      { step: 3, title: '结束打卡', content: '位置正常。', time: '2026-08-13 12:10' },
    ],
    vehicles: [],
    participants: ['赵磊'],
    submitAudit: { submitTime: '2026-08-13 12:20', remark: '', price: { labor: 400, material: 3200, total: 3600 } },
  },
  {
    id: 'wo4',
    orderNo: 'GZ202608111400',
    yyNo: 'YY20260811140101',
    repairNo: 'BX202608111000',
    repairType: 'offline',
    customerName: '南京金陵大厦物业',
    address: '南京市鼓楼区中山北路45号',
    contact: '赵经理',
    phone: '13644445555',
    project: '办公电脑',
    faultTypeText: '软件故障',
    faultDesc: '财务部 2 台电脑系统卡顿。',
    maintenanceNature: 'nonWarranty',
    maintenanceNatureText: '非质保',
    maintenanceType: '线下预约',
    personInCharge: '孙浩',
    status: 'finished', // 已完结
    reservation: {
      yyNo: 'YY20260811140101',
      reserveDate: '2026-08-11 14:00',
      faultTime: '2026-08-11 10:00',
      maintenanceNature: 'nonWarranty',
      maintenanceTypeText: '线下预约',
      assistant: false,
      signTime: '2026-08-11 14:10',
      signLocation: '南京金陵大厦 5F 财务部',
      signLocationOk: true,
    },
    planMaterials: [],
    repairLogs: [
      { step: 1, title: '基本信息', content: '已到达现场。', time: '2026-08-11 14:10' },
      { step: 2, title: '维修记录', content: '重装系统并恢复数据，运行正常。维修状态：维修完成。', time: '2026-08-11 16:30', status: 'done', statusText: '维修完成' },
      { step: 3, title: '结束打卡', content: '位置正常。', time: '2026-08-11 16:40' },
    ],
    vehicles: [],
    participants: ['孙浩'],
    submitAudit: { submitTime: '2026-08-11 16:50', remark: '', price: { labor: 200, material: 0, total: 200 } },
    finishedAt: '2026-08-12 10:00',
  },
  {
    id: 'wo5',
    orderNo: 'GZ202608151130',
    yyNo: '',
    repairNo: '',
    repairType: 'online', // 线上（软件维修，不需要预约单）
    customerName: '上海首汇信息科技有限公司',
    address: '上海市闵行区联航路1588号',
    contact: '王经理',
    phone: '13911112222',
    project: 'OA 系统',
    faultTypeText: '软件故障',
    faultDesc: 'OA 系统无法登录，提示服务异常。',
    maintenanceNature: 'full',
    maintenanceNatureText: '全包',
    maintenanceType: '线上维修',
    personInCharge: '李伟',
    status: 'processing', // 进行中
    reservation: null,
    planMaterials: [],
    repairLogs: [
      { step: 1, title: '维修日志', content: '排查 OA 服务日志，发现数据库连接池耗尽，已重启服务。维修状态：维修完成。', time: '2026-08-15 11:30', status: 'done', statusText: '维修完成', needAssistant: false },
    ],
    vehicles: [],
    participants: ['李伟'],
  },
  {
    id: 'wo6',
    orderNo: 'GZ202608160958',
    yyNo: 'YY20260816095901',
    repairNo: 'BX202608160922',
    repairType: 'offline',
    customerName: '南京金陵大厦物业',
    address: '南京市鼓楼区中山北路45号',
    contact: '赵经理',
    phone: '13644445555',
    project: '监控系统',
    faultTypeText: '硬件故障',
    faultDesc: '地下车库 3 个摄像头画面黑屏。',
    maintenanceNature: 'nonWarranty',
    maintenanceNatureText: '非质保',
    maintenanceType: '线下预约',
    personInCharge: '张三',
    status: 'notStart', // 未开始
    reservation: {
      yyNo: 'YY20260816095901',
      reserveDate: '2026-08-17 09:00',
      faultTime: '2026-08-16 09:22',
      maintenanceNature: 'nonWarranty',
      maintenanceTypeText: '线下预约',
      assistant: false,
      signTime: '',
      signLocation: '',
      signLocationOk: true,
    },
    planMaterials: [],
    repairLogs: [],
    vehicles: [],
    participants: [],
  },
]

const orderTimeline = (o: any) => {
  const lines = [
    { title: '客户报修', desc: o.repairNo || o.faultDesc, time: '2026-08-16 09:30' },
    { title: '信息部门派单', desc: '已派单', time: '2026-08-16 09:40' },
    { title: '运维接单', desc: `接单人：${o.personInCharge}`, time: '2026-08-16 09:50' },
  ]
  if (o.reservation?.signTime) lines.push({ title: '签到', desc: o.reservation.signLocation, time: o.reservation.signTime })
  o.repairLogs.forEach((l) => lines.push({ title: l.title, desc: l.content, time: l.time }))
  if (o.submitAudit) lines.push({ title: '提交审批', desc: o.submitAudit.remark || '提交审核', time: o.submitAudit.submitTime })
  if (o.status === 'finished') lines.push({ title: '客户确认', desc: '已签字评价', time: o.finishedAt })
  return lines
}

// ============ 待办（8 类） ============
const todoList = [
  { id: 't1', type: 'project_due', title: '项目工序即将到期', desc: '苏州工业园监控项目·设备安装 剩余 2 天', time: '2026-08-18 前', urgent: true },
  { id: 't2', type: 'workorder_audit', title: '工单提交审批', desc: 'GZ202608141020 待提交审核', time: '2026-08-16', urgent: false },
  { id: 't3', type: 'material_apply', title: '用料申请待处理', desc: '上海首汇科技·用料申请 2 条', time: '2026-08-16', urgent: false },
  { id: 't4', type: 'material_return', title: '还料申请待处理', desc: '杭州云栖数据·还料申请 1 条', time: '2026-08-16', urgent: false },
  { id: 't5', type: 'transfer', title: '转单信息', desc: '张工 申请将工单转给你', time: '2026-08-15', urgent: false },
  { id: 't6', type: 'inner_invite', title: '内协邀请', desc: '王强 邀请你协助维修', time: '2026-08-15', urgent: false },
  { id: 't7', type: 'repair_remind', title: '报修提醒', desc: '南京金陵·监控黑屏 待接单', time: '2026-08-16', urgent: false },
  { id: 't8', type: 'repair_timeout', title: '报修超 2 小时未处理', desc: 'BX202608161001 已超时', time: '2026-08-16', urgent: true },
  { id: 't9', type: 'inspection_due', title: '巡检任务即将到期', desc: '机房巡检 剩余 3 天', time: '2026-08-19 前', urgent: true },
]

// ============ 车辆记录 ============
const fuelRecords = [
  { id: 'f1', plate: '沪A·8H213', date: '2026-08-15', type: '95# 汽油', amount: '42.3L', price: 345.6, station: '中石化·联航路站', odometer: 25680, image: 'https://picsum.photos/seed/fuel1/400/300' },
  { id: 'f2', plate: '沪B·3K556', date: '2026-08-12', type: '95# 汽油', amount: '38L', price: 310.5, station: '中石油·星湖街站', odometer: 41200, image: 'https://picsum.photos/seed/fuel2/400/300' },
]
const tripRecords = [
  { id: 'tr1', plate: '沪A·8H213', startTime: '2026-08-15 08:30', endTime: '2026-08-15 10:20', startLoc: '首汇科技总部', endLoc: '杭州云栖小镇', mileage: 128, purpose: '上门维修门禁', image: 'https://picsum.photos/seed/trip1/400/300' },
  { id: 'tr2', plate: '沪A·8H213', startTime: '2026-08-14 13:00', endTime: '2026-08-14 15:40', startLoc: '首汇科技总部', endLoc: '苏州工业园区科技园', mileage: 96, purpose: '监控更换', image: 'https://picsum.photos/seed/trip2/400/300' },
]
const maintainRecords = [
  { id: 'm1', plate: '沪A·8H213', date: '2026-08-08', type: '机油机滤保养', cost: 680, store: '大众 4S 店·闵行', odometer: 25000 },
  { id: 'm2', plate: '沪B·3K556', date: '2026-07-30', type: '轮胎更换', cost: 2400, store: '途虎养车·星湖街', odometer: 40800 },
]

export default [
  // ============ 工作台 ============
  {
    url: `${proxyPrefix}/ops/workbench`,
    method: 'get',
    response: () =>
      ok({
        userInfo: { realname: '张三', roleName: '运维人员', avatar: '', orgCodeTxt: '首汇科技/运维部' },
        countGrid: [
          { key: 'offlineRepair', label: '线下维修', count: 3 },
          { key: 'offlineReserve', label: '线下预约', count: 2 },
          { key: 'onlineRepair', label: '线上维修', count: 1 },
          { key: 'materialApply', label: '用料申请', count: 2 },
          { key: 'materialReturn', label: '还料申请', count: 1 },
          { key: 'implementLog', label: '实施日志', count: 1 },
          { key: 'material', label: '物料管理', count: 0 },
          { key: 'punch', label: '内协打卡', count: 1 },
          { key: 'inspection', label: '巡检统计', count: 1 },
        ],
        vehicleGrid: [
          { key: 'vehicleLog', label: '车辆日志' },
          { key: 'vehicleTrip', label: '出行' },
          { key: 'vehicleFuel', label: '加油' },
          { key: 'vehicleMaintain', label: '保养' },
        ],
        todoCount: todoList.length,
        repairList: workOrders.slice(0, 4),
        counts: { repair: acceptList.length, project: 3, inspection: 1 },
      }),
  },
  // ============ 待办 ============
  {
    url: `${proxyPrefix}/ops/todoList`,
    method: 'get',
    response: () => ok(todoList),
  },
  {
    url: `${proxyPrefix}/ops/todo/clear`,
    method: 'post',
    response: () => ok('success'),
  },
  // ============ 报修接单列表 ============
  {
    url: `${proxyPrefix}/ops/acceptList`,
    method: 'get',
    response: () => ok(acceptList),
  },
  // ============ 接单详情 ============
  {
    url: `${proxyPrefix}/ops/acceptDetail`,
    method: 'get',
    response: ({ query }: any) => {
      const r = acceptList.find((x) => x.id === query?.id) || acceptList[0]
      return ok({ ...r, timeline: [{ title: '客户报修', desc: r.faultDesc, time: r.createTime }, { title: '信息部门派单', desc: '待运维接单', time: '2026-08-16 09:40' }] })
    },
  },
  // ============ 接单 / 驳回 ============
  {
    url: `${proxyPrefix}/ops/accept`,
    method: 'post',
    response: () => ok({ orderNo: 'GZ202608161100' }),
  },
  {
    url: `${proxyPrefix}/ops/reject`,
    method: 'post',
    response: () => ok('success'),
  },
  // ============ 客户模糊搜索 ============
  {
    url: `${proxyPrefix}/ops/customerSearch`,
    method: 'get',
    response: ({ query }: any) => {
      const name = query?.name || ''
      return ok(CUSTOMERS.filter((c) => c.name.includes(name)))
    },
  },
  // ============ 预约保存 ============
  {
    url: `${proxyPrefix}/ops/reservation/save`,
    method: 'post',
    response: () => ok({ yyNo: 'YY20260816092201' }),
  },
  // ============ 单号联动客户（用料/还料） ============
  {
    url: `${proxyPrefix}/ops/orderCustomer`,
    method: 'get',
    response: ({ query }: any) => {
      const no = query?.orderNo || ''
      const c = CUSTOMERS[(no.length + 1) % CUSTOMERS.length]
      return ok({ orderNo: no, ...c, maintenanceNatureText: '全包' })
    },
  },
  // ============ 物料列表 ============
  {
    url: `${proxyPrefix}/stock/material/list`,
    method: 'get',
    response: () => ok(MATERIALS),
  },
  // ============ 用料/还料保存 ============
  {
    url: `${proxyPrefix}/ops/materialApply/save`,
    method: 'post',
    response: () => ok({ applyNo: 'LK20260816120001' }),
  },
  {
    url: `${proxyPrefix}/ops/materialReturn/save`,
    method: 'post',
    response: () => ok({ returnNo: 'HL20260816130001' }),
  },
  // ============ 还料明细（申请数量 − 使用数量，只展示还料量 > 0） ============
  {
    url: `${proxyPrefix}/ops/materialReturn/items`,
    method: 'get',
    response: () =>
      ok([
        { id: 'm6', name: '摄像头 400W', spec: '枪机', applyQty: 3, usedQty: 2, returnQty: 1 },
        { id: 'm2', name: '网线 超五类', spec: '305米/箱', applyQty: 2, usedQty: 1, returnQty: 1 },
      ]),
  },
  // ============ 维修记录列表（线下/线上 tab） ============
  {
    url: `${proxyPrefix}/ops/repairRecords`,
    method: 'get',
    response: ({ query }: any) => {
      const type = query?.type || 'offline'
      return ok(workOrders.filter((o) => o.repairType === type))
    },
  },
  // ============ 工单详情 ============
  {
    url: `${proxyPrefix}/ops/repairDetail`,
    method: 'get',
    response: ({ query }: any) => {
      const o = workOrders.find((x) => x.id === query?.id) || workOrders[0]
      return ok({ ...o, timeline: orderTimeline(o) })
    },
  },
  // ============ 工单操作 ============
  { url: `${proxyPrefix}/ops/repair/start`, method: 'post', response: () => ok('success') },
  { url: `${proxyPrefix}/ops/repair/checkin`, method: 'post', response: () => ok('success') },
  { url: `${proxyPrefix}/ops/repair/log`, method: 'post', response: () => ok('success') },
  { url: `${proxyPrefix}/ops/repair/finish`, method: 'post', response: () => ok({ wxNo: 'WX20260816160001', duration: '1.5小时' }) },
  { url: `${proxyPrefix}/ops/repair/close`, method: 'post', response: () => ok('success') },
  { url: `${proxyPrefix}/ops/repair/transfer`, method: 'post', response: () => ok('success') },
  { url: `${proxyPrefix}/ops/repair/submitAudit`, method: 'post', response: () => ok('success') },
  { url: `${proxyPrefix}/ops/repair/updateReservation`, method: 'post', response: () => ok('success') },
  // ============ 车辆记录 ============
  {
    url: `${proxyPrefix}/ops/vehicleList`,
    method: 'get',
    response: ({ query }: any) => {
      const type = query?.type || 'fuel'
      const map: any = { fuel: fuelRecords, trip: tripRecords, maintain: maintainRecords, log: [...fuelRecords, ...tripRecords, ...maintainRecords] }
      return ok(map[type] || [])
    },
  },
  { url: `${proxyPrefix}/ops/vehicle/save`, method: 'post', response: () => ok('success') },
  // ============ 车辆列表（选择） ============
  { url: `${proxyPrefix}/ops/vehicleList/all`, method: 'get', response: () => ok(VEHICLES) },
  // ============ 打卡（内协） ============
  {
    url: `${proxyPrefix}/ops/attendanceList`,
    method: 'get',
    response: () =>
      ok([
        { id: 'a1', orderNo: 'GZ202608141020', date: '2026-08-14', checkin: '14:05', checkout: '16:10', location: '苏州工业园区科技园', status: 'done', workContent: '监控更换' },
        { id: 'a2', orderNo: 'GZ202608160940', date: '2026-08-16', checkin: '14:00', checkout: '', location: '杭州云栖小镇', status: 'processing', workContent: '门禁维修' },
      ]),
  },
  { url: `${proxyPrefix}/ops/attendance/save`, method: 'post', response: () => ok('success') },
  // ============ 实施日志 ============
  {
    url: `${proxyPrefix}/project/implementLog/list`,
    method: 'get',
    response: () =>
      ok([
        { id: 'il1', sgNo: 'SG20260812090001', projectName: '苏州工业园区监控项目', process: '设备安装', planPeriod: '2026-08-10 ~ 08-20', remainDays: 2, photos: ['https://picsum.photos/seed/impl1/400/300'], location: 'B2 车库', content: '完成 5 个摄像头安装、布线 120 米。', persons: ['张三', '王强'], outerCount: 1, outerHours: 4 },
        { id: 'il2', sgNo: 'SG20260810110001', projectName: '上海首汇网络改造', process: '线路敷设', planPeriod: '2026-08-08 ~ 08-18', remainDays: 0, delayed: true, photos: ['https://picsum.photos/seed/impl2/400/300'], location: '3F 办公区', content: '敷设网线 3 箱，完成配线间跳线。', persons: ['张三'] },
      ]),
  },
  { url: `${proxyPrefix}/project/implementLog/save`, method: 'post', response: () => ok({ sgNo: 'SG20260816170001' }) },
]
