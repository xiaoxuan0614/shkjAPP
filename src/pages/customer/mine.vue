<route lang="json5" type="tab">
{
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '设置',
    disableScroll: true,
  },
}
</route>

<template>
  <PageLayout
    class="settings-layout"
    navTitle="设置"
    navLeftText=""
    :navLeftArrow="false"
    navBackgroundColor="#176ac7"
  >
    <scroll-view class="settings-page" :scroll-y="true">
      <view class="settings-card">
        <button class="settings-row" hover-class="settings-row--pressed" @click="openPasswordPopup">
          <view class="settings-row__icon settings-row__icon--password">
            <wd-icon name="lock-on" size="18px" />
          </view>
          <text class="settings-row__label">修改密码</text>
          <wd-icon class="settings-row__arrow" name="arrow-right" size="15px" />
        </button>

        <button class="settings-row" hover-class="settings-row--pressed" @click="openProfileEdit">
          <view class="settings-row__icon settings-row__icon--phone">
            <wd-icon name="mobile" size="18px" />
          </view>
          <text class="settings-row__label">修改手机号</text>
          <text v-if="maskedPhone" class="settings-row__value">{{ maskedPhone }}</text>
          <wd-icon class="settings-row__arrow" name="arrow-right" size="15px" />
        </button>

        <view class="settings-row settings-row--static">
          <view class="settings-row__icon settings-row__icon--notice">
            <wd-icon name="notification-filled" size="18px" />
          </view>
          <text class="settings-row__label">消息提醒</text>
          <switch
            class="reminder-switch"
            :checked="messageReminder"
            color="#6384ff"
            aria-label="消息提醒"
            @change="handleReminderChange"
          />
        </view>

        <button class="settings-row" hover-class="settings-row--pressed" @click="clearCache">
          <view class="settings-row__icon settings-row__icon--cache">
            <wd-icon name="delete" size="18px" />
          </view>
          <text class="settings-row__label">清理缓存</text>
          <text class="settings-row__value">{{ cacheSizeLabel }}</text>
          <wd-icon class="settings-row__arrow" name="arrow-right" size="15px" />
        </button>

        <view class="settings-row settings-row--static settings-row--last">
          <view class="settings-row__icon settings-row__icon--version">
            <wd-icon name="info-circle" size="18px" />
          </view>
          <text class="settings-row__label">版本</text>
          <text class="settings-row__value">当前版本 V{{ appVersion }}</text>
        </view>
      </view>

      <button class="logout-button" hover-class="logout-button--pressed" @click="confirmLogout">
        退出登录
      </button>
    </scroll-view>

    <wd-popup
      v-model="passwordPopupVisible"
      position="bottom"
      :root-portal="true"
      :close-on-click-modal="!passwordSubmitting"
      :safe-area-inset-bottom="true"
      custom-style="border-radius: 18px 18px 0 0; overflow: hidden;"
      @closed="resetPasswordForm"
    >
      <view class="password-sheet">
        <view class="password-sheet__header">
          <text class="password-sheet__title">修改密码</text>
          <button
            class="password-sheet__close"
            :disabled="passwordSubmitting"
            aria-label="关闭修改密码"
            @click="passwordPopupVisible = false"
          >
            <wd-icon name="close" size="18px" />
          </button>
        </view>

        <label class="password-field">
          <text>当前密码</text>
          <input
            v-model="passwordForm.oldpassword"
            password
            :disabled="passwordSubmitting"
            placeholder="请输入当前密码"
            placeholder-style="color:#a4acb8"
          />
        </label>
        <label class="password-field">
          <text>新密码</text>
          <input
            v-model="passwordForm.password"
            password
            :disabled="passwordSubmitting"
            placeholder="请输入至少 6 位新密码"
            placeholder-style="color:#a4acb8"
          />
        </label>
        <label class="password-field">
          <text>确认新密码</text>
          <input
            v-model="passwordForm.confirmpassword"
            password
            :disabled="passwordSubmitting"
            placeholder="请再次输入新密码"
            placeholder-style="color:#a4acb8"
          />
        </label>

        <button
          class="password-submit"
          :disabled="passwordSubmitting"
          hover-class="password-submit--pressed"
          @click="submitPassword"
        >
          {{ passwordSubmitting ? '正在提交…' : '确认修改' }}
        </button>
      </view>
    </wd-popup>
  </PageLayout>
