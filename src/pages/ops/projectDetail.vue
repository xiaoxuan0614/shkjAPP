<route lang="json5">
{
  style: {
    navigationBarTitleText: '项目详情',
  },
}
</route>
<template>
  <PageLayout v-if="detail.id" :navbarShow="false">
    <scroll-view class="page" :scroll-y="true">
      <view class="status-card">
        <view class="status-card__no">{{ detail.name }}</view>
        <StatusBadge :value="detail.status" :dict="PROJECT_STATUS" />
      </view>

      <!-- 项目信息 -->
      <SectionCard title="项目信息">
        <view class="row">
          <text class="label">项目单号</text>
          <text class="val">{{ detail.xmNo }}</text>
        </view>
        <view class="row">
          <text class="label">客户名称</text>
          <text class="val">{{ detail.customerName }}</text>
        </view>
        <view class="row">
          <text class="label">负责人</text>
          <text class="val">{{ detail.personInCharge }}</text>
        </view>
        <view class="row">
          <text class="label">项目周期</text>
          <text class="val">{{ detail.startDate }} ~ {{ detail.endDate }}</text>
        </view>
        <view class="row">
          <text class="label">到货状态</text>
          <text class="val">{{ Number(detail.arrivalStatus) === 1 ? '已到货' : '未到货' }}</text>
        </view>
      </SectionCard>

      <!-- 项目成员 -->
      <SectionCard title="项目成员">
        <view class="member-group">
          <view class="member-group__head">
            <text class="member-group__title">参与人员</text>
            <text class="member-group__count">{{ detail.plan?.persons?.length || 0 }} 人</text>
          </view>
          <view v-if="detail.plan?.persons?.length" class="member-list">
            <text v-for="person in detail.plan.persons" :key="person" class="member-tag">
              {{ person }}
            </text>
          </view>
          <text
            v-else-if="detail.plan?.membersLoadFailed"
            class="member-empty member-empty--error"
            @click="load"
          >
            参与人员加载失败，点击重试
          </text>
          <text v-else class="member-empty">暂无参与人员</text>
        </view>

        <view class="member-group member-group--outsource">
          <view class="member-group__head">
            <text class="member-group__title">外协</text>
            <text class="member-group__count">
              {{ detail.plan?.outsources?.length || 0 }} 个单位
            </text>
          </view>
          <view v-if="detail.plan?.outsources?.length" class="outsource-list">
            <view v-for="item in detail.plan.outsources" :key="item.id" class="outsource-row">
              <text class="outsource-row__name">{{ item.unitName }}</text>
              <view class="outsource-row__meta">
                <text>{{ item.headcount }} 人</text>
                <text>{{ item.workHours }} 小时</text>
              </view>
            </view>
          </view>
          <text
            v-else-if="detail.plan?.outsourcesLoadFailed"
            class="member-empty member-empty--error"
            @click="load"
          >
            外协信息加载失败，点击重试
          </text>
          <text v-else class="member-empty">暂无外协</text>
        </view>
      </SectionCard>

      <!-- 实施计划 -->
      <SectionCard title="实施计划">
        <view class="mat-row" v-for="m in detail.plan?.planMaterials" :key="m.name">
          <text class="mat-name">{{ m.name }} {{ m.spec }}</text>
          <text class="mat-qty">计划 {{ m.planQty }} · 出库 {{ m.outQty }}</text>
        </view>
      </SectionCard>

      <!-- 实施情况 -->
      <SectionCard title="实施情况">
        <view class="row">
          <text class="label">当前工序</text>
          <text class="val">{{ detail.progress?.currentProcess }}</text>
        </view>
        <view class="row">
          <text class="label">计划工期</text>
          <text class="val">{{ detail.progress?.planPeriod }}</text>
        </view>
        <view class="row">
          <text class="label">现场负责人</text>
          <text class="val">{{ detail.personInCharge }}</text>
        </view>
        <view class="row">
          <text class="label">剩余工期</text>
          <text class="val" :class="{ warn: detail.progress?.remainDays < 0 }">
            {{
              detail.progress?.remainDays < 0
                ? `已延期 ${-detail.progress?.remainDays} 天`
                : detail.progress?.remainDays + ' 天'
            }}
          </text>
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
          <text>物料</text>
          <text>计划</text>
          <text>出库</text>
          <text>使用</text>
          <text>还料</text>
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
      <SectionCard
        v-if="detail.status === 'finished' || detail.status === 'warranty'"
        title="交付信息"
      >
        <view class="row">
          <text class="label">交付日期</text>
          <text class="val">{{ detail.deliverDate }}</text>
        </view>
        <view class="row">
          <text class="label">质保周期</text>
          <text class="val">{{ detail.warrantyPeriod }}</text>
        </view>
        <view class="row">
          <text class="label">竣工报告</text>
          <text class="val link" @click="toast('预览竣工报告')">查看 ›</text>
        </view>
        <view class="row">
          <text class="label">验收记录</text>
          <text class="val link" @click="toast('预览验收记录')">查看 ›</text>
        </view>
      </SectionCard>
    </scroll-view>

    <!-- 底部操作 -->
    <view class="bottom" v-if="ops.length">
      <text v-for="op in ops" :key="op.text" class="btn" :class="op.type" @click="op.action">
        {{ op.text }}
      </text>
    </view>

    <!-- 延期弹窗 -->
    <wd-popup v-model="showDelay" position="bottom" custom-style="border-radius:16px 16px 0 0;">
      <view class="popup">
        <view class="popup__title">申请延期</view>
        <view class="form-row">
          <text class="label">项目名称</text>
          <text class="val">{{ detail.name }}</text>
        </view>
        <view class="form-row">
          <text class="label">当前工序</text>
          <text class="val">{{ detail.progress?.currentProcess }}</text>
        </view>
        <view class="form-row">
          <text class="label">计划时间</text>
          <text class="val">{{ detail.progress?.planPeriod }}</text>
        </view>
        <view class="form-row form-row--top">
          <text class="label">延期原因</text>
          <textarea
            class="textarea"
            v-model="delay.reason"
            placeholder="必填"
            placeholder-style="color:#bbb"
          />
        </view>
        <view class="form-row">
          <text class="label">预计完成</text>
          <picker
            mode="date"
            :value="delay.expectTime"
            @change="(e: any) => (delay.expectTime = e.detail.value)"
          >
            <view class="picker-value">{{ delay.expectTime }}</view>
          </picker>
        </view>
        <view class="popup__btns">
          <text class="btn btn--plain" @click="showDelay = false">取消</text>
          <text class="btn btn--primary" @click="submitDelay">提交</text>
        </view>
      </view>
    </wd-popup>

    <!-- 确认到货 -->
    <wd-popup
      v-model="showArrival"
      position="bottom"
      :close-on-click-modal="!arrivalSubmitting"
      custom-style="border-radius:16px 16px 0 0;"
    >
      <view class="arrival-popup">
        <view class="arrival-popup__title">确认到货</view>
        <view class="arrival-popup__warning">
          确认后系统将自动生成到货款计划回款时间，是否确认执行该操作？
        </view>

        <view class="arrival-popup__row">
          <text class="label">项目名称</text>
          <text class="val">{{ detail.projectName || detail.name || '—' }}</text>
        </view>
        <view class="arrival-popup__row">
          <text class="label">分期名称</text>
          <text class="val">{{ detail.periodName || detail.name || '—' }}</text>
        </view>
        <view class="arrival-popup__row">
          <text class="label">回款周期</text>
          <text class="val">
            {{
              arrivalLoading
                ? '加载中…'
                : arrivalPlan
                  ? `${arrivalRollbackDays} 天`
                  : '未配置到货款计划'
            }}
          </text>
        </view>
        <view class="arrival-popup__row">
          <text class="label">预计回款</text>
          <text class="val arrival-popup__expected">
            {{ arrivalPlan ? arrivalExpectedDate : '—' }}
          </text>
        </view>
        <view class="arrival-popup__row">
          <text class="label">合同货物清单</text>
          <text
            v-if="arrivalMaterialSource"
            class="val arrival-popup__link"
            @click="previewArrivalMaterial"
          >
            {{ arrivalMaterialName }} ›
          </text>
          <text v-else class="val">暂无合同货物清单</text>
        </view>

        <view v-if="!arrivalLoading && !arrivalPlan" class="arrival-popup__error">
          合同中未找到到货款计划，请先完善合同回款计划后再确认到货。
        </view>

        <view class="arrival-popup__actions">
          <text
            class="btn btn--plain"
            :class="{ disabled: arrivalSubmitting }"
            @click="closeArrivalPopup"
          >
            取消
          </text>
          <text
            class="btn btn--primary"
            :class="{ disabled: arrivalLoading || !arrivalPlan || arrivalSubmitting }"
            @click="confirmArrival"
          >
            {{ arrivalSubmitting ? '处理中…' : '确认执行' }}
          </text>
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
import { normalizeProject, projectApi, unwrapRecords } from '@/service/shkj'
import { usePermissionStore } from '@/store/permission'
import { PROJECT_STATUS } from '@/types/business'
import { downloadFile } from '@/common/uitls'
import StatusBadge from '@/components/StatusBadge/StatusBadge.vue'
import SectionCard from '@/components/SectionCard/SectionCard.vue'

