<template>
  <view class="workflow">
    <PageLayout class="workflow-shell" :nav-title="title" nav-left-text="返回" nav-background-color="#176ac7" type="popup" @nav-back="back">
      <scroll-view class="workflow-body" scroll-y :scroll-top="scrollTop">
        <view class="workflow-content" :class="{ 'with-actions': footerActions.length || canShowMore, 'with-add': screen === 'reports' }">
          <view class="demo-toolbar"><text>Mock 演示 · {{ actor.name }}</text><button :disabled="mediaBusy" @click="showSettings = true">演示设置</button></view>
          <view v-if="error" class="error" role="alert">{{ error }}</view>
          <view v-if="message" class="feedback" role="status">{{ message }}</view>

          <template v-if="screen === 'create'">
            <SectionCard title="关联信息">
              <view class="form-row"><text class="label">客户<text class="required">*</text></text>
                <picker :range="demoCustomers" range-key="name" @change="chooseCustomer(Number($event.detail.value))"><view class="picker-value">{{ customer?.name || '请选择客户' }}<wd-icon name="arrow-right" /></view></picker>
              </view>
              <view class="form-row"><text class="label">项目<text class="required">*</text></text>
                <picker :range="projects" range-key="name" :disabled="!customer" @change="chooseProject(Number($event.detail.value))"><view class="picker-value">{{ project?.name || (customer ? '请选择项目' : '请先选择客户') }}<wd-icon name="arrow-right" /></view></picker>
              </view>
              <view class="form-row"><text class="label">产品<text class="required">*</text></text>
                <picker :range="project?.products || []" :disabled="!project" @change="draft.product = project?.products[Number($event.detail.value)] || ''"><view class="picker-value">{{ draft.product || (project ? '请选择项目产品' : '请先选择项目') }}<wd-icon name="arrow-right" /></view></picker>
              </view>
              <text class="muted">本轮按单个项目产品演示，多产品规则待后端对齐。</text>
            </SectionCard>
            <SectionCard title="报修信息">
              <label class="field-label" for="report-fault">故障现象<text class="required">*</text></label>
              <textarea id="report-fault" v-model="draft.fault" class="textarea" maxlength="1000" placeholder="描述故障现象及影响" />
              <view class="form-row"><text class="label">报修时间<text class="required">*</text></text><picker mode="date" :value="draft.reportedAt" @change="draft.reportedAt = $event.detail.value"><view class="picker-value">{{ draft.reportedAt }}<wd-icon name="calendar" /></view></picker></view>
              <label class="field-label" for="report-remark">备注</label><textarea id="report-remark" v-model="draft.remark" class="textarea" maxlength="1000" placeholder="请描述报修客户信息" />
              <view class="kv"><text>报修人</text><text>{{ actor.name }}（演示）</text></view>
            </SectionCard>
            <SectionCard title="现场附件"><ReportAttachments v-model:photos="draft.photos" v-model:videos="draft.videos" @busy="mediaBusy = $event" /></SectionCard>
          </template>

          <template v-else-if="['reports', 'records'].includes(screen)">
            <view class="list-filters">
              <view class="search-row"><input v-model="searchDraft" class="input" aria-label="搜索报修或维修" placeholder="客户、项目、产品、报修人" confirm-type="search" @confirm="search" /><button class="search-button" @click="search">查询</button></view>
              <view class="tabs" role="tablist"><button v-for="s in mainFilters" :key="s" role="tab" :aria-selected="filter === s" :class="{ active: filter === s }" @click="filter = s">{{ s }}</button></view>
              <view class="filter-row">
                <picker v-if="screen === 'records' && actor.role === 'technician'" :range="relations" :value="relations.indexOf(relation)" @change="relation = relations[Number($event.detail.value)]"><view class="picker-value">{{ relation }}<wd-icon name="arrow-down" size="14px" /></view></picker>
                <button v-else-if="screen === 'records' && actor.role === 'supervisor'" class="approval-filter" :class="{ on: pendingOnly }" @click="pendingOnly = !pendingOnly">{{ pendingOnly ? '待我审批' : '全部任务' }}<wd-icon name="arrow-down" size="14px" /></button>
                <text v-else class="muted">{{ scopeText }}</text>
                <button class="reset-button" :disabled="!searchDraft && !query && filter === '全部' && !pendingOnly" @click="resetFilters">重置</button>
              </view>
            </view>
            <text class="list-count">共 {{ filtered.length }} 条 · 每页 5 条</text>
            <view v-for="c in paged" :key="c.id" class="panel case-card" role="button" tabindex="0" @click="openCase(c)" @keydown.enter="openCase(c)">
              <view class="card-head"><text class="card-no">{{ displayNumber(c) }}</text><text class="badge" :class="stateTone(c.state)">{{ c.state }}</text></view>
              <view class="card-name">{{ c.project }}</view>
              <view class="kv"><text>客户</text><text>{{ c.customer }}</text></view>
              <view class="kv"><text>产品</text><text>{{ c.product }}</text></view>
              <view v-if="screen === 'records'" class="kv"><text>故障</text><text class="fault-summary">{{ c.fault }}</text></view>
              <view v-if="screen === 'records'" class="kv"><text>负责人</text><text>{{ c.owner }}</text></view>
              <view class="kv"><text>报修人</text><text>{{ c.applicant }}</text></view>
              <view class="kv"><text>报修时间</text><text>{{ c.reportedAt }}</text></view>
              <view class="card-progress"><text v-if="c.state === '待处理'" class="waiting">已等待 {{ waitText(c, clockNow) }}</text><text v-else>{{ detailStatus(c) }}</text><wd-icon name="arrow-right" size="14px" /></view>
            </view>
            <view v-if="!filtered.length" class="empty">当前范围暂无记录<text>可调整筛选，或切换模拟身份验证数据范围。</text></view>
            <view v-if="filtered.length" class="pagination"><button class="btn" :disabled="page === 1" @click="page--">上一页</button><text>{{ page }} / {{ pageCount }}</text><button class="btn" :disabled="page >= pageCount" @click="page++">下一页</button></view>
            <button v-if="screen === 'reports'" class="report-add" @click="go('create')"><wd-icon name="add" color="#fff" />新增报修</button>
          </template>

          <template v-else-if="screen === 'detail' && selected && canViewSelected">
            <view class="panel">
              <view class="row"><text class="title">{{ selected.project }}</text><text class="badge">{{ selected.state }}</text></view>
              <text class="status-line">{{ detailStatus(selected) }}</text>
              <text class="muted">{{ selected.orderId }} · 负责人：{{ selected.owner }}</text>
              <text v-if="!owner && source !== 'reports'" class="readonly-note">{{ actor.role === 'supervisor' || actor.role === 'director' ? '审批 / 查看身份，不拥有负责人操作权限' : '只读记录，不拥有当前负责人操作权限' }}</text>
            </view>
            <SectionCard title="报修信息">
              <view v-for="row in reportRows" :key="row[0]" class="kv"><text>{{ row[0] }}</text><text>{{ row[1] }}</text></view>
              <ReportAttachments v-if="selected.photos.length || selected.videos.length" :photos="selected.photos" :videos="selected.videos" readonly />
            </SectionCard>
            <template v-if="source !== 'reports'">
              <SectionCard title="维修日志">
                <text v-if="!selected.logs.length" class="muted">尚未开始维修，首次检查时判断是否需要报价。</text>
                <view v-for="log in visibleLogs" :key="log.id" class="log-entry">
                  <text class="field-label">第 {{ selected.logs.indexOf(log) + 1 }} 次 · {{ log.mode }} · {{ log.endedAt ? (log.result || '首次检查结束，待报价') : '打卡中 / 草稿' }}</text>
                  <text class="muted">{{ formatTime(log.startedAt) }} — {{ log.endedAt ? formatTime(log.endedAt) : '未结束' }}</text>
                  <text class="description">{{ log.description || '尚未填写维修记录' }}</text><text v-if="log.reason" class="muted">复修原因：{{ log.reason }}</text>
                  <ReportAttachments v-if="log.photos.length || log.videos.length" :photos="log.photos" :videos="log.videos" readonly />
                </view>
                <button v-if="selected.logs.length > 1" class="fold-button" :aria-expanded="showAllLogs" @click="showAllLogs = !showAllLogs">{{ showAllLogs ? '收起历史日志' : `查看全部 ${selected.logs.length} 次日志` }}<wd-icon :name="showAllLogs ? 'arrow-up' : 'arrow-down'" size="14px" /></button>
                <view class="kv"><text>累计时长</text><text>{{ totalHours(selected).toFixed(2) }}h（已结束记录）</text></view>
              </SectionCard>
              <SectionCard v-if="!['未判断', '无需报价'].includes(selected.quoteState)" title="报价信息">
                <view class="kv"><text>报价状态</text><text>{{ selected.quoteState }}{{ selected.quoteStep ? ` · 等待${selected.quoteStep}` : '' }}</text></view>
                <view v-for="(item, i) in selected.quoteItems" :key="i" class="kv"><text>{{ item.name }}</text><text>{{ item.qty }} × ¥{{ item.price }}</text></view>
                <view v-if="selected.quoteItems.length" class="kv"><text>报价合计</text><text>¥{{ quoteTotal(selected.quoteItems).toFixed(2) }}</text></view>
                <view v-if="selected.confirmedPrice != null" class="kv"><text>客户确认价</text><text>¥{{ selected.confirmedPrice.toFixed(2) }}</text></view>
                <text v-if="selected.quoteReason" class="muted">审批意见：{{ selected.quoteReason }}</text>
              </SectionCard>
              <SectionCard v-if="selected.assistanceRequests?.length" title="协助申请">
                <view v-for="(request, index) in selected.assistanceRequests" :key="index" class="log-entry"><text class="description">{{ request.users.map(u => u.name).join('、') }}</text><text class="muted">{{ request.reason }}</text><text class="muted">{{ request.status }}（Mock，审批办理待对接）</text></view>
              </SectionCard>
              <SectionCard v-if="selected.materialRequests?.length" title="物料申请记录">
                <view v-for="(request, index) in selected.materialRequests" :key="index" class="log-entry"><text class="description">{{ request.type }} · {{ request.status }}（Mock）</text><text v-for="line in request.lines" :key="line.id" class="muted">{{ line.material?.name || repairMaterials.find(m => m.id === line.id)?.name }}：{{ line.qty }} {{ line.material?.unit || repairMaterials.find(m => m.id === line.id)?.unit }}{{ line.reason ? `；差异原因：${line.reason}` : '' }}</text><text v-if="request.remark" class="muted">备注：{{ request.remark }}</text></view>
              </SectionCard>
              <SectionCard v-if="selected.materialOpen || selected.materialRequests?.length || selected.completion !== '未提交'" :title="selected.materialOpen || selected.materialRequests?.length ? '物料与完工' : '完工信息'">
                <view v-if="selected.materialOpen" class="kv"><text>物料结清</text><text>未结清（示例：电源 1 件）</text></view>
                <text v-if="selected.materialRequests?.length" class="muted">有待处理物料申请，审批及库管执行尚未对接，暂不能提交完工。</text>
                <view v-if="selected.completion !== '未提交'" class="kv"><text>完工审批</text><text>{{ selected.completion }}</text></view>
                <view v-if="selected.finalPrice != null" class="kv"><text>最终维修价</text><text>¥{{ selected.finalPrice.toFixed(2) }}</text></view>
                <text v-if="selected.completionReason" class="muted">审批意见：{{ selected.completionReason }}</text>
                <text v-if="selected.state === '已完成'" class="muted">维修已完成，客户评价待对接。</text>
              </SectionCard>
            </template>
            <view class="panel"><button class="fold-button" :aria-expanded="showEvents" @click="showEvents = !showEvents">处理记录（{{ selected.events.length }}）<wd-icon :name="showEvents ? 'arrow-up' : 'arrow-down'" size="14px" /></button><template v-if="showEvents"><view v-for="(event, i) in selected.events" :key="i" class="event">{{ event }}</view></template><text v-else class="muted">{{ selected.events.at(-1) }}</text></view>
            <text v-if="source === 'reports' && !canSeeRepair(selected, actor)" class="muted">维修负责人正在跟进，您可以在这里查看处理进度。</text>
          </template>

          <template v-else-if="screen === 'log' && selected && owner && currentLog">
            <SectionCard title="本次维修">
              <text class="title">{{ selected.project }} · {{ selected.product }}</text>
              <view class="kv"><text>维保类型</text><text>{{ selected.warranty }}</text></view>
              <view class="kv"><text>开始打卡</text><text>{{ formatTime(currentLog.startedAt) }}（模拟）</text></view>
              <view class="choices"><button v-for="mode in repairModes" :key="mode" class="choice" :class="{ on: currentLog.mode === mode }" @click="currentLog.mode = mode">{{ mode }}</button></view>
            </SectionCard>
            <SectionCard title="故障检查">
              <label for="fault-position" class="field-label">故障位置<text class="required">*</text></label><input id="fault-position" v-model="currentLog.position" class="input" maxlength="120" placeholder="填写故障所在位置" />
              <label for="fault-description" class="field-label spaced">故障描述<text class="required">*</text></label><textarea id="fault-description" v-model="currentLog.fault" class="textarea" maxlength="2000" placeholder="填写检查发现的问题" />
              <template v-if="selected.quoteState === '未判断'">
                <text class="field-label spaced">是否需要报价<text class="required">*</text></text><view class="choices"><button v-for="v in yesNo" :key="v" class="choice" :class="{ on: currentLog.needsQuote === v }" @click="currentLog.needsQuote = v">{{ v }}</button></view>
                <text v-if="currentLog.needsQuote === '是'" class="muted">保存并结束本次检查后填写报价；主管、总经理审批及客户确认完成前，不能开始后续维修。</text>
              </template>
              <view v-else class="kv"><text>报价状态</text><text>{{ selected.quoteState }}</text></view>
            </SectionCard>
            <SectionCard title="维修记录">
              <label for="repair-description" class="field-label">本次处理记录<text class="required">*</text></label><textarea id="repair-description" v-model="currentLog.description" class="textarea" maxlength="3000" placeholder="填写检查、处理过程和结果" />
              <ReportAttachments v-model:photos="currentLog.photos" v-model:videos="currentLog.videos" @busy="mediaBusy = $event" />
              <label for="repair-vehicle" class="field-label spaced">用车记录</label><input id="repair-vehicle" v-model="currentLog.vehicle" class="input" maxlength="200" placeholder="填写车辆、里程等（本轮文本演示）" />
              <view class="kv"><text>用人记录</text><text>{{ currentLog.people }}（双主管协助审批后续补齐）</text></view>
            </SectionCard>
            <SectionCard v-if="!(selected.quoteState === '未判断' && currentLog.needsQuote === '是')" title="本次结果">
              <view class="choices"><button v-for="r in results" :key="r" class="choice" :class="{ on: currentLog.result === r }" @click="currentLog.result = r">{{ r }}</button></view>
              <textarea v-if="currentLog.result === '需要复修'" v-model="currentLog.reason" class="textarea spaced" maxlength="1000" aria-label="复修原因" placeholder="请填写复修原因（必填）" />
            </SectionCard>
            <text class="muted">输入保留为本次会话草稿，返回不结束打卡；刷新页面会清空 Mock 数据。</text>
          </template>

          <template v-else-if="screen === 'quote' && selected && owner">
            <SectionCard title="填写维修报价">
              <text class="muted">{{ selected.project }} · {{ selected.product }}。提交后先由运维主管审批，再由总经理审批。</text>
              <view v-for="(item, i) in quoteDraft" :key="i" class="quote-line">
                <label :for="`item-${i}`" class="field-label">报价项目 {{ i + 1 }}<text class="required">*</text></label><input :id="`item-${i}`" v-model="item.name" class="input" maxlength="120" placeholder="项目名称" />
                <view class="split spaced"><view><label :for="`qty-${i}`" class="field-label">数量</label><input :id="`qty-${i}`" v-model.number="item.qty" type="digit" class="input" /></view><view><label :for="`price-${i}`" class="field-label">单价（元）</label><input :id="`price-${i}`" v-model.number="item.price" type="digit" class="input" /></view></view>
                <button class="btn btn--text" :disabled="quoteDraft.length === 1" @click="quoteDraft.splice(i, 1)">删除此项</button>
              </view>
              <button class="btn" @click="quoteDraft.push({ name: '', qty: 1, price: 0 })">添加报价项目</button>
              <view class="kv"><text>合计</text><text>¥{{ Number.isFinite(quoteTotal(quoteDraft)) ? quoteTotal(quoteDraft).toFixed(2) : '—' }}</text></view>
            </SectionCard>
          </template>

          <template v-else-if="['customer', 'completion', 'approval'].includes(screen) && selected && canSeeRepair(selected, actor)">
            <SectionCard :title="title">
              <view class="kv"><text>项目 / 产品</text><text>{{ selected.project }} / {{ selected.product }}</text></view>
              <view class="kv"><text>报价状态</text><text>{{ selected.quoteState }}</text></view>
              <view v-for="(item, i) in selected.quoteItems" :key="i" class="kv"><text>{{ item.name }}</text><text>{{ item.qty }} × ¥{{ item.price }}</text></view>
              <view v-if="selected.quoteItems.length" class="kv"><text>报价合计</text><text>¥{{ quoteTotal(selected.quoteItems).toFixed(2) }}</text></view>
              <view v-if="selected.confirmedPrice != null" class="kv"><text>客户确认价</text><text>¥{{ selected.confirmedPrice.toFixed(2) }}</text></view>
              <template v-if="screen === 'completion' || selected.completion === '待审批'">
                <view class="kv"><text>累计维修时长</text><text>{{ totalHours(selected).toFixed(2) }}h</text></view>
                <view class="kv"><text>物料结清</text><text>{{ selected.materialOpen ? '未结清，禁止提交' : '已结清 / 无领料' }}</text></view>
                <text class="muted">核对最终维修价格，可修改，无须客户再次确认。物料仅为 Mock 结清标记，不代表真实库存校验。</text>
              </template>
              <template v-if="screen === 'customer' || (screen === 'completion' && selected.quoteState === '报价已确认')"><label for="repair-price" class="field-label spaced">{{ screen === 'customer' ? '客户确认维修价格' : '最终维修价格' }}（元）<text class="required">*</text></label><input id="repair-price" v-model="priceInput" class="input" type="digit" placeholder="请输入价格，允许 0 元" /></template>
              <template v-if="screen === 'approval'"><view v-if="selected.finalPrice != null" class="kv"><text>最终维修价</text><text>¥{{ selected.finalPrice.toFixed(2) }}</text></view><label for="approval-reason" class="field-label spaced">审批意见（驳回必填）</label><textarea id="approval-reason" v-model="approvalReason" class="textarea" maxlength="1000" placeholder="填写审批意见" /></template>
            </SectionCard>
          </template>

          <template v-else-if="screen === 'exception' && selected && owner">
            <SectionCard :title="`申请${exceptionType}`"><text class="muted">仅登记待主管审批，不直接{{ exceptionType === '关闭' ? '关闭单据' : '变更负责人' }}；完整审批下一阶段补齐。</text>
              <picker :range="exceptionReasons" @change="exceptionReason = exceptionReasons[Number($event.detail.value)]"><view class="picker-value">{{ exceptionReason || '请选择原因（必填）' }}<wd-icon name="arrow-down" /></view></picker>
              <textarea v-model="exceptionRemark" class="textarea" maxlength="1000" aria-label="申请备注" placeholder="填写备注（必填）" />
            </SectionCard>
          </template>
          <RepairAssistanceForm v-else-if="screen === 'assistance' && selected && owner" ref="assistanceForm" :excluded="[selected.ownerId, ...selected.assistants, ...(selected.assistanceRequests ?? []).flatMap(r => r.users.map(u => u.id))]" @submit="submitAssistance" />
          <RepairMaterialForm v-else-if="screen === 'materials' && selected && owner" ref="materialForm" :key="materialType" :repair="selected" :type="materialType" @submit="submitMaterials" />
          <OpsPreviewInspection v-else-if="screen === 'inspection'" />
          <view v-else class="empty">当前身份无权查看此内容<button class="btn" @click="go('reports')">返回报修列表</button></view>
        </view>
      </scroll-view>
      <view v-if="footerActions.length || canShowMore" class="workflow-bottom">
        <view class="workflow-bottom__inner"><button v-for="op in footerActions" :key="op.text" class="footer-btn" :class="{ primary: op.primary }" :disabled="mediaBusy" @click="op.action">{{ op.text }}</button><button v-if="canShowMore" class="footer-btn footer-more" :aria-expanded="showMore" @click="showMore = true">更多 <wd-icon name="arrow-up" size="14px" /></button></view>
      </view>
    </PageLayout>
    <wd-popup v-model="showMore" position="bottom" :z-index="12000" :safe-area-inset-bottom="true" custom-style="border-radius:16px 16px 0 0;">
      <view class="more-sheet"><view class="sheet-head"><text>更多操作</text><button aria-label="关闭更多操作" @click="showMore = false"><wd-icon name="close" size="18px" /></button></view>
        <view v-for="group in moreGroups" :key="group.title" class="more-group"><text class="more-label">{{ group.title }}</text><view class="more-items"><button v-for="op in group.items" :key="op.text" :disabled="op.disabled" @click="runMore(op)">{{ op.text }}<wd-icon name="arrow-right" size="14px" /></button></view></view>
        <text v-if="selected && blockReason(selected)" class="muted spaced">{{ blockReason(selected) }}</text>
      </view>
    </wd-popup>
    <wd-popup v-model="showSettings" position="bottom" :z-index="12000" :safe-area-inset-bottom="true" custom-style="border-radius:16px 16px 0 0;">
      <view class="more-sheet"><view class="sheet-head"><text>演示设置</text><button aria-label="关闭演示设置" @click="showSettings = false"><wd-icon name="close" size="18px" /></button></view>
        <text class="muted">仅切换 Mock 身份，不修改账号权限。不提交业务、不获取定位；刷新或切换账号清空演示数据。</text>
        <view class="actor-options"><button v-for="(option, i) in demoActors" :key="option.id" :disabled="mediaBusy" :class="{ on: i === actorIndex }" @click="switchActor(i)">{{ option.name }}<text v-if="i === actorIndex">当前</text></button></view>
        <text class="muted">默认运维身份可查看维修任务。普通报修人仅显示报修管理入口。</text>
      </view>
    </wd-popup>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import dayjs from 'dayjs'
