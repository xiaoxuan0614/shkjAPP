/** 登录页以外的页面均需登录，覆盖导航、首次打开及刷新入口。 */
import { usePermissionStore, useUserStore } from '@/store'
import { HOME_PAGE } from '@/common/constants'
import { buildPermissionOwnerKey } from '@/service/permission'
import { isOAuth2AppEnv } from '@/common/uitls'
import { normalizeMiniAppPath } from '@/store/permission'
import { isRootEntry } from '@/utils/rootEntry'
const loginRoute = '/pages/login/login'
const publicPages = new Set([loginRoute, '/pages/login/loginOauth2'])
let redirectingToLogin = false
let redirectingRoot = false

const redirectToLogin = () => {
  if (redirectingToLogin || isLogined()) return
  redirectingToLogin = true
  const url = isOAuth2AppEnv() ? '/pages/login/loginOauth2' : loginRoute
  // 清空业务页栈，避免返回按钮再次显示未登录页面。
  uni.reLaunch({ url, complete: () => { redirectingToLogin = false } })
}

const isLogined = () => {
  const userStore = useUserStore()
  return userStore.isLogined
}

const navigateToInterceptor = {
  // 注意，这里的url是 '/' 开头的，如 '/pages/index/index'，跟 'pages.json' 里面的 path 不同
  invoke({ url }: { url: string }) {
    // console.log(url) // /pages/route-interceptor/index?name=feige&age=30
    const path = normalizeMiniAppPath(url)
    if (publicPages.has(path)) return true
    const hasLogin = isLogined()
    if (hasLogin) {
      const permissionStore = usePermissionStore()
      const userStore = useUserStore()
      const authorizationIsCurrent =
        permissionStore.loaded &&
        permissionStore.ownerKey === buildPermissionOwnerKey(userStore.userInfo)
      if (authorizationIsCurrent && !permissionStore.hasPageAccess(path)) {
        uni.showToast({ icon: 'none', title: '暂无该页面权限' })
        if (path !== HOME_PAGE) uni.reLaunch({ url: HOME_PAGE })
        return false
      }
      return true
    }
    redirectToLogin()
    return false
  },
}

export const routeInterceptor = {
  install(app: any) {
    // 首次直接访问和浏览器刷新不会经过 navigateTo 等导航方法。
    app.mixin({
      onShow() {
        if (this.$mpType !== 'page') return
        // #ifdef H5
        if (typeof window !== 'undefined' && isRootEntry(window.location, import.meta.env.BASE_URL)) {
          if (!isLogined()) redirectToLogin()
          else if (!redirectingRoot) {
            redirectingRoot = true
            uni.reLaunch({ url: HOME_PAGE, complete: () => { redirectingRoot = false } })
          }
          return
        }
        // #endif
        if (isLogined()) return
        const pages = getCurrentPages()
        const current = pages[pages.length - 1]
        const route = String(current?.route || this.$page?.route || '').split(/[?#]/)[0]
        const path = route.startsWith('/') ? route : `/${route}`
        if (publicPages.has(path)) return
        redirectToLogin()
      },
    })
    uni.addInterceptor('navigateTo', navigateToInterceptor)
    uni.addInterceptor('reLaunch', navigateToInterceptor)
    uni.addInterceptor('redirectTo', navigateToInterceptor)
    uni.addInterceptor('switchTab', navigateToInterceptor)
  },
}
