import { http } from '@/utils/http'

/** Same instance contracts as the PC drawer. Keep transport errors visible in the popup. */
export async function approvalRequest(path: string, query: Record<string, any>, post = false): Promise<any> {
  try {
    const response: any = await http({ url: path, method: post ? 'POST' : 'GET', ...(post ? { data: query } : { query }), hideErrorToast: true })
    if (response?.success !== true || Number(response.code) !== 200 || (!post && response.result == null))
      throw Object.assign(new Error(response?.message || '审批接口未返回有效结果'), { definite: response?.success === false })
    return response.result
  } catch (e: any) {
    throw Object.assign(new Error(e?.data?.message || e?.data?.msg || e?.message || (e?.statusCode ? `审批接口请求失败（HTTP ${e.statusCode}），请重新读取` : '审批服务暂时无法连接，请重新读取')), { definite: e?.definite === true || e?.success === false || e?.data?.success === false })
  }
}

export function validateRepairInstance(instance: any, id: string, context: Record<string, any> = {}) {
  if (!instance || String(instance.id) !== id || instance.businessType !== 'REPAIR_OPS_APPLICATION') throw new Error('维修审批实例不匹配，请刷新待办')
  if (typeof instance.snapshot === 'string') {
    try { instance.snapshot = JSON.parse(instance.snapshot) } catch { throw new Error('审批内容格式无效') }
  }
  if (context.orderId && String(instance.snapshot?.orderId) !== String(context.orderId)) throw new Error('待办维修单与审批实例不匹配')
  if (context.applicationId && String(instance.businessId) !== String(context.applicationId)) throw new Error('待办申请与审批实例不匹配')
  return instance
}

export function approvalButtons(instance: any, actions: any, taskId: string): string[] {
  const task = instance?.tasks?.find((t: any) => String(t.id) === taskId)
  const allowed = actions?.tasks?.find((t: any) => String(t.taskId) === taskId)
  if (!task?.canHandle || task.kind === 'WORK') return []
  return ['APPROVE', 'REJECT'].filter(action => allowed?.actions?.includes(action) && !allowed.disabledActions?.[action])
}

export function snapshotField(value: any, path: string): any {
  if (!path) return value
  if (value && Object.prototype.hasOwnProperty.call(value, path)) return value[path]
  const [first, ...rest] = path.split('.')
  if (first.endsWith('[]')) {
    const rows = value?.[first.slice(0, -2)]
    return Array.isArray(rows) ? rows.map(row => snapshotField(row, rest.join('.'))) : undefined
  }
  let next = value?.[first]
  if (typeof next === 'string' && /^[\[{]/.test(next.trim())) { try { next = JSON.parse(next) } catch { /* plain text */ } }
  return rest.length ? snapshotField(next, rest.join('.')) : next
}

const labels: Record<string, string> = { departmentName: '部门', reason: '申请原因', unitName: '外协单位', personCount: '人数', estimatedTotalHours: '预计工时', targetUserName: '接收人', closeType: '关闭原因', description: '说明', remark: '备注', personType: '协助类型', departments: '受邀部门', name: '名称', amount: '金额', finalAmount: '最终维修价' }
const values: Record<string, string> = { INTERNAL: '内部协助', EXTERNAL: '外部协助', CUSTOMER_ABANDONED: '客户弃修', NOT_A_PROBLEM: '非故障', OTHER: '其他' }
/** Flatten only schema-authorized fields; nested HIDDEN fields must never leak through parent objects. */
export function approvalRows(instance: any, schema: any): { label: string; value: string }[] {
  const permissions = schema.fieldPermissions || {}
  const hidden = (path: string) => Object.entries(permissions).some(([key, permission]) => permission === 'HIDDEN' && (path.replace(/\[\]/g, '') === key.replace(/\[\]/g, '') || path.replace(/\[\]/g, '').startsWith(key.replace(/\[\]/g, '') + '.')))
  const rows: { label: string; value: string }[] = []
  function add(value: any, path: string, label: string) {
    if (hidden(path) || value == null || value === '') return
    if (Array.isArray(value)) { value.forEach((v, i) => add(v, path + '[]', `${label} ${i + 1}`)); return }
    if (typeof value === 'object') {
      Object.entries(value).forEach(([key, v]) => {
        if (/Id$|Ids$/.test(key)) return
        add(v, `${path}.${key}`, `${label} · ${labels[key] || key}`)
      }); return
    }
    rows.push({ label, value: typeof value === 'boolean' ? (value ? '是' : '否') : values[String(value)] || String(value) })
  }
  const definitions:Record<string,[string,string][]>={
    repair_ops_close:[['form.closeType','关闭原因'],['form.reason','关闭说明']],
    repair_ops_external:[['form.unitName','外协单位'],['form.personCount','申请人数'],['form.estimatedTotalHours','预计总工时（h）'],['form.reason','协助原因']],
    repair_ops_transfer:[['form.targetUserName','接收人'],['form.reason','转单原因']],
  }
  const fields=schema.fields || []
  if(definitions[instance.processKey]) {
    for(const [path,label] of definitions[instance.processKey]) {
      if(fields.some((f:any)=>path===f.key || path.startsWith(f.key+'.')))add(snapshotField(instance.snapshot,path),path,label)
    }
    return rows
  }
  if(instance.processKey==='repair_ops_collaboration') {
    const departmentField=fields.find((f:any)=>f.key.endsWith('departments'))
    if(departmentField)add(snapshotField(instance.snapshot,departmentField.key),departmentField.key,'受邀部门')
    else {
      const formField=fields.find((f:any)=>['formData','form'].includes(f.key))
      if(formField)add(snapshotField(instance.snapshot,formField.key+'.departments'),formField.key+'.departments','受邀部门')
    }
    return rows
  }
  for (const field of fields) {
    if (/Id$|Ids$/.test(field.key) || field.key === 'applicationType') continue
    add(snapshotField(instance.snapshot, field.key), field.key, field.name || labels[field.key] || field.key)
  }
  return rows
}
