<route lang="json5">
{
  style: {
    navigationBarTitleText: '报修详情',
  },
}
</route>
<template>
  <PageLayout v-if="detail.id">
    <scroll-view class="page" :scroll-y="true">
      <!-- 状态卡 -->
      <view class="status-card" :style="{ background: statusBg }">
        <view class="status-card__no">{{ detail.repairNo }}</view>
        <StatusBadge :value="detail.status" :dict="REPAIR_STATUS" />
      </view>

      <!-- 报修信息 -->
      <SectionCard title="报修信息">
        <view class="row"><text class="label">报修项目</text><text class="val">{{ detail.project }}</text></view>
        <view class="row"><text class="label">客户名称</text><text class="val">{{ detail.customerName }}</text></view>
        <view class="row"><text class="label">所在地址</text><text class="val">{{ detail.address }}</text></view>
        <view class="row"><text class="label">联系人</text><text class="val">{{ detail.contact }} {{ detail.phone }}</text></view>
        <view class="row"><text class="label">故障描述</text><text class="val">{{ detail.faultDesc }}</text></view>
        <view class="row"><text class="label">报修时间</text><text class="val">{{ detail.createTime }}</text></view>
        <view class="row" v-if="detail.images?.length"><text class="label">现场照片</text>
          <view class="photos"><image v-for="(p, i) in detail.images" :key="i" :src="p" mode="aspectFill" class="photo" @click="preview(detail.images, i)" /></view>
        </view>
      </SectionCard>

      <!-- 状态专属信息 -->
      <SectionCard v-if="detail.status === 'processing'" title="维修进度">
        <view class="row"><text class="label">维修专员</text><text class="val">📞 {{ detail.repairerName }} {{ detail.repairerPhone }}</text></view>
      </SectionCard>

      <SectionCard v-if="detail.status === 'confirming'" title="维修结果待确认">
        <view class="row"><text class="label">维修专员</text><text class="val">{{ detail.repairerName }} {{ detail.repairerPhone }}</text></view>
        <view class="row"><text class="label">维修后照片</text>
          <view class="photos"><image v-for="(p, i) in detail.repairPhotos" :key="i" :src="p" mode="aspectFill" class="photo" @click="preview(detail.repairPhotos, i)" /></view>
        </view>
        <view class="row" v-if="detail.price"><text class="label">维修报价</text>
          <text class="val price">人工 ¥{{ detail.price.labor }} · 材料 ¥{{ detail.price.material }} · 合计 ¥{{ detail.price.total }}</text>
        </view>
        <view class="confirm-btn" @click="goConfirm">去确认</view>
      </SectionCard>

      <SectionCard v-if="detail.status === 'done'" title="服务评价">
        <view class="row"><text class="label">响应速度</text><text class="val">{{ starText(detail.evaluate?.speed) }}</text></view>
        <view class="row"><text class="label">处理速度</text><text class="val">{{ starText(detail.evaluate?.attitude) }}</text></view>
        <view class="row" v-if="detail.evaluate?.suggestion"><text class="label">建议</text><text class="val">{{ detail.evaluate.suggestion }}</text></view>
      </SectionCard>

      <SectionCard v-if="detail.reason" :title="detail.status === 'withdrawn' ? '撤回原因' : '驳回原因'">
        <view class="row"><text class="label">原因</text><text class="val">{{ detail.reason }}</text></view>
      </SectionCard>

      <!-- 处理时间线 -->
      <SectionCard title="处理进度">
        <view class="timeline">
          <view v-for="(t, i) in detail.timeline" :key="i" class="tl">
            <view class="tl__dot" :class="{ last: i === detail.timeline.length - 1 }"></view>
            <view class="tl__body">
              <view class="tl__title">{{ t.title }}</view>
              <view class="tl__desc">{{ t.desc }}</view>
              <view class="tl__time">{{ t.time }}</view>
            </view>
          </view>
        </view>
      </SectionCard>
    </scroll-view>

    <!-- 底部操作 -->
    <view class="bottom" v-if="detail.status === 'pending' || detail.status === 'withdrawn' || detail.status === 'rejected'">
      <text v-if="detail.status === 'pending'" class="btn btn--warn" @click="withdraw">撤回</text>
      <template v-if="detail.status === 'withdrawn' || detail.status === 'rejected'">
        <text class="btn" @click="goRepair">修改信息</text>
        <text class="btn btn--danger" @click="remove">删除</text>
      </template>
    </view>
  </PageLayout>
