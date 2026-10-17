<template>
  <view :class="{ 'report-list': !selected && view === 'reports' }">
    <view v-if="!selected && !['create', 'reports'].includes(view)" class="row toolbar">
      <button class="btn btn--text" @click="view = 'create'">填写报修</button>
    </view>
    <view v-if="error" class="error" role="alert">{{ error }}</view>
    <view v-if="view === 'create' && !selected" class="report-form">
      <SectionCard title="关联信息">
        <view class="report-form-row">
          <text class="report-label">客户<text class="required">*</text></text>
          <picker class="report-picker" :range="customerOptions" range-key="name" :value="Math.max(0, customerOptions.findIndex(c => c.id === draft.customerId))" @change="chooseCustomer(Number($event.detail.value))">
            <view class="report-picker-value" :class="{ placeholder: !selectedCustomer }"><text>{{ selectedCustomer?.name || '请选择客户' }}</text><wd-icon name="arrow-right" size="14px" /></view>
          </picker>
        </view>
        <view class="report-form-row">
          <text class="report-label">项目<text class="required">*</text></text>
          <picker class="report-picker" :range="projectOptions" range-key="name" :disabled="!draft.customerId" :value="Math.max(0, projectOptions.findIndex(p => p.id === draft.projectId))" @change="draft.projectId = projectOptions[Number($event.detail.value)]?.id || ''">
            <view class="report-picker-value" :class="{ placeholder: !selectedProject }"><text>{{ selectedProject?.name || (draft.customerId ? '请选择项目' : '请先选择客户') }}</text><wd-icon name="arrow-right" size="14px" /></view>
          </picker>
        </view>
      </SectionCard>
      <SectionCard title="报修信息">
        <view class="report-text-field">
          <label for="intake-fault" class="report-label">故障现象<text class="required">*</text></label>
          <textarea id="intake-fault" v-model="draft.fault" class="textarea" maxlength="1000" placeholder="描述出现的问题、发生位置及影响" placeholder-style="color:#767676" />
          <text class="report-count">{{ draft.fault.length }}/1000</text>
        </view>
        <view class="report-form-row">
          <text class="report-label">报修时间<text class="required">*</text></text>
          <view class="report-date-time">
            <picker mode="date" :value="draft.reportDate" @change="draft.reportDate = $event.detail.value"><view class="report-picker-value">{{ draft.reportDate }}<wd-icon name="calendar" size="16px" /></view></picker>
          </view>
        </view>
        <view class="report-text-field report-remark">
          <label for="intake-remark" class="report-label">备注（选填）</label>
          <textarea id="intake-remark" v-model="draft.remark" class="textarea" maxlength="1000" placeholder="请描述报修客户信息" placeholder-style="color:#767676" />
          <text class="report-count">{{ draft.remark.length }}/1000</text>
        </view>
      </SectionCard>
      <SectionCard title="现场附件">
        <ReportAttachments v-model:photos="draft.photos" v-model:videos="draft.videos" @busy="mediaBusy = $event" />
      </SectionCard>
      <text class="report-form-hint">提交后按值班表自动分配给运维人员，由值班人员跟进处理。</text>
      <view class="report-submit"><wd-button block size="large" type="primary" :disabled="mediaBusy" @click="createReport">提交报修</wd-button></view>
    </view>
    <template v-else-if="selected">
      <view class="panel">
        <view class="row"><text class="title">{{ selected.customer }}</text><text class="badge">{{ selected.stage }}</text></view>
        <view v-for="row in detailRows" :key="row[0]" class="kv"><text>{{ row[0] }}</text><text>{{ row[1] || '—' }}</text></view>
        <ReportAttachments v-if="selected.photos?.length || selected.videos?.length" :photos="selected.photos || []" :videos="selected.videos || []" readonly />
        <view v-if="selected.handling" class="kv"><text>受理说明</text><text>{{ selected.handling }}</text></view>
        <view v-if="selected.survey" class="kv"><text>现场勘查</text><text>{{ selected.surveyor }}：{{ selected.survey }}</text></view>
        <view v-if="selected.orderId" class="kv"><text>维修单</text><text>{{ selected.orderId }} · {{ selected.owner }}</text></view>
      </view>
      <view v-if="selected.items.length" class="panel">
        <view class="section-title">报价单 {{ selected.quoteId }}</view>
        <view v-for="(item, index) in selected.items" :key="index" class="kv"><text>{{ item.name }}</text><text>{{ item.qty }} × ¥{{ item.price }} = ¥{{ (item.qty * item.price).toFixed(2) }}</text></view>
        <view class="row"><text>报价合计</text><text class="title">¥{{ quoteTotal(selected.items).toFixed(2) }}</text></view>
        <text v-if="selected.quoteReason" class="muted">确认意见：{{ selected.quoteReason }}</text>
      </view>
      <view v-if="canHandleReport && selected.stage === '待受理'" class="panel">
        <view class="section-title">报修受理</view>
        <view class="field"><text class="field-label">是否故障</text><view class="choices"><button v-for="value in [true, false]" :key="String(value)" class="choice" :class="{ on: isFault === value }" @click="isFault = value">{{ value ? '是，需要处理' : '否，说明后关闭' }}</button></view></view>
        <view v-if="isFault" class="field"><text class="field-label">是否需要报价</text><view class="choices"><button v-for="value in [true, false]" :key="String(value)" class="choice" :class="{ on: needsQuote === value }" @click="needsQuote = value">{{ value ? '需要，先现场勘查' : '不需要，直接维修' }}</button></view></view>
        <label for="intake-handling" class="field-label">受理说明 *</label><textarea id="intake-handling" v-model="handling" class="textarea" maxlength="1000" placeholder="填写故障判断及处理依据" />
        <button class="btn btn--primary spaced" @click="run(() => assessReport(selected!, isFault, needsQuote, handling))">{{ !isFault ? '确认关闭报修' : needsQuote ? '确认受理，进入勘查' : '确认受理，进入维修' }}</button>
      </view>
      <view v-if="canHandleReport && selected.stage === '待勘查'" class="panel">
        <view class="section-title">现场勘查</view>
        <text class="muted">勘查只用于确认故障和报价，不生成维修单。</text>
        <view class="kv"><text>值班运维</text><text>{{ selected.owner || '等待自动分配' }}</text></view>
        <label for="intake-survey" class="field-label spaced">现场情况及处理方案 *</label><textarea id="intake-survey" v-model="survey" class="textarea" maxlength="2000" placeholder="记录现场检查结果及预计维修内容，供创建报价单使用" />
        <button class="btn btn--primary spaced" @click="run(() => finishSurvey(selected!, selected!.owner, survey))">完成勘查，创建报价</button>
      </view>
      <view v-if="canHandleReport && selected.stage === '待报价'" class="panel">
        <view class="section-title">{{ selected.quoteId ? '修改报价单' : '创建报价单' }}</view>
        <view v-for="(item, index) in items" :key="index" class="quote-item">
          <label :for="`quote-name-${index}`" class="field-label">报价项目 {{ index + 1 }}</label><input :id="`quote-name-${index}`" v-model="item.name" class="input" maxlength="120" placeholder="例如：设备维修服务、配件" />
          <view class="split spaced"><view><label :for="`quote-qty-${index}`" class="field-label">数量</label><input :id="`quote-qty-${index}`" v-model.number="item.qty" type="digit" class="input" /></view><view><label :for="`quote-price-${index}`" class="field-label">单价（元）</label><input :id="`quote-price-${index}`" v-model.number="item.price" type="digit" class="input" /></view></view>
          <button class="btn btn--text" :disabled="items.length === 1" @click="items.splice(index, 1)">删除此项</button>
        </view>
        <button class="btn" @click="items.push({ name: '', qty: 1, price: 0 })">添加报价项目</button>
        <view class="row spaced"><text>合计</text><text class="title">¥{{ Number.isFinite(quoteTotal(items)) ? quoteTotal(items).toFixed(2) : '—' }}</text></view>
        <button class="btn btn--primary spaced" @click="run(() => submitQuote(selected!, items))">提交内部确认</button>
      </view>
      <view v-if="canManage && selected.stage === '待内部确认'" class="panel">
        <view class="section-title">报价内部确认</view><text class="muted">内部确认后自动生成维修单，由原值班运维人员继续处理。演示由运维负责人确认。</text>
        <label for="quote-reason" class="field-label spaced">确认意见（退回必填）</label><textarea id="quote-reason" v-model="quoteReason" class="textarea" maxlength="1000" placeholder="填写确认意见或退回修改原因" />
        <view class="actions"><button class="btn" @click="run(() => confirmQuote(selected!, false, quoteReason))">退回修改</button><button class="btn btn--primary" @click="run(() => confirmQuote(selected!, true, quoteReason))">内部确认通过</button></view>
      </view>
      <button v-if="selected.orderId" class="btn btn--primary spaced" @click="emit('open-order', selected.orderId)">查看维修单</button>
      <view class="panel spaced"><view class="section-title">处理记录</view><view v-for="(event, index) in selected.events" :key="index" class="event">{{ event }}</view></view>
      <text v-if="!canHandleReport && !['已关闭', '待维修'].includes(selected.stage)" class="muted">值班运维人员正在跟进，可在报修列表查看进度。</text>
    </template>
    <template v-else>
      <view class="panel">
        <input v-model="query" class="input" aria-label="搜索报修" placeholder="搜索报修单号、客户、项目" />
        <picker :range="stages" @change="stage = stages[Number($event.detail.value)]"><view class="filter">处理状态：{{ stage }} <wd-icon name="arrow-down" /></view></picker>
        <text class="muted">{{ view === 'reports' ? '全部报修单及处理进度' : canManage ? '按值班人员跟进，报价需内部确认' : '查看报修及处理进度' }} · 共 {{ filtered.length }} 条</text>
      </view>
      <view v-for="report in paged" :key="report.id" class="panel report-card" role="button" tabindex="0" :aria-label="'查看报修详情 ' + report.id" @click="select(report)" @keydown.enter="select(report)">
        <view class="row"><text class="title">{{ report.customer }}</text><text class="badge">{{ report.stage }}</text></view>
        <text class="muted">{{ report.id }} · {{ report.projectName }}</text><view class="description">{{ report.fault }}</view>
        <text class="muted">报修时间：{{ report.reportedAt }} · 申请人：{{ report.applicant }}</text>
      </view>
      <view v-if="!filtered.length" class="empty">暂无{{ view === 'quotes' ? '需要报价的报修' : '报修记录' }}<view>可填写报修，或调整搜索条件。</view></view>
      <view v-if="filtered.length" class="actions"><button class="btn" :disabled="page <= 1" @click="page--">上一页</button><text class="page-count">{{ page }} / {{ Math.max(1, Math.ceil(filtered.length / 5)) }}</text><button class="btn" :disabled="page * 5 >= filtered.length" @click="page++">下一页</button></view>
    </template>
    <button v-if="!selected && view === 'reports'" class="report-add" aria-label="新增报修单" @click="view = 'create'">
      <wd-icon name="add" size="22px" /><text>新增报修</text>
    </button>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import dayjs from 'dayjs'