import PageLayout from '@/components/PageLayout/PageLayout.vue'
import SectionCard from '@/components/SectionCard/SectionCard.vue'
import ReportAttachments from './ReportAttachments.vue'
import OpsPreviewInspection from './OpsPreviewInspection.vue'
import RepairAssistanceForm from './RepairAssistanceForm.vue'
import RepairMaterialForm from './RepairMaterialForm.vue'
import { requestAssistance, requestRepairMaterials, repairMaterials, type AssistUser, type MaterialLine } from './repairWorkflow'
import { demoActors, demoCustomers, createWorkflowFixtures, createCase, canSeeReport, canSeeRepair, isOwner, activeLog, blockReason, startLog, finishLog, submitQuote, quoteTotal, canApproveQuote, approveQuote, confirmCustomer, completionBlock, submitCompletion, approveCompletion, requestException, totalHours, waitText, defaultDemoActorIndex, type DemoRole, type RepairCase, type ReportDraft, type QuoteLine } from './repairWorkflow'
const props = defineProps<{ canManage: boolean }>()
const emit = defineEmits<{ close: []; 'role-change': [role: DemoRole] }>()
type Screen = 'create' | 'reports' | 'records' | 'detail' | 'log' | 'quote' | 'customer' | 'completion' | 'approval' | 'exception' | 'inspection' | 'assistance' | 'materials'
const assistanceForm = ref<InstanceType<typeof RepairAssistanceForm>>()
const materialForm = ref<InstanceType<typeof RepairMaterialForm>>()
const materialType = ref<'领料' | '还料'>('领料')
function submitAssistance(users: AssistUser[], reason: string) { run(() => requestAssistance(selected.value!, actor.value, users, reason)) }
function submitMaterials(lines: MaterialLine[], remark: string) { run(() => requestRepairMaterials(selected.value!, actor.value, materialType.value, lines, remark)) }
function openMaterials(type: '领料' | '还料') { materialType.value = type; go('materials') }
const screen = ref<Screen>('reports'), source = ref<Screen>('reports')
const actorIndex = ref(defaultDemoActorIndex(props.canManage))
const actor = computed(() => demoActors[actorIndex.value])
watch(() => actor.value.role, role => emit('role-change', role), { immediate: true })
const showSettings = ref(false), showMore = ref(false), showAllLogs = ref(false), showEvents = ref(false)
const scrollTop = ref(0)
function scrollToTop() { scrollTop.value = 1; void nextTick(() => { scrollTop.value = 0 }) }
const cases = ref(createWorkflowFixtures()), selectedId = ref('')
const selected = computed(() => cases.value.find(c => c.id === selectedId.value))
const owner = computed(() => !!selected.value && isOwner(selected.value, actor.value))
const terminal = computed(() => !!selected.value && ['已完成', '已关闭'].includes(selected.value.state))
const currentLog = computed(() => selected.value && activeLog(selected.value))
const visibleLogs = computed(() => selected.value ? (showAllLogs.value ? [...selected.value.logs].reverse() : selected.value.logs.slice(-1)) : [])
const canViewSelected = computed(() => !!selected.value && (source.value === 'reports' ? canSeeReport(selected.value, actor.value) : canSeeRepair(selected.value, actor.value)))
const error = ref(''), message = ref(''), mediaBusy = ref(false)
const query = ref(''), searchDraft = ref(''), filter = ref('全部'), page = ref(1), relation = ref('我负责的'), pendingOnly = ref(false)
const mainFilters = ['全部', '待处理', '进行中', '已完成', '已关闭']
const relations = ['我负责的', '我协助的', '历史负责']
const repairModes = ['线上', '线下', '检修'] as const
const results = ['维修完成', '需要复修'] as const
const yesNo = ['是', '否'] as const
const clockNow = ref(Date.now())
const timer = setInterval(() => { clockNow.value = Date.now() }, 60000)
onBeforeUnmount(() => clearInterval(timer))
const scopeText = computed(() => screen.value === 'reports' ? (actor.value.role === 'supervisor' ? '全部报修单' : actor.value.role === 'technician' ? '分配给我及历史负责的报修单' : '我提交的报修单') : actor.value.role === 'supervisor' ? '全部维修任务' : actor.value.role === 'director' ? '等待我审批的报价' : '与我有关的维修任务')
const filtered = computed(() => cases.value.filter(c => {
  if (screen.value === 'reports' ? !canSeeReport(c, actor.value) : !canSeeRepair(c, actor.value)) return false
  if (screen.value === 'records' && pendingOnly.value && !canApproveQuote(c, actor.value) && !(actor.value.role === 'supervisor' && c.completion === '待审批')) return false
  if (screen.value === 'records' && actor.value.role === 'technician') {
    if (relation.value === '我负责的' && c.ownerId !== actor.value.id) return false
    if (relation.value === '我协助的' && !c.assistants.includes(actor.value.id)) return false
    if (relation.value === '历史负责' && !c.previousOwners.includes(actor.value.id)) return false
  }
  return (filter.value === '全部' || c.state === filter.value) && `${c.id}${c.orderId}${c.customer}${c.project}${c.product}${c.applicant}`.toLowerCase().includes(query.value.trim().toLowerCase())
}))
const pageCount = computed(() => Math.max(1, Math.ceil(filtered.value.length / 5)))
const paged = computed(() => filtered.value.slice((page.value - 1) * 5, page.value * 5))
watch([query, filter, relation, pendingOnly], () => { page.value = 1 })
watch(page, scrollToTop)
watch(pageCount, value => { if (page.value > value) page.value = value })
const titles: Record<Screen, string> = { create: '填写报修', reports: '报修管理', records: '维修列表', detail: '维修详情', log: '填写维修日志', quote: '填写报价', customer: '客户确认维修', completion: '提交完工', approval: '审批详情', exception: '申请处理', inspection: '巡检管理', assistance: '申请协助', materials: '物料申请' }
const title = computed(() => screen.value === 'materials' ? `${materialType.value}申请` : screen.value === 'detail' && source.value === 'reports' ? '报修详情' : titles[screen.value])
const reportRows = computed(() => selected.value ? [['客户', selected.value.customer], ['项目', selected.value.project], ['产品', selected.value.product], ['报修人', selected.value.applicant], ['报修时间', selected.value.reportedAt], ['故障现象', selected.value.fault], ['备注', selected.value.remark || '—']] : [])
const emptyDraft = (): ReportDraft => ({ customerId: '', projectId: '', product: '', fault: '', reportedAt: dayjs().format('YYYY-MM-DD'), remark: '', photos: [], videos: [] })
const draft = reactive(emptyDraft())
const customer = computed(() => demoCustomers.find(c => c.id === draft.customerId))
const projects = computed(() => customer.value?.projects || [])
const project = computed(() => projects.value.find(p => p.id === draft.projectId))
function chooseCustomer(index: number) { draft.customerId = demoCustomers[index]?.id || ''; draft.projectId = ''; draft.product = '' }
function chooseProject(index: number) { draft.projectId = projects.value[index]?.id || ''; draft.product = '' }
const quoteDraft = ref<QuoteLine[]>([]), priceInput = ref(''), approvalReason = ref('')
const exceptionType = ref<'转单' | '关闭'>('转单'), exceptionReason = ref(''), exceptionRemark = ref('')
const exceptionReasons = computed(() => exceptionType.value === '关闭' ? ['客户弃修', '不是问题', '其他'] : ['个人问题', '病假'])
watch(exceptionType, () => { exceptionReason.value = ''; exceptionRemark.value = '' })
function go(target: Screen) { error.value = ''; message.value = ''; screen.value = target; showMore.value = false; scrollToTop() }
function back() {
  if (showMore.value || showSettings.value) { showMore.value = false; showSettings.value = false; return }
  if (['detail', 'create'].includes(screen.value)) { go(source.value === 'detail' ? 'reports' : source.value); selectedId.value = '' }
  else if (['reports', 'records', 'inspection'].includes(screen.value)) emit('close')
  else go('detail')
}
function resetFilters() { searchDraft.value = ''; query.value = ''; filter.value = '全部'; pendingOnly.value = false; relation.value = '我负责的'; page.value = 1 }
function search() { query.value = searchDraft.value.trim(); page.value = 1 }
function openHomeEntry(entry: 'reports' | 'records' | 'inspection') {
  const target = entry === 'records' && actor.value.role === 'reporter' ? 'reports' : entry
  source.value = target; selectedId.value = ''; resetFilters(); showSettings.value = false; go(target)
}
defineExpose({ openHomeEntry })
function switchActor(index: number) {
  if (!demoActors[index] || mediaBusy.value) return
  const returnToRecords = screen.value === 'records' || source.value === 'records'
  actorIndex.value = index; selectedId.value = ''; resetFilters(); showSettings.value = false
  Object.assign(draft, emptyDraft()); mediaBusy.value = false
  source.value = actor.value.role !== 'reporter' && (returnToRecords || actor.value.role === 'director') ? 'records' : 'reports'; go(source.value)
}
function openCase(c: RepairCase) { source.value = screen.value; selectedId.value = c.id; showAllLogs.value = false; showEvents.value = false; go('detail') }
function displayNumber(c: RepairCase) { return `${screen.value === 'reports' ? 'BX' : 'WX'}-${dayjs(c.createdAt).format('YYMMDD')}-${c.id.split('-').at(-1)!.padStart(3, '0')}（示例）` }
function stateTone(state: string) { return state === '已完成' ? 'badge--success' : state === '已关闭' ? 'badge--closed' : state === '待处理' ? 'badge--warn' : '' }
function formatTime(value: number) { return dayjs(value).format('MM-DD HH:mm') }
function detailStatus(c: RepairCase) {
  if (activeLog(c)) return '维修打卡中，待填写并结束'
  if (blockReason(c)) return blockReason(c)
  if (c.completion === '已驳回') return `完工驳回：${c.completionReason}`
  if (c.logs.at(-1)?.result === '需要复修') return '需要复修'
  if (c.logs.at(-1)?.result === '维修完成') return c.materialOpen ? '维修完成，待物料结清' : '维修完成，待提交完工'
  return c.state === '待处理' ? '等待负责人开始维修' : '可继续维修'
}
function run(action: () => void, target: Screen = 'detail') {
  try { action(); go(target); message.value = '操作已在本次 Mock 会话中生效，未提交服务器。' }
  catch (e) { error.value = e instanceof Error ? e.message : '操作失败，请检查填写内容'; scrollToTop() }
}
function createReport() {
  if (mediaBusy.value) return
  try {
    const c = createCase(draft, actor.value, cases.value.length + 1); cases.value.unshift(c)
    Object.assign(draft, emptyDraft()); selectedId.value = c.id; source.value = 'reports'
    go(canSeeReport(c, actor.value) ? 'detail' : 'reports')
    message.value = `报修已提交（模拟），自动分配给${c.owner}，已生成维修任务。${canSeeReport(c, actor.value) ? '' : '本单不在当前运维身份的负责范围内，可切换到主管查看。'}`
  } catch (e) { error.value = e instanceof Error ? e.message : '提交失败，请检查填写内容'; scrollToTop() }
}
function startWork() { if (selected.value) run(() => startLog(selected.value!, actor.value), 'log') }
function endWork() { if (!mediaBusy.value && selected.value) run(() => finishLog(selected.value!, actor.value)) }
function openForm(target: Screen) {
  quoteDraft.value = selected.value?.quoteItems.length ? selected.value.quoteItems.map(i => ({ ...i })) : [{ name: '', qty: 1, price: 0 }]
  priceInput.value = target === 'customer' ? '' : selected.value?.confirmedPrice == null ? '' : String(selected.value.confirmedPrice)
  approvalReason.value = ''; go(target)
}
function confirmPrice() { run(() => { if (!priceInput.value.trim()) throw new Error('请填写客户确认维修价格'); confirmCustomer(selected.value!, actor.value, Number(priceInput.value)) }) }
function complete() { run(() => { if (selected.value!.quoteState === '报价已确认' && !priceInput.value.trim()) throw new Error('请填写最终维修价格'); submitCompletion(selected.value!, actor.value, priceInput.value.trim() ? Number(priceInput.value) : undefined) }) }
function review(approved: boolean) { run(() => { const c = selected.value!; if (c.completion === '待审批') approveCompletion(c, actor.value, approved, approvalReason.value); else approveQuote(c, actor.value, approved, approvalReason.value) }, actor.value.role === 'director' ? 'records' : 'detail') }
interface FooterAction { text: string; action: () => void; primary?: boolean; disabled?: boolean }
const canShowMore = computed(() => screen.value === 'detail' && source.value !== 'reports' && canViewSelected.value && owner.value && !terminal.value && !selected.value?.pendingRequest && selected.value?.completion !== '待审批')
const footerActions = computed<FooterAction[]>(() => {
  const c = selected.value
  const primary = (text: string, action: () => void): FooterAction[] => [{ text, action, primary: true }]
  if (screen.value === 'create') return primary('提交报修', createReport)
  if (!c || !canViewSelected.value) return []
  if (screen.value === 'detail') {
    if (source.value === 'reports') return canSeeRepair(c, actor.value) ? primary('进入维修详情', () => { source.value = 'records'; scrollToTop() }) : []
    if (canApproveQuote(c, actor.value)) return primary('审批报价', () => openForm('approval'))
    if (actor.value.role === 'supervisor' && c.completion === '待审批') return primary('审批完工', () => openForm('approval'))
    if (!canShowMore.value) return []
    if (currentLog.value) return primary('继续填写日志', () => go('log'))
    if (['待报价', '审批驳回'].includes(c.quoteState)) return primary(c.quoteState === '审批驳回' ? '修改报价' : '填写报价', () => openForm('quote'))
    if (c.quoteState === '审批通过待客户确认') return primary('客户确认维修', () => openForm('customer'))
    if (!blockReason(c) && !completionBlock(c)) return primary('提交完工', () => openForm('completion'))
    if (!blockReason(c)) return primary(c.logs.length ? '继续维修' : '开始维修', startWork)
    return []
  }
  if (screen.value === 'approval' && (canApproveQuote(c, actor.value) || (actor.value.role === 'supervisor' && c.completion === '待审批'))) return [{ text: '驳回', action: () => review(false) }, { text: '审批通过', action: () => review(true), primary: true }]
  if (!owner.value || terminal.value) return []
  if (screen.value === 'assistance') return primary('提交协助申请', () => assistanceForm.value?.submit())
  if (screen.value === 'materials') return primary(`提交${materialType.value}申请`, () => materialForm.value?.submit())
  if (screen.value === 'log' && currentLog.value) return primary('保存并结束打卡', endWork)
  if (screen.value === 'quote') return primary('提交报价审批', () => run(() => submitQuote(c, actor.value, quoteDraft.value)))
  if (screen.value === 'customer') return primary('确认维修价格', confirmPrice)
  if (screen.value === 'completion') return primary('提交完工审批', complete)
  if (screen.value === 'exception') return primary(`提交${exceptionType.value}申请`, () => run(() => requestException(c, actor.value, exceptionType.value, exceptionReason.value, exceptionRemark.value)))
  return []
})
function openException(type: '转单' | '关闭') { exceptionType.value = type; exceptionReason.value = ''; exceptionRemark.value = ''; go('exception') }
const moreGroups = computed(() => {
  const c = selected.value
  if (!c || !canShowMore.value) return []
  const work: FooterAction[] = [...footerActions.value]
  if (!currentLog.value && !blockReason(c) && !work.some(op => op.text === '继续维修' || op.text === '开始维修')) work.push({ text: '再开始一次维修', action: startWork })
  return [
    ...(work.length ? [{ title: '维修办理', items: work }] : []),
    { title: '人员与物料', items: [{ text: '申请协助', action: () => go('assistance') }, { text: '领料申请', action: () => openMaterials('领料') }, { text: '申请还料', action: () => openMaterials('还料') }] },
    { title: '单据流转', items: [{ text: '申请转单', action: () => openException('转单') }, { text: '申请关闭', action: () => openException('关闭') }] },
  ]
})
function runMore(op: FooterAction) { if (op.disabled) return; showMore.value = false; op.action() }
</script>

