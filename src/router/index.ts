import { HOME_PAGE, ROUTE_PARAMS } from '@/common/constants'
import { cache, isOAuth2AppEnv } from '@/common/uitls'
import { createRouter } from '@/plugin/uni-mini-router'
import { ensureCurrentAuthorization } from '@/service/permission'
import { usePermissionStore } from '@/store/permission'
import { useUserStore } from '@/store/user'
import { isEmpty } from '@/utils/is'
import pagesJsonToRoutes from 'uni-parse-pages'
import pagesJson from '../pages.json'

const routes = pagesJsonToRoutes(pagesJson)
setRouteName(routes)

const router = createRouter({ routes: [...routes] })

export const whiteList = ['/pages/login/login', '/pages/login/loginOauth2']
export const loginPage = '/pages/login/login'

interface CacheRoute {
  path: string
  query: Record<string, string | number | boolean>
}

export const beforEach = async (to, _from, next) => {
  const userStore = useUserStore()

  if (to.path === '/oauth2-app/login') {
    const currentUrl = location.href
    location.href = currentUrl.replace('/oauth2-app/login', '/pages/login/loginOauth2')
    return
  }

  if (!userStore.isLogined) {
    if (whiteList.includes(to.path)) {
      if (to.path === loginPage && isOAuth2AppEnv()) next({ path: '/pages/login/loginOauth2' })
      else next()
      return
    }

    const targetLoginPage = isOAuth2AppEnv() ? '/pages/login/loginOauth2' : loginPage
    let redirectPath = to.path
    if (isOAuth2AppEnv() && redirectPath === '/pages/flow/myTaskDetail' && to.query?.info) {
      redirectPath += `?info=${to.query.info}`
      next({ path: targetLoginPage, query: { redirect: encodeURIComponent(redirectPath) } })
    } else {
      next({ path: targetLoginPage })
    }
    return
  }

  if (to.path === '/pages/login/loginOauth2') {
    if (to.query?.redirect) next()
    else next({ path: HOME_PAGE })
    return
  }
  if (to.path === loginPage) {
    next({ path: HOME_PAGE })
    return
  }

  // 旧运维工作台已经停止维护，统一进入当前公共首页，避免展示旧待办结构。
  if (to.path === '/pages/ops/home') {
    next({ path: HOME_PAGE })
    return
  }

  try {
    await ensureCurrentAuthorization(userStore.userInfo)
  } catch (error) {
    // 保留首页及退出登录入口，业务页在授权失败时关闭。
    if (![HOME_PAGE, '/pages/customer/mine'].includes(to.path)) {
      uni.showToast({ icon: 'none', title: '权限加载失败，请稍后重试' })
      next({ path: HOME_PAGE })
      return
    }
  }

  const permissionStore = usePermissionStore()
  if (permissionStore.loaded && !permissionStore.hasPageAccess(to.path)) {
    uni.showToast({ icon: 'none', title: '暂无该页面权限' })
    next({ path: HOME_PAGE })
    return
  }

  const flowRoute = getPathAndQuery(to)
  if (flowRoute) {
    next({ path: flowRoute.path, query: flowRoute.query })
    return
  }

  const cacheRoute = cache(ROUTE_PARAMS) as CacheRoute | undefined
  if (
    cacheRoute &&
    !isEmpty(cacheRoute) &&
    cacheRoute.path === to.path &&
    isEmpty(to.query) &&
    !isEmpty(cacheRoute.query)
  ) {
    to.query = cacheRoute.query
    next({ path: to.path, query: cacheRoute.query })
    return
  }

  cache(ROUTE_PARAMS, to, 1 * 60 * 10)
  next()
}

router.beforeEach(beforEach)

function setRouteName(routeList) {
  routeList.forEach((item) => {
    if (item.path) item.name = item.path.split('/').pop()
  })
}

function getPathAndQuery(to) {
  if (to.path === '/pages/flow/myTaskDetail' && to.query?.info) {
    const info = JSON.parse(to.query.info)
    info.hasToken = 1
    return {
      path: '/pages/login/loginOauth2',
      query: { redirect: encodeURI(`/pages/flow/myTaskDetail?info=${JSON.stringify(info)}`) },
    }
  }
  return false
}

export default router
