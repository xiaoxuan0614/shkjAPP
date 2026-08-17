<route lang="json5">
{
  style: {
    navigationBarTitleText: '审批详情',
  },
}
</route>
<template>
  <PageLayout v-if="detail.id">
    <scroll-view class="page" :scroll-y="true">
      <SectionCard title="审批时间线">
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

      <SectionCard title="维修费用明细">
        <view class="row"><text class="label">人工费</text><text class="val price">¥{{ detail.price.labor }}</text></view>
        <view class="row"><text class="label">材料费</text><text class="val price">¥{{ detail.price.material }}</text></view>
        <view class="row"><text class="label">合计</text><text class="val price total">¥{{ detail.price.total }}</text></view>
      </SectionCard>

      <SectionCard title="工单信息">
        <view class="row"><text class="label">工单单号</text><text class="val">{{ detail.orderNo }}</text></view>
        <view class="row"><text class="label">客户名称</text><text class="val">{{ detail.customerName }}</text></view>
        <view class="row"><text class="label">维保项目</text><text class="val">{{ detail.project }}</text></view>
        <view class="row"><text class="label">维修人员</text><text class="val">{{ detail.repairerName }}</text></view>
        <view class="row"><text class="label">提交时间</text><text class="val">{{ detail.submitTime }}</text></view>
      </SectionCard>
    </scroll-view>

    <view class="bottom">
      <text class="btn btn--danger" @click="showReject = true">驳回</text>
      <text class="btn btn--primary" @click="approve">通过</text>
    </view>

    <!-- 驳回弹窗 -->
    <wd-popup v-model="showReject" position="bottom" custom-style="border-radius:16px 16px 0 0;">
      <view class="popup">
        <view class="popup__title">驳回原因</view>
        <textarea class="reject-textarea" v-model="rejectReason" placeholder="请填写驳回原因（必填）" placeholder-style="color:#bbb" />
        <view class="popup__btns">
          <text class="btn btn--plain" @click="showReject = false">取消</text>
          <text class="btn btn--danger" @click="doReject">确认驳回</text>
        </view>
      </view>
    </wd-popup>
  </PageLayout>
</template>

<script lang="ts" setup>
import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { useToast, useMessage } from 'wot-design-uni'
import { http } from '@/utils/http'
import SectionCard from '@/components/SectionCard/SectionCard.vue'

const toast = useToast()
const message = useMessage()
const detail = ref<any>({})
const id = ref('')
const showReject = ref(false)
const rejectReason = ref('')

const load = async () => {
  try {
    const res: any = await http.get('/admin/approvalDetail', { id: id.value })
    detail.value = res.result
  } catch (e) {
    /* ignore */
  }
}

const approve = () => {
  message
    .confirm({ title: '通过审批', msg: '一旦通过，全部流程结束\n请确认维修费用与工单信息无误' })
    .then(doApprove)
    .catch(() => {})
}

const doApprove = async () => {
  await http.post('/admin/approval/approve', { id: id.value })
  toast.success('已通过，流程结束')
  uni.navigateBack()
}

const doReject = async () => {
  if (!rejectReason.value.trim()) return toast.warning('请填写驳回原因')
  await http.post('/admin/approval/reject', { id: id.value, reason: rejectReason.value })
  toast.success('已驳回')
  showReject.value = false
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

    &.price {
      color: #f56c6c;

      &.total {
        font-weight: 700;
      }
    }
  }
}

.timeline {
  .tl {
    display: flex;
    padding-bottom: 16px;

    &:last-child {
      padding-bottom: 0;
    }

    &__dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #e6a23c;
      margin-top: 4px;
      flex: none;
      position: relative;
      z-index: 1;

      &.last {
        background: #e6a23c;
        animation: pulse 1.5s infinite;
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

@keyframes pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(230, 162, 60, 0.4);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(230, 162, 60, 0.1);
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
    padding: 12px 0;
    border-radius: 22px;
    font-size: 15px;
    margin-left: 12px;

    &:first-child {
      margin-left: 0;
    }

    &--primary {
      background: #67c23a;
      color: #fff;
    }

    &--danger {
      background: #f56c6c;
      color: #fff;
    }
  }
}

.tip-box {
  text-align: center;
  padding: 8px 0;

  .tip-icon {
    font-size: 36px;
  }

  .tip-text {
    font-size: 16px;
    font-weight: 600;
    margin-top: 8px;
  }

  .tip-sub {
    font-size: 13px;
    color: #999;
    margin-top: 6px;
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
    margin-top: 16px;

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

      &--danger {
        background: #f56c6c;
        color: #fff;
      }
    }
  }
}

.reject-textarea {
  width: 100%;
  height: 80px;
  margin-top: 14px;
  background: #f7f8fa;
  border-radius: 8px;
  padding: 12px;
  font-size: 14px;
  box-sizing: border-box;
}
</style>
