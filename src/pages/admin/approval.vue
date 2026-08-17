<route lang="json5">
{
  style: {
    navigationBarTitleText: '审批工单',
  },
}
</route>
<template>
  <PageLayout>
    <scroll-view class="list" :scroll-y="true">
      <view v-if="!list.length" class="empty">暂无待审批工单</view>
      <view v-for="a in list" :key="a.id" class="card" @click="goDetail(a)">
        <view class="card__head">
          <text class="card__no">{{ a.orderNo }}</text>
          <text class="card__status">审批中</text>
        </view>
        <view class="row"><text class="label">客户</text><text class="val">{{ a.customerName }}</text></view>
        <view class="row"><text class="label">项目</text><text class="val">{{ a.project }}</text></view>
        <view class="row"><text class="label">维修人</text><text class="val">{{ a.repairerName }}</text></view>
        <view class="row"><text class="label">费用</text><text class="val price">¥{{ a.price.total }}</text></view>
        <view class="row"><text class="label">等待</text><text class="val wait">{{ a.waitingHours }} 小时</text></view>
      </view>
    </scroll-view>
  </PageLayout>
</template>

<script lang="ts" setup>
import { onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { http } from '@/utils/http'

const list = ref<any[]>([])

const load = async () => {
  try {
    const res: any = await http.get('/admin/approvalList')
    list.value = res.result || []
  } catch (e) {
    /* ignore */
  }
}

const goDetail = (a: any) => uni.navigateTo({ url: `/pages/admin/approvalDetail?id=${a.id}` })

onShow(load)
</script>

<style lang="scss" scoped>
.list {
  height: 100vh;
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
    justify-content: space-between;
    margin-bottom: 6px;
  }

  &__no {
    font-size: 15px;
    font-weight: 600;
    color: #333;
  }

  &__status {
    font-size: 12px;
    color: #e6a23c;
    background: #fdf6ec;
    padding: 2px 8px;
    border-radius: 4px;
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

    &.price {
      color: #f56c6c;
      font-weight: 600;
    }

    &.wait {
      color: #e6a23c;
    }
  }
}
</style>
