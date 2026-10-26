/** 完整加载后才回填，避免网络中断时误认为已经带入全部物料。 */
export async function loadPickAllAccounts(
  fetchPage: (params: { periodId: string; pageNo: number; pageSize: number }) => Promise<any>,
  periodId: string,
  isCurrent: () => boolean,
) {
  const rows: any[] = [], seen = new Set<string>()
  let expectedTotal: number | undefined
  for (let pageNo = 1; pageNo <= 1000; pageNo++) {
    if (!isCurrent()) throw new Error('项目已切换')
    const response = await fetchPage({ periodId, pageNo, pageSize: 200 })
    if (!isCurrent()) throw new Error('项目已切换')
    if (response?.success === false) throw new Error(response.message || '物料加载失败')
    const result = response?.result ?? response
    const records = Array.isArray(result) ? result : result?.records
    if (!Array.isArray(records)) throw new Error('可申请物料返回格式异常，请重试')
    const total = result?.total == null ? undefined : Number(result.total)
    if (total !== undefined && (!Number.isSafeInteger(total) || total < 0)) throw new Error('物料分页数量异常，请重试')
    if (expectedTotal !== undefined && total !== expectedTotal) throw new Error('项目物料已变化，请重新带入')
    expectedTotal = total
    for (const row of records) {
      const id = String(row?.materialId ?? '')
      if (!id || seen.has(id) || (row.periodId != null && String(row.periodId) !== periodId)) throw new Error('物料分页重复或项目数据已变化，请重试')
      seen.add(id); rows.push(row)
    }
    if (Array.isArray(result)) return rows
    if (total !== undefined) {
      if (rows.length === total) return rows
      if (rows.length > total || !records.length) throw new Error('物料分页不完整，请重新带入')
    } else if (records.length < 200) return rows
  }
  throw new Error('物料数量过多，请分批添加')
}

export function missingPickAccounts(accounts: any[], selected: any[]) {
  const selectedIds = new Set(selected.map(row => String(row.id)))
  return accounts.filter(row => !selectedIds.has(String(row.materialId)) && Number.isFinite(Number(row.availableApplyQty)) && Number(row.availableApplyQty) > 0)
    .map(row => {
      if (!String(row.baseUnitName || '').trim()) throw new Error(`「${row.materialName || '未命名物料'}」缺少基准单位，请先维护单位`)
      return row
    })
}
