<route lang="json5">
{
  style: {
    navigationBarTitleText: '线下维修',
  },
}
</route>
<template>
  <PageLayout :navbarShow="false" v-if="order.id">
    <!-- 主步骤条 -->
    <view class="main-steps">
      <view v-for="(s, i) in mainSteps" :key="i" class="main-step" :class="{ on: i === mainStep, done: i < mainStep }">
        <text class="main-step__dot">{{ i < mainStep ? '✓' : i + 1 }}</text>
        <text class="main-step__label">{{ s }}</text>
      </view>
    </view>

    <scroll-view class="page" :scroll-y="true">
      <!-- ===== ① 签到 ===== -->
      <template v-if="mainStep === 0">
        <SectionCard title="到岗签到">
          <view class="loc-box">
            <view class="loc-icon">📍</view>
            <view class="loc-info">
              <view class="loc-name">{{ location.name || '正在获取定位…' }}</view>
              <view class="loc-addr">{{ location.address || '点击下方按钮获取当前位置' }}</view>
            </view>
          </view>
          <view class="loc-btns">
            <text class="loc-btn" @click="getLocation">重新定位</text>
          </view>
        </SectionCard>
        <view class="info-tip">工单信息已生成，签到后开始维修</view>
      </template>

      <!-- ===== ② 维修日志（3 步） ===== -->
      <template v-if="mainStep === 1">
        <view class="sub-steps">
          <view v-for="(s, i) in logSteps" :key="i" class="sub-step" :class="{ on: i === logStep, done: i < logStep }">
            <text class="sub-step__dot">{{ i < logStep ? '✓' : i + 1 }}</text>
            <text class="sub-step__label">{{ s }}</text>
          </view>
        </view>

        <!-- 1.基本信息 -->
        <SectionCard v-if="logStep === 0" title="基本信息">
          <view class="row"><text class="label">客户名称</text><text class="val">{{ order.customerName }}</text></view>
          <view class="row"><text class="label">维保日期</text><text class="val">{{ order.reservation?.reserveDate }}</text></view>
          <view class="row"><text class="label">维护性质</text><text class="val">{{ order.maintenanceNatureText }}</text></view>
          <view class="row"><text class="label">维护类型</text><text class="val">{{ order.maintenanceType }}</text></view>
          <view class="row"><text class="label">故障描述</text><text class="val">{{ order.faultDesc }}</text></view>
        </SectionCard>

        <!-- 2.维修记录 -->
        <SectionCard v-if="logStep === 1" title="维修记录">
          <view class="row">
            <text class="label">维修状态</text>
            <view class="radio-group">
              <text v-for="s in repairStates" :key="s.value" class="radio" :class="{ on: log.repairStatus === s.value }" @click="log.repairStatus = s.value">{{ s.label }}</text>
            </view>
          </view>
          <view class="row row--top">
            <text class="label">维修描述</text>
            <textarea class="textarea" v-model="log.description" placeholder="请描述维修内容与处理结果" placeholder-style="color:#bbb" />
          </view>
          <view v-if="log.repairStatus === 'redo'" class="row row--top">
            <text class="label">复修原因</text>
            <textarea class="textarea" v-model="log.redoReason" placeholder="请填写复修原因" placeholder-style="color:#bbb" />
          </view>
          <view class="row row--top">
            <text class="label">维修后照片</text>
            <view class="photos">
              <view v-for="(p, i) in log.afterPhotos" :key="i" class="photo">
                <image :src="p" mode="aspectFill" class="photo__img" />
                <text class="photo__del" @click="log.afterPhotos.splice(i, 1)">×</text>
              </view>
              <view class="photo photo--add" @click="addPhoto">＋</view>
            </view>
          </view>
          <view class="sub-title">故障信息</view>
          <view class="row row--top">
            <text class="label">故障位置</text>
            <input class="input" v-model="faultInfo.location" placeholder="填写故障位置" placeholder-style="color:#bbb" />
          </view>
          <view class="row row--top">
            <text class="label">故障描述</text>
            <input class="input" v-model="faultInfo.desc" placeholder="填写故障描述" placeholder-style="color:#bbb" />
          </view>
          <view class="row">
            <text class="label">报价状态</text>
            <view class="radio-group">
              <text v-for="s in quoteStates" :key="s.value" class="radio" :class="{ on: faultInfo.quoteStatus === s.value }" @click="faultInfo.quoteStatus = s.value">{{ s.label }}</text>
            </view>
          </view>
        </SectionCard>

        <!-- 3.用料/用车/参与人员 -->
        <SectionCard v-if="logStep === 2" title="用料记录">
          <view class="mat-row" v-for="m in order.planMaterials" :key="m.name">
            <text class="mat-name">{{ m.name }}</text>
            <text class="mat-qty">计划 {{ m.planQty }} · 出库 {{ m.outQty }}</text>
          </view>
          <view v-if="!order.planMaterials?.length" class="empty">本次维修暂无用料</view>
        </SectionCard>
        <SectionCard v-if="logStep === 2" title="用车记录">
          <view class="mat-row" v-for="v in order.vehicles" :key="v.plate">
            <text class="mat-name">🚗 {{ v.plate }}</text>
            <text class="mat-qty">{{ v.purpose }}</text>
          </view>
          <view v-if="!order.vehicles?.length" class="empty">本次维修未用车</view>
        </SectionCard>
        <SectionCard v-if="logStep === 2" title="参与人员">
          <view class="persons">
            <text v-for="(p, i) in order.participants" :key="i" class="person-chip">{{ p }}</text>
            <text class="person-chip person-chip--add" @click="order.participants.push('外协1')">＋</text>
          </view>
        </SectionCard>
      </template>

      <!-- ===== ③ 结束打卡 ===== -->
      <template v-if="mainStep === 2">
        <SectionCard title="结束打卡">
          <view class="loc-box">
            <view class="loc-icon">📍</view>
            <view class="loc-info">
              <view class="loc-name">{{ location.name || '正在获取定位…' }}</view>
              <view class="loc-addr">{{ location.address }}</view>
            </view>
          </view>
          <view class="loc-btns">
            <text class="loc-btn" @click="getLocation">重新定位</text>
          </view>
        </SectionCard>
        <SectionCard title="位置异常">
          <view class="switch-row">
            <text class="switch-label">位置异常</text>
            <switch :checked="locationAbnormal" color="#f56c6c" @change="(e: any) => (locationAbnormal = e.detail.value)" />
          </view>
          <view v-if="locationAbnormal" class="row row--top">
            <text class="label">异常原因</text>
            <textarea class="textarea" v-model="abnormalReason" placeholder="请填写位置异常原因（必填）" placeholder-style="color:#bbb" />
          </view>
        </SectionCard>
      </template>
    </scroll-view>

    <!-- 底部操作 -->
    <view class="bottom">
      <text v-if="mainStep > 0" class="btn btn--plain" @click="prevStep">上一步</text>
      <text class="btn btn--primary" @click="nextStep">{{ nextText }}</text>
    </view>
  </PageLayout>
