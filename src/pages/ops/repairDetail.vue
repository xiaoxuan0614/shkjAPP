<route lang="json5">
{
  style: {
    navigationBarTitleText: '工单详情',
  },
}
</route>
<template>
  <PageLayout v-if="detail.id">
    <scroll-view class="page" :scroll-y="true">
      <view class="status-card">
        <view class="status-card__no">{{ detail.orderNo }}</view>
        <StatusBadge :value="detail.status" :dict="WORK_ORDER_STATUS" />
      </view>

      <!-- 工单信息 -->
      <SectionCard title="工单信息">
        <view class="row"><text class="label">客户名称</text><text class="val">{{ detail.customerName }}</text></view>
        <view class="row"><text class="label">所在地址</text><text class="val">{{ detail.address }}</text></view>
        <view class="row"><text class="label">维保项目</text><text class="val">{{ detail.project }}</text></view>
        <view class="row"><text class="label">维护性质</text><text class="val">{{ detail.maintenanceNatureText }}</text></view>
        <view class="row"><text class="label">维护类型</text><text class="val">{{ detail.maintenanceType }}</text></view>
        <view class="row"><text class="label">负责人</text><text class="val">{{ detail.personInCharge }}</text></view>
        <view class="row"><text class="label">故障描述</text><text class="val">{{ detail.faultDesc }}</text></view>
      </SectionCard>

      <!-- 预约信息 -->
      <SectionCard v-if="detail.reservation" title="预约信息">
        <view class="row"><text class="label">预约单号</text><text class="val">{{ detail.reservation.yyNo }}</text></view>
        <view class="row"><text class="label">预约时间</text><text class="val">{{ detail.reservation.reserveDate }}</text></view>
        <view class="row"><text class="label">报故时间</text><text class="val">{{ detail.reservation.faultTime }}</text></view>
        <view class="row"><text class="label">维护性质</text><text class="val">{{ detail.reservation.maintenanceNatureText }}</text></view>
        <view class="row"><text class="label">协助需求</text><text class="val">{{ detail.reservation.assistant ? (detail.reservation.assistantType === 'inner' ? '内协 ' + (detail.reservation.assistantPersons || []).join('、') : `外协 ${detail.reservation.assistantOrg}·${detail.reservation.assistantCount}人·${detail.reservation.assistantHours}工时`) : '无' }}</text></view>
        <view class="row" v-if="detail.reservation.signTime"><text class="label">签到信息</text><text class="val">{{ detail.reservation.signTime }} · {{ detail.reservation.signLocation }}</text></view>
      </SectionCard>

      <!-- 计划用料 -->
      <SectionCard v-if="detail.planMaterials?.length" title="计划用料">
        <view class="mat-row" v-for="m in detail.planMaterials" :key="m.name">
          <text class="mat-name">{{ m.name }} {{ m.spec }}</text>
          <text class="mat-qty">计划 {{ m.planQty }} · 出库 {{ m.outQty }}</text>
        </view>
      </SectionCard>

      <!-- 维修记录 -->
      <SectionCard v-if="detail.repairLogs?.length" title="维修日志">
        <view class="log" v-for="(l, i) in detail.repairLogs" :key="i">
          <view class="log__head">
            <text class="log__title">{{ l.title }}</text>
            <text class="log__status" v-if="l.statusText">{{ l.statusText }}</text>
            <text class="log__time">{{ l.time }}</text>
          </view>
          <view class="log__content">{{ l.content }}</view>
        </view>
        <view class="extra-line" v-if="detail.vehicles?.length">🚗 用车：{{ detail.vehicles.map((v: any) => v.plate + '(' + v.purpose + ')').join('、') }}</view>
        <view class="extra-line" v-if="detail.participants?.length">👥 参与人员：{{ detail.participants.join('、') }}</view>
      </SectionCard>

      <!-- 提交审批 -->
      <SectionCard v-if="detail.submitAudit" title="提交审批">
        <view class="row"><text class="label">提交时间</text><text class="val">{{ detail.submitAudit.submitTime }}</text></view>
        <view class="row" v-if="detail.submitAudit.remark"><text class="label">备注</text><text class="val">{{ detail.submitAudit.remark }}</text></view>
        <view class="row"><text class="label">人工费</text><text class="val price">¥{{ detail.submitAudit.price.labor }}</text></view>
        <view class="row"><text class="label">材料费</text><text class="val price">¥{{ detail.submitAudit.price.material }}</text></view>
        <view class="row"><text class="label">合计</text><text class="val price total">¥{{ detail.submitAudit.price.total }}</text></view>
      </SectionCard>

      <!-- 时间线 -->
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
    <view class="bottom" v-if="ops.length">
      <text v-for="op in ops" :key="op.text" class="btn" :class="op.type" @click="op.action">{{ op.text }}</text>
    </view>

    <!-- 关闭弹窗 -->
    <wd-popup v-model="showClose" position="bottom" custom-style="border-radius:16px 16px 0 0;">
      <view class="popup">
        <view class="popup__title">关闭工单</view>
        <textarea class="reason-textarea" v-model="closeReason" placeholder="请填写关闭原因（必填）" placeholder-style="color:#bbb" />
        <view class="popup__btns">
          <text class="btn btn--plain" @click="showClose = false">取消</text>
          <text class="btn btn--danger" @click="doClose">确认关闭</text>
        </view>
      </view>
    </wd-popup>

    <!-- 转单弹窗 -->
    <wd-popup v-model="showTransfer" position="bottom" custom-style="border-radius:16px 16px 0 0;">
      <view class="popup">
        <view class="popup__title">转单</view>
        <view class="form-row">
          <text class="label">接单人</text>
          <view class="chips">
            <text v-for="p in persons" :key="p" class="chip" :class="{ on: transfer.person === p }" @click="transfer.person = p">{{ p }}</text>
          </view>
        </view>
        <textarea class="reason-textarea" v-model="transfer.reason" placeholder="请填写转单原因（必填）" placeholder-style="color:#bbb" />
        <view class="popup__btns">
          <text class="btn btn--plain" @click="showTransfer = false">取消</text>
          <text class="btn btn--primary" @click="doTransfer">确认转单</text>
        </view>
      </view>
    </wd-popup>

    <!-- 提交审核弹窗 -->
    <wd-popup v-model="showAudit" position="bottom" custom-style="border-radius:16px 16px 0 0;">
      <view class="popup">
        <view class="popup__title">提交审核</view>
        <view class="form-row">
          <text class="label">备注</text>
          <input class="input" v-model="audit.remark" placeholder="选填" placeholder-style="color:#bbb" />
        </view>
        <view class="form-row">
          <text class="label">人工费</text>
          <input class="input" v-model="audit.price.labor" type="number" placeholder="¥" placeholder-style="color:#bbb" />
        </view>
        <view class="form-row">
          <text class="label">材料费</text>
          <input class="input" v-model="audit.price.material" type="number" placeholder="¥" placeholder-style="color:#bbb" />
        </view>
        <view class="form-row">
          <text class="label">合计</text>
          <text class="val total">¥{{ (Number(audit.price.labor) || 0) + (Number(audit.price.material) || 0) }}</text>
        </view>
        <view class="popup__btns">
          <text class="btn btn--plain" @click="showAudit = false">取消</text>
          <text class="btn btn--primary" @click="doAudit">确认提交</text>
        </view>
      </view>
    </wd-popup>
  </PageLayout>