const toast = useToast()
const permissionStore = usePermissionStore()
const detail = ref<any>({})
const id = ref('')
const showDelay = ref(false)
const delay = ref({ reason: '', expectTime: dayjs().add(7, 'day').format('YYYY-MM-DD') })
const showArrival = ref(false)
const arrivalLoading = ref(false)
const arrivalSubmitting = ref(false)
const arrivalPlan = ref<any>()
const arrivalContract = ref<any>({})
const arrivalMaterialFile = ref<any>({})

const arrivalConfirmableStatuses = new Set(['IMPLEMENTING', 'DEBUGGING', 'DEBUG_COMPLETED'])
const canConfirmArrival = computed(
  () =>
    (permissionStore.fullAccess || permissionStore.hasPermission('project:arrival:confirm')) &&
    Number(detail.value.arrivalStatus) !== 1 &&
    arrivalConfirmableStatuses.has(String(detail.value.rawStatus || '')),
)
const arrivalRollbackDays = computed(() => {
  const value = Number(arrivalPlan.value?.rollbackTime ?? 7)
  return Number.isInteger(value) && value >= 0 ? value : 7
})
const arrivalExpectedDate = computed(() =>
  dayjs().add(arrivalRollbackDays.value, 'day').format('YYYY-MM-DD'),
)
const arrivalMaterialSource = computed(
  () =>
    arrivalMaterialFile.value?.fileId ||
    arrivalMaterialFile.value?.url ||
    arrivalContract.value?.materialFileId ||
    arrivalContract.value?.materialListFileId ||
    arrivalContract.value?.materialListFilePath ||
    '',
)
const arrivalMaterialName = computed(() => {
  const sourceName =
    arrivalMaterialFile.value?.fileName ||
    arrivalContract.value?.materialFileName ||
    arrivalContract.value?.materialListFileName
  if (sourceName) return sourceName
  const name = String(arrivalMaterialSource.value).split('/').pop() || '合同货物清单'
  try {
    return decodeURIComponent(name)
  } catch {
    return name
  }
})