</template>

<script lang="ts" setup>
import { onLoad } from '@dcloudio/uni-app'
import { ref, computed } from 'vue'
import { useToast, useMessage } from 'wot-design-uni'
import { http } from '@/utils/http'
import { REPAIR_STATUS } from '@/types/business'
import StatusBadge from '@/components/StatusBadge/StatusBadge.vue'
import SectionCard from '@/components/SectionCard/SectionCard.vue'

const toast = useToast()
const detail = ref<any>({})
const id = ref('')

const statusBg = computed(() => {
  const s = REPAIR_STATUS.find((x) => x.value === detail.value.status)
  return (s?.color ?? '#909399') + '1a'
})

const starText = (n: number) => (n ? '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(n) : '-')

const load = async () => {
  try {
    const res: any = await http.get('/repair/detail', { id: id.value })
    detail.value = res.result
  } catch (e) {
    /* ignore */
  }
}

const preview = (urls: string[], index: number) => uni.previewImage({ urls, current: index })
const goRepair = () => uni.navigateTo({ url: '/pages/customer/repair' })
const goConfirm = () => uni.navigateTo({ url: `/pages/customer/confirm?id=${id.value}` })

const withdraw = () => {
  useMessage()
    .confirm('确定撤回该报修吗？')
    .then(async () => {
      await http.post('/repair/withdraw', { id: id.value })
      toast.success('已撤回')
      uni.navigateBack()
    })
    .catch(() => {})
}

const remove = () => {
  useMessage()
    .confirm('删除后不可恢复，确定删除吗？')
    .then(async () => {
      await http.post('/repair/remove', { id: id.value })
      toast.success('已删除')
      uni.navigateBack()
    })
    .catch(() => {})
}

onLoad((query) => {
  id.value = query?.id || ''
  load()
})
</script>

<style lang="scss" scoped>
.page {
  min-height: 0;
}

.status-card {
  margin: 12px;
  padding: 16px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;

  &__no {
    font-size: 18px;
    font-weight: 700;
    color: #333;
  }
}

.row {
  display: flex;
  margin-top: 10px;

  .label {
    width: 84px;
    font-size: 13px;
    color: #999;
    flex: none;
  }

  .val {
    flex: 1;
    font-size: 13px;
    color: #333;
  }

  .price {
    color: #f56c6c;
    font-weight: 500;
  }

  .photos {
    display: flex;
    flex-wrap: wrap;
    flex: 1;

    .photo {
      width: 64px;
      height: 64px;
      border-radius: 6px;
      margin: 0 8px 8px 0;
    }
  }
}

.confirm-btn {
  margin-top: 12px;
  text-align: center;
  background: #2f86ff;
  color: #fff;
  border-radius: 20px;
  padding: 10px 0;
  font-size: 14px;
}

.timeline {
  .tl {
    display: flex;
    position: relative;
    padding-bottom: 18px;

    &:last-child {
      padding-bottom: 0;
    }

    &__dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #2f86ff;
      margin-top: 4px;
      flex: none;
      position: relative;
      z-index: 1;

      &.last {
        background: #67c23a;
      }
    }

    &::before {
      content: '';
      position: absolute;
      left: 4px;
      top: 14px;
      bottom: 0;
      width: 2px;
      background: #e5e5e5;
    }

    &:last-child::before {
      display: none;
    }

    &__body {
      margin-left: 12px;
      flex: 1;
    }

    &__title {
      font-size: 14px;
      color: #333;
      font-weight: 500;
    }

    &__desc {
      font-size: 12px;
      color: #666;
      margin-top: 2px;
    }

    &__time {
      font-size: 12px;
      color: #bbb;
      margin-top: 2px;
    }
  }
}

.bottom {
  display: flex;
  padding: 12px 16px;
  background: #fff;
  border-top: 1px solid #f0f0f0;

  .btn {
    flex: 1;
    text-align: center;
    padding: 10px 0;
    border-radius: 22px;
    border: 1px solid #ddd;
    color: #666;
    font-size: 14px;
    margin-left: 12px;

    &:first-child {
      margin-left: 0;
    }

    &--warn {
      color: #e6a23c;
      border-color: #e6a23c;
    }

    &--danger {
      color: #f56c6c;
      border-color: #f56c6c;
    }
  }
}
</style>