<style scoped lang="scss">
@use './preview.scss';
.workflow { position: fixed; inset: 0; z-index: 10000; color: #333; background: #f3f5f8; font-size: 14px; overflow-wrap: anywhere; }
.workflow-shell { height: 100%; background: #f3f5f8; }
.workflow-body { flex: 1; height: 0; min-height: 0; }
.workflow-content { box-sizing: border-box; max-width: 760px; margin: 0 auto; padding: 12px 12px calc(24px + env(safe-area-inset-bottom)); }
.workflow-content.with-actions, .workflow-content.with-add { padding-bottom: calc(100px + env(safe-area-inset-bottom)); }
.workflow-content :deep(.section-card) { margin: 0 0 12px; }
.readonly-note { display: block; font-size: 12px; line-height: 1.7; color: #667085; margin-top: 8px; }
.demo-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 44px; color: #667085; font-size: 12px; }
.demo-toolbar button { margin: 0; padding: 0 4px 0 12px; min-height: 44px; line-height: 44px; background: transparent; color: #176ac7; font-size: 12px; }
.status-line { display: block; margin: 12px 0; line-height: 1.7; }
.list-filters { padding: 12px; background: #fff; border-radius: 12px; }
.search-row { display: flex; align-items: center; gap: 12px; }
.search-row .input { flex: 1; min-width: 0; height: 44px; border: none; background: #f4f6f8; border-radius: 8px; }
.search-button { flex: none; margin: 0; padding: 0 16px; min-height: 44px; line-height: 44px; background: #176ac7; color: #fff; font-size: 14px; border-radius: 8px; }
.filter-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.filter-row picker { flex: 1; min-width: 0; }
.reset-button, .approval-filter { margin: 0; padding: 0 8px; min-height: 44px; line-height: 44px; font-size: 14px; background: transparent; color: #176ac7; }
.approval-filter { display: flex; align-items: center; gap: 8px; padding-left: 0; color: #475569; }
.approval-filter.on { color: #176ac7; }
.list-count { display: block; margin: 12px 2px; color: #667085; font-size: 12px; }
.tabs { display: flex; flex-wrap: wrap; gap: 4px; margin: 8px 0 0; border-bottom: 1px solid #f0f0f0; }
.tabs button { flex: 1 0 auto; min-height: 44px; background: transparent; color: #667085; font-size: 14px; padding: 0 8px; margin: 0; }
.tabs button.active { color: #176ac7; border-bottom: 2px solid #176ac7; font-weight: 600; }
.form-row { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid #edf0f3; }
.form-row .label { flex: 0 0 76px; }
.form-row picker { flex: 1; min-width: 0; }
.picker-value { display: flex; align-items: center; justify-content: space-between; min-height: 44px; gap: 12px; }
.spaced { margin-top: 16px; }
.full { width: 100%; }
.input, .textarea { font-size: 16px; }
.case-card { cursor: pointer; padding: 16px; }
.card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.card-no { min-width: 0; color: #667085; font-size: 12px; overflow-wrap: anywhere; }
.card-name { margin-bottom: 12px; font-size: 16px; font-weight: 600; line-height: 1.5; }
.case-card .kv { padding: 4px 0; }
.case-card .kv > text:first-child { flex-basis: 64px; }
.fault-summary { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.card-progress { display: flex; align-items: center; justify-content: space-between; gap: 12px; background: #f0f7ff; border-radius: 8px; padding: 10px; margin-top: 12px; color: #176ac7; font-size: 13px; line-height: 1.5; }
.card-progress .waiting { margin: 0; }
.badge--closed { background: #f0f1f3; color: #596574; }
.fold-button { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; min-height: 44px; margin: 0; padding: 8px 0; line-height: 1.5; color: #176ac7; background: transparent; font-size: 14px; text-align: left; }
.case-card:focus-visible, button:focus-visible { outline: 2px solid #176ac7; outline-offset: 2px; }
.waiting { display: block; margin-top: 8px; color: #886013; }
.pagination { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.report-add { position: fixed; right: 20px; bottom: calc(24px + env(safe-area-inset-bottom)); display: flex; align-items: center; gap: 8px; background: #176ac7; color: white; min-height: 48px; padding: 0 16px; border-radius: 24px; font-size: 14px; }
.log-entry, .quote-line, .event { padding: 12px 0; border-bottom: 1px solid #edf0f3; line-height: 1.7; }
.description, .muted { display: block; }
.description { margin: 8px 0; }
.empty text { display: block; margin-top: 8px; font-size: 13px; }
.feedback { padding: 12px; margin-bottom: 12px; background: #e8f5ee; color: #237046; border-radius: 8px; line-height: 1.7; }
.workflow-bottom { position: absolute; bottom: 0; left: 0; right: 0; z-index: 3; background: #fff; border-top: 1px solid #f0f0f0; }
.workflow-bottom__inner { display: flex; flex-wrap: nowrap; gap: 8px; box-sizing: border-box; max-width: 760px; margin: 0 auto; padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); }
.footer-btn { flex: 1; min-width: 0; min-height: 44px; box-sizing: border-box; margin: 0; padding: 10px 8px; border: 1px solid #ddd; border-radius: 22px; font-size: 14px; line-height: 22px; white-space: nowrap; text-align: center; color: #596574; background: #fff; }
.footer-btn.primary { background: #2f86ff; border-color: #2f86ff; color: #fff; }
.footer-more { flex: 0 0 72px; margin-left: auto; background: #f5f6f8; }
.more-sheet { padding: 8px 16px 20px; max-height: 70vh; overflow-y: auto; color: #333; }
.sheet-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 17px; font-weight: 600; }
.sheet-head button { display: flex; align-items: center; justify-content: center; width: 44px; min-height: 44px; padding: 0; margin: 0; background: transparent; }
.more-group { margin-top: 12px; }
.more-label { display: block; margin-bottom: 8px; color: #596574; font-size: 13px; }
.more-items { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.more-items button { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-width: 0; min-height: 48px; margin: 0; padding: 10px 12px; background: #f5f6f8; color: #27364a; font-size: 14px; line-height: 1.5; text-align: left; }
.actor-options { margin: 16px 0; }
.actor-options button { display: flex; align-items: center; justify-content: space-between; width: 100%; min-height: 48px; margin: 8px 0 0; padding: 10px 12px; font-size: 14px; line-height: 1.5; background: #f5f6f8; color: #475569; text-align: left; }
.actor-options button.on { background: #eaf4ff; color: #176ac7; }
button::after { border: none; }
button[disabled] { opacity: .5; }
</style>
