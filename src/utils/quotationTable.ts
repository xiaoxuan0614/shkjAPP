import { quotationLineTotal } from '@/service/quotationApproval'

export function quotationDisplayColumns(record: any, access: any, personnelRoute = '') {
  // 与 PC editor.directEntry 一致：市场人员查看待审批历史单仍用直接报价列，不改审批线路。
  const direct = record.approvalRoute === 'MARKET' || (personnelRoute === 'MARKET' && ['-1', '0', '2'].includes(String(record.status)))
  const cost = access.canManage === true || access.canViewCost === true
  const quote = access.canManage === true || access.canViewQuote === true
  const rate = access.canManage === true
  return [
    { key: 'unit', title: '单位', kind: 'unit' },
    { key: 'quantity', title: '数量', kind: 'number' },
    ...(cost ? [{ key: 'basePrice', title: '成本单价', kind: 'price' }, { key: 'costTotal', title: '成本总价', kind: 'price' }] : []),
    ...(!direct && rate ? [{ key: 'markupRate', title: '加价比例（%）', kind: 'price' }] : []),
    ...(quote ? [{ key: 'finalPrice', title: direct ? '报价单价' : '指导价', kind: 'price' }] : []),
    ...(direct && quote && rate ? [{ key: 'quotationPercent', title: '报价比例', kind: 'price' }] : []),
    ...(quote && (direct || String(record.status) === '1') ? [{ key: 'guideTotal', title: direct ? '报价总价' : '指导总价', kind: 'price' }] : []),
    { key: 'remark', title: '备注', kind: 'opinion' },
    ...(String(record.status ?? '-1') !== '-1' ? [{ key: 'approvalOpinion', title: '审批意见', kind: 'opinion' }] : []),
  ]
}

export function quotationIdentity(item: any, brands: Record<string, string> = {}) {
  const name = String(item.materialName || item.name || (item.isFee ? '未命名服务费' : '未命名物料')).trim()
  const brand = item.isFee ? '' : String(item.brand_dictText || brands[String(item.brand ?? '').trim()] || item.brand || '').trim()
  return brand && !name.endsWith(`（${brand}）`) && !name.endsWith(`(${brand})`) ? `${name}（${brand}）` : name
}

export function quotationModelPreview(value: unknown) {
  const chars = Array.from(String(value ?? '').trim())
  return chars.length ? chars.slice(0, 10).join('') + (chars.length > 10 ? '...' : '') : '暂无型号'
}

export function quotationPercent(cost: unknown, price: unknown) {
  // 按分进行长除法，最后一位四舍五入，避免浮点在百分数边界上多舍/少舍一分。
  const cents = (value: unknown) => {
    const text = String(value ?? '').trim()
    if (!/^\d{1,10}(\.\d{1,2})?$/.test(text)) return null
    const [integer, fraction = ''] = text.split('.')
    return Number(integer) * 100 + Number(fraction.padEnd(2, '0'))
  }
  const base = cents(cost), final = cents(price)
  if (base == null || final == null) return '—'
  if (base === 0) return '0.00%'
  const difference = final - base, magnitude = Math.abs(difference)
  let remainder = magnitude % base
  let decimals = ''
  for (let i = 0; i < 5; i++) { remainder *= 10; decimals += Math.floor(remainder / base); remainder %= base }
  let digits = (String(Math.floor(magnitude / base)) + decimals.slice(0, 4)).split('').map(Number)
  if (Number(decimals[4]) >= 5) {
    let carry = 1
    for (let i = digits.length - 1; i >= 0 && carry; i--) { const n = digits[i] + carry; digits[i] = n % 10; carry = Math.floor(n / 10) }
    if (carry) digits.unshift(1)
  }
  const value = digits.join('').replace(/^0+(?=\d)/, '').padStart(3, '0')
  return `${difference < 0 && /[1-9]/.test(value) ? '-' : ''}${value.slice(0, -2)}.${value.slice(-2)}%`
}

export function quotationCell(item: any, key: string) {
  if (key === 'costTotal') return quotationLineTotal(item.basePrice, item.quantity)
  if (key === 'guideTotal') return quotationLineTotal(item.finalPrice, item.quantity)
  if (key === 'quotationPercent' || key === 'markupRate') return quotationPercent(item.basePrice, item.finalPrice)
  const value = item[key]
  if (value == null || value === '') return '—'
  if (key === 'basePrice' || key === 'finalPrice') return Number.isFinite(Number(value)) ? `¥${Number(value).toFixed(2)}` : '—'
  return String(value)
}

export function quotationPersonnelRoute(ids: unknown, tree: any[]) {
  const departments = (Array.isArray(ids) ? ids : String(ids || '').split(',')).map(id => String(id).trim())
  const rows: any[] = []
  const visit = (nodes: any[]) => nodes.forEach(node => { rows.push(node); if (Array.isArray(node.children)) visit(node.children) })
  visit(tree)
  const member = (name: string) => {
    const matches = rows.filter(row => String(row.departName ?? row.title ?? '').trim() === name && String(row.delFlag ?? '0') === '0' && (row.status == null || String(row.status) === '1'))
    return matches.length === 1 && departments.includes(String(matches[0].id))
  }
  return member('技术部') ? 'TECHNICAL' : member('市场部') ? 'MARKET' : ''
}
