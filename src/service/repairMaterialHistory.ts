/** Match both material and historical base unit; names must never be used as keys. */
export function repairMaterialHistory(detail:any, orderId:string, material:any) {
  if (String(detail?.order?.id || '') !== orderId) throw new Error('维修单信息不匹配，请重新读取')
  if (!material.materialId || !material.baseUnitId) throw new Error('物料或基准单位信息不完整，暂不能查询明细')
  const same = (row:any) => (!row.orderId || String(row.orderId) === orderId)
    && String(row.materialId || '') === String(material.materialId)
    && String(row.baseUnitId || '') === String(material.baseUnitId)
  const links = (detail.materialLinks || []).filter(same)
  const pickIds = new Set(links.filter((row:any)=>row.linkType === 'PICK').map((row:any)=>row.id))
  const uses = (detail.materialUses || []).filter((row:any)=>same(row) || (
    (!row.orderId || String(row.orderId) === orderId) && !row.materialId && !row.baseUnitId && pickIds.has(row.pickLinkId)))
  const name = (id:string) => {
    const member = (detail.members || []).find((row:any)=>row.userId === id)
    return member?.personNameSnapshot || member?.userNameSnapshot || (id === detail.order.responsibleUserId ? detail.order.responsibleUserName : '') || '姓名未返回'
  }
  return {
    links: links.filter((row:any)=>['PICK','RETURN'].includes(row.linkType)).map((row:any)=>({...row,personName:name(row.handlerUserId)})),
    uses: uses.map((row:any)=>({...row,personName:name(row.handlerUserId)})),
  }
}
