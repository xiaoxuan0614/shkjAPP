import { http } from '@/utils/http'

export function unwrapQuotation(response: any) {
  if (response?.success === false) throw new Error(response.message || '报价请求失败')
  return response?.result ?? response
}

export function quotationVersion(value: unknown) {
  if (!['number', 'string'].includes(typeof value) || String(value).trim() === '' || !Number.isSafeInteger(Number(value)) || Number(value) < 0)
    throw new Error('报价缺少有效版本号，请刷新后重试')
  return Number(value)
}

export function approvalItems(rows: any[], maxLength = 500) {
  const ids = new Set<string>()
  return rows.map(row => {
    const itemId = String(row.id ?? '').trim()
    if (!itemId || ids.has(itemId)) throw new Error('明细 ID 缺失或重复，请刷新后重试')
    ids.add(itemId)
    const approvalOpinion = row.approvalOpinion ?? ''
    if (typeof approvalOpinion !== 'string' || approvalOpinion.length > maxLength) throw new Error(`审批意见最多 ${maxLength} 字，请在详情中修改后提交`)
    return { itemId, approvalOpinion }
  })
}

// 完整加载后才允许整单审批，避免只提交当前页或遗漏服务费。
export async function quotationPages(url: string, params: Record<string, any>, requireFees = false, periodId?: string) {
  const rows: any[] = [], ids = new Set<string>()
  let candidate: any
  let serviceFees: any[] = []
  for (let pageNo = 1; ; pageNo++) {
    const data = unwrapQuotation(await http.get(url, { ...params, pageNo, pageSize: 100 }))
    if (periodId !== undefined) {
      const current = readQuotationCandidate(data, periodId, String(params.candidateId))
      if (candidate && quotationVersion(candidate.version) !== quotationVersion(current.version)) throw new Error('报价加载期间已变更，请重新加载')
      candidate = current
    }
    const batch = Array.isArray(data) ? data : data?.records
    if (!Array.isArray(batch)) throw new Error('报价分页数据异常，请重试')
    if (pageNo === 1 && requireFees) {
      if (!Array.isArray(data.serviceFees)) throw new Error('服务费数据缺失，暂不可审批，请确认后端已更新')
      serviceFees = data.serviceFees
      approvalItems(serviceFees)
    }
    for (const row of batch) {
      const id = String(row.id ?? '').trim()
      if (!id || ids.has(id)) throw new Error('报价分页 ID 缺失或重复，请刷新后重试')
      ids.add(id); rows.push(row)
    }
    if (Array.isArray(data)) break
    const total = data.total == null ? null : Number(data.total)
    if (total != null && (!Number.isSafeInteger(total) || total < 0)) throw new Error('报价分页总数异常')
    if (total != null && rows.length >= total) break
    if (!batch.length) {
      if (total != null && rows.length < total) throw new Error('报价明细未加载完整，请重试')
      break
    }
    if (total == null && batch.length < Number(data.size || 100)) break
  }
  return { rows, serviceFees, candidate }
}

export function readQuotationCandidate(data: any, periodId: string, candidateId: string) {
  const record = data?.candidate
  if (!record || String(record.id) !== candidateId || String(record.periodId) !== periodId) throw new Error('报价主单摘要缺失或不匹配，请刷新重试')
  quotationVersion(record.version)
  return { ...record, approvalRoute: record.approvalRoute ?? 'TECHNICAL' }
}

export async function getQuotationRecord(periodId: string, candidateId: string) {
  const data = unwrapQuotation(await http.get('/project/materialCandidateItem/list', { candidateId, pageNo: 1, pageSize: 1 }))
  return readQuotationCandidate(data, periodId, candidateId)
}

export async function getQuotationAccess(periodId: string, candidateId: string) {
  return unwrapQuotation(await http.get('/project/materialCandidate/permissions', { periodId, ...(candidateId ? { candidateId } : {}) }))
}

export function canApproveQuotation(record: any, access: any, hasPermission: (code: string) => boolean) {
  return String(record.status) === '2' && access?.canApprove === true &&
    ['MARKET', 'TECHNICAL'].includes(record.approvalRoute) &&
    hasPermission(record.approvalRoute === 'MARKET' ? 'plan:quotation:lock' : 'plan:quotation:technicalApprove')
}

export function quotationApprovalPayload(record: any, materials: any[], fees: any[], result: '0' | '1', reason: string) {
  if (!record.id || !materials.length) throw new Error('报价物料明细为空，暂不可审批')
  if (result === '0' && (!reason.trim() || reason.trim().length > 500)) throw new Error('请填写 1～500 字驳回原因')
  return { candidateId: record.id, version: quotationVersion(record.version), result,
    approvalItems: approvalItems(materials, 100), serviceFeeApprovalItems: approvalItems(fees, 100),
    ...(result === '0' ? { reason: reason.trim() } : {}) }
}

// 十进制字符串乘法，金额四舍五入到分，避免浮点乘法误差；不把缺失价格视为 0。
export function quotationLineTotal(price: unknown, quantity: unknown) {
  const values = [price, quantity].map(value => String(value ?? '').trim())
  if (values.some(value => !/^\d{1,20}(\.\d{1,10})?$/.test(value))) return '—'
  const scale = values.reduce((sum, value) => sum + (value.split('.')[1]?.length || 0), 0)
  const [a, b] = values.map(value => value.replace('.', ''))
  const digits = Array(a.length + b.length).fill(0)
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) digits[i + j + 1] += Number(a[i]) * Number(b[j])
  for (let i = digits.length - 1; i > 0; i--) { digits[i - 1] += Math.floor(digits[i] / 10); digits[i] %= 10 }
  let product = digits.join('').replace(/^0+(?=\d)/, '').padStart(scale + 1, '0')
  if (scale <= 2) product += '0'.repeat(2 - scale)
  else {
    const round = Number(product[product.length - scale + 2]) >= 5
    product = product.slice(0, product.length - scale + 2)
    if (round) {
      const cents = product.split('').map(Number)
      let carry = 1
      for (let i = cents.length - 1; i >= 0 && carry; i--) { const n = cents[i] + carry; cents[i] = n % 10; carry = Math.floor(n / 10) }
      product = (carry ? '1' : '') + cents.join('')
    }
  }
  product = product.replace(/^0+(?=\d)/, '').padStart(3, '0')
  return `¥${product.slice(0, -2)}.${product.slice(-2)}`
}

export async function getQuotationMaterial(id: string) {
  if (!id) throw new Error('当前明细缺少物料 ID，无法查询基础信息')
  const detail = unwrapQuotation(await http.get('/stock/material/queryById', { id }))
  if (String(detail?.id || '') !== id) throw new Error('物料详情不匹配，请重试')
  const resolved = { ...detail }
  await Promise.all([['materialCategory', 'material_category'], ['brand', 'material_brand']].map(async ([field, code]) => {
    if (resolved[`${field}_dictText`] || resolved[field] == null) return
    try {
      const options = unwrapQuotation(await http.get(`/sys/dict/getDictItems/${code}`))
      const match = Array.isArray(options) ? options.find(option => String(option.value) === String(resolved[field])) : null
      if (match) resolved[`${field}_dictText`] = match.text || match.label
    } catch { /* 字典失败保留接口原值，不阻断物料信息。 */ }
  }))
  return resolved
}
