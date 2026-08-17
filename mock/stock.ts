// mock/stock.ts —— 库管域（用料/还料申请记录，出库/入库）
import { ok, proxyPrefix } from './_data'

const applyList = [
  {
    id: 's1',
    applyNo: 'LK20260816120001',
    type: 'out', // 出库（用料申请）
    typeText: '用料申请',
    orderNo: 'GZ202608141020',
    customerName: '苏州工业园区科技园',
    status: 'pending', // 待出库
    statusText: '待出库',
    useTime: '2026-08-14',
    applyTime: '2026-08-16 12:00',
    remark: '更换 3 个摄像头',
    items: [
      { name: '摄像头 400W', spec: '枪机', applyQty: 3, outQty: 0, usedQty: 0, returnQty: 0, returnableQty: 0 },
    ],
  },
  {
    id: 's2',
    applyNo: 'LK20260815103001',
    type: 'out',
    typeText: '用料申请',
    orderNo: 'GZ202608160940',
    customerName: '杭州云栖数据有限公司',
    status: 'done', // 已出库
    statusText: '已出库',
    useTime: '2026-08-15',
    applyTime: '2026-08-15 10:30',
    remark: '门禁维修用料',
    items: [
      { name: '门禁控制器', spec: '双门', applyQty: 1, outQty: 1, usedQty: 1, returnQty: 0, returnableQty: 0 },
      { name: '网线 超五类', spec: '305米/箱', applyQty: 1, outQty: 1, usedQty: 0, returnQty: 0, returnableQty: 0 },
    ],
  },
  {
    id: 's3',
    applyNo: 'HL20260816130001',
    type: 'in', // 入库（还料申请）
    typeText: '还料申请',
    orderNo: 'GZ202608141020',
    customerName: '苏州工业园区科技园',
    status: 'pending', // 待入库
    statusText: '待入库',
    useTime: '2026-08-14',
    applyTime: '2026-08-16 13:00',
    remark: '更换后旧件退回',
    items: [
      { name: '摄像头 400W', spec: '枪机', applyQty: 3, outQty: 3, usedQty: 2, returnQty: 1, returnableQty: 1 },
    ],
  },
  {
    id: 's4',
    applyNo: 'HL20260812110001',
    type: 'in',
    typeText: '还料申请',
    orderNo: 'GZ202608111400',
    customerName: '南京金陵大厦物业',
    status: 'done', // 已入库
    statusText: '已入库',
    useTime: '2026-08-11',
    applyTime: '2026-08-12 11:00',
    remark: '',
    items: [
      { name: '网线 超五类', spec: '305米/箱', applyQty: 2, outQty: 2, usedQty: 1, returnQty: 1, returnableQty: 1 },
    ],
  },
]

export default [
  {
    url: `${proxyPrefix}/stock/applyList`,
    method: 'get',
    response: ({ query }: any) => {
      const type = query?.type || 'out'
      return ok(applyList.filter((a) => a.type === type))
    },
  },
  {
    url: `${proxyPrefix}/stock/applyDetail`,
    method: 'get',
    response: ({ query }: any) => {
      return ok(applyList.find((a) => a.id === query?.id) || applyList[0])
    },
  },
  { url: `${proxyPrefix}/stock/apply/execute`, method: 'post', response: () => ok('success') },
]
