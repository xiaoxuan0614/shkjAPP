import { http } from '@/utils/http'
import { normalizeMiniAppPath, usePermissionStore, type AuthorizedMenu } from '@/store/permission'

const CURRENT_USER_MENU_URL = '/sys/permission/getUserPermissionByToken'
const PERMISSION_CODE_URL = '/sys/permission/getPermCode'

const toArray = (value: any): any[] => {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.records)) return value.records
  if (Array.isArray(value?.menu)) return value.menu
  return []
}

const flattenMenuTree = (items: any[]): any[] =>
  items.flatMap((item) => [item, ...flattenMenuTree(toArray(item?.children))])

const resolveMiniAppPath = (item: any) =>
  normalizeMiniAppPath(
    item?.miniAppPath ||
      item?.meta?.miniAppPath ||
      item?.mobilePath ||
      item?.appPath,
  )

const normalizeMenus = (response: any): AuthorizedMenu[] => {
  const result = response?.result ?? response
  const source = flattenMenuTree(toArray(result?.menu ?? result))
  const paths = new Set<string>()

  return source
    .map((item: any, index: number) => ({
      id: String(item?.id || `menu-${index}`),
      name: String(item?.meta?.title || item?.title || item?.name || '未命名菜单'),
      miniAppPath: resolveMiniAppPath(item),
      icon: item?.icon ? String(item.icon) : undefined,
      sortNo: Number(item?.sortNo ?? index),
    }))
    .filter((item) => {
      if (!item.miniAppPath || paths.has(item.miniAppPath)) return false
      paths.add(item.miniAppPath)
      return true
    })
    .sort((a, b) => Number(a.sortNo || 0) - Number(b.sortNo || 0))
}

const normalizePermissionCodes = (response: any) => {
  const result = response?.result ?? response
  const source = Array.isArray(result)
    ? result
    : result?.codeList || result?.permissionCodes || result?.permissions || result?.auth || []
  return Array.isArray(source) ? source.map((item) => String(item)).filter(Boolean) : []
}

export const buildPermissionOwnerKey = (userInfo: IUserInfo) =>
  `${userInfo.userid || userInfo.username || ''}:${userInfo.tenantId || ''}:menu-v6`

export const loadCurrentAuthorization = async (ownerKey: string, userInfo: IUserInfo) => {
  const permissionStore = usePermissionStore()
  try {
    const menuResponse: any = await http.get(CURRENT_USER_MENU_URL)
    let permissionCodes: string[] = []
    try {
      const permissionResponse: any = await http.get(PERMISSION_CODE_URL)
      permissionCodes = normalizePermissionCodes(permissionResponse)
    } catch {
      // 按钮权限加载失败不应拖垮菜单；按钮接口仍由后端独立鉴权。
    }
    permissionStore.setAuthorization(normalizeMenus(menuResponse), permissionCodes, ownerKey)
    return permissionStore.menus
  } catch (error: any) {
    permissionStore.setLoadError(error?.message || error?.msg || '菜单权限加载失败')
    throw error
  }
}

export const ensureCurrentAuthorization = async (userInfo: IUserInfo, force = false) => {
  const permissionStore = usePermissionStore()
  const ownerKey = buildPermissionOwnerKey(userInfo)
  if (!force && permissionStore.loaded && permissionStore.ownerKey === ownerKey) {
    return permissionStore.menus
  }
  return loadCurrentAuthorization(ownerKey, userInfo)
}
