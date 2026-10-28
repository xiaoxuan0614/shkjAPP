/** 日志录入格式校验，不用于判定号牌是否实际登记或车辆能源类型。 */
const province = '[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼]'
const ordinaryPlate = new RegExp(`^${province}[A-Z][A-Z0-9]{4}[A-Z0-9挂学警港澳]$`)
const eightCharacterPlate = new RegExp(`^${province}[A-Z][A-Z0-9]{6}$`)

export const normalizeVehiclePlate = (value: unknown) => String(value ?? '').trim().toUpperCase()
export const isValidVehiclePlate = (value: unknown) => {
  const plate = normalizeVehiclePlate(value)
  return !plate || ordinaryPlate.test(plate) || eightCharacterPlate.test(plate)
}
