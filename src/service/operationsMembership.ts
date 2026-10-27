import { http } from '@/utils/http'

/** 转单候选按实际所属部门查询，不以运维角色替代部门。 */
export async function readOperationsUsers(): Promise<{value:string;label:string}[]> {
  const tree: any = await http.get('/sys/sysDepart/queryTreeList')
  if (tree?.success !== true || !Array.isArray(tree.result)) throw new Error('运维部查询失败')
  const ids = new Set<string>()
  const visit = (rows:any[]) => rows.forEach(row => {
    if (row.delFlag != null && String(row.delFlag) !== '0') return
    if (row.status != null && String(row.status) !== '1') return
    if (String(row.departName || row.title || '').trim() === '运维部' && (row.id || row.key)) ids.add(String(row.id || row.key))
    if (Array.isArray(row.children)) visit(row.children)
  })
  visit(tree.result)
  if (ids.size !== 1) throw new Error(ids.size ? '存在多个运维部，请联系管理员确认部门配置' : '未找到有效运维部，请联系管理员配置')
  const departId = [...ids][0], users = new Map<string,{value:string;label:string}>()
  for (let pageNo = 1; ; pageNo++) {
    const response:any = await http.get('/sys/user/list', {departId,pageNo,pageSize:100})
    const page = response?.result
    if (response?.success !== true || !Array.isArray(page?.records) || !Number.isFinite(Number(page.total)) || Number(page.total) < 0) throw new Error('运维部人员查询失败')
    for (const user of page.records) {
      if (!user.id || (user.delFlag != null && String(user.delFlag) !== '0') || (user.status != null && String(user.status) !== '1')) continue
      users.set(String(user.id),{value:String(user.id),label:user.realname || user.username || '未命名人员'})
    }
    if (pageNo * 100 >= Number(page.total)) break
    if (!page.records.length || pageNo >= 1000) throw new Error('运维部人员分页返回不完整，请重新加载')
  }
  return [...users.values()]
}

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
