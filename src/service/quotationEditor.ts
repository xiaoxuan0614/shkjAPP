import { http } from '@/utils/http'
import { quotationLineTotal, quotationVersion, unwrapQuotation } from './quotationApproval'

// Mirrors PC quotationDetailCapabilities: contract pricing grants do not grant quotation editing.
export function quotationCapabilities(record: any, access: any, user: any, has: (code: string) => boolean) {
  const status = String(record?.status ?? '-1')
  const applicant = !!record?.createBy && [user?.username, user?.id, user?.userId].filter(Boolean).map(String).includes(String(record.createBy))
  const manager = access?.canManage === true
  const content = manager || applicant
  const edit = has('plan:quotation:edit') && content && ['-1', '0', '1'].includes(status)
  return {
    edit, structure: edit && String(record.adopted) === '0', cost: edit && String(record.adopted) === '0',
    submit: has('plan:quotation:submit') && content && ['-1', '0'].includes(status),
    withdraw: has('plan:quotation:withdraw') && applicant && status === '2',
    void: has('plan:quotation:delete') && content && String(record.adopted) === '0' && ['-1', '0', '1'].includes(status),
    price: record?.approvalRoute !== 'MARKET' && has('plan:quotation:price') && manager && status === '1',
    grant: has('plan:quotation:grant') && manager && status === '1' && String(record.priced) === '1',
    export: has('plan:quotation:export') && (manager || access?.canExport === true) && status === '1' && String(record.priced) === '1',
  }
}

export function decimalInput(value: unknown, label: string, precision = 2, positive = false) {
  const raw = String(value ?? '').trim()
  if (!new RegExp(`^\\d+(?:\\.\\d{1,${precision}})?$`).test(raw)) throw new Error(`${label}须为有效数字，最多 ${precision} 位小数`)
  const number = Number(raw)
  if (!Number.isFinite(number) || number > 9999999999 || (positive && number <= 0)) throw new Error(`${label}${positive ? '须大于 0 且' : '须'}不超过 9999999999`)
  return number
}

// 与PC一致：成本20、加价25%得到指导价25；比例按百分数输入，不是毛利率。
export function guidancePrice(cost: unknown, percent: unknown) {
  decimalInput(cost, '成本价')
  const raw = String(percent ?? '').trim(), negative = raw.startsWith('-')
  decimalInput(negative ? raw.slice(1) : raw, '加价比例', 4)
  if (Number(raw) < -100) throw new Error('加价比例不能低于 -100%')
  const [whole, fraction = ''] = (negative ? raw.slice(1) : raw).split('.')
  const scaled = 1000000 + (negative ? -1 : 1) * (Number(whole) * 10000 + Number(fraction.padEnd(4, '0')))
  const digits = String(scaled).padStart(7, '0')
  const multiplier = `${digits.slice(0, -6)}.${digits.slice(-6)}`
  const amount = quotationLineTotal(cost, multiplier).replace('¥', '')
  decimalInput(amount, '指导价')
  return amount
}

export function materialPayload(row: any, options: { cost: boolean; price: boolean; direct: boolean }) {
  if (!row.materialId || !row.unitId) throw new Error(`${row.materialName || '物料'}缺少物料或单位，请重新选择`)
  const result: any = { ...(row.id ? { id: row.id } : {}), materialId: row.materialId, unitId: row.unitId,
    quantity: decimalInput(row.quantity, '物料数量', 4, true), remark: String(row.remark || '') }
  if (result.remark.length > 500) throw new Error('物料备注最多 500 字')
  if (options.cost) result.basePrice = decimalInput(row.basePrice, '成本价')
  if (options.price) {
    if (options.direct || row.finalPrice != null && row.finalPrice !== '') result.finalPrice = decimalInput(row.finalPrice, '报价')
  }
  return result
}

export function feePayload(row: any, options: { cost: boolean; price: boolean; structure: boolean; direct: boolean }) {
  const name = String(row.name || '').trim(), unit = String(row.unit || '').trim()
  if (!name || name.length > 100 || !unit || unit.length > 50) throw new Error('请填写服务费名称（100字内）和单位（50字内）')
  const result: any = { ...(row.id ? { id: row.id } : {}), ...(row.serviceFeeId ? { serviceFeeId: row.serviceFeeId } : {}), name, unit,
    quantity: decimalInput(row.quantity, '服务费数量', 4, true), description: String(row.description || ''), remark: String(row.remark || '') }
  if (result.description.length > 1000 || result.remark.length > 500) throw new Error('服务说明最多 1000 字、备注最多 500 字')
  if (row.taxRate != null && row.taxRate !== '') result.taxRate = decimalInput(row.taxRate, '税率', 6)
  if (options.cost) result.costPrice = decimalInput(row.costPrice, '服务费成本价')
  if (options.price || (!row.id && options.structure && row.serviceFeeId)) {
    const guide = row.guidePrice
    result.guidePrice = decimalInput(guide, '服务费报价')
  }
  return result
}

export function pricingPayload(materials: any[], fees: any[]) {
  const ids = new Set<string>()
  const identify = (row: any) => {
    if (!row.id || ids.has(String(row.id))) throw new Error('明细 ID 缺失或重复，请刷新')
    ids.add(String(row.id)); return row.id
  }
  return {
    records: materials.map(row => ({ id: identify(row), finalPrice: decimalInput(row.finalPrice, '指导价') })),
    serviceFees: fees.map(row => ({ id: identify(row), guidePrice: decimalInput(row.guidePrice, '服务费指导价') })),
  }
}

export function candidateAction(action: 'submit' | 'withdraw' | 'void' | 'price', record: any, fields: any = {}) {
  if (!record?.id) throw new Error('缺少报价主单')
  return http.post(`/project/materialCandidate/${action}`, { ...fields, candidateId: record.id, version: quotationVersion(record.version) }).then(unwrapQuotation)
}
