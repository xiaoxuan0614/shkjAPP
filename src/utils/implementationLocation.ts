// #ifdef H5
import H5Map from '@/common/js-sdk/js-amap/amap-h5'
// #endif

export const IMPLEMENTATION_RADIUS_METERS = 500
export const MAX_LOCATION_ACCURACY_METERS = 100
export const LOCATION_MAX_AGE_MS = 120000
export type VerifiedLocation = { latitude: number; longitude: number; accuracy: number; acquiredAt: number; coordinateSystem: 'gcj02' }

export function validateCoordinates(latitude: unknown, longitude: unknown) {
  if (typeof latitude !== 'number' || typeof longitude !== 'number' || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180)
    throw new Error('定位坐标无效，请重新定位')
}
export function validateAccuracy(accuracy: unknown): number {
  if (typeof accuracy !== 'number' || !Number.isFinite(accuracy) || accuracy <= 0)
    throw new Error('未获取到有效定位精度，请重新定位')
  if (accuracy > MAX_LOCATION_ACCURACY_METERS)
    throw new Error(`定位精度不足（误差约 ${Math.round(accuracy)} 米），请到开阔处重新定位`)
  return accuracy
}
export function isFreshLocation(location: any, now = Date.now()) {
  return ['NORMAL', 'OUT_OF_RANGE'].includes(location?.status) && location.coordinateSystem === 'gcj02'
    && Number.isFinite(location.latitude) && Math.abs(location.latitude) <= 90 && Number.isFinite(location.longitude) && Math.abs(location.longitude) <= 180
    && Number.isFinite(location.accuracy) && location.accuracy > 0 && location.accuracy <= MAX_LOCATION_ACCURACY_METERS
    && Number.isFinite(location.acquiredAt) && now >= location.acquiredAt && now - location.acquiredAt <= LOCATION_MAX_AGE_MS
}
function bounded<T>(promise: Promise<T>, message: string, ms = 12000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    promise.then(value => { clearTimeout(timer); resolve(value) }, error => { clearTimeout(timer); reject(error) })
  })
}
export async function convertGps(sdk: any, latitude: number, longitude: number): Promise<{ latitude: number; longitude: number }> {
  validateCoordinates(latitude, longitude)
  return bounded(new Promise((resolve, reject) => {
    if (!sdk?.convertFrom) return reject(new Error('坐标转换服务未就绪，请重新定位'))
    sdk.convertFrom([longitude, latitude], 'gps', (status: string, result: any) => {
      try {
        if (status !== 'complete' || result?.info !== 'ok' || !result.locations?.length) throw new Error('坐标转换失败，请重新定位')
        const point = result.locations[0]
        const lat = point.getLat?.() ?? point.lat, lng = point.getLng?.() ?? point.lng
        validateCoordinates(lat, lng)
        resolve({ latitude: lat, longitude: lng })
      } catch (error) { reject(error) }
    })
  }), '坐标转换超时，请重新定位')
}
export async function getImplementationLocation(): Promise<VerifiedLocation> {
  // H5 deliberately bypasses uni.getLocation's silent conversion-failure fallback.
  // #ifdef H5
  const raw = await new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('当前浏览器不支持定位，请更换浏览器'))
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 })
  })
  const accuracy = validateAccuracy(raw.coords.accuracy)
  if (!Number.isFinite(raw.timestamp) || Date.now() - raw.timestamp > LOCATION_MAX_AGE_MS || raw.timestamp > Date.now() + 5000) throw new Error('定位结果已过期，请重新定位')
  const sdk = await bounded(H5Map(), '地图加载超时，请重新定位')
  const point = await convertGps(sdk, raw.coords.latitude, raw.coords.longitude)
  return { ...point, accuracy, acquiredAt: raw.timestamp, coordinateSystem: 'gcj02' }
  // #endif
  // #ifndef H5
  return new Promise((resolve, reject) => {
    uni.getLocation({ type: 'gcj02', isHighAccuracy: true, highAccuracyExpireTime: 15000,
      success(result) {
        try {
          validateCoordinates(result.latitude, result.longitude)
          const accuracy = validateAccuracy(result.accuracy)
          resolve({ latitude: result.latitude, longitude: result.longitude, accuracy, acquiredAt: Date.now(), coordinateSystem: 'gcj02' })
        } catch (error) { reject(error) }
      }, fail: reject,
    })
  })
  // #endif
}