</template>

<script lang="ts" setup>
import { onLoad } from '@dcloudio/uni-app'
import { ref, computed } from 'vue'
import { useToast, useMessage } from 'wot-design-uni'
import { http } from '@/utils/http'
import SectionCard from '@/components/SectionCard/SectionCard.vue'

const toast = useToast()
const message = useMessage()
const order = ref<any>({})
const id = ref('')
const mainSteps = ['签到', '维修日志', '结束打卡']
const mainStep = ref(0)
const logSteps = ['基本信息', '维修记录', '用料/用车/人员']
const logStep = ref(0)
const location = ref<any>({ name: '', address: '' })
const locationAbnormal = ref(false)
const abnormalReason = ref('')
const submitting = ref(false)
const wxNo = ref('')
const duration = ref('')

const repairStates = [
  { value: 'done', label: '维修完成' },
  { value: 'redo', label: '需要复修' },
  { value: 'abandon', label: '客户弃修' },
]
const quoteStates = [
  { value: 'pending', label: '待报价' },
  { value: 'quoted', label: '报价完成' },
  { value: 'abandon', label: '客户弃修' },
]

const log = ref({
  repairStatus: 'done',
  description: '',
  redoReason: '',
  afterPhotos: [] as string[],
})
const faultInfo = ref({ location: '', desc: '', quoteStatus: 'pending' })

const nextText = computed(() => (mainStep.value === 2 ? '完成维修' : '下一步'))

const getLocation = () => {
  location.value = { name: '定位中…', address: '' }
  uni.getLocation({
    type: 'gcj02',
    success: () => {
      location.value = { name: '杭州云栖小镇 2F 门禁机房', address: '杭州市西湖区云栖小镇（模拟定位）' }
    },
    fail: () => {
      location.value = { name: '杭州云栖小镇 2F 门禁机房', address: '定位失败，使用模拟定位（开发模式）' }
    },
  })
}

const addPhoto = () => {
  uni.chooseImage({ count: 1, success: (r) => log.value.afterPhotos.push(r.tempFilePaths[0]) })
}

const checkin = async () => {
  if (!location.value.name) return toast.warning('请先获取定位')
  await http.post('/ops/repair/checkin', { id: id.value, location: location.value })
}

const saveLog = async () => {
  if (logStep.value === 0) {
    logStep.value = 1
    return
  }
  if (logStep.value === 1) {
    if (!log.value.description) return toast.warning('请填写维修描述')
    await http.post('/ops/repair/log', { id: id.value, ...log.value, faultInfo: faultInfo.value })
    logStep.value = 2
    return
  }
  if (logStep.value === 2) {
    mainStep.value = 2
  }
}

