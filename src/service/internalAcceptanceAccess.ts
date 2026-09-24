import { http } from '@/utils/http'

// 与 PC 一致：只认负责部门，不以所属运维部作为主管资格。
export function isOperationsDirector(departmentIds: string[], tree: any[]): boolean {
  const matches: any[] = []
  const visit = (rows: any[]) => rows.forEach((row) => {
    if (String(row.departName || row.title || '').trim() === '运维部' &&
      (row.delFlag == null || String(row.delFlag) === '0')) matches.push(row)
    if (Array.isArray(row.children)) visit(row.children)
  })
  visit(tree)
  if (matches.length !== 1) return false
  const id = String(matches[0].id || matches[0].key || '')
  return !!id && departmentIds.includes(id)
}

export async function readInternalAcceptanceAccess(identity: {
  userId: string; responsibleDepartmentIds?: string[]; roleCodes?: string[]
}): Promise<boolean> {
  if (!identity.userId) return false
  if (identity.roleCodes?.some((code) => code === 'admin' || code === 'operations_manager')) return true
  if (!identity.responsibleDepartmentIds?.length) return false
  const response: any = await http.get('/sys/sysDepart/queryTreeList')
  if (response?.success !== true || !Array.isArray(response.result)) throw new Error('内部验收主管资格查询失败')
  return isOperationsDirector(identity.responsibleDepartmentIds, response.result)
}