const ops = computed(() => {
  const list: { text: string; type: string; action: () => void }[] = []
  const s = detail.value.status
  if (s === 'notStart' || s === 'preparing') {
    list.push({ text: '开始实施', type: 'primary', action: () => toast('已开始实施') })
  } else if (s === 'implementing') {
    list.push({
      text: '项目实施',
      type: 'primary',
      action: () => uni.navigateTo({ url: `/pages/ops/implementLog?projectId=${id.value}` }),
    })
    list.push({ text: '临时邀约', type: '', action: () => toast('已发起临时邀约') })
    list.push({
      text: '申请还料',
      type: '',
      action: () => uni.navigateTo({ url: '/pages/ops/materialReturn' }),
    })
    list.push({
      text: '申请延期',
      type: '',
      action: () => {
        delay.value = { reason: '', expectTime: dayjs().add(7, 'day').format('YYYY-MM-DD') }
        showDelay.value = true
      },
    })
    list.push({ text: '提交验收', type: '', action: submitAcceptance })
  }
  if (canConfirmArrival.value) {
    list.push({ text: '确认到货', type: '', action: openArrivalConfirm })
  }
  return list
})

const openArrivalConfirm = async () => {
  showArrival.value = true
  arrivalLoading.value = true
  arrivalSubmitting.value = false
  arrivalPlan.value = undefined
  arrivalContract.value = {}
  arrivalMaterialFile.value = {}
  try {
    const response: any = await projectApi.contractDetail(id.value)
    const result = response?.result ?? response ?? {}
    arrivalContract.value = result.contract || result
    arrivalMaterialFile.value = result.materialFile || {}
    const records = Array.isArray(result.records) ? result.records : []
    arrivalPlan.value = records.find((item: any) => {
      const node = String(item.paymentNode ?? item.node ?? '')
        .trim()
        .toUpperCase()
      return node === '2' || node === '到货款' || node === 'ARRIVAL'
    })
  } catch (error: any) {
    toast.error(error?.message || error?.msg || '合同回款信息加载失败')
  } finally {
    arrivalLoading.value = false
  }
}

