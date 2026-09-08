<route lang="json5">
{
  style: {
    navigationBarTitleText: '派单详情',
  },
}
</route>
<template>
  <PageLayout :navbarShow="false" v-if="detail.id">
    <scroll-view class="page" :scroll-y="true">
      <SectionCard title="报修信息">
        <view class="row"><text class="label">报修单号</text><text class="val">{{ detail.repairNo }}</text></view>
        <view class="row"><text class="label">客户名称</text><text class="val">{{ detail.customerName }}</text></view>
        <view class="row"><text class="label">故障类型</text><text class="val">{{ detail.faultTypeText }}</text></view>
        <view class="row"><text class="label">故障描述</text><text class="val">{{ detail.faultDesc }}</text></view>
        <view class="row"><text class="label">报修时间</text><text class="val">{{ detail.createTime }}</text></view>
        <view class="row" v-if="detail.rejectReason"><text class="label">驳回原因</text><text class="val">{{ detail.rejectReason }}</text></view>
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

    <view class="bottom" v-if="detail.status === 'unassigned'">
      <text class="btn btn--plain" @click="showReject = true">驳回</text>
      <text class="btn btn--primary" @click="showAssign = true">派单</text>
    </view>

    <!-- 派单弹窗 -->
    <wd-popup v-model="showAssign" position="bottom" custom-style="border-radius:16px 16px 0 0;">
      <view class="popup">
        <view class="popup__title">确认派单</view>
        <view class="form-row">
          <text class="label">接单人员</text>
          <view class="chips">
            <text v-for="p in persons" :key="p.name" class="chip" :class="{ on: assignee === p.name }" @click="assignee = p.name">{{ p.name }}</text>
          </view>
        </view>
        <view class="popup__btns">
          <text class="btn btn--plain" @click="showAssign = false">取消</text>
          <text class="btn btn--primary" @click="doAssign">确认派单</text>
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
          <text class="btn btn--danger" @click="doReject">确认驳回</text>
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
import SectionCard from '@/components/SectionCard/SectionCard.vue'

const toast = useToast()
const detail = ref<any>({})
const id = ref('')
const showAssign = ref(false)
const showReject = ref(false)
const assignee = ref('')
const rejectReason = ref('')
const persons = [
  { name: '李伟' },
  { name: '王强' },
  { name: '赵磊' },
  { name: '孙浩' },
]

const load = async () => {
  try {
    const res: any = await http.get('/dispatch/detail', { id: id.value })
    detail.value = res.result
  } catch (e) {
    /* ignore */
  }
}

const doAssign = async () => {
  if (!assignee.value) return toast.warning('请选择接单人员')
  await http.post('/dispatch/assign', { id: id.value, assignee: assignee.value })
  toast.success('派单成功')
  uni.navigateBack()
}

const doReject = async () => {
  if (!rejectReason.value.trim()) return toast.warning('请填写驳回原因')
  await http.post('/dispatch/reject', { id: id.value, reason: rejectReason.value })
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
    padding-bottom: 16px;

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
    padding: 12px 0;
    border-radius: 22px;
    font-size: 15px;
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

.form-row {
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f5f5f5;

  .label {
    width: 84px;
    font-size: 14px;
    color: #333;
    flex: none;
  }

  .chips {
    flex: 1;
    display: flex;
    flex-wrap: wrap;

    .chip {
      padding: 5px 14px;
      border: 1px solid #ddd;
      border-radius: 16px;
      font-size: 13px;
      color: #666;
      margin: 0 8px 8px 0;

      &.on {
        border-color: #2f86ff;
        color: #2f86ff;
        background: #f0f7ff;
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