import { useUserStore } from '@/store/user'
import { createIntakeFixtures } from './intakeFixtures'
import ReportAttachments from './ReportAttachments.vue'
import SectionCard from '@/components/SectionCard/SectionCard.vue'
import type { PreviewOrder } from './previewData'
import { assessReport, finishSurvey, submitQuote, confirmQuote, createRepairOrder, assignDemoDuty, quoteTotal, type IntakeReport, type IntakeView, type QuoteItem } from './intakeFlow'
const props = defineProps<{ entry: IntakeView; request: number; canManage: boolean }>()
const emit = defineEmits<{ 'order-created': [order: PreviewOrder]; 'open-order': [id: string]; 'title-change': [title: string] }>()
const user = useUserStore()
const reports = ref<IntakeReport[]>(createIntakeFixtures(user.identity.userId))
const view = ref<IntakeView>(props.entry)
const headings = { create: '填写报修', reports: '报修列表', quotes: '维修报价' }
// 演示选项，不用于真实业务接口。
const customerOptions = [
  { id: 'DEMO-C-1', name: '滨海堆场（示例）', projects: [{ id: 'DEMO-P-1', name: '闸口设备维护（示例）' }, { id: 'DEMO-P-2', name: '堆场系统维护（示例）' }] },
  { id: 'DEMO-C-2', name: '港区物流（示例）', projects: [{ id: 'DEMO-P-3', name: '车辆识别系统（示例）' }] },
  { id: 'DEMO-C-3', name: '智慧园区（示例）', projects: [{ id: 'DEMO-P-4', name: '园区设备维护（示例）' }] },
]
const emptyDraft = () => ({ customerId: '', projectId: '', fault: '', reportDate: dayjs().format('YYYY-MM-DD'), remark: '', photos: [] as string[], videos: [] as string[] })
const draft = reactive(emptyDraft())
const mediaBusy = ref(false)
const selectedCustomer = computed(() => customerOptions.find(c => c.id === draft.customerId))
const projectOptions = computed(() => selectedCustomer.value?.projects || [])
const selectedProject = computed(() => projectOptions.value.find(p => p.id === draft.projectId))
function chooseCustomer(index: number) {
  const id = customerOptions[index]?.id || ''
  if (id !== draft.customerId) { draft.customerId = id; draft.projectId = '' }
}
const selectedId = ref(''), query = ref(''), stage = ref('全部'), page = ref(1), error = ref('')
const stages = ['全部', '待受理', '待勘查', '待报价', '待内部确认', '待维修', '已关闭']
const selected = computed(() => reports.value.find(r => r.id === selectedId.value))
const canHandleReport = computed(() => props.canManage || (!!user.identity.userId && selected.value?.ownerId === user.identity.userId))
watch(() => selected.value ? '报修处理详情' : headings[view.value], title => emit('title-change', title), { immediate: true })
function backToList() {
  if (selectedId.value) { selectedId.value = ''; error.value = ''; return true }
  if (view.value === 'create' && props.entry !== 'create') { view.value = props.entry; error.value = ''; return true }
  return false
}
defineExpose({ backToList })
const isFault = ref(true), needsQuote = ref(true), handling = ref(''), survey = ref(''), quoteReason = ref('')
const items = ref<QuoteItem[]>([{ name: '', qty: 1, price: 0 }])
const filtered = computed(() => reports.value.filter(r =>
  (view.value === 'reports' || props.canManage || r.applicantId === user.identity.userId || r.ownerId === user.identity.userId) &&
  (view.value !== 'quotes' || r.needsQuote) &&
  (stage.value === '全部' || r.stage === stage.value) && `${r.id}${r.customer}${r.projectName}`.toLowerCase().includes(query.value.trim().toLowerCase())))
