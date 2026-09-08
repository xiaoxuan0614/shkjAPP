<route lang="json5">
{
  style: {
    navigationBarTitleText: '维修记录',
  },
}
</route>
<template>
  <PageLayout :navbarShow="false">
    <view class="tabs">
      <view class="tab" :class="{ on: active === 0 }" @click="switchTab(0)">线下维修</view>
      <view class="tab" :class="{ on: active === 1 }" @click="switchTab(1)">线上维修</view>
    </view>

    <scroll-view class="list" :scroll-y="true">
      <view v-if="!list.length" class="empty">暂无{{ active === 0 ? '线下' : '线上' }}维修记录</view>
      <view v-for="o in list" :key="o.id" class="card" @click="goDetail(o)">
        <view class="card__head">
          <text class="card__no">{{ o.orderNo }}</text>
          <StatusBadge :value="o.status" :dict="WORK_ORDER_STATUS" />
        </view>
        <view class="row"><text class="label">客户</text><text class="val">{{ o.customerName }}</text></view>
        <view class="row"><text class="label">类型</text><text class="val">{{ o.maintenanceType }} · {{ o.maintenanceNatureText }}</text></view>
        <view class="row"><text class="label">故障</text><text class="val ellipsis">{{ o.faultDesc }}</text></view>
        <view class="row"><text class="label">负责人</text><text class="val">{{ o.personInCharge }}</text></view>
      </view>
    </scroll-view>
  </PageLayout>
</template>

<script lang="ts" setup>
import { onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { http } from '@/utils/http'
import { WORK_ORDER_STATUS } from '@/types/business'
import StatusBadge from '@/components/StatusBadge/StatusBadge.vue'

const active = ref(0)
const list = ref<any[]>([])

const switchTab = (i: number) => {
  active.value = i
  load()
}

const load = async () => {
  try {
    const res: any = await http.get('/ops/repairRecords', { type: active.value === 0 ? 'offline' : 'online' })
    list.value = res.result || []
  } catch (e) {
    /* ignore */
  }
}

const goDetail = (o: any) => uni.navigateTo({ url: `/pages/ops/repairDetail?id=${o.id}` })

onShow(load)
</script>

<style lang="scss" scoped>
.tabs {
  display: flex;
  background: #fff;

  .tab {
    flex: 1;
    text-align: center;
    padding: 14px 0;
    font-size: 15px;
    color: #666;
    position: relative;

    &.on {
      color: #2f86ff;
      font-weight: 600;

      &::after {
        content: '';
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        bottom: 6px;
        width: 28px;
        height: 3px;
        border-radius: 2px;
        background: #2f86ff;
      }
    }
  }
}

.list {
  height: calc(100vh - 44px - 88px);
  padding: 12px;
}

.empty {
  text-align: center;
  color: #999;
  font-size: 13px;
  padding: 60px 0;
}

.card {
  background: #fff;
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 12px;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  &__no {
    font-size: 15px;
    font-weight: 600;
    color: #333;
  }
}

.row {
  display: flex;
  margin-top: 6px;

  .label {
    width: 60px;
    font-size: 13px;
    color: #999;
    flex: none;
  }

  .val {
    flex: 1;
    font-size: 13px;
    color: #333;
  }
}
</style>
