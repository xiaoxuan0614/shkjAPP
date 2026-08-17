<route lang="json5">
{
  style: {
    navigationBarTitleText: '报修派单',
  },
}
</route>
<template>
  <PageLayout>
    <scroll-view class="list" :scroll-y="true">
      <view v-if="!list.length" class="empty">暂无报修</view>
      <view v-for="d in list" :key="d.id" class="card" @click="goDetail(d)">
        <view class="card__head">
          <text class="card__no">{{ d.repairNo }}</text>
          <StatusBadge :value="d.status" :dict="statusDict" />
        </view>
        <view class="row"><text class="label">客户</text><text class="val">{{ d.customerName }}</text></view>
        <view class="row"><text class="label">故障</text><text class="val ellipsis">{{ d.faultTypeText }} · {{ d.faultDesc }}</text></view>
        <view class="row"><text class="label">报修时间</text><text class="val">{{ d.createTime }}</text></view>
        <view class="row" v-if="d.assignee"><text class="label">派给</text><text class="val">{{ d.assignee }}</text></view>
        <view class="row" v-if="d.rejectReason"><text class="label">驳回原因</text><text class="val">{{ d.rejectReason }}</text></view>
        <view class="ops" @click.stop>
          <text v-if="d.status === 'unassigned'" class="op op--plain" @click="reject(d)">驳回</text>
          <text v-if="d.status === 'unassigned'" class="op op--primary" @click="assign(d)">派单</text>
        </view>
      </view>
    </scroll-view>

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
import { onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { useToast } from 'wot-design-uni'
import { http } from '@/utils/http'
import StatusBadge from '@/components/StatusBadge/StatusBadge.vue'

const toast = useToast()
const list = ref<any[]>([])
const statusDict = [
  { value: 'unassigned', label: '待派单', color: '#e6a23c' },
  { value: 'assigned', label: '已派单', color: '#67c23a' },
  { value: 'rejected', label: '已驳回', color: '#f56c6c' },
]
const showAssign = ref(false)
const showReject = ref(false)
const current = ref<any>(null)
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
    const res: any = await http.get('/dispatch/list')
    list.value = res.result || []
  } catch (e) {
    /* ignore */
  }
}

const goDetail = (d: any) => uni.navigateTo({ url: `/pages/dispatch/detail?id=${d.id}` })

const assign = (d: any) => {
  current.value = d
  assignee.value = ''
  showAssign.value = true
}

const doAssign = async () => {
  if (!assignee.value) return toast.warning('请选择接单人员')
  await http.post('/dispatch/assign', { id: current.value.id, assignee: assignee.value })
  toast.success('派单成功')
  showAssign.value = false
  load()
}

const reject = (d: any) => {
  current.value = d
  rejectReason.value = ''
  showReject.value = true
}

const doReject = async () => {
  if (!rejectReason.value.trim()) return toast.warning('请填写驳回原因')
  await http.post('/dispatch/reject', { id: current.value.id, reason: rejectReason.value })
  toast.success('已驳回')
  showReject.value = false
  load()
}

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
