<route lang="json5">
{
  style: {
    navigationBarTitleText: '巡检管理',
  },
}
</route>
<template>
  <PageLayout :navbarShow="false">
    <scroll-view class="list" :scroll-y="true">
      <view v-if="!list.length" class="empty">暂无巡检任务</view>
      <view v-for="t in list" :key="t.id" class="card" @click="goDetail(t)">
        <view class="card__head">
          <text class="card__no">{{ t.xjNo }} · {{ t.name }}</text>
          <StatusBadge :value="t.status" :dict="statusDict" />
        </view>
        <view class="row"><text class="label">任务时间</text><text class="val">{{ t.taskTime }}</text></view>
        <view class="row"><text class="label">巡检人员</text><text class="val">{{ t.persons.join('、') }}</text></view>
        <view class="row"><text class="label">设备清单</text><text class="val">{{ t.devices.join('、') }}</text></view>
        <view v-if="t.status === 'undone'" class="row">
          <text class="label">完成进度</text>
          <view class="progress-wrap">
            <view class="progress-bar">
              <view class="progress-inner" :style="{ width: (t.finishedCount / t.objectCount) * 100 + '%' }"></view>
            </view>
            <text class="progress-text">{{ t.finishedCount }}/{{ t.objectCount }} · 异常 {{ t.abnormalCount }}</text>
          </view>
        </view>
        <view v-if="t.status === 'done'" class="row"><text class="label">办结说明</text><text class="val">{{ t.finishRemark }}</text></view>
      </view>
    </scroll-view>
  </PageLayout>
</template>

<script lang="ts" setup>
import { onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { http } from '@/utils/http'
import StatusBadge from '@/components/StatusBadge/StatusBadge.vue'

const list = ref<any[]>([])
const statusDict = [
  { value: 'undone', label: '未办结', color: '#e6a23c' },
  { value: 'done', label: '已办结', color: '#67c23a' },
]

const load = async () => {
  try {
    const res: any = await http.get('/inspection/list')
    list.value = res.result || []
  } catch (e) {
    /* ignore */
  }
}

const goDetail = (t: any) => uni.navigateTo({ url: `/pages/ops/inspectionDetail?id=${t.id}` })

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

.progress-wrap {
  flex: 1;

  .progress-bar {
    height: 6px;
    background: #f0f0f0;
    border-radius: 3px;
    overflow: hidden;

    .progress-inner {
      height: 100%;
      background: #2f86ff;
      border-radius: 3px;
    }
  }

  .progress-text {
    font-size: 12px;
    color: #999;
    margin-top: 4px;
  }
}
</style>
