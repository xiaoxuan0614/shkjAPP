import { decimalInput } from '@/service/quotationEditor'
import { quotationLineTotal } from '@/service/quotationApproval'

export const PURCHASE_APPLICATION_PATH = '/pages/stock/purchaseApply'
/** PC 采购总额先汇总未舍入乘积，再统一保留两位；不要复用报价的逐行舍入合计。 */
export function purchaseTotal(rows: any[]) {
  let sum = 0
  for (const row of rows) {
    const quantity = Number(decimalInput(row.quantity, '采购数量', 2, true))
    const price = Number(decimalInput(row.unitPrice, '采购单价', 2))
    const product = Math.round(quantity * 100) * Math.round(price * 100)
    if (!Number.isSafeInteger(product) || !Number.isSafeInteger(sum + product + 50)) throw new Error('采购总价过大')
    sum += product
  }
  return (Math.floor((sum + 50) / 100) / 100).toFixed(2)
}
export function purchaseItem(row: any) {
  if (!row.materialId) throw new Error('请选择物料')
  const quantity = decimalInput(row.quantity, '采购数量', 2, true)
  const unitPrice = decimalInput(row.unitPrice, '采购单价', 2)
  if (!String(row.unit || '').trim()) throw new Error('请选择采购单位')
  const amount = Number(quotationLineTotal(unitPrice, quantity).replace('¥', ''))
  if (!Number.isSafeInteger(Math.round(amount * 100))) throw new Error('采购金额过大')
  return { materialId: row.materialId, materialName: row.materialName, materialCategory: row.materialCategory,
    brand: row.brand, model: row.model, unit: row.unit, quantity: Number(quantity), unitPrice: Number(unitPrice), amount }
}
export function purchasePayload(form: any, rows: any[], types: any[]) {
  if (!types.some(type => String(type.value) === String(form.purchaseType))) throw new Error('请选择采购类型')
  if (!form.supplierId || !form.supplierName) throw new Error('请选择供应商')
  if (String(form.purchaseType) === '1' && (!form.periodId || !form.projectId)) throw new Error('请选择关联项目')
  if (!rows.length) throw new Error('请添加采购物料')
  if (new Set(rows.map(row => String(row.materialId))).size !== rows.length) throw new Error('采购物料不能重复')
  const itemList = rows.map(purchaseItem)
  const totalAmount = Number(purchaseTotal(itemList))
  if (!Number.isSafeInteger(Math.round(totalAmount * 100))) throw new Error('采购总价过大')
  return { purchaseType: String(form.purchaseType), supplierId: form.supplierId, supplierName: form.supplierName,
    ...(String(form.purchaseType) === '1' ? { projectId: form.projectId, periodId: form.periodId, projectName: form.projectName } : {}),
    ...(form.orderDate ? { orderDate: form.orderDate } : {}),
    ...(form.expectedArrivalDate ? { expectedArrivalDate: form.expectedArrivalDate } : {}),
    remark: String(form.remark || '').trim(), status: '1', totalAmount, itemList }
}
