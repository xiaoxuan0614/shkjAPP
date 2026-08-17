<route lang="json5">
{
  style: {
    navigationBarTitleText: '线上维修',
  },
}
</route>
<template>
  <PageLayout v-if="order.id">
    <scroll-view class="page" :scroll-y="true">
      <view class="tip-banner">软件线上维修无需预约单，首次填写日志自动生成维修单号</view>

      <SectionCard title="工单信息">
        <view class="row"><text class="label">工单单号</text><text class="val">{{ order.orderNo }}</text></view>
        <view class="row"><text class="label">客户名称</text><text class="val">{{ order.customerName }}</text></view>
        <view class="row"><text class="label">故障项目</text><text class="val">{{ order.project }}</text></view>
        <view class="row"><text class="label">故障描述</text><text class="val">{{ order.faultDesc }}</text></view>
        <view class="row"><text class="label">维护性质</text><text class="val">{{ order.maintenanceNatureText }}</text></view>
        <view class="row"><text class="label">维护类型</text><text class="val">线上维修</text></view>
      </SectionCard>

      <SectionCard title="维修日志">
        <view class="row">
          <text class="label">维修状态</text>
          <view class="radio-group">
            <text v-for="s in states" :key="s.value" class="radio" :class="{ on: log.repairStatus === s.value }" @click="log.repairStatus = s.value">{{ s.label }}</text>
          </view>
        </view>
        <view class="row row--top">
          <text class="label">维修描述</text>
          <textarea class="textarea" v-model="log.description" placeholder="请描述排查过程与处理结果" placeholder-style="color:#bbb" />
        </view>
        <view v-if="log.repairStatus === 'redo'" class="row row--top">
          <text class="label">复修原因</text>
          <textarea class="textarea" v-model="log.redoReason" placeholder="请填写复修原因" placeholder-style="color:#bbb" />
        </view>
        <view class="row">
          <text class="label">需内协</text>
          <view class="radio-group">
            <text class="radio" :class="{ on: log.needAssistant }" @click="log.needAssistant = true">是</text>
            <text class="radio" :class="{ on: !log.needAssistant }" @click="log.needAssistant = false">否</text>
          </view>
        </view>
      </SectionCard>

      <view class="submit-wrap">
        <wd-button size="large" type="primary" :loading="submitting" @click="submit">提交维修日志</wd-button>
      </view>
    </scroll-view>
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
const order = ref<any>({})
const id = ref('')
const submitting = ref(false)
const wxNo = ref('')

const states = [
  { value: 'notStart', label: '暂未开始' },
  { value: 'redo', label: '需要复修' },
  { value: 'done', label: '维修完成' },
]
const log = ref({ repairStatus: 'done', description: '', redoReason: '', needAssistant: false })

const submit = async () => {
  if (!log.value.description) return toast.warning('请填写维修描述')
  submitting.value = true
  try {
    const res: any = await http.post('/ops/repair/log', { id: id.value, online: true, ...log.value })
    wxNo.value = res.result?.wxNo || 'WX' + Date.now()
    message.alert({ title: '维修完成', msg: `维修单号：${wxNo.value}\n线上维修完成，等待提交审批` }).then(() => uni.navigateBack())
  } catch (e) {
    toast.error('提交失败')
  } finally {
    submitting.value = false
  }
}

const back = () => uni.navigateBack()

onLoad(async (query) => {
  id.value = query?.id || ''
  try {
    const res: any = await http.get('/ops/repairDetail', { id: id.value })
    order.value = res.result
  } catch (e) {
    /* ignore */
  }
})
</script>

<style lang="scss" scoped>
.page {
  min-height: 0;
}

.tip-banner {
  background: #e8f3ff;
  color: #2f86ff;
  font-size: 12px;
  padding: 10px 14px;
  margin: 12px;
  border-radius: 8px;
}

.row {
  display: flex;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #f5f5f5;

  &:last-child {
    border-bottom: none;
  }

  &--top {
    align-items: flex-start;
  }

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

  .textarea {
    flex: 1;
    height: 80px;
    font-size: 13px;
    padding: 0;
  }

  .radio-group {
    flex: 1;
    display: flex;
    flex-wrap: wrap;

    .radio {
      padding: 4px 12px;
      border: 1px solid #ddd;
      border-radius: 14px;
      font-size: 12px;
      color: #666;
      margin: 0 8px 6px 0;

      &.on {
        border-color: #2f86ff;
        color: #2f86ff;
        background: #f0f7ff;
      }
    }
  }
}

.submit-wrap {
  padding: 20px 16px 40px;
}

.done-box {
  text-align: center;
  padding: 8px 0;

  .done-icon {
    font-size: 40px;
  }

  .done-no {
    font-size: 16px;
    font-weight: 600;
    margin-top: 10px;
  }

  .done-desc {
    font-size: 13px;
    color: #999;
    margin-top: 6px;
  }
}
</style>