</template>

<script lang="ts" setup>
import { onShow } from '@dcloudio/uni-app'
import { computed, reactive, ref } from 'vue'
import { useToast } from 'wot-design-uni'
import { APP_CONFIG, APP_ROUTE, ROUTE_PARAMS } from '@/common/constants'
import { authApi } from '@/service/auth'
import { useUserStore } from '@/store/user'
import { clearDictionaryCache } from '@/utils/dictionaryCache'

const MESSAGE_REMINDER_KEY = 'message_reminder_enabled'
const CLEARABLE_CACHE_KEYS = [APP_ROUTE, APP_CONFIG, ROUTE_PARAMS]
const userStore = useUserStore()
const toast = useToast()

const messageReminder = ref(uni.getStorageSync(MESSAGE_REMINDER_KEY) !== false)
const cacheSizeLabel = ref('0 B')
const passwordPopupVisible = ref(false)
const passwordSubmitting = ref(false)
const passwordForm = reactive({
  oldpassword: '',
  password: '',
  confirmpassword: '',
})

const maskedPhone = computed(() => {
  const phone = String(userStore.userInfo.phone || '')
  return /^1\d{10}$/.test(phone) ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : ''
})

const appVersion = (() => {
  try {
    return uni.getAppBaseInfo?.().appVersion || '1.0.0'
  } catch {
    return '1.0.0'
  }
})()

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const utf8Size = (text: string) => Array.from(text).reduce((total, char) => {
  const code = char.codePointAt(0) || 0
  return total + (code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4)
}, 0)

const refreshCacheSize = () => {
  const bytes = CLEARABLE_CACHE_KEYS.reduce((total, key) => {
    const value = uni.getStorageSync(key)
    if (value === '' || value === undefined || value === null) return total
    const text = typeof value === 'string' ? value : JSON.stringify(value)
    return total + utf8Size(text)
  }, 0)
  cacheSizeLabel.value = formatBytes(bytes)
}

const openProfileEdit = () => uni.navigateTo({ url: '/pages-user/userEdit/userEdit' })

const handleReminderChange = (event: any) => {
  const enabled = Boolean(event.detail?.value)
  messageReminder.value = enabled
  uni.setStorageSync(MESSAGE_REMINDER_KEY, enabled)
  toast.success(enabled ? '消息提醒已开启' : '消息提醒已关闭')
}

const clearCache = () => {
  uni.showModal({
    title: '清理缓存',
    content: '仅清理页面与字典缓存，不会退出登录或删除业务数据。',
    success: (result) => {
      if (!result.confirm) return
      CLEARABLE_CACHE_KEYS.forEach((key) => uni.removeStorageSync(key))
      clearDictionaryCache()
      refreshCacheSize()
      toast.success('缓存已清理')
    },
  })
}

const resetPasswordForm = () => {
  if (passwordSubmitting.value) return
  passwordForm.oldpassword = ''
  passwordForm.password = ''
  passwordForm.confirmpassword = ''
}

const openPasswordPopup = () => {
  resetPasswordForm()
  passwordPopupVisible.value = true
}

const submitPassword = async () => {
  if (passwordSubmitting.value) return
  if (!passwordForm.oldpassword) return toast.warning('请输入当前密码')
  if (passwordForm.password.length < 6) return toast.warning('新密码至少 6 位')
  if (passwordForm.password === passwordForm.oldpassword) return toast.warning('新密码不能与当前密码相同')
  if (passwordForm.confirmpassword !== passwordForm.password) return toast.warning('两次输入的新密码不一致')

  passwordSubmitting.value = true
  try {
    const response: any = await authApi.updatePassword({
      username: userStore.userInfo.username,
      oldpassword: passwordForm.oldpassword,
      password: passwordForm.password,
      confirmpassword: passwordForm.confirmpassword,
    })
    if (response?.success === false) throw new Error(response.message || '修改失败')
    passwordPopupVisible.value = false
    toast.success(response?.message || '密码修改成功')
  } catch (error: any) {
    toast.error(error?.message || error?.msg || '密码修改失败')
  } finally {
    passwordSubmitting.value = false
  }
}

