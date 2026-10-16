/** PC 合同只读预览：仅消费 queryById 的 materialSnapshot，不补查当前报价。 */
export async function loadContractQuotation(contract: Record<string, any>) {
  const snapshot = contract.materialSnapshot
  const records = Array.isArray(snapshot?.records) ? snapshot.records : []
  const rows = records.filter((row: any) => row && typeof row === 'object' && !Array.isArray(row)).map((row: any, index: number) => ({
    rowKey: `material-${index}`,
    materialName: row.materialName, brand: row.brand, model: row.model,
    quantity: row.quantity, unit: row.unit, remark: row.remark,
  }))
  const fees = Array.isArray(snapshot?.serviceFees) ? snapshot.serviceFees : []
  rows.push(...fees.filter((row: any) => row && typeof row === 'object' && !Array.isArray(row)).map((row: any, index: number) => ({
    rowKey: `fee-${index}`, isFee: true, materialName: row.name, brand: '', model: '',
    quantity: row.quantity, unit: row.unit, remark: row.remark,
  })))
  return { title: '报价单物料及服务费清单', statusText: '合同快照', rows, showPrice: false,
    emptyText: !snapshot ? '暂无物料及服务费快照' : Array.isArray(snapshot.records) || Array.isArray(snapshot.serviceFees) ? '本轮未提交物料或服务费' : '快照未提供物料及服务费明细' }
}
