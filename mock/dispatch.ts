// mock/dispatch.ts —— 信息部门（派单）
import { ok, proxyPrefix } from './_data'

const dispatchList = [
  {
    id: 'd1',
    repairNo: 'BX202608160934',
    customerName: '上海首汇信息科技有限公司',
    faultTypeText: '网络故障',
    faultDesc: '核心交换机 2 口掉线，办公区部分电脑无法上网。',
    createTime: '2026-08-16 09:20',
    status: 'unassigned',
    statusText: '待派单',
    assignee: '',
  },
  {
    id: 'd2',
    repairNo: 'BX202608160922',
    customerName: '南京金陵大厦物业',
    faultTypeText: '硬件故障',
    faultDesc: '地下车库 3 个摄像头画面黑屏。',
    createTime: '2026-08-16 09:22',
    status: 'assigned',
    statusText: '已派单',
    assignee: '李伟',
  },
  {
    id: 'd3',
    repairNo: 'BX202608151012',
    customerName: '杭州云栖数据有限公司',
    faultTypeText: '硬件故障',
    faultDesc: '3 楼门禁无法刷卡开门。',
    createTime: '2026-08-15 10:12',
    status: 'rejected',
    statusText: '已驳回',
    rejectReason: '报修信息不完整，请补充项目信息。',
  },
]

export default [
  {
    url: `${proxyPrefix}/dispatch/list`,
    method: 'get',
    response: () => ok(dispatchList),
  },
  {
    url: `${proxyPrefix}/dispatch/detail`,
    method: 'get',
    response: ({ query }: any) => {
      const d = dispatchList.find((x) => x.id === query?.id) || dispatchList[0]
      return ok({
        ...d,
        timeline: [
          { title: '发起报修', desc: d.faultDesc, time: d.createTime },
          { title: d.status === 'rejected' ? '信息部门驳回' : '信息部门派单', desc: d.rejectReason || d.assignee, time: '2026-08-16 09:40' },
        ],
      })
    },
  },
  { url: `${proxyPrefix}/dispatch/assign`, method: 'post', response: () => ok('success') },
  { url: `${proxyPrefix}/dispatch/reject`, method: 'post', response: () => ok('success') },
]