const confirmLogout = () => {
  uni.showModal({
    title: '退出登录',
    content: '确定退出当前账号吗？',
    confirmColor: '#d94b4b',
    success: (result) => {
      if (!result.confirm) return
      void authApi.logout().catch(() => undefined)
      userStore.clearUserInfo()
      uni.reLaunch({ url: '/pages/login/login' })
    },
  })
}

onShow(refreshCacheSize)
</script>

<style lang="scss" scoped>
.settings-layout :deep(.pageNav .wd-navbar__title) {
  color: #fff;
}

.settings-page {
  min-height: 0;
  flex: 1;
  box-sizing: border-box;
  padding: 10px 14px calc(28px + env(safe-area-inset-bottom));
  background: #f5f7fb;
}

.settings-card {
  overflow: hidden;
  border: 1px solid #eef1f6;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 4px 18px rgba(42, 56, 84, 0.04);
}

.settings-row {
  position: relative;
  display: flex;
  width: 100%;
  min-height: 54px;
  margin: 0;
  padding: 0 14px;
  align-items: center;
  border: 0;
  border-radius: 0;
  background: #fff;
  color: #273142;
  text-align: left;
  line-height: 1.4;
  touch-action: manipulation;

  &::after {
    position: absolute;
    right: 14px;
    bottom: 0;
    left: 46px;
    height: 1px;
    border: 0;
    background: #f0f2f5;
    content: '';
    transform: scaleY(0.5);
    transform-origin: bottom;
  }

  &--static::after { left: 46px; }
  &--last::after { display: none; }
  &--pressed { background: #f8faff; }

  &__icon {
    display: flex;
    width: 28px;
    height: 28px;
    margin-right: 6px;
    align-items: center;
    justify-content: center;

    &--password { color: #6a69e9; }
    &--phone { color: #62a8ff; }
    &--notice { color: #ef7f89; }
    &--cache { color: #9ba4b1; }
    &--version { color: #7b8797; }
  }

  &__label {
    flex: 1;
    min-width: 0;
    color: #303746;
    font-size: 15px;
  }

  &__value {
    max-width: 58%;
    margin-left: 10px;
    overflow: hidden;
    color: #a0a8b4;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__arrow {
    margin-left: 8px;
    color: #c0c6cf;
  }
}

.reminder-switch {
  margin-left: 10px;
  transform: scale(0.78);
  transform-origin: right center;
}

.logout-button {
  width: 100%;
  min-height: 48px;
  margin: 58px 0 0;
  border: 1px solid #6a88f7;
  border-radius: 6px;
  background: transparent;
  color: #577cf2;
  font-size: 15px;
  font-weight: 500;
  line-height: 46px;
  touch-action: manipulation;

  &::after { border: 0; }
  &--pressed { background: rgba(99, 132, 255, 0.07); }
}

.password-sheet {
  padding: 18px 18px calc(22px + env(safe-area-inset-bottom));
  background: #fff;

  &__header {
    display: flex;
    min-height: 44px;
    align-items: center;
    justify-content: space-between;
  }

  &__title {
    color: #202737;
    font-size: 18px;
    font-weight: 600;
  }

  &__close {
    display: flex;
    width: 44px;
    height: 44px;
    margin: 0 -10px 0 0;
    padding: 0;
    align-items: center;
    justify-content: center;
    border: 0;
    background: transparent;
    color: #727d8d;

    &::after { border: 0; }
  }
}

.password-field {
  display: block;
  margin-top: 14px;

  > text {
    display: block;
    margin-bottom: 7px;
    color: #3b4454;
    font-size: 14px;
  }

  input {
    width: 100%;
    height: 48px;
    box-sizing: border-box;
    padding: 0 12px;
    border: 1px solid #d9dee7;
    border-radius: 8px;
    color: #252d3d;
    font-size: 16px;
  }
}

.password-submit {
  width: 100%;
  min-height: 48px;
  margin: 22px 0 0;
  border: 0;
  border-radius: 8px;
  background: #5f80f4;
  color: #fff;
  font-size: 16px;
  line-height: 48px;

  &::after { border: 0; }
  &[disabled] { opacity: 0.6; }
  &--pressed { background: #4e6fdc; }
}
</style>
