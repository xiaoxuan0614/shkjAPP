<route lang="json5">
{
  style: {
    navigationBarTitleText: '项目管理',
  },
}
</route>
<template>
  <PageLayout :navbarShow="false">
    <scroll-view class="list" :scroll-y="true">
      <view v-if="!list.length" class="empty">暂无项目</view>
      <view v-for="p in list" :key="p.id" class="card" @click="goDetail(p)">
        <view class="card__head">
          <text class="card__no">{{ p.xmNo }}</text>
          <StatusBadge :value="p.status" :dict="PROJECT_STATUS" />
        </view>
        <view class="card__name">{{ p.name }}</view>
        <view class="row"><text class="label">客户</text><text class="val">{{ p.customerName }}</text></view>
        <view v-if="p.personInCharge" class="row"><text class="label">负责人</text><text class="val">{{ p.personInCharge }}</text></view>
        <view v-if="p.startDate || p.endDate" class="row"><text class="label">周期</text><text class="val">{{ p.startDate || '—' }} ~ {{ p.endDate || '—' }}</text></view>
        <!-- 实施中：当前工序 + 剩余工时/延期 -->
        <view v-if="p.status === 'implementing' && p.currentProcess" class="progress">
          <view class="progress__item">
            <text class="progress__label">当前工序</text>
            <text class="progress__val">{{ p.currentProcess }}</text>
          </view>
          <view class="progress__item">
            <text class="progress__label">工序周期</text>
            <text class="progress__val">{{ p.processPlan }}</text>
          </view>
          <view class="progress__item">
            <text class="progress__label">{{ p.remainDays < 0 ? '延期' : '剩余' }}</text>
            <text class="progress__val" :class="{ warn: p.remainDays < 0 }">{{ p.remainDays < 0 ? -p.remainDays + ' 天' : p.remainDays + ' 天' }}</text>
          </view>
        </view>
        <!-- 已完结/质保中：交付信息 -->
        <view v-if="p.status === 'warranty'" class="row"><text class="label">质保至</text><text class="val">{{ p.warrantyPeriod }}</text></view>
      </view>
    </scroll-view>
  </PageLayout>
</template>

<script lang="ts" setup>
import { onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { normalizeProject, projectApi, unwrapRecords } from '@/service/shkj'
import { PROJECT_STATUS } from '@/types/business'
import StatusBadge from '@/components/StatusBadge/StatusBadge.vue'

const list = ref<any[]>([])

const load = async () => {
  try {
    const res: any = await projectApi.list()
    list.value = unwrapRecords(res).map(normalizeProject)
  } catch (e) {
    /* ignore */
  }
}

const goDetail = (p: any) => uni.navigateTo({ url: `/pages/ops/projectDetail?id=${p.id}` })

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
    font-size: 14px;
    font-weight: 600;
    color: #333;
  }

  &__name {
    font-size: 16px;
    font-weight: 600;
    color: #222;
    margin-bottom: 8px;
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

.progress {
  display: flex;
  background: #f0f7ff;
  border-radius: 8px;
  padding: 10px;
  margin-top: 10px;

  &__item {
    flex: 1;

    &__label {
      display: block;
      font-size: 12px;
      color: #999;
    }
  }

  &__label {
    font-size: 12px;
    color: #999;
  }

  &__val {
    display: block;
    font-size: 13px;
    color: #2f86ff;
    font-weight: 600;
    margin-top: 4px;

    &.warn {
      color: #f56c6c;
    }
  }
}
</style>
