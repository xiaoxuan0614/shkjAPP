import { http } from '@/utils/http'
import { useUserStore } from '@/store/user'
import { normalizeMiniAppPath, usePermissionStore, type AuthorizedMenu } from '@/store/permission'

const CURRENT_USER_MENU_URL = '/sys/permission/getUserPermissionByToken'
const PERMISSION_CODE_URL = '/sys/permission/getPermCode'
let authorizationCheckedAt = 0

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
  const userStore = useUserStore()
  const token = userInfo.token
  try {
    // 登录/统一权限刷新时补全角色，弹窗只读用户状态，不再查询部门。
    try {
      const profileResponse: any = await http.get('/sys/user/getUserInfo')
      const profile = profileResponse?.result?.userInfo
      if (userStore.userInfo.token !== token) return []
      if (!profile || String(profile.id) !== String(userInfo.userid)) throw new Error('当前用户身份响应不匹配')
      userStore.editUserInfo({ ...profile, belongDepIds: profile.belongDepIds ?? (userStore.userInfo as any).belongDepIds, roles: Array.isArray(profile.roles) ? profile.roles : [] })
    } catch {
      if (userStore.userInfo.token !== token) return []
      userStore.editUserInfo({ roles: [] })
    }
    const menuResponse: any = await http.get(CURRENT_USER_MENU_URL)
    let permissionCodes: string[] = []
    try {
      const permissionResponse: any = await http.get(PERMISSION_CODE_URL)
      permissionCodes = normalizePermissionCodes(permissionResponse)
    } catch {
      // 按钮权限加载失败不应拖垮菜单；按钮接口仍由后端独立鉴权。
    }
    if (userStore.userInfo.token !== token) return []
    permissionStore.setAuthorization(normalizeMenus(menuResponse), permissionCodes, ownerKey)
    authorizationCheckedAt = Date.now()
    return permissionStore.menus
  } catch (error: any) {
    permissionStore.setLoadError(error?.message || error?.msg || '菜单权限加载失败')
    throw error
  }
}

export const ensureCurrentAuthorization = async (userInfo: IUserInfo, force = false) => {
  const permissionStore = usePermissionStore()
  const ownerKey = buildPermissionOwnerKey(userInfo)
  if (!force && permissionStore.loaded && permissionStore.ownerKey === ownerKey &&
    Date.now() - authorizationCheckedAt < 60_000) {
    return permissionStore.menus
  }
  return loadCurrentAuthorization(ownerKey, userInfo)
}