const paged = computed(() => filtered.value.slice((page.value - 1) * 5, page.value * 5))
const detailRows = computed(() => selected.value ? [
  ['报修单', selected.value.id], ['项目', selected.value.projectName], ['故障现象', selected.value.fault],
  ['报修时间', selected.value.reportedAt], ['值班运维', selected.value.owner || '等待自动分配'], ['分配依据', selected.value.dutyDate ? `${selected.value.dutyDate} 值班表（示例）` : '等待值班信息'], ['备注', selected.value.remark], ['申请人', selected.value.applicant],
] : [])
watch([query, stage, view], () => { page.value = 1; error.value = '' })
watch(() => props.request, () => { view.value = props.entry; selectedId.value = ''; query.value = ''; stage.value = '全部'; error.value = '' })
function select(report: IntakeReport) {
  selectedId.value = report.id; error.value = ''; handling.value = report.handling; survey.value = report.survey
  quoteReason.value = ''; isFault.value = true; needsQuote.value = true
  items.value = report.items.length ? report.items.map(i => ({ ...i })) : [{ name: '', qty: 1, price: 0 }]
}
function createReport() {
  if (mediaBusy.value) return
  if (!selectedCustomer.value || !selectedProject.value) { error.value = '请选择客户及对应项目'; return }
  if (!draft.fault.trim()) { error.value = '请填写故障现象'; return }
  if (!draft.reportDate || !dayjs(draft.reportDate).isValid()) { error.value = '请选择有效的报修日期'; return }
  const id = `DEMO-BX-${Date.now()}-${reports.value.length + 1}`
  const createdAt = new Date().toLocaleString('zh-CN', { hour12: false })
  const report: IntakeReport = {
    customerId: selectedCustomer.value.id, customer: selectedCustomer.value.name,
    projectId: selectedProject.value.id, projectName: selectedProject.value.name,
    equipment: '', contact: '', phone: '', address: '', fault: draft.fault.trim(),
    reportedAt: draft.reportDate, remark: draft.remark.trim(),
    photos: [...draft.photos], videos: [...draft.videos],
    id, applicant: user.userInfo.realname || user.userInfo.username || '当前员工', applicantId: user.identity.userId,
    createdAt, stage: '待受理', handling: '', surveyor: '', survey: '', quoteId: '', items: [], quoteReason: '', quoteConfirmed: false,
    owner: '', mode: 'offline', orderId: '', events: [`${createdAt} 提交报修（演示）`],
  }
  assignDemoDuty(report)
  reports.value.unshift(report); Object.assign(draft, emptyDraft()); view.value = 'reports'; selectedId.value = ''; stage.value = '全部'; query.value = ''; error.value = ''
}
function run(action: () => void) {
  if (!canHandleReport.value || (selected.value?.stage === '待内部确认' && !props.canManage)) { error.value = '当前账号不能办理此操作'; return }
  try { action(); ensureRepairOrder(); error.value = ''; if (selected.value?.stage === '待报价') items.value = selected.value.items.length ? selected.value.items.map(i => ({ ...i })) : [{ name: '', qty: 1, price: 0 }] }
  catch (e: any) { error.value = e.message || '操作失败' }
}
function ensureRepairOrder(report = selected.value) {
  if (report?.stage === '待维修' && !report.orderId) emit('order-created', createRepairOrder(report))
}
onMounted(() => reports.value.forEach(report => ensureRepairOrder(report)))
</script>

