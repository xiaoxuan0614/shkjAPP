import { getEnvBaseUrl } from '@/utils'
import { useUserStore } from '@/store/user'

export interface ContractFile {
  path: string
  name: string
  label?: string
}

export const fileExtension = (file: ContractFile) => {
  const extension = (value: string) =>
    value
      .split(/[?#]/)[0]
      .match(/\.([a-z0-9]+)$/i)?.[1]
      ?.toLowerCase() || ''
  return extension(file.name || '') || extension(file.path)
}

export function contractFileRequest(path: string) {
  const base = getEnvBaseUrl().replace(/\/$/, '')
  const source = path.trim().replace(/\\/g, '/')
  if (!source || /^(?!https?:)[a-z][\w+.-]*:/i.test(source) || source.startsWith('//')) {
    throw new Error('文件地址无效，请联系管理员检查附件')
  }
  const isAbsolute = /^https?:\/\//i.test(source)
  let url = isAbsolute ? source : `${base}/sys/common/static/${source.replace(/^\/+/, '')}`
  const trusted = url.startsWith(`${base}/`)
  // #ifdef H5
  if (trusted && import.meta.env.DEV && import.meta.env.VITE_APP_PROXY === 'true') {
    url = import.meta.env.VITE_APP_PROXY_PREFIX + url.slice(base.length)
  }
  // #endif
  const user = useUserStore().userInfo
  const header: Record<string, string> = {}
  // 外部附件地址不能携带本系统的登录凭据。
  if (trusted) {
    if (user.token) header['X-Access-Token'] = user.token
    if (user.tenantId != null) header['X-Tenant-Id'] = String(user.tenantId)
  }
  return { url, header, trusted }
}
