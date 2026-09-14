import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { HOME_PAGE } from '@/common/constants'

export interface AuthorizedMenu {
  id: string
  name: string
  miniAppPath: string
  icon?: string
  sortNo?: number
}

const COMMON_AUTHENTICATED_PAGES = new Set([HOME_PAGE, '/pages/customer/mine'])

const PAGE_PARENT_ACCESS: Record<string, string[]> = {
  '/pages/customer/repair': ['/pages/customer/home'],
  '/pages/customer/repairRecord': ['/pages/customer/home'],
  '/pages/customer/repairDetail': ['/pages/customer/home'],
  '/pages/customer/confirm': ['/pages/customer/home'],
  '/pages/ops/projectDetail': ['/pages/ops/project', '/pages/ops/home'],
  '/pages/ops/implementRecords': ['/pages/ops/project', '/pages/ops/home', '/pages/ops/projectDetail'],
  '/pages/ops/implementRecordDetail': ['/pages/ops/project', '/pages/ops/home', '/pages/ops/projectDetail'],
  '/pages/ops/materialReturn': ['/pages/ops/materialApply', '/pages/ops/home'],
  '/pages/stock/materialDetail': ['/pages/stock/materialApply'],
  '/pages/dispatch/detail': ['/pages/dispatch/list'],
  '/pages/admin/approvalDetail': ['/pages/admin/approval'],
}

export const normalizeMiniAppPath = (value?: string) => {
  const path = String(value || '')
    .trim()
    .split('?')[0]
    .split('#')[0]
  if (!path) return ''
  return path.startsWith('/') ? path : `/${path}`
}

export const usePermissionStore = defineStore(
  'permission',
  () => {
    const menus = ref<AuthorizedMenu[]>([])
    const permissionCodes = ref<string[]>([])
    const loaded = ref(false)
    const ownerKey = ref('')
    const loadError = ref('')
    const fullAccess = ref(false)

    const menuPaths = computed(() => new Set(menus.value.map((item) => item.miniAppPath)))
    const permissionCodeSet = computed(() => new Set(permissionCodes.value))

    const setAuthorization = (
      nextMenus: AuthorizedMenu[],
      nextCodes: string[],
      nextOwnerKey: string,
      nextFullAccess = false,
    ) => {
      menus.value = nextMenus
      permissionCodes.value = Array.from(new Set(nextCodes.filter(Boolean)))
      ownerKey.value = nextOwnerKey
      fullAccess.value = nextFullAccess
      loaded.value = true
      loadError.value = ''
    }

    const setLoadError = (message: string) => {
      loadError.value = message
      // 同步失败时不能继续用旧菜单执行前端拦截，否则用户连“我的/退出登录”也无法进入。
      loaded.value = false
    }

    const reset = () => {
      menus.value = []
      permissionCodes.value = []
      ownerKey.value = ''
      fullAccess.value = false
      loaded.value = false
      loadError.value = ''
    }

    const hasPermission = (code: string) => permissionCodeSet.value.has(code)

    const hasPageAccess = (rawPath?: string) => {
      const path = normalizeMiniAppPath(rawPath)
      if (!path) return false
      if (fullAccess.value) return true
      if (COMMON_AUTHENTICATED_PAGES.has(path) || menuPaths.value.has(path)) return true

      const configuredParents = PAGE_PARENT_ACCESS[path] || []
      if (configuredParents.some((parent) => menuPaths.value.has(parent))) return true

      return false
    }

    return {
      menus,
      permissionCodes,
      loaded,
      ownerKey,
      loadError,
      fullAccess,
      menuPaths,
      setAuthorization,
      setLoadError,
      reset,
      hasPermission,
      hasPageAccess,
    }
  },
  { persist: true },
)