<style scoped lang="scss">
@use './preview.scss';
.toolbar { margin-bottom: 14px; }
.report-form :deep(.section-card) { margin: 0 0 12px; }
.report-form-row { display: flex; align-items: center; padding: 12px 0; border-bottom: 1px solid #f5f5f5; }
.report-form-row:last-child { border-bottom: none; }
.report-label { flex: none; width: 84px; font-size: 14px; font-weight: 400; color: #333; }
.report-picker { flex: 1; min-width: 0; }
.report-picker-value { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 44px; font-size: 14px; color: #333; }
.report-picker-value text { min-width: 0; overflow-wrap: anywhere; }
.report-picker-value.placeholder { color: #767676; }
.report-date-time { flex: 1; min-width: 0; display: flex; flex-wrap: wrap; gap: 4px 14px; }
.report-date-time > picker:first-child { flex: 1 1 132px; }
.report-text-field { position: relative; }
.report-text-field > .report-label { display: block; width: auto; margin-bottom: 9px; }
.report-text-field .textarea { height: 110px; padding-bottom: 28px; }
.report-remark { margin-top: 16px; }
.report-count { position: absolute; bottom: 8px; right: 10px; font-size: 12px; line-height: 16px; color: #767676; pointer-events: none; }
.report-form-hint { display: block; padding: 0 4px; font-size: 13px; line-height: 1.6; color: #767676; }
.report-submit { padding: 20px 4px 16px; }
.report-form :deep(.report-media) { margin-top: 0; }
.report-card { cursor: pointer; }
.report-card:focus-visible { outline: 2px solid #176ac7; outline-offset: 2px; }
.select-control { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 44px; height: auto; padding-top: 10px; padding-bottom: 10px; }
.select-control text { min-width: 0; overflow-wrap: anywhere; }
.select-disabled { color: #667085; background: #eef0f4; }
.report-list { padding-bottom: 88px; }
.report-add {
  position: fixed;
  right: 20px;
  bottom: calc(24px + env(safe-area-inset-bottom));
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 48px;
  margin: 0;
  padding: 0 16px;
  border-radius: 24px;
  background: #176ac7;
  color: #fff;
  font-size: 14px;
  line-height: 48px;
  box-shadow: 0 4px 12px rgba(23, 106, 199, 0.2);
}
.report-add::after { border: none; }
.report-add:focus-visible { outline: 2px solid #176ac7; outline-offset: 3px; }
.spaced { margin-top: 16px; }
.description { margin: 12px 0; font-size: 14px; line-height: 1.7; overflow-wrap: anywhere; }
.quote-item { padding: 14px 0; border-bottom: 1px solid #e1e4e8; margin-bottom: 16px; }
.event { padding: 10px 0; font-size: 14px; line-height: 1.7; border-bottom: 1px solid #eef0f5; overflow-wrap: anywhere; }
.filter { padding: 14px 0; font-size: 14px; color: #333; }
.page-count { align-self: center; font-size: 14px; color: #667085; }
</style>
