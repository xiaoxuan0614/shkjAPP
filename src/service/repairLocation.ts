export const REPAIR_RADIUS_METERS = 300
export type RepairSite = { id: string; locationName: string; latitude: number; longitude: number }
const coordinate = (value: unknown) => value == null || String(value).trim() === '' ? NaN : Number(value)
export function repairSites(rows: any[]): RepairSite[] {
  return rows.flatMap(row => {
    const latitude=coordinate(row.latitude), longitude=coordinate(row.longitude)
    return Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude)<=90 && Math.abs(longitude)<=180
      ? [{id:String(row.id || ''),locationName:row.locationName || '售后项目位置',latitude,longitude}] : []
  })
}
export function nearestRepairSite(latitude:number,longitude:number,sites:RepairSite[]) {
  if (!sites.length) throw new Error('售后项目未配置有效位置，请联系管理员维护后重试')
  const rad=(value:number)=>value*Math.PI/180
  const ranked=sites.map(site=>{
    const a=Math.sin(rad(site.latitude-latitude)/2)**2+Math.cos(rad(latitude))*Math.cos(rad(site.latitude))*Math.sin(rad(site.longitude-longitude)/2)**2
    const distance=6371000*2*Math.asin(Math.sqrt(Math.min(1,Math.max(0,a))))
    return {site,distance,status:distance<=REPAIR_RADIUS_METERS?'NORMAL' as const:'OUT_OF_RANGE' as const}
  })
  return ranked.reduce((a,b)=>a.distance<=b.distance?a:b)
}

/** Normal check-ins deliberately omit any evidence from a previous abnormal location. */
export function repairAbnormalEvidence(abnormal: boolean, reason: string, photos: string[]) {
  if (!abnormal) return {}
  const abnormalReason = reason.trim()
  if (!abnormalReason) throw new Error('请填写打卡异常原因')
  if (abnormalReason.length > 2000) throw new Error('打卡异常原因最多2000字')
  if (!photos.length) throw new Error('请添加至少1张现场照片')
  if (photos.length > 6) throw new Error('现场照片最多6张')
  if (new Set(photos).size !== photos.length) throw new Error('现场照片不能重复')
  if (photos.some(photo => !photo.trim())) throw new Error('照片上传结果无效，请重新添加')
  return { abnormalReason, photoFileIds: [...photos] }
}
