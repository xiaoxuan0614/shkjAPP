export function workMaterialItems(work:any, detail:any, recordId:string) {
  if (Array.isArray(work.materialItems)) return work.materialItems.map((item:any) => ({...item}))
  const ids = new Set(work.materialUseIds || [])
  if ([...ids].some(id => !(detail.materialUses || []).some((u:any) => u.id === id))) throw new Error('历史用料明细未返回，请刷新核对后再修改日志')
  return (detail.materialUses || []).filter((u:any) => u.useStatus !== 'VOIDED' && (u.workRecordId === recordId || ids.has(u.id)))
    .map((u:any) => ({pickLinkId:u.pickLinkId,quantity:u.usedQuantity,description:u.useDescription || ''}))
}
export function materialInfo(detail:any, id:string) {
  const link = (detail.materialLinks || []).find((l:any) => l.id === id) || {}
  return {...(link.material || {}),...link}
}
export function confirmedMaterial(detail:any, recordId:string, id:string) {
  return (detail.materialUses || []).some((u:any) => u.workRecordId === recordId && u.pickLinkId === id && u.useStatus === 'CONFIRMED')
}
export function materialItemsPayload(items:any[], draftOnly:boolean, detail:any, actorId:string, recordId:string, original:any[]) {
  if (items.length > 100) throw new Error('用料最多选择 100 项')
  const seen = new Set<string>()
  for (const item of items) {
    if (!item.pickLinkId || seen.has(item.pickLinkId)) throw new Error('请勿重复选择同一笔领料')
    seen.add(item.pickLinkId)
    if (draftOnly) continue
    const text = String(item.quantity ?? '').trim(), qty = Number(text)
    if (!/^\d+(\.\d{1,4})?$/.test(text) || !Number.isFinite(qty) || qty <= 0) throw new Error('本次用量须大于 0，最多 4 位小数')
    const link = materialInfo(detail,item.pickLinkId)
    if (link.linkType !== 'PICK' || link.handlerUserId !== actorId || !(Number(link.outboundQty) > 0)) throw new Error('请选择本人已出库的物料')
    const baseline = original.find((r:any) => r.pickLinkId === item.pickLinkId)
    if (confirmedMaterial(detail,recordId,item.pickLinkId) && Number(baseline?.quantity) !== qty) throw new Error('已确认的用料不可修改')
    // A replacement already occupies the server balance; the atomic update validates its delta.
    if (!baseline) {
      if (link.availableUseQty == null || !Number.isFinite(Number(link.availableUseQty))) throw new Error('物料可用量未返回，请刷新后重试')
      if (qty > Number(link.availableUseQty)) throw new Error(`${link.materialName || '物料'}本次用量不能超过可用量`)
    }
  }
  if (!draftOnly && original.some(item => confirmedMaterial(detail,recordId,item.pickLinkId) && !seen.has(item.pickLinkId))) throw new Error('已确认的用料不可移除')
  return items.map(item => ({pickLinkId:item.pickLinkId,quantity:item.quantity === '' || item.quantity == null ? null : Number(item.quantity),...(item.description?.trim() ? {description:item.description.trim()} : {})}))
}
