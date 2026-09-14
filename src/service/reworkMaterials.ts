import { http } from '@/utils/http'
import { projectApi, stockApi, unwrapRecords } from '@/service/shkj'

export async function validateRework(periodId: string, reworkId: string) {
  const [project, response]: any[] = await Promise.all([
    projectApi.detail(periodId), http.get('/project/rework/queryById', { id: reworkId }),
  ])
  const period = project?.result, rework = response?.result
  if (!period || String(period.currentReworkId || '') !== reworkId || String(period.periodStatus ?? period.status).toUpperCase() !== 'REWORKING' ||
    !rework || String(rework.periodId) !== periodId || String(rework.approvalStatus) !== '1' || String(rework.executionStatus).toUpperCase() !== 'IN_PROGRESS') {
    throw new Error('当前返工已不可领料，请返回项目详情刷新')
  }
}

export async function getReworkMaterials(periodId: string, reworkId: string) {
  await validateRework(periodId, reworkId)
  const response: any = await http.get('/project/rework/materials', { reworkId })
  if (!Array.isArray(response?.result)) throw new Error('返工用料数据异常，请重试')
  const rows = response.result.filter((row: any) => row.materialId && Number(row.availableApplyQty) > 0)
  const required = new Set(rows.map((row: any) => String(row.materialId)))
  const masters = new Map<string, any>()
  for (let pageNo = 1; required.size; pageNo++) {
    const result: any = await stockApi.materials({ pageNo, pageSize: 100 })
    const materials = unwrapRecords(result)
    for (const material of materials) if (required.has(String(material.id))) {
      masters.set(String(material.id), material); required.delete(String(material.id))
    }
    const total = result?.result?.total
    if (!materials.length || (total != null ? pageNo * 100 >= Number(total) : materials.length < 100)) break
  }
  return rows.map((row: any) => {
    const material = masters.get(String(row.materialId))
    const base = material?.unitList?.find((unit: any) => unit.isBaseUnit === true || String(unit.isBaseUnit) === '1')
    const unit = material?.baseUnitName || base?.unitName || material?.unit
    if (!material || !unit) throw new Error('返工物料缺少名称或基准单位，请核实物料资料')
    return { ...material, ...row, materialName: material.materialName || material.name, baseUnitName: unit }
  })
}