const closeArrivalPopup = () => {
  if (!arrivalSubmitting.value) showArrival.value = false
}

const previewArrivalMaterial = () => {
  if (arrivalMaterialSource.value) downloadFile(arrivalMaterialSource.value)
}

const confirmArrival = async () => {
  if (arrivalLoading.value || arrivalSubmitting.value || !arrivalPlan.value) return
  arrivalSubmitting.value = true
  try {
    await projectApi.confirmArrival(id.value)
    toast.success('已确认到货')
    showArrival.value = false
    await load()
  } finally {
    arrivalSubmitting.value = false
  }
}

const load = async () => {
  try {
    const detailRes: any = await projectApi.detail(id.value)
    const basic = normalizeProject(detailRes.result || {})
    const results = await Promise.allSettled([
      projectApi.members(id.value),
      projectApi.outsources(id.value),
      projectApi.processes(id.value),
      projectApi.implementLogs(id.value),
      projectApi.materialPlans(id.value),
    ])
    const recordsAt = (index: number) =>
      results[index].status === 'fulfilled'
        ? unwrapRecords((results[index] as PromiseFulfilledResult<any>).value)
        : []
    const members = recordsAt(0)
    const outsources = recordsAt(1)
    const processes = recordsAt(2)
    const logs = recordsAt(3)
    const materials = recordsAt(4)
    const uniqueMemberNames = new Map<string, string>()
    members
      .filter((item: any) => {
        const isOutsource = item.outsourcingFlag === true || Number(item.outsourcingFlag) === 1
        const isAccepted = item.inviteStatus == null || Number(item.inviteStatus) === 1
        return !isOutsource && isAccepted
      })
      .forEach((item: any) => {
        const name = item.userName || item.memberName || item.realname || ''
        const memberKey = String(item.userId || item.memberId || item.id || name)
        if (name && memberKey) uniqueMemberNames.set(memberKey, name)
      })
    const currentProcess =
      processes.find((item: any) =>
        ['PROCESSING', 'IN_PROGRESS', '进行中'].includes(String(item.status).toUpperCase()),
      ) ||
      processes[0] ||
      {}
    const processStartDates = processes
      .map((item: any) => item.plannedStartTime)
      .filter(Boolean)
      .sort()
    const processStartDate = processStartDates[0] || ''
    const processEndDates = processes
      .map((item: any) => item.plannedEndTime)
      .filter(Boolean)
      .sort()
    const processEndDate = processEndDates[processEndDates.length - 1] || ''
    const projectStartDate = basic.startDate || processStartDate
    const projectEndDate = basic.endDate || processEndDate
    detail.value = {
      ...basic,
      startDate: projectStartDate,
      endDate: projectEndDate,
      plan: {
        persons: [...uniqueMemberNames.values()],
        membersLoadFailed: results[0].status === 'rejected',
        outsources: outsources.map((item: any, index: number) => ({
          id: String(item.id || item.outsourceMemberId || item.unitId || `outsource-${index}`),
          unitName: item.unitName || item.outsourcingUnit || '未命名外协单位',
          headcount: Number(item.headcount ?? 0),
          workHours: Number(item.workHours ?? 0),
        })),
        outsourcesLoadFailed: results[1].status === 'rejected',
        planMaterials: materials.map((item: any) => ({
          name: item.materialName || item.name || '',
          spec: item.model || item.specification || '',
          planQty: Number(item.plannedQty ?? item.planQty ?? item.quantity ?? item.unitQty ?? 0),
          outQty: Number(item.outQty ?? item.executedQty ?? 0),
        })),
      },
      progress: {
        currentProcess: currentProcess.processName || currentProcess.name || '—',
        processId: currentProcess.id,
        planPeriod: [
          currentProcess.plannedStartTime || projectStartDate,
          currentProcess.plannedEndTime || projectEndDate,
        ]
          .filter(Boolean)
          .join(' ~ '),
        remainDays: projectEndDate
          ? dayjs(projectEndDate).startOf('day').diff(dayjs().startOf('day'), 'day')
          : 0,
        delayedReason: basic.delayReason || '',
      },
      records: logs.map((item: any) => ({
        date: item.implementDate || item.logDate || item.createTime || '',
        sgNo: item.logNo || item.sgNo || item.id || '',
        content: item.implementContent || item.content || item.workContent || '',
      })),
      materialStat: materials.map((item: any) => ({
        name: item.materialName || item.name || '',
        planQty: Number(item.plannedQty ?? item.planQty ?? item.quantity ?? item.unitQty ?? 0),
        outQty: Number(item.outQty ?? item.executedQty ?? 0),
        usedQty: Number(item.actualQty ?? item.usedQty ?? 0),
        returnQty: Number(item.returnQty ?? 0),
      })),
    }
  } catch (e) {
    /* ignore */
  }
}