</template>

<script lang="ts" setup>
import { onLoad } from '@dcloudio/uni-app'
import { ref, computed } from 'vue'
import { useToast, useMessage } from 'wot-design-uni'
import { http } from '@/utils/http'
import { WORK_ORDER_STATUS } from '@/types/business'
import StatusBadge from '@/components/StatusBadge/StatusBadge.vue'
import SectionCard from '@/components/SectionCard/SectionCard.vue'

const toast = useToast()
const message = useMessage()
const detail = ref<any>({})
const id = ref('')
const showClose = ref(false)
const showTransfer = ref(false)
const showAudit = ref(false)
const closeReason = ref('')
const transfer = ref({ person: '', reason: '' })
const audit = ref({ remark: '', price: { labor: '', material: '' } })
const persons = ['王强', '赵磊', '孙浩', '李伟']

const ops = computed(() => {
  const list: { text: string; type: string; action: () => void }[] = []
  const s = detail.value.status
  if (s === 'notStart') {
    list.push({ text: '修改预约', type: '', action: () => uni.navigateTo({ url: `/pages/ops/reservation?orderNo=${detail.value.orderNo}` }) })
    list.push({ text: '转单', type: '', action: () => { transfer.value = { person: '', reason: '' }; showTransfer.value = true } })
    list.push({ text: '关闭', type: 'danger', action: () => { closeReason.value = ''; showClose.value = true } })
    list.push({ text: '开始维修', type: 'primary', action: doStart })
  } else if (s === 'processing') {
    list.push({ text: '临时邀约', type: '', action: () => toast('已发起临时邀约') })
    list.push({ text: '申请还料', type: '', action: () => uni.navigateTo({ url: '/pages/ops/materialReturn' }) })
    list.push({ text: '提交审核', type: 'primary', action: () => { audit.value = { remark: '', price: { labor: '', material: '' } }; showAudit.value = true } })
  } else if (s === 'pendingAudit') {
    list.push({ text: '撤回审批', type: '', action: doWithdraw })
  } else if (s === 'pendingEvaluate') {
    list.push({ text: '生成二维码', type: 'primary', action: () => message.alert({ title: '客户确认二维码', msg: '请客户扫码后核对维修信息并签字评价' }) })
  }
  return list
})

