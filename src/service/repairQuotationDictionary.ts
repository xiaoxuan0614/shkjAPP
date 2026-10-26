import { http } from '@/utils/http'

export const REPAIR_QUOTATION_DICT = 'repair_quotation_status'
export async function loadRepairQuotationDictionary(): Promise<any[]> {
  const response: any = await http.get(`/sys/dict/getDictItems/${REPAIR_QUOTATION_DICT}`)
  if (response?.success === false) throw new Error('报价状态字典加载失败')
  const rows = Array.isArray(response) ? response : response?.result
  if (!Array.isArray(rows)) throw new Error('报价状态字典格式错误')
  return rows
}
export function repairQuotationText(value: unknown, options: any[]): string {
  if (value == null || value === '') return '—'
  const item = options.find(row => String(row.value) === String(value))
  return item?.text ?? item?.label ?? String(value)
}
