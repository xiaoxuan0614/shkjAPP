<route lang="json5">
{
  style: {
    navigationBarTitleText: '项目详情',
  },
}
</route>
<template>
  <PageLayout v-if="detail.id">
    <scroll-view class="page" :scroll-y="true">
      <view class="status-card">
        <view class="status-card__no">{{ detail.name }}</view>
        <StatusBadge :value="detail.status" :dict="PROJECT_STATUS" />
      </view>

      <!-- 项目信息 -->
      <SectionCard title="项目信息">
        <view class="row"><text class="label">项目单号</text><text class="val">{{ detail.xmNo }}</text></view>
        <view class="row"><text class="label">客户名称</text><text class="val">{{ detail.customerName }}</text></view>
        <view class="row"><text class="label">负责人</text><text class="val">{{ detail.personInCharge }}</text></view>
        <view class="row"><text class="label">项目周期</text><text class="val">{{ detail.startDate }} ~ {{ detail.endDate }}</text></view>
      </SectionCard>

      <!-- 实施计划 -->
      <SectionCard title="实施计划">
        <view class="row"><text class="label">人员配置</text><text class="val">{{ detail.plan?.persons?.join('、') }}</text></view>
        <view class="mat-row" v-for="m in detail.plan?.planMaterials" :key="m.name">
          <text class="mat-name">{{ m.name }} {{ m.spec }}</text>
          <text class="mat-qty">计划 {{ m.planQty }} · 出库 {{ m.outQty }}</text>
        </view>
      </SectionCard>

      <!-- 实施情况 -->
      <SectionCard title="实施情况">
        <view class="row"><text class="label">当前工序</text><text class="val">{{ detail.progress?.currentProcess }}</text></view>
        <view class="row"><text class="label">计划工期</text><text class="val">{{ detail.progress?.planPeriod }}</text></view>
        <view class="row"><text class="label">现场负责人</text><text class="val">{{ detail.personInCharge }}</text></view>
        <view class="row">
          <text class="label">剩余工期</text>
          <text class="val" :class="{ warn: detail.progress?.remainDays < 0 }">{{ detail.progress?.remainDays < 0 ? `已延期 ${-detail.progress?.remainDays} 天` : detail.progress?.remainDays + ' 天' }}</text>
        </view>
        <view class="row" v-if="detail.progress?.delayedReason">
          <text class="label">延期原因</text>
          <text class="val">{{ detail.progress.delayedReason }}</text>
        </view>
      </SectionCard>

      <!-- 实施记录 -->
      <SectionCard title="实施记录">
        <view class="rec" v-for="(r, i) in detail.records" :key="i">
          <view class="rec__head">
            <text class="rec__date">{{ r.date }}</text>
            <text class="rec__sg">{{ r.sgNo }}</text>
          </view>
          <view class="rec__content">{{ r.content }}</view>
        </view>
      </SectionCard>

      <!-- 用料统计 -->
      <SectionCard title="用料统计">
        <view class="stat-head">
          <text>物料</text><text>计划</text><text>出库</text><text>使用</text><text>还料</text>
        </view>
        <view class="stat-row" v-for="m in detail.materialStat" :key="m.name">
          <text class="stat-name">{{ m.name }}</text>
          <text class="stat-num">{{ m.planQty }}</text>
          <text class="stat-num">{{ m.outQty }}</text>
          <text class="stat-num">{{ m.usedQty }}</text>
          <text class="stat-num">{{ m.returnQty }}</text>
        </view>
      </SectionCard>

      <!-- 交付/质保 -->
      <SectionCard v-if="detail.status === 'finished' || detail.status === 'warranty'" title="交付信息">
        <view class="row"><text class="label">交付日期</text><text class="val">{{ detail.deliverDate }}</text></view>
        <view class="row"><text class="label">质保周期</text><text class="val">{{ detail.warrantyPeriod }}</text></view>
        <view class="row"><text class="label">竣工报告</text><text class="val link" @click="toast('预览竣工报告')">查看 ›</text></view>
        <view class="row"><text class="label">验收记录</text><text class="val link" @click="toast('预览验收记录')">查看 ›</text></view>
      </SectionCard>
    </scroll-view>

    <!-- 底部操作 -->
    <view class="bottom" v-if="ops.length">
      <text v-for="op in ops" :key="op.text" class="btn" :class="op.type" @click="op.action">{{ op.text }}</text>
    </view>

    <!-- 延期弹窗 -->
    <wd-popup v-model="showDelay" position="bottom" custom-style="border-radius:16px 16px 0 0;">
      <view class="popup">
        <view class="popup__title">申请延期</view>
        <view class="form-row"><text class="label">项目名称</text><text class="val">{{ detail.name }}</text></view>
        <view class="form-row"><text class="label">当前工序</text><text class="val">{{ detail.progress?.currentProcess }}</text></view>
        <view class="form-row"><text class="label">计划时间</text><text class="val">{{ detail.progress?.planPeriod }}</text></view>
        <view class="form-row form-row--top">
          <text class="label">延期原因</text>
          <textarea class="textarea" v-model="delay.reason" placeholder="必填" placeholder-style="color:#bbb" />
        </view>
        <view class="form-row">
          <text class="label">预计完成</text>
          <picker mode="date" :value="delay.expectTime" @change="(e: any) => (delay.expectTime = e.detail.value)">
            <view class="picker-value">{{ delay.expectTime }}</view>
          </picker>
        </view>
        <view class="popup__btns">
          <text class="btn btn--plain" @click="showDelay = false">取消</text>
          <text class="btn btn--primary" @click="submitDelay">提交</text>
        </view>
      </view>
    </wd-popup>
  </PageLayout>
