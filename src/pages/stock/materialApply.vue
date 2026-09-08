<route lang="json5">
{
  style: {
    navigationBarTitleText: '申请物料记录',
  },
}
</route>
<template>
  <PageLayout :navbarShow="false">
    <view class="tabs">
      <view class="tab" :class="{ on: active === 0 }" @click="switchTab(0)">出库 · 领料申请</view>
      <view class="tab" :class="{ on: active === 1 }" @click="switchTab(1)">入库 · 还料申请</view>
    </view>

    <scroll-view class="list" :scroll-y="true">
      <view v-if="!list.length" class="empty">暂无{{ active === 0 ? '出库' : '入库' }}记录</view>
      <view v-for="a in list" :key="a.id" class="card" @click="goDetail(a)">
        <view class="card__head">
          <text class="card__no">{{ a.applyNo }}</text>
          <StatusBadge :value="a.status" :dict="statusDict" />
        </view>
        <view class="row">
          <text class="label">关联单号</text>
          <text class="val">{{ a.orderNo }}</text>
        </view>
        <view v-if="active === 0" class="row">
          <text class="label">领料类型</text>
          <text class="val">{{ getMaterialUsageTypeText(a.usageType) }}</text>
        </view>
        <view class="row">
          <text class="label">客户</text>
          <text class="val">{{ a.customerName }}</text>
        </view>
        <view class="row">
          <text class="label">申请时间</text>
          <text class="val">{{ a.applyTime }}</text>
        </view>
        <view class="ops" @click.stop>
          <button v-if="a.status === 'pending'" class="op op--primary" @click="goDetail(a)">
            办理{{ active === 0 ? '出库' : '入库' }}
          </button>
          <text v-else class="op op--done">已{{ active === 0 ? '出库' : '入库' }}</text>
        </view>
      </view>
    </scroll-view>
  </PageLayout>
</template>

<script lang="ts" setup>
import { onLoad, onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { stockApi, unwrapRecords } from '@/service/shkj'
import StatusBadge from '@/components/StatusBadge/StatusBadge.vue'
import { getMaterialUsageTypeText } from '@/types/business'

const active = ref(0)
const list = ref<any[]>([])
const statusDict = [
  { value: 'pending', label: '待处理', color: '#e6a23c' },
  { value: 'done', label: '已完成', color: '#67c23a' },
]

const normalizeApply = (item: any) => {
  const executed = String(item.executeStatus || '').toUpperCase()
  const done = ['EXECUTED', 'COMPLETED', 'DONE', '已出库', '已入库'].includes(executed)
  return {
    ...item,
    applyNo: item.applyNo || item.id,
    orderNo: item.projectNo || item.orderNo || '',
    customerName: item.projectName || item.customerName || '',
    applyTime: item.createTime || item.applyTime || '',
    status: done ? 'done' : 'pending',
  }
}

const load = async () => {
  try {
    const applyType = active.value === 0 ? 'OUT' : 'IN'
    const res: any = await stockApi.applies({ applyType })
    list.value = unwrapRecords(res)
      .filter((item: any) => !item.applyType || item.applyType === applyType)
      .map(normalizeApply)
  } catch (e) {
    /* ignore */
  }
}

const switchTab = (i: number) => {
  active.value = i
  load()
}

const goDetail = (a: any) => uni.navigateTo({ url: `/pages/stock/materialDetail?id=${a.id}` })

onLoad((query) => {
  if ((query as any)?.tab === 'in') active.value = 1
})
onShow(load)
</script>

<style lang="scss" scoped>
.tabs {
  display: flex;
  background: #fff;

  .tab {
    flex: 1;
    text-align: center;
    padding: 13px 0;
    font-size: 14px;
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
        bottom: 5px;
        width: 28px;
        height: 3px;
        border-radius: 2px;
        background: #2f86ff;
      }
    }
  }
}

.list {
  height: calc(100vh - 44px - 80px);
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
}

.row {
  display: flex;
  margin-top: 6px;

  .label {
    width: 70px;
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

.ops {
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #f5f5f5;

  .op {
    min-width: 96px;
    min-height: 44px;
    margin: 0;
    border: 0;
    font-size: 13px;
    line-height: 44px;
    padding: 0 20px;
    border-radius: 22px;

    &::after {
      border: 0;
    }

    &--primary {
      background: #2f86ff;
      color: #fff;
    }

    &--done {
      color: #67c23a;
    }
  }
}
</style>
