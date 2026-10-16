import { quotationLineTotal } from '@/service/quotationApproval'

export function quotationDocumentAmount(row: any) {
  return Object.prototype.hasOwnProperty.call(row, 'documentAmount')
    ? quotationLineTotal(row.documentAmount, 1)
    : quotationLineTotal(row.finalPrice, row.quantity)
}

/** 与导出一致，先按行四舍五入到分再求和；任一缺失价格不显示不完整合计。 */
export function quotationDocumentTotal(rows: any[]) {
  if (!rows.length) return '—'
  let sum = '0'
  for (const row of rows) {
    const amount = quotationDocumentAmount(row)
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
