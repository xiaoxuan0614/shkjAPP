<route lang="json5">
{
  style: {
    navigationBarTitleText: '报修接单',
  },
}
</route>
<template>
  <PageLayout :navbarShow="false">
    <scroll-view class="page" :scroll-y="true">
      <view class="count-tip">共 {{ list.length }} 条待接单报修</view>
      <view v-for="r in list" :key="r.id" class="card">
        <view class="card__head">
          <text class="card__no">{{ r.repairNo }}</text>
          <text class="card__time">{{ r.createTime }}</text>
        </view>
        <view class="row"><text class="label">客户</text><text class="val">{{ r.customerName }}</text></view>
        <view class="row"><text class="label">地址</text><text class="val">{{ r.address }}</text></view>
        <view class="row"><text class="label">故障</text><text class="val">{{ r.faultTypeText }} · {{ r.faultDesc }}</text></view>
        <view class="row"><text class="label">联系人</text><text class="val">{{ r.contact }} {{ r.phone }}</text></view>
        <view class="ops">
          <text class="op op--plain" @click="openReject(r)">驳回</text>
          <text class="op op--primary" @click="openAccept(r)">接单</text>
        </view>
      </view>
    </scroll-view>

    <!-- 接单弹窗：选择维修类型 -->
    <wd-popup v-model="showAccept" position="bottom" custom-style="border-radius:16px 16px 0 0;">
      <view class="popup">
        <view class="popup__title">选择维修类型</view>
        <view class="popup__sub">报修单：{{ current?.repairNo }}</view>
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
        <view class="popup__sub">报修单：{{ current?.repairNo }}</view>
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
import { onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { useToast } from 'wot-design-uni'
import { http } from '@/utils/http'
import { REPAIR_TYPE } from '@/types/business'

const toast = useToast()
const list = ref<any[]>([])
const showAccept = ref(false)
const showReject = ref(false)
const current = ref<any>(null)
const repairType = ref('offline')
const rejectReason = ref('')

const load = async () => {
  try {
    const res: any = await http.get('/ops/acceptList')
    list.value = res.result || []
  } catch (e) {
    /* ignore */
  }
}

const openAccept = (r: any) => {
  current.value = r
  repairType.value = 'offline'
  showAccept.value = true
}
const openReject = (r: any) => {
  current.value = r
  rejectReason.value = ''
  showReject.value = true
}

const confirmAccept = async () => {
  await http.post('/ops/accept', { id: current.value.id, repairType: repairType.value })
  toast.success('接单成功')
  showAccept.value = false
  load()
  const type = REPAIR_TYPE.find((t) => t.value === repairType.value)?.label
  uni.navigateTo({ url: `/pages/ops/${repairType.value === 'online' ? 'repairOnline' : 'repairOffline'}` })
}

const confirmReject = async () => {
  if (!rejectReason.value.trim()) return toast.warning('请填写驳回原因')
  await http.post('/ops/reject', { id: current.value.id, reason: rejectReason.value })
  toast.success('已驳回')
  showReject.value = false
  load()
}

onShow(load)
</script>

<style lang="scss" scoped>
.page {
  min-height: 0;
  padding: 12px;
}

.count-tip {
  color: #999;
  font-size: 13px;
  padding: 4px 4px 12px;
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

  &__time {
    font-size: 12px;
    color: #bbb;
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

.ops {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid #f5f5f5;

  .op {
    font-size: 13px;
    padding: 7px 22px;
    border-radius: 18px;
    margin-left: 12px;

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

  &__sub {
    font-size: 12px;
    color: #999;
    text-align: center;
    margin-top: 4px;
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
