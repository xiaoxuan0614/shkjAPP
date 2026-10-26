/** 本地选料搜索使用完整字典名称；普通项目的远程搜索不使用此过滤器。 */
export function materialBrandMap(response: any): Record<string, string> {
  const rows = response?.result ?? response
  if (response?.success === false || !Array.isArray(rows)) throw new Error('品牌字典加载失败')
  return Object.fromEntries(rows
    .filter(row => row?.value !== undefined && row?.value !== null)
    .map(row => [String(row.value), String(row.text ?? row.label ?? row.value)]))
}

export function filterMaterialSearch(rows: any[], keyword: string, brands: Record<string, string>) {
  const search = keyword.trim().toLowerCase()
  if (!search) return rows
  return rows.filter(material => [
    material.materialCode, material.code, material.name, material.materialName,
    material.brand_dictText, brands[String(material.brand)], material.brand,
    material.model, material.spec,
  ].some(value => String(value ?? '').toLowerCase().includes(search)))
}
