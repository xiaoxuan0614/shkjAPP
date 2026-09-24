// #ifdef H5
import H5Map from '@/common/js-sdk/js-amap/amap-h5'
// #endif
// #ifdef MP-WEIXIN
import amap from '@/common/js-sdk/js-amap/amap-wx'
// #endif

export type PhotoLocation = { latitude: number; longitude: number; locationText: string }

function bounded<T>(work: Promise<T>, message: string, milliseconds: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), milliseconds)
    work.then(resolve, reject).finally(() => clearTimeout(timer))
  })
}

async function resolvePhotoAddress(latitude: number, longitude: number, nativeAddress: any): Promise<string> {
  // #ifdef H5
  const sdk: any = await H5Map()
  return new Promise((resolve, reject) => {
    sdk.plugin('AMap.Geocoder', () => {
      new sdk.Geocoder().getAddress([longitude, latitude], (status: string, result: any) => {
        const address = String(result?.regeocode?.formattedAddress || '').trim()
        if (status === 'complete' && address) resolve(address)
        else reject(new Error('当前位置地址解析失败，请重新添加照片'))
      })
    })
  })
  // #endif
  // #ifdef APP-PLUS
  const address = nativeAddress || {}
  const text = typeof address === 'string' ? address.trim() :
    [address.country, address.province, address.city, address.district, address.street, address.streetNum]
      .filter(Boolean).join('')
  if (text) return text
  // #endif
  // #ifdef MP-WEIXIN
  const key = import.meta.env.VITE_GD_MAP_KEY__WEIXIN
  if (!key) throw new Error('未配置地图地址解析服务')
  return new Promise((resolve, reject) => {
    new amap.AMapWX({ key }).getRegeo({
      location: `${longitude},${latitude}`,
      success: (rows: any[]) => {
        const address = String(rows?.[0]?.regeocodeData?.formatted_address || '').trim()
        if (address) resolve(address)
        else reject(new Error('当前位置地址解析失败，请重新添加照片'))
      },
      fail: () => reject(new Error('当前位置地址解析失败，请重新添加照片')),
    })
  })
  // #endif
  throw new Error('当前位置地址解析不可用，请检查地图服务')
}

/** 每次添加照片独立取位置，不读取打卡位置、项目地点或手填实施位置。 */
export async function readPhotoLocation(): Promise<PhotoLocation> {
  // #ifdef H5
  if (typeof window !== 'undefined' && window.isSecureContext === false)
    throw new Error('当前网页无法定位，请通过 HTTPS 访问后重新添加照片')
  // #endif
  const position = await bounded<any>(new Promise((resolve, reject) => {
    uni.getLocation({
      type: 'gcj02',
      geocode: true,
      isHighAccuracy: true,
      highAccuracyExpireTime: 10000,
      success: resolve,
      fail: () => reject(new Error('照片定位失败，请开启定位权限后重新添加照片')),
    })
  }), '照片定位超时，请重新添加照片', 20000)
  const latitude = Number(position.latitude)
  const longitude = Number(position.longitude)
  if (position.latitude == null || position.longitude == null ||
    !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 || Math.abs(longitude) > 180)
    throw new Error('照片定位坐标无效，请重新添加照片')
  const locationText = await bounded(resolvePhotoAddress(latitude, longitude, position.address),
    '照片地址解析超时，请重新添加照片', 12000)
  return { latitude, longitude, locationText }
}