</template>

<script lang="ts" setup>
import { onLoad } from '@dcloudio/uni-app'
import { ref, computed } from 'vue'
import dayjs from 'dayjs'
import { useToast } from 'wot-design-uni'
import { http } from '@/utils/http'
import { PROJECT_STATUS } from '@/types/business'
import StatusBadge from '@/components/StatusBadge/StatusBadge.vue'
import SectionCard from '@/components/SectionCard/SectionCard.vue'

const toast = useToast()
const detail = ref<any>({})
const id = ref('')
const showDelay = ref(false)
const delay = ref({ reason: '', expectTime: dayjs().add(7, 'day').format('YYYY-MM-DD') })

const ops = computed(() => {
  const list: { text: string; type: string; action: () => void }[] = []
  const s = detail.value.status
  if (s === 'notStart' || s === 'preparing') {
    list.push({ text: '开始实施', type: 'primary', action: () => toast('已开始实施') })
  } else if (s === 'implementing') {
    list.push({ text: '临时邀约', type: '', action: () => toast('已发起临时邀约') })
    list.push({ text: '申请还料', type: '', action: () => uni.navigateTo({ url: '/pages/ops/materialReturn' }) })
    list.push({ text: '申请延期', type: '', action: () => { delay.value = { reason: '', expectTime: dayjs().add(7, 'day').format('YYYY-MM-DD') }; showDelay.value = true } })
    list.push({ text: '提交验收', type: 'primary', action: () => toast('已提交验收') })
  }
  return list
})

const load = async () => {
  try {
    const res: any = await http.get('/project/detail', { id: id.value })
    detail.value = res.result
  } catch (e) {
    /* ignore */
  }
}

const submitDelay = async () => {
  if (!delay.value.reason.trim()) return toast.warning('请填写延期原因')
  await http.post('/project/delay/save', { projectId: id.value, ...delay.value })
  toast.success('延期申请已提交')
  showDelay.value = false
  load()
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

  &__no {
    font-size: 17px;
    font-weight: 700;
    color: #333;
    margin-bottom: 8px;
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

    &.warn {
      color: #f56c6c;
    }

    &.link {
      color: #2f86ff;
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

.rec {
  padding: 10px 0;
  border-bottom: 1px solid #f5f5f5;

  &:last-child {
    border-bottom: none;
  }

  &__head {
    display: flex;
    justify-content: space-between;
  }

  &__date {
    font-size: 14px;
    font-weight: 600;
    color: #333;
  }

  &__sg {
    font-size: 12px;
    color: #999;
  }

  &__content {
    font-size: 13px;
    color: #666;
    margin-top: 4px;
  }
}

.stat-head,
.stat-row {
  display: flex;

  text {
    flex: 1;
    text-align: center;
    font-size: 12px;

    &:first-child {
      flex: 2;
      text-align: left;
    }
  }
}

.stat-head {
  color: #999;
  padding-bottom: 8px;
}

.stat-row {
  padding: 8px 0;
  border-top: 1px solid #f5f5f5;
  color: #333;
  font-size: 13px;

  .stat-name {
    flex: 2;
    text-align: left;
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
    }
  }
}

.form-row {
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f5f5f5;

  &--top {
    align-items: flex-start;
  }

  .label {
    width: 84px;
    font-size: 14px;
    color: #333;
    flex: none;
  }

  .val,
  .picker-value {
    flex: 1;
    font-size: 13px;
    color: #666;
  }

  .textarea {
    flex: 1;
    height: 70px;
    font-size: 13px;
    padding: 0;
  }
}
</style>
