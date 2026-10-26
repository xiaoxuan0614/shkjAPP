import { http } from '@/utils/http'
import { readProjectMembership } from '@/service/projectMembership'
import { parseTodoActionParams, type TodoRecord } from '@/service/todo'

export const isMaterialApprovalTodo = (todo: TodoRecord) =>
  [todo.todoType, todo.actionKey].some(value =>
    ['PROJECT_MATERIAL_APPLY_APPROVAL', 'STOCK_OUT_APPROVAL', 'STOCK_IN_APPROVAL'].includes(String(value || '').trim().toUpperCase()))

export function materialApprovalId(todo: TodoRecord) {
  if (!isMaterialApprovalTodo(todo)) return ''
  return String(parseTodoActionParams(todo.actionParams).applyId || todo.bizId || '').trim()
}

export async function canApproveMaterial(record: any, user: any, hasPermission: (code: string) => boolean) {
  if (String(record?.status) !== '2' || !['IN', 'OUT'].includes(record?.applyType)) return false
  if (record.usageType === 'PROJECT') {
    return (await readProjectMembership(String(record.periodId || ''), String(user.userid || user.id || user.userId || ''))).manager
  }
  if (record.applyType === 'IN') return hasPermission('mtl:goods:io')
  if (!['MAINTENANCE', 'LABOR_PROTECTION'].includes(record.usageType)) return false
  // 维修用料按申请部门负责人办理，服务端最终鉴权；劳保保留菜单权限。
  if (record.usageType === 'LABOR_PROTECTION' && !hasPermission('mtl:apply:approve')) return false
  const ids = Array.isArray(user.departIds) ? user.departIds : String(user.departIds || '').split(',')
  return String(user.userIdentity) === '2' && !!record.deptId && ids.map(id => String(id).trim()).includes(String(record.deptId))
}

function checkResponse(response: any) {
  if (response?.success === false) throw new Error(response.message || '请求未成功，请重试')
  return response
}

export const materialApprovalApi = {
  detail: async (id: string) => {
    const response: any = checkResponse(await http.get('/stock/apply/queryById', { id }))
    const record = response?.result ?? response
    if (!record?.id || String(record.id) !== id || !['OUT', 'IN'].includes(record.applyType)) throw new Error('未找到对应物料申请，请刷新待办')
    return record
  },
  items: async (applyId: string, pageNo: number) => checkResponse(await http.get('/stock/apply/items', { applyId, pageNo, pageSize: 20 })),
  submit: (applyId: string, approvalResult: 'AGREE' | 'REJECT', approvalComment: string) => {
    if (!applyId || (approvalResult === 'REJECT' && !approvalComment.trim())) throw new Error('请填写驳回原因')
    return http.post('/stock/apply/approve', {
      applyId, approvalResult, ...(approvalComment.trim() ? { approvalComment: approvalComment.trim() } : {}),
    }).then(checkResponse)
  },
}
