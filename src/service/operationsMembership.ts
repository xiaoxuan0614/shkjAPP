import { http } from '@/utils/http'

// 使用真实所属部门，不使用负责部门、主管角色或管理员身份。
export function isOperationsMember(memberships: any[], tree: any[]): boolean {
  const nodes: any[] = []
  const visit = (rows: any[]) => rows.forEach(row => {
    nodes.push(row)
    if (Array.isArray(row.children)) visit(row.children)
  })
  visit(tree)
  const matches = nodes.filter(row => String(row.departName || row.title || '').trim() === '运维部')
  if (matches.length !== 1) return false
  const department = matches[0]
  if (String(department.delFlag) !== '0' || (department.status != null && String(department.status) !== '1')) return false
  const id = String(department.id || department.key || '')
  return !!id && memberships.some(row => String(row.key || row.id || row.value || '') === id)
}

export async function readOperationsMembership(userId: string): Promise<boolean> {
  if (!userId) return false
  const [membership, tree]: any[] = await Promise.all([
    http.get('/sys/user/userDepartList', { userId }),
    http.get('/sys/sysDepart/queryTreeList'),
  ])
  if (membership?.success !== true || tree?.success !== true || !Array.isArray(membership.result) || !Array.isArray(tree.result)) throw new Error('所属部门查询失败')
  return isOperationsMember(membership.result, tree.result)
}
