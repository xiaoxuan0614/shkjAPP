<route lang="json5">
{
  style: {
    navigationBarTitleText: '内协打卡',
  },
}
</route>
<template>
  <PageLayout>
    <scroll-view class="page" :scroll-y="true">
      <!-- 当前打卡 -->
      <SectionCard title="内协打卡">
        <view class="form-row">
          <text class="label">关联单号</text>
          <input class="input" v-model="orderNo" placeholder="输入工单/项目单号自动带出" placeholder-style="color:#bbb" />
        </view>
        <view class="loc-box">
          <view class="loc-icon">📍</view>
          <view class="loc-info">
            <view class="loc-name">{{ location.name || '点击获取定位' }}</view>
            <view class="loc-addr">{{ location.address }}</view>
          </view>
          <text class="loc-btn" @click="getLocation">定位</text>
        </view>
        <view class="form-row" v-if="checkedIn">
          <text class="label">工作内容</text>
          <textarea class="textarea" v-model="workContent" placeholder="结束打卡前请填写工作内容" placeholder-style="color:#bbb" />
        </view>
        <view class="form-row" v-if="checkedIn">
          <text class="label">位置异常</text>
          <view class="switch-wrap">
            <switch :checked="locationAbnormal" color="#f56c6c" @change="(e: any) => (locationAbnormal = e.detail.value)" />
          </view>
        </view>
        <view v-if="checkedIn && locationAbnormal" class="form-row">
          <text class="label">异常原因</text>
          <input class="input" v-model="abnormalReason" placeholder="必填" placeholder-style="color:#bbb" />
        </view>
        <view class="punch-btn-wrap">
          <text class="punch-btn" :class="checkedIn ? 'out' : 'in'" @click="togglePunch">{{ checkedIn ? '结束打卡' : '签到' }}</text>
        </view>
      </SectionCard>

      <!-- 打卡记录 -->
      <SectionCard title="打卡记录">
        <view v-for="a in records" :key="a.id" class="rec">
          <view class="rec__head">
            <text class="rec__order">{{ a.orderNo }}</text>
            <StatusBadge :value="a.status" :dict="attStatus" />
          </view>
          <view class="rec__row"><text class="label">日期</text><text class="val">{{ a.date }}</text></view>
          <view class="rec__row"><text class="label">签到/结束</text><text class="val">{{ a.checkin }} / {{ a.checkout || '—' }}</text></view>
          <view class="rec__row"><text class="label">位置</text><text class="val">{{ a.location }}</text></view>
          <view class="rec__row" v-if="a.workContent"><text class="label">工作内容</text><text class="val">{{ a.workContent }}</text></view>
        </view>
      </SectionCard>
    </scroll-view>
  </PageLayout>
</template>

<script lang="ts" setup>
import { onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { useToast } from 'wot-design-uni'
import { http } from '@/utils/http'
import StatusBadge from '@/components/StatusBadge/StatusBadge.vue'
import SectionCard from '@/components/SectionCard/SectionCard.vue'

const toast = useToast()
const orderNo = ref('GZ202608141020')
const checkedIn = ref(false)
const workContent = ref('')
const location = ref<any>({})
const locationAbnormal = ref(false)
const abnormalReason = ref('')
const records = ref<any[]>([])

const attStatus = [
  { value: 'processing', label: '进行中', color: '#409eff' },
  { value: 'done', label: '已完成', color: '#67c23a' },
]

const getLocation = () => {
  uni.getLocation({
    type: 'gcj02',
    success: () => {
      location.value = { name: '苏州工业园区科技园', address: '苏州市工业园区星湖街328号（模拟定位）' }
    },
    fail: () => {
      location.value = { name: '苏州工业园区科技园', address: '定位失败，使用模拟定位（开发模式）' }
    },
  })
}

const load = async () => {
  try {
    const res: any = await http.get('/ops/attendanceList')
    records.value = res.result || []
  } catch (e) {
    /* ignore */
  }
}

const togglePunch = async () => {
  if (!orderNo.value.trim()) return toast.warning('请填写关联单号')
  if (!location.value.name) return toast.warning('请先获取定位')
  if (checkedIn.value) {
    if (!workContent.value.trim()) return toast.warning('请填写工作内容')
    if (locationAbnormal.value && !abnormalReason.value.trim()) return toast.warning('请填写位置异常原因')
    await http.post('/ops/attendance/save', { orderNo: orderNo.value, type: 'out', location: location.value, workContent: workContent.value, locationAbnormal: locationAbnormal.value, abnormalReason: abnormalReason.value })
    toast.success('打卡完成')
    checkedIn.value = false
  } else {
    await http.post('/ops/attendance/save', { orderNo: orderNo.value, type: 'in', location: location.value })
    toast.success('签到成功')
    checkedIn.value = true
    workContent.value = ''
  }
  load()
}

onShow(() => {
  load()
  if (!location.value.name) getLocation()
})
</script>

<style lang="scss" scoped>
.page {
  min-height: 0;
}

.form-row {
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f5f5f5;

  &:last-child {
    border-bottom: none;
  }

  .label {
    width: 84px;
    font-size: 14px;
    color: #333;
    flex: none;
  }

  .input {
    flex: 1;
    font-size: 14px;
  }

  .textarea {
    flex: 1;
    height: 60px;
    font-size: 13px;
    padding: 0;
  }

  .switch-wrap {
    flex: 1;
  }
}

.loc-box {
  display: flex;
  align-items: center;
  padding: 14px 0;

  .loc-icon {
    font-size: 26px;
    margin-right: 10px;
  }

  .loc-info {
    flex: 1;

    .loc-name {
      font-size: 14px;
      color: #333;
      font-weight: 500;
    }

    .loc-addr {
      font-size: 12px;
      color: #999;
      margin-top: 2px;
    }
  }

  .loc-btn {
    color: #2f86ff;
    font-size: 13px;
    padding: 6px 16px;
    border: 1px solid #2f86ff;
    border-radius: 16px;
  }
}

.punch-btn-wrap {
  padding: 20px 0 6px;

  .punch-btn {
    display: block;
    width: 120px;
    margin: 0 auto;
    text-align: center;
    padding: 14px 0;
    border-radius: 30px;
    font-size: 16px;
    font-weight: 600;

    &.in {
      background: #2f86ff;
      color: #fff;
    }

    &.out {
      background: #f56c6c;
      color: #fff;
    }
  }
}

.rec {
  padding: 10px 0;
  border-bottom: 1px solid #f5f5f5;

  &:last-child {
    border-bottom: none;
  }

  &__head {
    display: flex;
    justify-content: space-between;
    margin-bottom: 6px;
  }

  &__order {
    font-size: 14px;
    font-weight: 600;
    color: #333;
  }

  &__row {
    display: flex;
    margin-top: 5px;

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
}
</style>
