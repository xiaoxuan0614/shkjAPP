<route lang="json5">
{
  style: {
    navigationBarTitleText: '接单详情',
  },
}
</route>
<template>
  <PageLayout :navbarShow="false" v-if="detail.id">
    <scroll-view class="page" :scroll-y="true">
      <SectionCard title="报修信息">
        <view class="row"><text class="label">报修单号</text><text class="val">{{ detail.repairNo }}</text></view>
        <view class="row"><text class="label">客户名称</text><text class="val">{{ detail.customerName }}</text></view>
        <view class="row"><text class="label">所在地址</text><text class="val">{{ detail.address }}</text></view>
        <view class="row"><text class="label">联系人</text><text class="val">{{ detail.contact }} {{ detail.phone }}</text></view>
        <view class="row"><text class="label">故障类型</text><text class="val">{{ detail.faultTypeText }}</text></view>
        <view class="row"><text class="label">故障描述</text><text class="val">{{ detail.faultDesc }}</text></view>
        <view class="row"><text class="label">报修时间</text><text class="val">{{ detail.createTime }}</text></view>
      </SectionCard>

      <SectionCard title="处理时间线">
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

    <view class="bottom">
      <text class="btn btn--plain" @click="showReject = true">驳回</text>
      <text class="btn btn--primary" @click="showAccept = true">接单</text>
    </view>

    <!-- 接单弹窗 -->
    <wd-popup v-model="showAccept" position="bottom" custom-style="border-radius:16px 16px 0 0;">
      <view class="popup">
        <view class="popup__title">选择维修类型</view>
        <view class="radio-list">
          <view v-for="t in REPAIR_TYPE" :key="t.value" class="radio" :class="{ on: repairType === t.value }" @click="repairType = t.value">
            <text>{{ t.label }}</text>
            <text class="radio__dot">{{ repairType === t.value ? '●' : '○' }}</text>
          </view>
        </view>
        <view class="popup__btns">
          <text class="btn btn--plain" @click="showAccept = false">取消</text>
          <text class="btn btn--primary" @click="confirmAccept">确认接单</text>
        </view>
      </view>
    </wd-popup>

    <!-- 驳回弹窗 -->
    <wd-popup v-model="showReject" position="bottom" custom-style="border-radius:16px 16px 0 0;">
      <view class="popup">
        <view class="popup__title">驳回原因</view>
        <textarea class="reject-textarea" v-model="rejectReason" placeholder="请填写驳回原因（必填）" placeholder-style="color:#bbb" />
        <view class="popup__btns">
          <text class="btn btn--plain" @click="showReject = false">取消</text>
          <text class="btn btn--danger" @click="confirmReject">确认驳回</text>
        </view>
      </view>
    </wd-popup>
  </PageLayout>
</template>

<script lang="ts" setup>
import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { useToast } from 'wot-design-uni'
import { http } from '@/utils/http'
import { REPAIR_TYPE } from '@/types/business'
import SectionCard from '@/components/SectionCard/SectionCard.vue'

const toast = useToast()
const detail = ref<any>({})
const id = ref('')
const showAccept = ref(false)
const showReject = ref(false)
const repairType = ref('offline')
const rejectReason = ref('')

const load = async () => {
  try {
    const res: any = await http.get('/ops/acceptDetail', { id: id.value })
    detail.value = res.result
  } catch (e) {
    /* ignore */
  }
}

const confirmAccept = async () => {
  await http.post('/ops/accept', { id: id.value, repairType: repairType.value })
  toast.success('接单成功')
  uni.navigateBack()
}

const confirmReject = async () => {
  if (!rejectReason.value.trim()) return toast.warning('请填写驳回原因')
  await http.post('/ops/reject', { id: id.value, reason: rejectReason.value })
  toast.success('已驳回')
  uni.navigateBack()
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
}

.timeline {
  .tl {
    display: flex;
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
    padding: 11px 0;
    border-radius: 22px;
    font-size: 14px;
    margin-left: 12px;

    &:first-child {
      margin-left: 0;
    }

    &--plain {
      border: 1px solid #ddd;
      color: #666;
    }

    &--primary {
      background: #2f86ff;
      color: #fff;
    }

    &--danger {
      background: #f56c6c;
      color: #fff;
    }
  }
}

.popup {
  padding: 16px 20px 24px;

  &__title {
    font-size: 16px;
    font-weight: 600;
    text-align: center;
  }

  &__btns {
    display: flex;
    margin-top: 20px;

    .btn {
      flex: 1;
      text-align: center;
      padding: 11px 0;
      border-radius: 22px;
      font-size: 14px;
      margin-left: 12px;

      &:first-child {
        margin-left: 0;
      }

      &--plain {
        border: 1px solid #ddd;
        color: #666;
      }

      &--primary {
        background: #2f86ff;
        color: #fff;
      }

      &--danger {
        background: #f56c6c;
        color: #fff;
      }
    }
  }
}

.radio-list {
  margin-top: 16px;

  .radio {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px;
    border: 1px solid #eee;
    border-radius: 10px;
    margin-bottom: 10px;
    font-size: 14px;
    color: #333;

    &.on {
      border-color: #2f86ff;
      color: #2f86ff;
    }

    &__dot {
      color: #2f86ff;
    }
  }
}

.reject-textarea {
  width: 100%;
  height: 90px;
  margin-top: 16px;
  background: #f7f8fa;
  border-radius: 8px;
  padding: 12px;
  font-size: 14px;
  box-sizing: border-box;
}
</style>
