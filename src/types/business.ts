// 业务字典：状态/类型的前端映射；已接字典接口的页面以接口回显为准。
export interface DictItem {
  value: string
  label: string
  color?: string
}

export const MATERIAL_USAGE_TYPE: DictItem[] = [
  { value: 'PROJECT', label: '项目用料' },
  { value: 'MAINTENANCE', label: '维修用料' },
  { value: 'LABOR_PROTECTION', label: '劳保用品领取' },
]

export const getMaterialUsageTypeText = (value?: string) =>
  MATERIAL_USAGE_TYPE.find((item) => item.value === value)?.label || value || '—'

export const REPAIR_STATUS: DictItem[] = [
  { value: 'pending', label: '未开始', color: '#909399' },
  { value: 'processing', label: '进行中', color: '#409eff' },
  { value: 'confirming', label: '待确认', color: '#e6a23c' },
  { value: 'done', label: '已完成', color: '#67c23a' },
  { value: 'withdrawn', label: '已撤回', color: '#909399' },
  { value: 'rejected', label: '已驳回', color: '#f56c6c' },
]

export const WORK_ORDER_STATUS: DictItem[] = [
  { value: 'notStart', label: '未开始', color: '#909399' },
  { value: 'processing', label: '进行中', color: '#409eff' },
  { value: 'pendingAudit', label: '待审批', color: '#e6a23c' },
  { value: 'pendingConfirm', label: '待确认', color: '#e6a23c' },
  { value: 'pendingEvaluate', label: '待评价', color: '#e6a23c' },
  { value: 'finished', label: '已完结', color: '#67c23a' },
  { value: 'closed', label: '已关闭', color: '#909399' },
]

export const PROJECT_STATUS: DictItem[] = [
  { value: 'notStart', label: '未开始', color: '#909399' },
  { value: 'preparing', label: '筹备中', color: '#409eff' },
  { value: 'implementing', label: '实施中', color: '#e6a23c' },
  { value: 'accepting', label: '待验收', color: '#e6a23c' },
  { value: 'warranty', label: '质保中', color: '#67c23a' },
  { value: 'finished', label: '已完成', color: '#67c23a' },
  { value: 'closed', label: '已关闭', color: '#909399' },
]

export const MAINTENANCE_NATURE: DictItem[] = [
  { value: 'full', label: '全包' },
  { value: 'half', label: '半包' },
  { value: 'warranty', label: '质保' },
  { value: 'nonWarranty', label: '非质保' },
]

export const MAINTENANCE_TYPE: DictItem[] = [
  { value: 'offline', label: '线下预约' },
  { value: 'online', label: '线上维修' },
]

// 接单时选择的维修类型（线下预约 / 线上维修）
export const REPAIR_TYPE: DictItem[] = MAINTENANCE_TYPE

export const FAULT_TYPE: DictItem[] = [
  { value: 'hardware', label: '硬件故障' },
  { value: 'software', label: '软件故障' },
  { value: 'network', label: '网络故障' },
  { value: 'clean', label: '设备清洁' },
  { value: 'maintain', label: '定期保养' },
  { value: 'other', label: '其他' },
]

export const ASSISTANT_TYPE: DictItem[] = [
  { value: 'inner', label: '内协' },
  { value: 'outer', label: '外协' },
]

export const VEHICLE_TYPE: DictItem[] = [
  { value: 'fuel', label: '加油' },
  { value: 'trip', label: '行车' },
  { value: 'maintain', label: '保养' },
  { value: 'log', label: '车辆日志' },
]
