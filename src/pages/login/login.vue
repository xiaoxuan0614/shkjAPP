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
    <view class="page-container">
      <view class="text-center">
        <image v-if="compLogo" :src="compLogo" mode="aspectFit" class="logo"></image>
        <view v-else class="brand-mark">SHKJ</view>
        <view class="title text-shadow">{{ compTitle || 'SHKJ' }}</view>
        <view class="enter-area">
          <view v-if="loginWay == 1" class="account-login-area">
            <view class="box account">
              <wd-icon name="user" size="15px"></wd-icon>
              <wd-text text="账号："></wd-text>
              <wd-input placeholder="请输入账号" v-model.trim="userName"></wd-input>
            </view>
            <view class="box password">
              <wd-icon name="lock-on" size="15px"></wd-icon>
              <wd-text text="密码："></wd-text>
              <input
                class="uni-input"
                placeholder="请输入密码"
                :password="showPassword"
                v-model.trim="password"
              />
              <wd-icon
                v-if="showPassword"
                name="eye-close"
                size="18px"
                @click="handleChangePassword"
              ></wd-icon>
              <wd-icon v-else name="view" size="18px" @click="handleChangePassword"></wd-icon>
            </view>
          </view>
          <view v-else class="phone-login-area">
            <view class="account-login-area">
              <view class="box account">
                <wd-icon name="mobile" size="15px"></wd-icon>
                <wd-text text="手机号：" color="#000"></wd-text>
                <wd-input placeholder="请输入手机号" v-model="phoneNo"></wd-input>
              </view>
              <view class="box password">
                <wd-icon name="lock-on" size="15px"></wd-icon>
                <wd-text text="验证码：" color="#000"></wd-text>
                <wd-input placeholder="请输入验证码" v-model="smsCode"></wd-input>
                <wd-button
                  :round="false"
                  size="small"
                  custom-class="sendSMSBtn"
                  plain
                  hairline
                  :disabled="isSendSMSEnable"
                  @click="handleSMSSend"
                >
                  {{ getSendBtnText }}
                </wd-button>
              </view>
            </view>
          </view>
        </view>
        <view class="btn-area text-center">
          <wd-button custom-class="login align-top" :loading="loading" @click="hanldeLogin">
            {{ loading ? '登录...' : '登录' }}
          </wd-button>
          <wd-button v-if="loginWay == 2" plain hairline @click="toggleLoginWay(1)">
            账户登录
          </wd-button>
          <wd-button v-else custom-class="align-top" plain hairline @click="toggleLoginWay(2)">
            短信登录
          </wd-button>
        </view>
      </view>
      <wd-notify />
    </view>
  </PageLayout>
</template>

<script lang="ts" setup>
import { useNotify, useToast } from 'wot-design-uni'
import { ref } from 'vue'
import { useUserStore } from '@/store/user'
import { http } from '@/utils/http'
import {
  ACCESS_TOKEN,
  USER_NAME,
  USER_INFO,
  APP_ROUTE,
  APP_CONFIG,
  HOME_CONFIG_EXPIRED_TIME,
  HOME_PAGE,
} from '@/common/constants'

import { cache, getFileAccessHttpUrl } from '@/common/uitls'
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
const defLogo = ''
const shape = ref()
const loading = ref(false)
const userName = ref('')
const password = ref('')
const phoneNo = ref('')
const smsCode = ref('')
const showPassword = ref(false) // 是否显示明文
const loginWay = ref(1) // 1: 账密，2：验证码
const smsCountDown = ref(0)
let smsCountInterval: ReturnType<typeof setInterval> | undefined
const toggleDelay = ref(false)
const version = ref('')
const compLogo = ref(defLogo)
const compTitle = ref('SHKJ')
const paramsStore = useParamsStore()
paramsStore.reset()
// 是否开启本地路由配置
const isLocalConfig = getApp().globalData.isLocalConfig
if (import.meta.env.MODE === 'development') {
  userName.value = 'admin'
  password.value = '123456'
}

