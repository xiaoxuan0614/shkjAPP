<route lang="json5" type="tab">
{
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '我的',
    disableScroll: true,
  },
}
</route>
<template>
  <PageLayout :navbarShow="false">
    <!-- 顶部用户卡 -->
    <view class="header">
      <view class="avatar">{{ (realname || '客').slice(0, 1) }}</view>
      <view class="info">
        <view class="name">{{ realname || '尊敬的客户' }}</view>
        <view class="role">{{ roleSummary }}</view>
      </view>
    </view>

    <scroll-view class="body" :scroll-y="true">
      <!-- 我的服务 -->
      <SectionCard title="我的服务">
        <view class="menu">
          <view v-for="m in menus" :key="m.key" class="menu__item" @click="m.action">
            <text class="menu__icon">{{ m.icon }}</text>
            <text class="menu__label">{{ m.label }}</text>
            <text class="menu__arrow">›</text>
          </view>
        </view>
      </SectionCard>

      <SectionCard title="当前权限">
        <view v-if="permissionStore.menus.length" class="permission-list">
          <text v-for="item in permissionStore.menus" :key="item.id" class="permission-tag">
            {{ item.name }}
          </text>
        </view>
        <view v-else class="permission-empty">当前账号暂无移动端菜单权限</view>
      </SectionCard>

      <view class="logout" @click="logout">退出登录</view>

      <view class="footer">首汇科技 · 小程序</view>
    </scroll-view>
  </PageLayout>
</template>

<script lang="ts" setup>
import { onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { useUserStore } from '@/store/user'
import { usePermissionStore } from '@/store/permission'
import { useToast } from 'wot-design-uni'
import SectionCard from '@/components/SectionCard/SectionCard.vue'
import { authApi } from '@/service/auth'

const userStore = useUserStore()
const permissionStore = usePermissionStore()
const toast = useToast()
const realname = ref(userStore.userInfo.realname || '')

const menus = computed(() => [
  ...(permissionStore.hasPageAccess('/pages/customer/repairRecord')
    ? [
        {
          key: 'record',
          icon: '报',
          label: '我的报修',
          action: () => uni.navigateTo({ url: '/pages/customer/repairRecord' }),
        },
      ]
    : []),
  { key: 'phone', icon: '电', label: '服务热线', action: () => toast('服务热线 400-888-8888') },
  { key: 'feedback', icon: '意', label: '意见反馈', action: () => toast('功能开发中') },
  { key: 'about', icon: '关', label: '关于我们', action: () => toast('首汇科技 · 运维服务平台') },
])

const roleSummary = computed(() => {
  const names = permissionStore.menus.map((item) => item.name)
  return names.length ? names.slice(0, 2).join(' · ') : '首汇科技移动端用户'
})

const logout = () => {
  // 服务端注销不应阻塞本地退出；http 会在调用时同步读取当前 token。
  void authApi.logout().catch(() => undefined)
  userStore.clearUserInfo()
  uni.reLaunch({ url: '/pages/login/login' })
}

onShow(() => {
  realname.value = userStore.userInfo.realname || ''
})
</script>

<style lang="scss" scoped>
.header {
  display: flex;
  align-items: center;
  background: linear-gradient(135deg, #2f86ff 0%, #5aa8ff 100%);
  padding: 32px 20px;
  border-radius: 0 0 24px 24px;

  .avatar {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.25);
    color: #fff;
    font-size: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 14px;
  }

  .info {
    color: #fff;

    .name {
      font-size: 19px;
      font-weight: 600;
    }

    .role {
      font-size: 12px;
      opacity: 0.85;
      margin-top: 4px;
    }
  }
}

.body {
  min-height: 0;
}

.menu {
  &__item {
    display: flex;
    align-items: center;
    padding: 13px 4px;
    border-bottom: 1px solid #f5f5f5;

    &:last-child {
      border-bottom: none;
    }
  }

  &__icon {
    font-size: 18px;
    margin-right: 12px;
  }

  &__label {
    flex: 1;
    font-size: 14px;
    color: #333;
  }

  &__arrow {
    color: #ccc;
    font-size: 16px;
  }
}

.permission-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.permission-tag {
  padding: 6px 12px;
  border-radius: 8px;
  background: #eef5fd;
  color: #246fd6;
  font-size: 12px;
}

.permission-empty {
  color: #8a95a3;
  font-size: 13px;
}

.logout {
  display: flex;
  min-height: 44px;
  align-items: center;
  justify-content: center;
  margin: 18px 12px 0;
  border-radius: 14px;
  background: #fff;
  color: #d64545;
  font-size: 14px;
  font-weight: 600;
  box-shadow: 0 6px 20px rgba(31, 78, 121, 0.06);
}

.footer {
  text-align: center;
  color: #bbb;
  font-size: 12px;
  padding: 20px 0 40px;
}
</style>
