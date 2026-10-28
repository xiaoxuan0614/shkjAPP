import { quotationLineTotal } from '@/service/quotationApproval'

export type QuotationDocumentBasis = 'cost' | 'quote'
export function quotationDocumentBasis(cost: boolean, quote: boolean, requested: QuotationDocumentBasis): QuotationDocumentBasis | null {
  if (requested === 'cost' && cost) return 'cost'
  return quote ? 'quote' : cost ? 'cost' : null
}

export function quotationDocumentAmount(row: any, basis: QuotationDocumentBasis = 'quote') {
  // 服务费在详情 rows 中已将 costPrice 映射为 basePrice；成本不读取报价快照金额。
  if (basis === 'cost') return quotationLineTotal(row.basePrice, row.quantity)
  return Object.prototype.hasOwnProperty.call(row, 'documentAmount')
    ? quotationLineTotal(row.documentAmount, 1)
    : quotationLineTotal(row.finalPrice, row.quantity)
}

/** 与导出一致，先按行四舍五入到分再求和；任一缺失价格不显示不完整合计。 */
export function quotationDocumentTotal(rows: any[], basis: QuotationDocumentBasis = 'quote') {
  if (!rows.length) return '—'
  let sum = '0'
  for (const row of rows) {
    const amount = quotationDocumentAmount(row, basis)
    if (amount === '—') return '—'
    const cents = amount.replace(/[¥.]/g, '')
    const width = Math.max(sum.length, cents.length)
    const a = sum.padStart(width, '0'), b = cents.padStart(width, '0')
    let result = '', carry = 0
    for (let i = width - 1; i >= 0; i--) { const n = Number(a[i]) + Number(b[i]) + carry; result = String(n % 10) + result; carry = Math.floor(n / 10) }
    sum = (carry ? '1' : '') + result
  }
  sum = sum.replace(/^0+(?=\d)/, '').padStart(3, '0')
  return sum.slice(0, -2) + '.' + sum.slice(-2)
}
