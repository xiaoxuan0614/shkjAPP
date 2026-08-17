// mock/inspection.ts —— 巡检域（任务列表 / 巡检表 / 办结）
import { ok, proxyPrefix } from './_data'

const inspections = [
  {
    id: 'ip1',
    xjNo: 'XJ001',
    name: '机房巡检',
    taskTime: '2026-08-18 09:00',
    persons: ['张三', '王强'],
    devices: ['机房空调', 'UPS', '核心交换机', '配电柜'],
    status: 'undone',
    statusText: '未办结',
    finishedCount: 3,
    abnormalCount: 1,
    objectCount: 4,
  },
  {
    id: 'ip2',
    xjNo: 'XJ002',
    name: '弱电间巡检',
    taskTime: '2026-08-10 14:00',
    persons: ['李伟'],
    devices: ['弱电间A', '弱电间B'],
    status: 'done',
    statusText: '已办结',
    finishedCount: 2,
    abnormalCount: 0,
    objectCount: 2,
    finishRemark: '巡检无异常。',
    finishTime: '2026-08-10 16:00',
  },
]

// 巡检表：左侧巡检对象 + 右侧检查项（value 为空 = 未完成，显示红点）
const inspectionForm = [
  {
    id: 'obj1',
    name: '机房空调',
    items: [
      { id: 'i1', label: '温度是否正常', type: 'normal', value: 'normal' },
      { id: 'i2', label: '滤网是否清洁', type: 'normal', value: 'abnormal', photo: 'https://picsum.photos/seed/insp1/400/300' },
    ],
  },
  {
    id: 'obj2',
    name: 'UPS 电源',
    items: [
      { id: 'i3', label: '电池电压', type: 'normal', value: '' },
      { id: 'i4', label: '告警状态', type: 'normal', value: '' },
    ],
  },
  {
    id: 'obj3',
    name: '核心交换机',
    items: [
      { id: 'i5', label: '设备运行灯', type: 'normal', value: '' },
      { id: 'i6', label: '风扇运转', type: 'normal', value: '' },
    ],
  },
  {
    id: 'obj4',
    name: '配电柜',
    items: [
      { id: 'i7', label: '空开状态', type: 'normal', value: '' },
      { id: 'i8', label: '温度', type: 'normal', value: '' },
    ],
  },
]

export default [
  { url: `${proxyPrefix}/inspection/list`, method: 'get', response: () => ok(inspections) },
  {
    url: `${proxyPrefix}/inspection/detail`,
    method: 'get',
    response: ({ query }: any) => {
      const t = inspections.find((x) => x.id === query?.id) || inspections[0]
      return ok({ ...t, form: inspectionForm })
    },
  },
  { url: `${proxyPrefix}/inspection/saveItem`, method: 'post', response: () => ok('success') },
  { url: `${proxyPrefix}/inspection/finish`, method: 'post', response: () => ok('success') },
]
