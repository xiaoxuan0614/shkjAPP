<route lang="json5" type="page">
{
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '',
    disableScroll: true, // 微信禁止页面滚动
    'app-plus': {
      bounce: 'none', // 禁用 iOS 弹性效果
    },
  },
}
</route>

<template>
  <PageLayout :navbarShow="false">
    <scroll-view scroll-y class="login-page">
      <view class="login-content">
        <view class="login-brand">
          <image v-if="compLogo && !logoFailed" :src="compLogo" mode="aspectFit" class="login-logo" aria-label="首汇科技 Logo" @error="logoFailed = true" />
          <text v-else class="login-brand__fallback">首汇科技</text>
          <text class="login-title">首汇科技</text>
        </view>
        <form class="login-form" @submit="accountLogin">
          <view class="login-field">
            <wd-icon name="user" size="20px" color="#667085" />
            <input v-model.trim="userName" class="login-input" type="text" placeholder="请输入账号" placeholder-style="color:#767676" aria-label="登录账号" autocomplete="username" :disabled="loading" confirm-type="go" @confirm="accountLogin" />
          </view>
          <view class="login-field">
            <wd-icon name="lock-on" size="20px" color="#667085" />
            <input v-model="password" class="login-input" :password="showPassword" placeholder="请输入密码" placeholder-style="color:#767676" aria-label="登录密码" autocomplete="current-password" :disabled="loading" confirm-type="go" @confirm="accountLogin" />
            <button class="password-toggle" :aria-label="showPassword ? '显示密码' : '隐藏密码'" :disabled="loading" @click="handleChangePassword">
              <wd-icon :name="showPassword ? 'eye-close' : 'view'" size="20px" />
            </button>
          </view>
          <button class="login-submit" form-type="submit" :loading="loading" :disabled="loading">
            {{ loading ? '正在登录…' : '登录' }}
          </button>
        </form>
      </view>
      <wd-notify />
    </scroll-view>
  </PageLayout>
</template>

<script lang="ts" setup>
import { useToast } from 'wot-design-uni'
import { ref } from 'vue'
import { useUserStore } from '@/store/user'
import { http } from '@/utils/http'
import {
  APP_ROUTE,
  APP_CONFIG,
  HOME_CONFIG_EXPIRED_TIME,
  HOME_PAGE,
} from '@/common/constants'

import { cache } from '@/common/uitls'
import { useRouter } from '@/plugin/uni-mini-router'
import { useParamsStore } from '@/store/page-params'
import { encryptLoginPassword } from '@/utils/cipher'
import { authApi } from '@/service/auth'
import { ensureCurrentAuthorization } from '@/service/permission'

defineOptions({
  name: 'login',
  options: {
    // apply-shared‌：当前页面样式会影响到子组件样式.(小程序)
    // shared‌：当前页面样式影响到子组件，子组件样式也会影响到当前页面.(小程序)
    styleIsolation: 'shared',
  },
})
const router = useRouter()
const defLogo = `${import.meta.env.BASE_URL}static/company-logo.png`
const loading = ref(false)
const userName = ref('')
const password = ref('')
const showPassword = ref(true) // true masks the password
const logoFailed = ref(false)
const compLogo = ref(defLogo)
const compTitle = ref('首汇科技')
const paramsStore = useParamsStore()
paramsStore.reset()
// 是否开启本地路由配置
const isLocalConfig = getApp().globalData.isLocalConfig

const toast = useToast()
const userStore = useUserStore()
const handleChangePassword = () => {
  showPassword.value = !showPassword.value
}
const accountLogin = () => {
  if (loading.value) return
  if (userName.value.length === 0) {
    toast.warning('请输入账号')
    return
  }
  if (password.value.length === 0) {
    toast.warning('请输入密码')
    return
  }
  loading.value = true
  authApi
    .login({
      username: userName.value,
      password: encryptLoginPassword(password.value),
    })
    .then((res: any) => {
      saveLoginResult(res.result)
      return appConfig()
    })
    .catch((error: any) => {
      if (error instanceof Error) toast.warning(error.message)
    })
    .finally(() => {
      loading.value = false
    })
}

