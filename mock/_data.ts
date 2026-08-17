// mock/_data.ts —— 共享 mock 工具与数据（文件名以下划线开头，vite-plugin-mock 会忽略，不会当作 mock 接口）
// 响应格式与 jeecg 后端一致：{ code: 200, success: true, result }
import { readFileSync } from 'fs'
import path from 'path'
import { parse } from 'dotenv'

// 代理前缀跟随 env/.env 的 VITE_APP_PROXY_PREFIX，保证 mock 与 http 层发出去的路径一致
let proxyPrefix = '/shouhuiApi'
try {
  const envPath = path.resolve(__dirname, '../env/.env')
  const parsedEnv = parse(readFileSync(envPath, 'utf8'))
  proxyPrefix = parsedEnv.VITE_APP_PROXY_PREFIX || proxyPrefix
} catch (e) {
  // 读取失败时用上面的默认前缀
}
export { proxyPrefix }

export const ok = (result: any) => ({ code: 200, success: true, result, message: '操作成功' })
export const fail = (message = '请求失败') => ({ code: 500, success: false, result: null, message })

// ========== 字典 ==========
// 报修状态
export const REPAIR_STATUS = [
  { value: 'pending', label: '未开始', color: '#909399' },
  { value: 'processing', label: '进行中', color: '#409eff' },
  { value: 'confirming', label: '待确认', color: '#e6a23c' },
  { value: 'done', label: '已完成', color: '#67c23a' },
  { value: 'withdrawn', label: '已撤回', color: '#909399' },
  { value: 'rejected', label: '已驳回', color: '#f56c6c' },
]
// 工单状态
export const WORK_ORDER_STATUS = [
  { value: 'notStart', label: '未开始', color: '#909399' },
  { value: 'processing', label: '进行中', color: '#409eff' },
  { value: 'pendingAudit', label: '待审批', color: '#e6a23c' },
  { value: 'pendingConfirm', label: '待确认', color: '#e6a23c' },
  { value: 'pendingEvaluate', label: '待评价', color: '#e6a23c' },
  { value: 'finished', label: '已完结', color: '#67c23a' },
  { value: 'closed', label: '已关闭', color: '#909399' },
]
// 项目状态
export const PROJECT_STATUS = [
  { value: 'notStart', label: '未开始', color: '#909399' },
  { value: 'preparing', label: '筹备中', color: '#409eff' },
  { value: 'implementing', label: '实施中', color: '#e6a23c' },
  { value: 'accepting', label: '待验收', color: '#e6a23c' },
  { value: 'warranty', label: '质保中', color: '#67c23a' },
  { value: 'finished', label: '已完成', color: '#67c23a' },
  { value: 'closed', label: '已关闭', color: '#909399' },
]
export const MAINTENANCE_NATURE = [
  { value: 'full', label: '全包' },
  { value: 'half', label: '半包' },
  { value: 'warranty', label: '质保' },
  { value: 'nonWarranty', label: '非质保' },
]
export const REPAIR_TYPE = [
  { value: 'offline', label: '线下预约' },
  { value: 'online', label: '线上维修' },
]
export const FAULT_TYPE = [
  { value: 'hardware', label: '硬件故障' },
  { value: 'software', label: '软件故障' },
  { value: 'network', label: '网络故障' },
  { value: 'clean', label: '设备清洁' },
  { value: 'maintain', label: '定期保养' },
]

export const statusText = (dict: any[], value: string) => dict.find((d) => d.value === value)?.label ?? value
export const statusColor = (dict: any[], value: string) => dict.find((d) => d.value === value)?.color ?? '#909399'

// ========== 公共实体 ==========
export const CURRENT_USER = {
  id: 'u_ops_001',
  username: 'zhangsan',
  realname: '张三',
  avatar: '',
  phone: '13800138001',
  orgCodeTxt: '首汇科技/运维部',
  roleCode: 'ops',
  roleName: '运维人员',
  tenantId: 1,
}

export const CUSTOMERS = [
  { id: 'c1', name: '上海首汇信息科技有限公司', address: '上海市闵行区联航路1588号', contact: '王经理', phone: '13911112222', warrantyPeriod: '2024-01-01 至 2026-12-31', maintenanceNature: 'full' },
  { id: 'c2', name: '杭州云栖数据有限公司', address: '杭州市西湖区云栖小镇', contact: '李工', phone: '13822223333', warrantyPeriod: '2023-06-01 至 2026-05-31', maintenanceNature: 'half' },
  { id: 'c3', name: '苏州工业园区科技园', address: '苏州市工业园区星湖街328号', contact: '陈主管', phone: '13733334444', warrantyPeriod: '2025-01-01 至 2028-12-31', maintenanceNature: 'warranty' },
  { id: 'c4', name: '南京金陵大厦物业', address: '南京市鼓楼区中山北路45号', contact: '赵经理', phone: '13644445555', warrantyPeriod: '2022-03-01 至 2025-02-28', maintenanceNature: 'nonWarranty' },
]

export const REPAIRERS = [
  { id: 'r1', name: '李伟', phone: '13712345678' },
  { id: 'r2', name: '王强', phone: '13723456789' },
  { id: 'r3', name: '赵磊', phone: '13734567890' },
  { id: 'r4', name: '孙浩', phone: '13745678901' },
]

export const MATERIALS = [
  { id: 'm1', name: '交换机 S5735-L24P4XE-A', spec: '24口千兆', stock: 12, unit: '台', planQty: 2, outQty: 1 },
  { id: 'm2', name: '网线 超五类', spec: '305米/箱', stock: 8, unit: '箱', planQty: 3, outQty: 2 },
  { id: 'm3', name: '光纤收发器', spec: '千兆单模', stock: 25, unit: '对', planQty: 1, outQty: 0 },
  { id: 'm4', name: '电源模块', spec: '48V', stock: 6, unit: '个', planQty: 4, outQty: 4 },
  { id: 'm5', name: '门禁控制器', spec: '双门', stock: 3, unit: '台', planQty: 1, outQty: 0 },
  { id: 'm6', name: '摄像头 400W', spec: '枪机', stock: 15, unit: '台', planQty: 2, outQty: 1 },
]

export const VEHICLES = [
  { id: 'v1', plate: '沪A·8H213', model: '大众帕萨特', driver: '张三', mileage: 25680 },
  { id: 'v2', plate: '沪B·3K556', model: '别克GL8', driver: '李伟', mileage: 41200 },
]