const load = async () => {
  try {
    const res: any = await http.get('/ops/repairDetail', { id: id.value })
    detail.value = res.result
  } catch (e) {
    /* ignore */
  }
}

const doStart = async () => {
  await http.post('/ops/repair/start', { id: id.value })
  uni.navigateTo({ url: `/pages/ops/repairOffline?id=${id.value}` })
}

const doClose = async () => {
  if (!closeReason.value.trim()) return toast.warning('请填写关闭原因')
  await http.post('/ops/repair/close', { id: id.value, reason: closeReason.value })
  toast.success('工单已关闭')
  showClose.value = false
  load()
}

const doTransfer = async () => {
  if (!transfer.value.person) return toast.warning('请选择接单人')
  if (!transfer.value.reason.trim()) return toast.warning('请填写转单原因')
  await http.post('/ops/repair/transfer', { id: id.value, ...transfer.value })
  toast.success('转单已提交')
  showTransfer.value = false
  load()
}

const doAudit = async () => {
  if (!audit.value.price.labor && !audit.value.price.material) return toast.warning('请填写费用')
  await http.post('/ops/repair/submitAudit', { id: id.value, ...audit.value })
  toast.success('已提交审批')
  showAudit.value = false
  load()
}

const doWithdraw = () => {
  useMessage()
    .confirm('确定撤回审批吗？')
    .then(async () => {
      await http.post('/ops/repair/log', { id: id.value, withdraw: true })
      toast.success('已撤回')
      load()
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
  background: #f0f7ff;
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

    &.price {
      color: #f56c6c;

      &.total {
        font-weight: 700;
      }
    }
  }
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

.log {
  padding: 10px 0;
  border-bottom: 1px solid #f5f5f5;

  &:last-child {
    border-bottom: none;
  }

  &__head {
    display: flex;
    align-items: center;
  }

  &__title {
    font-size: 14px;
    font-weight: 600;
    color: #333;
  }

  &__status {
    font-size: 11px;
    color: #67c23a;
    background: #f0f9eb;
    padding: 1px 8px;
    border-radius: 4px;
    margin-left: 8px;
  }

  &__time {
    margin-left: auto;
    font-size: 12px;
    color: #bbb;
  }

  &__content {
    font-size: 13px;
    color: #666;
    margin-top: 4px;
  }
}

.extra-line {
  font-size: 13px;
  color: #666;
  margin-top: 8px;
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
    padding: 10px 0;
    border-radius: 22px;
    font-size: 13px;
    border: 1px solid #ddd;
    color: #666;
    margin-left: 10px;

    &:first-child {
      margin-left: 0;
    }

    &.primary {
      background: #2f86ff;
      border-color: #2f86ff;
      color: #fff;
    }

    &.danger {
      border-color: #f56c6c;
      color: #f56c6c;
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
    width: 72px;
    font-size: 14px;
    color: #333;
    flex: none;
  }

  .input {
    flex: 1;
    font-size: 14px;
  }

  .val.total {
    flex: 1;
    color: #f56c6c;
    font-weight: 700;
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

.reason-textarea {
  width: 100%;
  height: 80px;
  margin-top: 14px;
  background: #f7f8fa;
  border-radius: 8px;
  padding: 12px;
  font-size: 14px;
  box-sizing: border-box;
}

.qr-box {
  text-align: center;
  padding: 8px 0;

  .qr-placeholder {
    width: 160px;
    height: 160px;
    margin: 0 auto;
    border: 1px dashed #ccc;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #999;
    font-size: 14px;
  }

  .qr-tip {
    font-size: 13px;
    color: #999;
    margin-top: 12px;
  }
}
</style>
