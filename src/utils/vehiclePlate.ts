/** 内地普通号牌（含常见专用尾字）和小型、大型新能源号牌。 */
const province = '[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼]'
const ordinaryPlate = new RegExp(`^${province}[A-HJ-NP-Z][A-HJ-NP-Z0-9]{4}[A-HJ-NP-Z0-9挂学警港澳]$`)
const newEnergyPlate = new RegExp(`^${province}[A-HJ-NP-Z](?:[DF][A-HJ-NP-Z0-9][0-9]{4}|[0-9]{5}[DF])$`)

export const normalizeVehiclePlate = (value: unknown) => String(value ?? '').trim().toUpperCase()
export const isValidVehiclePlate = (value: unknown) => {
  const plate = normalizeVehiclePlate(value)
  return !plate || ordinaryPlate.test(plate) || newEnergyPlate.test(plate)
}