const finish = async () => {
  if (locationAbnormal.value && !abnormalReason.value.trim()) return toast.warning('请填写位置异常原因')
  submitting.value = true
  try {
    const res: any = await http.post('/ops/repair/finish', {
      id: id.value,
      location: location.value,
      locationAbnormal: locationAbnormal.value,
      abnormalReason: abnormalReason.value,
    })
    wxNo.value = res.result?.wxNo || 'WX' + Date.now()
    duration.value = res.result?.duration || '1.5 小时'
    message
      .alert({ title: '本次维修完成', msg: `维修单号：${wxNo.value}\n本次维修时长：${duration.value}\n如需还料，请先申请还料，待库管入库后再提交审核` })
      .then(() => uni.navigateBack())
  } catch (e) {
    toast.error('提交失败')
  } finally {
    submitting.value = false
  }
}

const nextStep = () => {
  if (mainStep.value === 0) {
    checkin().then(() => {
      mainStep.value = 1
      logStep.value = 0
    })
  } else if (mainStep.value === 1) {
    saveLog()
  } else {
    finish()
  }
}

const prevStep = () => {
  if (mainStep.value === 1 && logStep.value > 0) {
    logStep.value--
  } else if (mainStep.value > 0) {
    mainStep.value--
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
  getLocation()
})
</script>

<style lang="scss" scoped>
.main-steps {
  display: flex;
  background: #fff;
  padding: 12px 16px;

  .main-step {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;

    &__dot {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #e5e5e5;
      color: #999;
      font-size: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 4px;
    }

    &__label {
      font-size: 13px;
      color: #999;
    }

    &.on .main-step__dot {
      background: #2f86ff;
      color: #fff;
    }
    &.on .main-step__label {
      color: #2f86ff;
      font-weight: 600;
    }
    &.done .main-step__dot {
      background: #67c23a;
      color: #fff;
    }
    &.done .main-step__label {
      color: #67c23a;
    }
  }
}

.sub-steps {
  display: flex;
  background: #fff;
  padding: 10px 16px;

  .sub-step {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;

    &__dot {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #e5e5e5;
      color: #999;
      font-size: 11px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 4px;
    }

    &__label {
      font-size: 12px;
      color: #999;
    }

    &.on .sub-step__dot {
      background: #2f86ff;
      color: #fff;
    }
    &.on .sub-step__label {
      color: #2f86ff;
    }
    &.done .sub-step__dot {
      background: #67c23a;
      color: #fff;
    }
  }
}

.page {
  min-height: 0;
}

.loc-box {
  display: flex;
  align-items: center;

  .loc-icon {
    font-size: 30px;
    margin-right: 10px;
  }

  .loc-name {
    font-size: 15px;
    color: #333;
    font-weight: 500;
  }

  .loc-addr {
    font-size: 12px;
    color: #999;
    margin-top: 2px;
  }
}

.loc-btns {
  margin-top: 12px;

  .loc-btn {
    color: #2f86ff;
    font-size: 13px;
    padding: 6px 18px;
    border: 1px solid #2f86ff;
    border-radius: 16px;
  }
}

.info-tip {
  text-align: center;
  color: #999;
  font-size: 13px;
  margin: 16px 0;
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

  .input {
    flex: 1;
    font-size: 13px;
  }

  .textarea {
    flex: 1;
    height: 70px;
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

  .photos {
    flex: 1;
    display: flex;
    flex-wrap: wrap;

    .photo {
      width: 60px;
      height: 60px;
      border-radius: 6px;
      margin: 0 8px 8px 0;
      position: relative;

      &__img {
        width: 100%;
        height: 100%;
        border-radius: 6px;
      }

      &__del {
        position: absolute;
        top: 0;
        right: 0;
        width: 18px;
        height: 18px;
        background: rgba(0, 0, 0, 0.5);
        color: #fff;
        font-size: 13px;
        text-align: center;
        line-height: 18px;
        border-radius: 0 0 0 6px;
      }

      &--add {
        border: 1px dashed #ccc;
        color: #999;
        font-size: 22px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
    }
  }
}

.sub-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin: 14px 0 4px;
}

.mat-row {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid #f5f5f5;

  .mat-name {
    font-size: 14px;
    color: #333;
  }

  .mat-qty {
    font-size: 12px;
    color: #999;
  }
}

.empty {
  color: #999;
  font-size: 13px;
  text-align: center;
  padding: 16px 0;
}

.persons {
  display: flex;
  flex-wrap: wrap;

  .person-chip {
    padding: 5px 14px;
    background: #f0f7ff;
    color: #2f86ff;
    border-radius: 14px;
    font-size: 13px;
    margin: 0 8px 8px 0;

    &--add {
      background: #f5f5f5;
      color: #999;
    }
  }
}

.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;

  .switch-label {
    font-size: 14px;
    color: #333;
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
  }
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

  .done-time {
    font-size: 13px;
    color: #333;
    margin-top: 6px;
  }

  .done-desc {
    font-size: 12px;
    color: #999;
    margin-top: 6px;
  }
}
</style>