const isSendSMSEnable = computed(() => {
  return smsCountDown.value > 0 || phoneNo.value.length !== 11
})
const toast = useToast()
const userStore = useUserStore()
const toggleLoginWay = (val) => {
  loginWay.value = val
}
const handleChangePassword = () => {
  showPassword.value = !showPassword.value
}
const handleSMSSend = () => {
  const mobile = phoneNo.value
  const checkPhone = /^1[3-9][0-9]{9}$/
  if (!mobile) {
    toast.warning('请输入手机号')
    return false
  }
  if (!checkPhone.test(mobile)) {
    toast.warning('请输入正确的手机号')
    return false
  }
  if (smsCountDown.value) {
    return
  }
  authApi
    .sendLoginSms(mobile)
    .then(() => {
      smsCountDown.value = 60
      startSMSTimer()
    })
    .catch(() => {
      smsCountDown.value = 0
    })
}
const startSMSTimer = () => {
  smsCountInterval = setInterval(() => {
    smsCountDown.value--
    if (smsCountDown.value <= 0) {
      if (smsCountInterval) clearInterval(smsCountInterval)
    }
  }, 1e3)
}
const getSendBtnText = computed(() => {
  if (smsCountDown.value > 0) {
    return smsCountDown.value + '秒后发送'
  } else {
    return '发送验证码'
  }
})
const hanldeLogin = () => {
  loginWay.value === 1 ? accountLogin() : phoneLogin()
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
      appConfig()
    })
    .catch((error: any) => {
      if (error instanceof Error) toast.warning(error.message)
    })
    .finally(() => {
      loading.value = false
    })
}

const phoneLogin = () => {
  const checkPhone = /^1[3-9][0-9]{9}$/

  if (!phoneNo.value) {
    toast.warning('请输入手机号')
    return
  }
  if (!checkPhone.test(phoneNo.value)) {
    toast.warning('请输入正确的手机号')
    return false
  }
  if (!smsCode.value) {
    toast.warning('请输入短信验证码')
    return
  }
  loading.value = true
  authApi
    .phoneLogin(phoneNo.value, smsCode.value)
    .then((res: any) => {
      saveLoginResult(res.result)
      appConfig()
    })
    .catch((err) => {
      const msg = err.message || '请求出现错误，请稍后再试'
      toast.warning(msg)
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
        const configuredLogo = getFileAccessHttpUrl(info.appLogo)
        compLogo.value = /jeecg/i.test(configuredLogo || '') ? defLogo : configuredLogo || defLogo
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
//

.page-container {
  padding: 0 20upx;
  padding-top: 100upx;
  position: relative;
  font-size: 15px;
  color: var(--UI-FG-0);
  .logo {
    width: 200upx;
    height: 150px;
  }
  .brand-mark {
    display: flex;
    width: 168upx;
    height: 168upx;
    margin: 0 auto 28upx;
    font-size: 42upx;
    font-weight: 750;
    letter-spacing: 2upx;
    color: #fff;
    background: #176ac7;
    border-radius: 28upx;
    align-items: center;
    justify-content: center;
  }
  .title {
    font-size: 58upx;
  }
  .enter-area {
    padding-top: 75px;
    width: 87%;
    margin: 0 auto 60upx;
    .box {
      display: flex;
      align-items: center;
      min-height: 100upx;
      color: #000;
      border: 1px solid #eee;
      background-color: #fff;
      padding: 0 20upx;
      margin-bottom: 30upx;
      box-shadow: 0 0 5px rgba(0, 0, 0, 0.1);
      :deep(.wd-text) {
        margin: 0 10upx;
      }
      :deep(.wd-input),
      :deep(.uni-input) {
        flex: 1;
        &::after {
          height: 0;
        }
      }
      .uni-input {
        text-align: left;
        font-size: var(--wot-input-fs, var(--wot-cell-title-fs, 14px));
        height: var(--wot-input-inner-height, 34px);
        color: var(--wot-input-color, #262626);
        .uni-input-placeholder {
          color: var(--wot-input-placeholder-color, #bfbfbf);
        }
      }
    }
    :deep(.sendSMSBtn) {
      margin-left: 20upx;
    }
    :deep(.wd-icon-view),
    :deep(.wd-icon-eye-close) {
      color: #555;
    }
  }
  .btn-area {
    :deep(.login) {
      margin-right: 30px;
    }
    :deep(.wd-button) {
      --wot-button-medium-height: 41px;
      --wot-button-medium-fs: 16px;
      --wot-button-plain-bg-color: transparent;
      min-width: 100px;
      box-shadow: 3px 3px 4px rgba(0, 102, 204, 0.2);
    }
  }
}
</style>