const saveLoginResult = (result: any) => {
  const userInfo = result?.userInfo || {}
  if (!result?.token || !userInfo.id) {
    throw new Error('登录响应缺少 token 或用户信息，请联系管理员检查接口')
  }
  const departs = Array.isArray(result?.departs) ? result.departs : []
  const currentDepart =
    departs.find((item: any) => item.orgCode === userInfo.loginOrgCode) ||
    departs.find((item: any) => item.orgCode === userInfo.orgCode) ||
    (departs.length === 1 ? departs[0] : undefined)
  userStore.setUserInfo({
    ...userInfo,
    belongDepIds: userInfo.belongDepIds ?? departs.map((item: any) => item.id),
    token: result?.token || '',
    userid: userInfo.id,
    tenantId: userInfo.loginTenantId,
    departName: currentDepart?.departName || userInfo.departName || '',
    orgCodeTxt: userInfo.orgCodeTxt || currentDepart?.departName || '',
    localStorageTime: Date.now(),
  })
}

const enterAuthorizedHome = async () => {
  try {
    await ensureCurrentAuthorization(userStore.userInfo, true)
    toast.success('登录成功!')
    router.pushTab({ path: HOME_PAGE })
  } catch (error) {
    userStore.clearUserInfo()
    toast.warning('菜单权限加载失败，请重新登录')
  }
}

const appConfig = async () => {
  if (isLocalConfig) {
    await enterAuthorizedHome()
  } else {
    try {
      const res: any = await http.get('/eoa/sysAppConfig/queryAppConfigRoute')
      if (res.success) {
        cache(APP_ROUTE, res.result.route, HOME_CONFIG_EXPIRED_TIME)
        cache(APP_CONFIG, res.result.config, HOME_CONFIG_EXPIRED_TIME)
      }
    } catch (error) {
      // App 配置不影响正式菜单权限初始化
    }
    await enterAuthorizedHome()
  }
}

const loadConfig = () => {
  http.get('/eoa/sysAppConfig/queryAppConfig').then((res: any) => {
    if (res.success) {
      const info = res.result
      if (info) {
        // 公司品牌使用统一随包资源，避免旧后台配置覆盖新 Logo。
        compLogo.value = defLogo
        compTitle.value = /jeecg/i.test(info.appTitle || '') ? 'SHKJ' : info.appTitle || 'SHKJ'
      } else {
        compLogo.value = defLogo
      }
    }
  })
}
const checkToken = () => {
  const { userInfo, clearUserInfo } = userStore
  if (userInfo.token) {
    if (+new Date() - userInfo.localStorageTime > 2 * 3600000) {
      // 超过2小时过期
      clearUserInfo()
    } else {
      router.pushTab({ path: HOME_PAGE })
    }
  } else {
    clearUserInfo()
  }
}
const checkAccount = () => {}
// #ifdef APP-PLUS || H5
checkToken()
checkAccount()
// #endif
if (isLocalConfig === false) {
  loadConfig()
}
</script>

<style lang="scss" scoped>
.login-page { height: 100%; background: #fff; color: #202939; }
.login-content { width: 100%; max-width: 440px; min-height: 100%; margin: 0 auto; box-sizing: border-box; padding: calc(76px + env(safe-area-inset-top)) 24px max(32px, env(safe-area-inset-bottom)); }
.login-brand { display: flex; flex-direction: column; align-items: center; }
.login-logo { display: block; width: 72px; height: 72px; }
.login-brand__fallback { display: block; color: #087fbd; font-size: 24px; font-weight: 600; line-height: 72px; }
.login-title { display: block; margin-top: 20px; font-size: 22px; font-weight: 500; line-height: 1.5; }
.login-form { display: block; margin-top: 44px; }
.login-field { display: flex; align-items: center; gap: 12px; min-height: 52px; margin-bottom: 16px; padding: 0 14px; border: 1px solid #e0e4ea; border-radius: 8px; box-sizing: border-box; background: #fff; }
.login-field:focus-within { border-color: #2461eb; }
.login-input { flex: 1; width: 0; min-width: 0; height: 50px; color: #202939; font-size: 16px; text-align: left; }
.password-toggle { display: flex; align-items: center; justify-content: center; width: 44px; height: 48px; margin: 0 -10px 0 0; padding: 0; flex: none; background: transparent; color: #667085; }
.password-toggle::after, .login-submit::after { border: 0; }
.login-submit { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 50px; margin-top: 28px; padding: 0 16px; border-radius: 8px; background: #2461eb; color: #fff; font-size: 16px; font-weight: 600; line-height: 1.5; }
.login-submit:active { background: #1c4ec3; }
.login-submit[disabled] { background: #dce6fd; color: #37527e; }
.password-toggle:focus-visible, .login-submit:focus-visible { outline: 2px solid #2461eb; outline-offset: 3px; }
@media (max-height: 560px) {
  .login-content { padding-top: calc(24px + env(safe-area-inset-top)); }
  .login-logo { width: 56px; height: 56px; }
  .login-title { margin-top: 12px; }
  .login-form { margin-top: 24px; }
}
</style>