const submitAcceptance = () => {
  toast.success('已提交验收')
}

const submitDelay = async () => {
  if (!delay.value.reason.trim()) return toast.warning('请填写延期原因')
  const originalEndTime = detail.value.endDate
  await projectApi.addDelay({
    projectId: detail.value.projectId,
    periodId: id.value,
    processId: detail.value.progress?.processId,
    delayReason: delay.value.reason.trim(),
    originalEndTime,
    expectedEndTime: delay.value.expectTime,
    delayDays: originalEndTime
      ? Math.max(0, dayjs(delay.value.expectTime).diff(dayjs(originalEndTime), 'day'))
      : undefined,
  })
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

.member-group {
  &--outsource {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid #f0f0f0;
  }

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  &__title {
    font-size: 14px;
    font-weight: 600;
    color: #333;
  }

  &__count {
    font-size: 12px;
    color: #777;
  }
}

.member-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.member-tag {
  padding: 6px 10px;
  border-radius: 6px;
  background: #f0f7ff;
  color: #176ac7;
  font-size: 13px;
  line-height: 1.4;
}

.member-empty {
  display: block;
  padding: 6px 0 2px;
  color: #777;
  font-size: 13px;

  &--error {
    color: #b42318;
  }
}

.outsource-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid #f5f5f5;

  &:first-child {
    padding-top: 0;
  }

  &:last-child {
    padding-bottom: 0;
    border-bottom: 0;
  }

  &__name {
    min-width: 0;
    flex: 1;
    color: #333;
    font-size: 13px;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  &__meta {
    display: flex;
    flex: none;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 10px;
    color: #777;
    font-size: 12px;
    line-height: 1.5;
    font-variant-numeric: tabular-nums;
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
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 16px;
  background: #fff;
  border-top: 1px solid #f0f0f0;

  .btn {
    box-sizing: border-box;
    flex: 0 0 calc(33.333% - 6px);
    text-align: center;
    padding: 10px 0;
    border-radius: 22px;
    font-size: 13px;
    border: 1px solid #ddd;
    color: #666;
    &.primary {
      background: #2f86ff;
      border-color: #2f86ff;
      color: #fff;
    }
  }
}

.arrival-popup {
  padding: 18px 20px calc(24px + env(safe-area-inset-bottom));

  &__title {
    text-align: center;
    font-size: 17px;
    font-weight: 600;
    color: #222;
  }

  &__warning,
  &__error {
    margin: 16px 0 8px;
    padding: 11px 12px;
    border-radius: 8px;
    font-size: 13px;
    line-height: 1.6;
  }

  &__warning {
    background: #fff7e8;
    color: #8a5b16;
  }

  &__error {
    background: #fff1f0;
    color: #b42318;
  }

  &__row {
    display: flex;
    align-items: flex-start;
    padding: 11px 0;
    border-bottom: 1px solid #f0f0f0;

    .label {
      width: 84px;
      flex: none;
      color: #666;
      font-size: 13px;
    }

    .val {
      flex: 1;
      min-width: 0;
      color: #222;
      font-size: 13px;
      text-align: right;
      overflow-wrap: anywhere;
    }
  }

  &__expected {
    color: #176ac7 !important;
    font-weight: 600;
  }

  &__link {
    color: #176ac7 !important;
  }

  &__actions {
    display: flex;
    gap: 12px;
    margin-top: 18px;

    .btn {
      flex: 1;
      padding: 11px 0;
      border-radius: 22px;
      text-align: center;
      font-size: 14px;

      &--plain {
        border: 1px solid #d9d9d9;
        color: #595959;
      }

      &--primary {
        background: #176ac7;
        color: #fff;
      }

      &.disabled {
        opacity: 0.45;
        pointer-events: none;
      }
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
