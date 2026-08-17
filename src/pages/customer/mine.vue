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
        <view class="role">首汇科技 · 客户</view>
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

      <!-- 开发演示入口 -->
      <SectionCard title="开发演示 · 角色入口" extra="角色页面" @extra-click="goRole">
        <view class="dev-desc">登录/角色路由未接通，此处用于预览各角色页面</view>
        <view class="dev-list">
          <text v-for="(r, i) in roles" :key="i" class="dev-chip" @click="r.action">{{ r.label }}</text>
        </view>
      </SectionCard>

      <view class="footer">首汇科技 · 小程序</view>
    </scroll-view>
  </PageLayout>
</template>

<script lang="ts" setup>
import { onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { useUserStore } from '@/store/user'
import { useToast } from 'wot-design-uni'
import SectionCard from '@/components/SectionCard/SectionCard.vue'

const userStore = useUserStore()
const toast = useToast()
const realname = ref(userStore.userInfo.realname || '')

const menus = [
  { key: 'record', icon: '📋', label: '我的报修', action: () => uni.switchTab({ url: '/pages/customer/repairRecord' }) },
  { key: 'phone', icon: '📞', label: '服务热线', action: () => toast('服务热线 400-888-8888') },
  { key: 'feedback', icon: '✉️', label: '意见反馈', action: () => toast('功能开发中') },
  { key: 'about', icon: 'ℹ️', label: '关于我们', action: () => toast('首汇科技 · 运维服务平台') },
]

const goRole = () => uni.navigateTo({ url: '/pages/role/index' })
const roles = [
  { label: '运维工作台', action: () => uni.navigateTo({ url: '/pages/ops/home' }) },
  { label: '库管', action: () => uni.navigateTo({ url: '/pages/stock/materialApply' }) },
  { label: '管理员', action: () => uni.navigateTo({ url: '/pages/admin/approval' }) },
  { label: '信息部门', action: () => uni.navigateTo({ url: '/pages/dispatch/list' }) },
]

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

.dev-desc {
  font-size: 12px;
  color: #999;
  margin-bottom: 10px;
}

.dev-list {
  display: flex;
  flex-wrap: wrap;

  .dev-chip {
    padding: 6px 16px;
    border-radius: 16px;
    background: #f0f7ff;
    color: #2f86ff;
    font-size: 13px;
    margin: 0 10px 10px 0;
  }
}

.footer {
  text-align: center;
  color: #bbb;
  font-size: 12px;
  padding: 20px 0 40px;
}
</style>
