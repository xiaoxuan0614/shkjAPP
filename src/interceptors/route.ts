/**
 * 路由拦截，通常也是登录拦截
 * 可以设置路由白名单，或者黑名单，看业务需要选哪一个
 * 我这里应为大部分都可以随便进入，所以使用黑名单
 */
import { usePermissionStore, useUserStore } from '@/store'
import { HOME_PAGE } from '@/common/constants'
import { buildPermissionOwnerKey } from '@/service/permission'
const loginRoute = '/pages/login/login'
const publicPages = new Set([loginRoute, '/pages/login/loginOauth2'])

const isLogined = () => {
  const userStore = useUserStore()
  return userStore.isLogined
}

const navigateToInterceptor = {
  // 注意，这里的url是 '/' 开头的，如 '/pages/index/index'，跟 'pages.json' 里面的 path 不同
  invoke({ url }: { url: string }) {
    // console.log(url) // /pages/route-interceptor/index?name=feige&age=30
    const path = url.split('?')[0]
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
    const redirectRoute = `${loginRoute}?redirect=${encodeURIComponent(url)}`
    uni.navigateTo({ url: redirectRoute })
    return false
  },
}

export const routeInterceptor = {
  install() {
    uni.addInterceptor('navigateTo', navigateToInterceptor)
    uni.addInterceptor('reLaunch', navigateToInterceptor)
    uni.addInterceptor('redirectTo', navigateToInterceptor)
    uni.addInterceptor('switchTab', navigateToInterceptor)
  },
}
