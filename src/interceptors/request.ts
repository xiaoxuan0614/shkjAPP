/* eslint-disable no-param-reassign */
import qs from 'qs'
import { useUserStore } from '@/store'
import { platform } from '@/utils/platform'
import { getEnvBaseUrl } from '@/utils'
import { isTrustedApiUrl, removeSessionHeaders } from '@/utils/requestTrust'

export type CustomRequestOptions = UniApp.RequestOptions & {
  query?: Record<string, any>
  /** 出错时是否隐藏错误提示 */
  hideErrorToast?: boolean
  /** Expose a cancellable request for short-lived previews. */
  onRequestTask?: (task: UniApp.RequestTask) => void
} & IUniUploadFileOptions // 添加uni.uploadFile参数类型

// 请求基准地址
const baseUrl = getEnvBaseUrl()

// 拦截器配置
const httpInterceptor = {
  // 拦截前触发
  invoke(options: CustomRequestOptions) {
    let trustedProxy = false
    // 接口请求支持通过 query 参数配置 queryString
    if (options.query) {
      const queryStr = qs.stringify(options.query)
      if (options.url.includes('?')) {
        options.url += `&${queryStr}`
      } else {
        options.url += `?${queryStr}`
      }
    }
    // 非 http 开头需拼接地址
    if (!/^[a-z][\w+.-]*:/i.test(options.url) && !options.url.startsWith('//')) {
      // #ifdef H5
      // console.log(import.meta.env.VITE_APP_PROXY)
      if (JSON.parse(import.meta.env.VITE_APP_PROXY) && import.meta.env.MODE === 'development') {
        const prefix = import.meta.env.VITE_APP_PROXY_PREFIX.replace(/\/$/, '')
        trustedProxy = options.url.startsWith(`${prefix}/`) &&
          isTrustedApiUrl(baseUrl.replace(/\/$/, '') + options.url.slice(prefix.length), baseUrl)
      } else {
        options.url = baseUrl + options.url
      }
      // #endif
      // 非H5正常拼接
      // #ifndef H5
      options.url = baseUrl + options.url
      // #endif
      // TIPS: 如果需要对接多个后端服务，也可以在这里处理，拼接成所需要的地址
    }
    // 1. 请求超时
    options.timeout = options.timeout ?? 20000 // 默认 20s，允许视频上传单独设置
    // 2. （可选）添加小程序端请求头标识
    options.header = {
      platform, // 可选，与 uniapp 定义的平台一致，告诉后台来源
      ...options.header,
    }
    // 3. 添加 token 请求头标识
    const userStore = useUserStore()
    const { token } = userStore.userInfo as unknown as IUserInfo
    if (!trustedProxy && !isTrustedApiUrl(options.url, baseUrl)) {
      removeSessionHeaders(options.header)
      // #ifdef H5
      options.withCredentials = false
      // #endif
    } else if (token) {
      options.header.Authorization = `${token}`
    }
  },
}

export const requestInterceptor = {
  install() {
    // 拦截 request 请求
    uni.addInterceptor('request', httpInterceptor)
    // 拦截 uploadFile 文件上传
    uni.addInterceptor('uploadFile', httpInterceptor)
  },
}
