<route lang="json5" type="home">
{
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '首汇服务',
    disableScroll: true,
  },
}
</route>
<template>
  <PageLayout :navbarShow="false">
    <!-- 顶部个人信息 + 快捷入口 -->
    <view class="header">
      <view class="header__top">
        <view class="header__user">
          <view class="avatar">{{ (realname || '客').slice(0, 1) }}</view>
          <view class="header__info">
            <view class="name">{{ realname || '尊敬的客户' }}</view>
            <view class="desc">首汇科技 · 贴心服务</view>
          </view>
        </view>
        <view class="header__entry" @click="goRecord">我的报修 ›</view>
      </view>
      <!-- 故障报修主入口 -->
      <view class="report-entry" @click="goRepair">
        <view class="report-entry__icon">🔧</view>
        <view class="report-entry__main">
          <view class="report-entry__title">故障报修</view>
          <view class="report-entry__desc">一键报修，专员上门服务</view>
        </view>
        <view class="report-entry__btn">立即报修</view>
      </view>
      <view class="header__service">
        <view class="svc" v-for="s in services" :key="s.key" @click="s.action">
          <view class="svc__icon">{{ s.icon }}</view>
          <view class="svc__label">{{ s.label }}</view>
        </view>
      </view>
    </view>

    <scroll-view class="body" :scroll-y="true">
      <!-- 最近报修 -->
      <SectionCard title="最近报修" extra="查看全部" @extra-click="goRecord">
        <view v-if="!records.length" class="empty">暂无报修记录，点击上方「故障报修」发起</view>
        <view v-for="r in records" :key="r.id" class="rec" @click="goDetail(r)">
          <view class="rec__no">{{ r.repairNo }}</view>
          <StatusBadge :value="r.status" :dict="REPAIR_STATUS" />
          <view class="rec__desc ellipsis">{{ r.faultDesc }}</view>
          <view class="rec__time">{{ r.createTime }}</view>
        </view>
      </SectionCard>

      <!-- 会员中心 -->
      <SectionCard title="会员中心" extra="进入" @extra-click="toast('功能开发中')">
        <view class="member">
          <view class="member__item">
            <view class="member__num">2</view>
            <view class="member__label">维保项目</view>
          </view>
          <view class="member__item">
            <view class="member__num">{{ records.length }}</view>
            <view class="member__label">历史报修</view>
          </view>
          <view class="member__item">
            <view class="member__num">服务</view>
            <view class="member__label">质保期内</view>
          </view>
        </view>
      </SectionCard>

      <!-- 售后 / 公告 -->
      <SectionCard title="服务公告">
        <view class="notice" v-for="n in notices" :key="n.id" @click="toast(n.title)">
          <text class="notice__dot">·</text>
          <text class="notice__text ellipsis">{{ n.title }}</text>
          <text class="notice__time">{{ n.time }}</text>
        </view>
      </SectionCard>

      <view class="footer">首汇科技 · 运维服务</view>
    </scroll-view>
  </PageLayout>
</template>

<script lang="ts" setup>
import { onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { useUserStore } from '@/store/user'
import { useToast } from 'wot-design-uni'
import { http } from '@/utils/http'
import { REPAIR_STATUS } from '@/types/business'
import StatusBadge from '@/components/StatusBadge/StatusBadge.vue'
import SectionCard from '@/components/SectionCard/SectionCard.vue'

const userStore = useUserStore()
const toast = useToast()
const realname = ref(userStore.userInfo.realname || '尊敬的客户')
const records = ref<any[]>([])

const services = [
  { key: 'record', icon: '📋', label: '报修记录', action: goRecord },
  { key: 'hotline', icon: '📞', label: '服务热线', action: () => toast('服务热线 400-888-8888') },
  { key: 'help', icon: '💡', label: '使用帮助', action: () => toast('功能开发中') },
  { key: 'feedback', icon: '✉️', label: '意见反馈', action: () => toast('功能开发中') },
]

const notices = [
  { id: 1, title: '夏季设备巡检通知：8 月 18 日起对机房设备开展例行巡检', time: '08-16' },
  { id: 2, title: '客户服务电话升级公告：服务热线调整为 400-888-8888', time: '08-12' },
]

const goRepair = () => uni.navigateTo({ url: '/pages/customer/repair' })
const goRecord = () => uni.switchTab({ url: '/pages/customer/repairRecord' })
const goDetail = (r: any) => uni.navigateTo({ url: `/pages/customer/repairDetail?id=${r.id}` })

const loadRecords = async () => {
  try {
    const res: any = await http.get('/repair/list')
    records.value = (res.result || []).slice(0, 3)
  } catch (e) {
    /* mock 关闭时静默 */
  }
}

onShow(() => {
  realname.value = userStore.userInfo.realname || '尊敬的客户'
  loadRecords()
})
</script>

<style lang="scss" scoped>
.header {
  background: linear-gradient(135deg, #2f86ff 0%, #5aa8ff 100%);
  padding: 24px 16px 16px;
  border-radius: 0 0 24px 24px;

  &__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__user {
    display: flex;
    align-items: center;
  }

  .avatar {
    width: 46px;
    height: 46px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.25);
    color: #fff;
    font-size: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 10px;
  }

  &__info {
    color: #fff;

    .name {
      font-size: 17px;
      font-weight: 600;
    }
    .desc {
      font-size: 12px;
      opacity: 0.8;
      margin-top: 2px;
    }
  }

  &__entry {
    color: #fff;
    font-size: 13px;
    opacity: 0.9;
  }
}

.report-entry {
  margin-top: 16px;
  background: #fff;
  border-radius: 14px;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);

  &__icon {
    font-size: 30px;
    margin-right: 12px;
  }

  &__main {
    flex: 1;
  }

  &__title {
    font-size: 16px;
    font-weight: 600;
    color: #333;
  }

  &__desc {
    font-size: 12px;
    color: #999;
    margin-top: 2px;
  }

  &__btn {
    background: #2f86ff;
    color: #fff;
    font-size: 13px;
    padding: 8px 16px;
    border-radius: 20px;
  }
}

.header__service {
  display: flex;
  justify-content: space-between;
  margin-top: 16px;

  .svc {
    flex: 1;
    text-align: center;
    color: #fff;

    &__icon {
      font-size: 22px;
    }

    &__label {
      font-size: 12px;
      margin-top: 4px;
      opacity: 0.9;
    }
  }
}

.body {
  min-height: 0;
}

.empty {
  color: #999;
  font-size: 13px;
  text-align: center;
  padding: 24px 0;
}

.rec {
  padding: 10px 0;
  border-bottom: 1px solid #f5f5f5;

  &__no {
    font-size: 14px;
    font-weight: 500;
    color: #333;
  }

  &__desc {
    font-size: 13px;
    color: #666;
    margin-top: 4px;
  }

  &__time {
    font-size: 12px;
    color: #bbb;
    margin-top: 4px;
  }
}

.member {
  display: flex;

  &__item {
    flex: 1;
    text-align: center;
  }

  &__num {
    font-size: 18px;
    font-weight: 600;
    color: #2f86ff;
  }

  &__label {
    font-size: 12px;
    color: #999;
    margin-top: 4px;
  }
}

.notice {
  display: flex;
  align-items: center;
  padding: 8px 0;

  &__dot {
    color: #2f86ff;
    margin-right: 6px;
  }

  &__text {
    flex: 1;
    font-size: 13px;
    color: #555;
  }

  &__time {
    font-size: 12px;
    color: #bbb;
  }
}

.footer {
  text-align: center;
  color: #bbb;
  font-size: 12px;
  padding: 20px 0 40px;
}
</style>
