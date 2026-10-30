<template>
  <view class="workflow">
    <PageLayout class="workflow-shell" :nav-title="title" nav-left-text="返回" nav-background-color="#176ac7" type="popup" @nav-back="back">
      <scroll-view class="workflow-body" scroll-y :scroll-top="scrollTop" :lower-threshold="120" @scrolltolower="loadMore">
        <view class="workflow-content" :class="{ 'with-actions': footerActions.length || canShowMore, 'with-add': screen === 'reports', 'ops-form-page': ['reportCancel', 'exception', 'quote', 'customer', 'completion', 'approval', 'assistance', 'materials'].includes(screen) }">
          <view v-if="loading" class="loading-toolbar"><text>正在加载…</text></view>
          <view v-if="error" class="error" role="alert">{{ error }}</view>
          <view v-if="message" class="feedback" role="status">{{ message }}</view>
          <view v-if="['begin', 'log', 'checkout'].includes(screen) && (screen !== 'log' || isAssistantWork)" class="repair-steps" aria-label="维修日志办理进度">
            <text class="field-label">第 {{ ['begin', 'log', 'checkout'].indexOf(screen) + 1 }} 步 / 共 3 步</text>
            <view class="repair-steps__labels"><text v-for="(step, index) in ['签到', '维修日志', '签退']" :key="step" :class="{ active: index === ['begin', 'log', 'checkout'].indexOf(screen) }">{{ step }}</text></view>
          </view>

          <template v-if="screen === 'create'">
            <ReportDutyRoster />
            <view v-if="submitUncertain && !editingReport" class="error">上次提交结果未确认，请先查看报修列表，避免重复创建。<button class="btn" @click="resolveReportUncertainty">已核对列表，解除提交保护</button></view>
            <SectionCard title="关联信息">
              <view class="form-row"><text class="label">客户<text class="required">*</text></text>
                <wd-select-picker :model-value="draft.customerId" :columns="customerOptions" value-key="id" label-key="name" type="radio" filterable filter-placeholder="搜索客户" title="选择客户" :z-index="12000" :loading="optionBusy.customers" :disabled="submitting || !!editingReport || optionBusy.customers" @confirm="chooseCustomer(customerOptions.findIndex(item => item.id === $event.value))">
                  <view class="picker-value">{{ customer?.name || '请选择客户' }}<wd-icon name="arrow-right" /></view>
                </wd-select-picker>
              </view>
              <view class="form-row"><text class="label">项目<text class="required">*</text></text>
                <wd-select-picker :model-value="draft.projectId" :columns="projects" value-key="id" label-key="name" type="radio" filterable filter-placeholder="搜索该客户项目" title="选择项目" :z-index="12000" :loading="optionBusy.projects" :disabled="submitting || !!editingReport || !customer || optionBusy.projects || !projects.length" @confirm="chooseProject(projects.findIndex(item => item.id === $event.value))">
                  <view class="picker-value">{{ project?.name || (customer ? '请选择项目' : '请先选择客户') }}<wd-icon name="arrow-right" /></view>
                </wd-select-picker>
              </view>
              <text v-if="draft.customerId && !optionBusy.projects && !projects.length" class="muted">该客户暂无可报修项目</text>
              <view class="form-row"><text class="label">产品<text class="required">*</text></text>
                <wd-select-picker :model-value="selectedProducts" :columns="productOptions.map(p => ({value:p.id,label:p.name}))" type="checkbox" filterable filter-placeholder="搜索该项目产品" title="选择产品" :z-index="12000" :loading="optionBusy.products" :disabled="submitting || !project || optionBusy.products || !productOptions.length" @confirm="selectedProducts = $event.value">
                  <view class="picker-value">{{ selectedProducts.map(id => productOptions.find(p => p.id === id)?.name || '产品信息待加载').join('、') || (project ? '请选择项目产品（可多选）' : '请先选择项目') }}<wd-icon name="arrow-right" /></view>
                </wd-select-picker>
              </view>
              <template v-for="productId in selectedProducts" :key="productId">
                <view v-if="serviceChoices(productId).length > 1 && !originalReportProducts.some(p=>p.productId===productId && p.serviceId)" class="form-row">
                  <text class="label">{{ productOptions.find(p=>p.id===productId)?.name }}保障<text class="required">*</text></text>
                  <wd-select-picker :model-value="reportServices[productId]" :columns="serviceChoices(productId)" type="radio" title="选择适用保障" :z-index="12000" :disabled="submitting || optionBusy.products" @confirm="reportServices[productId]=$event.value">
                    <view class="picker-value">{{ serviceChoices(productId).find(s=>s.value===reportServices[productId])?.label || '请选择适用保障' }}<wd-icon name="arrow-right" /></view>
                  </wd-select-picker>
                </view>
              </template>
              <text v-if="draft.projectId && !optionBusy.products && !productOptions.length" class="muted">该项目未配置产品</text>
            </SectionCard>
            <SectionCard title="报修信息">
              <view class="report-text-field">
                <view class="report-field-heading"><label for="report-fault">故障现象<text class="required">*</text></label></view>
                <view class="report-text-box">
                  <textarea id="report-fault" v-model="draft.fault" class="report-textarea" maxlength="1000" placeholder="描述故障现象及影响" placeholder-class="report-placeholder" />
                  <text class="report-count">{{ draft.fault.length }}/1000</text>
                </view>
              </view>
              <view class="report-text-field">
                <view class="report-field-heading"><label for="report-remark">备注</label><text class="report-optional">选填</text></view>
                <view class="report-text-box">
                  <textarea id="report-remark" v-model="draft.remark" class="report-textarea report-textarea--remark" maxlength="1000" placeholder="请描述报修客户信息" placeholder-class="report-placeholder" />
                  <text class="report-count">{{ draft.remark.length }}/1000</text>
                </view>
              </view>
              <view class="report-field"><view class="report-field-heading"><text>报修时间<text class="required">*</text></text></view><wd-datetime-picker v-model="reportTimestamp" type="datetime" use-second title="选择报修时间" :disabled="submitting" :z-index="12000" :root-portal="true" :safe-area-inset-bottom="true"><view class="report-time-trigger"><text>{{ dayjs(reportTimestamp).format('YYYY-MM-DD HH:mm:ss') }}</text><wd-icon name="arrow-down" size="16px" /></view></wd-datetime-picker></view>
            </SectionCard>
            <SectionCard title="现场附件"><RepairServerAttachments v-if="editingReport" :files="retainedReportFiles" editable :disabled="submitting" @remove="retainedReportFiles=retainedReportFiles.filter(f=>f.fileId!==$event)" /><ReportAttachments v-model:photos="draft.photos" v-model:videos="draft.videos" :existing-photos="retainedReportFiles.filter(f=>f.mediaType==='IMAGE').length" :existing-videos="retainedReportFiles.filter(f=>f.mediaType==='VIDEO').length" @busy="mediaBusy = $event" /></SectionCard>
            <SectionCard v-if="editingReport" title="修改原因"><textarea v-model="reportChangeReason" class="textarea" maxlength="1000" aria-label="修改原因（必填）" placeholder="请填写修改原因（必填）" /></SectionCard>
          </template>

          <template v-else-if="screen === 'reportCancel' && selected"><SectionCard title="取消报修"><text class="title">{{ selected.project }}</text><text class="muted">取消后保留报修记录，关闭相关待办，不再进入维修处理。此操作不经过维修关闭审批。</text><label class="field-label spaced" for="report-cancel-reason">取消原因<text class="required"> *</text></label><textarea id="report-cancel-reason" v-model="reportCancelReason" class="textarea" maxlength="1000" :disabled="submitting" placeholder="请说明取消报修的原因" /></SectionCard></template>

          <template v-else-if="['reports', 'records'].includes(screen)">
            <view v-if="restManageAccess && screen === 'records'" class="tabs"><button class="btn" @click="restInitialTab='rest';showRestAssignment=true">休息与转派</button><button class="btn" @click="restInitialTab='schedule';showRestAssignment=true">待调度 / 执行计划</button></view>
            <view class="list-filters">
              <view class="search-row"><input v-model="searchDraft" class="input" aria-label="筛选已加载记录" placeholder="搜索已加载的客户、项目、报修人" confirm-type="search" @confirm="search" /><button class="search-button" @click="search">筛选</button></view>
              <view class="tabs" role="tablist"><button v-for="s in mainFilters" :key="s" role="tab" :aria-selected="filter === s" :class="{ active: filter === s }" @click="filter = s">{{ s }}</button></view>
              <view class="filter-row">
                <picker v-if="screen === 'records'" :range="relations" :value="relations.indexOf(relation)" @change="relation = relations[Number($event.detail.value)]"><view class="picker-value">{{ relation }}<wd-icon name="arrow-down" size="14px" /></view></picker>
                <text v-else class="muted">{{ scopeText }}</text>
                <button class="reset-button" :disabled="!searchDraft && !query && filter === '全部' && !pendingOnly" @click="resetFilters">重置</button>
              </view>
            </view>
            <text class="list-count">共 {{ total }} 条 · 已加载 {{ cases.length }} 条</text>
            <view class="case-list">
            <view v-for="c in paged" :key="c.id" class="case-card" role="button" tabindex="0" @click="openCase(c)" @keydown.enter="openCase(c)">
              <view class="card-head"><text class="card-no">{{ displayNumber(c) }}</text><view class="card-statuses"><text class="badge" :class="stateTone(c.state)">{{ c.state }}</text><text v-if="screen === 'records' && cardApprovalText(c)" class="card-approval">{{ cardApprovalText(c) }}</text></view></view>
              <view class="card-name">{{ c.project }}</view>
              <view class="kv"><text>客户</text><text>{{ c.customer }}</text></view>
              <view v-if="c.product" class="kv"><text>产品</text><text>{{ c.product }}</text></view>
              <view v-if="screen === 'records'" class="kv"><text>故障</text><text class="fault-summary">{{ c.fault }}</text></view>
              <view class="kv"><text>维修人</text><text>{{ c.owner }}</text></view>
              <view class="kv"><text>报修人</text><text>{{ c.applicant }}</text></view>
              <view class="kv"><text>报修时间</text><text>{{ formatReportedAt(c.reportedAt) }}</text></view>
              <view v-if="c.state === '待处理'" class="card-progress"><text class="waiting">已等待 {{ waitText(c, clockNow) }}</text></view>
            </view>
            </view>
            <view v-if="!listBusy && !listError && !filtered.length" class="empty">{{ query ? '已加载记录中无匹配结果' : '当前范围暂无记录' }}<text>{{ hasMore ? '可继续向下加载更多记录。' : '可调整筛选后重新查询。' }}</text></view>
            <view class="list-status" role="status">
              <text v-if="listBusy">正在加载…</text>
              <template v-else-if="listError"><text>{{ listError }}</text><button @click="loadList(page > 0)">点击重试</button></template>
              <button v-else-if="hasMore" @click="loadMore">继续加载</button>
              <text v-else-if="cases.length">已加载全部记录</text>
            </view>
            <button v-if="screen === 'reports'" class="report-add" @click="go('create')"><wd-icon name="add" color="#fff" />新增报修</button>
          </template>

          <template v-else-if="screen === 'detail' && selected && canViewSelected">
            <view class="panel">
              <view class="row"><text class="title">{{ selected.project }}</text><text class="badge">{{ selected.state }}</text></view>
              <text class="muted">{{ selected.orderId }} · 负责人：{{ selected.owner }}</text>
              <text v-if="!owner && !currentLog && !selected.actions.canStartWork && source !== 'reports'" class="readonly-note">按当前账号权限查看或办理</text>
            </view>
            <SectionCard v-if="source !== 'reports'" title="维修记录">
              <template #extra><button class="quotation-entry" @click="go('logList')">查看详情</button></template>
              <view v-for="row in repairSummaryRows" :key="row.label" class="kv repair-summary-row"><text>{{ row.label }}</text><text :class="{ 'summary-missing': row.missing }">{{ row.value }}</text></view>
            </SectionCard>
            <RepairCollaborationProgress ref="collaborationPanel" :detail="selected.raw" :actor-id="actor.id" :disabled="submitting || mutationBlocked" :manage="manageCollaboration" :action-error="error" @edit="openAssistance" @changed="collaborationChanged" />
            <SectionCard title="报修信息">
              <button class="report-row report-customer" aria-label="查看客户联系资料" @click="showContact = true"><text class="report-label">客户</text><text class="report-value">{{ selected.customer || '—' }}</text><wd-icon name="arrow-right" size="14px" /></button>
              <view class="report-row"><text class="report-label">产品</text><text class="report-value">{{ selected.product || '—' }}</text></view>
              <view class="report-row"><text class="report-label">故障现象</text><text class="report-value">{{ selected.fault || '—' }}</text></view>
              <view v-if="showReportDetails" class="report-extra">
                <view v-for="row in reportRows.filter(row => !['客户', '项目', '产品', '故障现象'].includes(row[0]))" :key="row[0]" class="report-row"><text class="report-label">{{ row[0] }}</text><text class="report-value">{{ row[1] || '—' }}</text></view>
                <view class="report-row report-attachments-row">
                  <text class="report-label">照片/视频</text>
                  <view class="report-value"><RepairServerAttachments v-if="reportFiles.length" :files="reportFiles" inline /><text v-else class="muted">暂无报修附件</text></view>
                </view>
              </view>
              <button class="fold-button report-expand" :aria-expanded="showReportDetails" @click="showReportDetails = !showReportDetails">{{ showReportDetails ? '收起报修详情' : '查看照片、备注等详情' }}<wd-icon :name="showReportDetails ? 'arrow-up' : 'arrow-down'" size="14px" /></button>
            </SectionCard>
            <template v-if="source !== 'reports'">
              <SectionCard v-for="evaluation in (selected.raw.evaluations || []).filter(e => e.evaluationStatus === 'EVALUATED')" :key="evaluation.id" title="回访评价"><view class="kv"><text>服务态度</text><text>{{ evaluation.serviceAttitudeScore }} 分</text></view><view class="kv"><text>维修质量</text><text>{{ evaluation.repairQualityScore }} 分</text></view><view class="kv"><text>响应效率</text><text>{{ evaluation.responseEfficiencyScore }} 分</text></view><text class="description">{{ evaluation.opinion || '未填写反馈意见' }}</text><text class="muted">{{ formatReportedAt(evaluation.recordedAt) }} · 已提交，只读</text></SectionCard>
              <SectionCard title="报价管理">
                <template #extra><button v-if="quotationEntryText" class="quotation-entry" :disabled="submitting" @click.stop="openQuotationEntry">{{ quotationEntryText }}</button></template>
                <view class="kv"><text>报价状态</text><text>{{ quotationText(selected.quotationStatus) }}</text></view>
                <text v-if="quotationLockedMessage" class="muted">{{ quotationLockedMessage }}</text>
                <text v-else-if="selected.quotationStatus === 'UNDETERMINED'" class="muted">请选择是否需要报价；需要报价时一并填写报价明细。</text>
              </SectionCard>
              <RepairMaterialStatistics :key="selected.id" :order-id="selected.id" />
              <SectionCard v-if="selected.finalPrice != null" title="完工信息">
                <view v-if="selected.finalPrice != null" class="kv"><text>最终维修价</text><text>¥{{ selected.finalPrice.toFixed(2) }}</text></view>
                <text v-if="selected.completionReason" class="muted">审批意见：{{ selected.completionReason }}</text>
              </SectionCard>
            </template>
            <SectionCard title="处理日志" @header-click="toggleEvents"><template #extra><button class="event-toggle" :aria-expanded="showEvents" aria-label="展开或收起处理日志" @click.stop="toggleEvents"><text>{{ showEvents ? '收起' : '展开' }}</text><wd-icon :name="showEvents ? 'arrow-up' : 'arrow-down'" size="14px" /></button></template><template v-if="showEvents"><view class="event-timeline"><view v-for="(event, i) in events" :key="event.id || i" class="event-item"><view class="event-heading"><text class="event-operator">{{ event.operator }}</text><text class="event-time">{{ event.time }}</text></view><text class="event-action">{{ event.action }}</text><text v-if="event.content && event.content !== event.action" class="event-content">{{ event.content }}</text></view></view><text v-if="eventLoading" class="muted" role="status">正在加载处理日志…</text><button v-else-if="eventError" class="btn" @click="loadEvents">{{ eventError }}，点击重试</button><button v-else-if="events.length < eventTotal" class="btn" @click="loadEvents">加载更多</button><text v-else-if="!events.length" class="muted">暂无处理日志</text></template></SectionCard>
            <text v-if="source === 'reports' && !selected.actions.canViewRepairDetail" class="muted">维修负责人正在跟进，您可以在这里查看处理进度。</text>
          </template>

          <template v-else-if="screen === 'begin' && selected">
            <SectionCard title="开始本次作业">
              <text class="title">{{ selected.project }} · {{ selected.product }}</text>
              <template v-if="!isAssistantWork"><text class="field-label spaced">维修方式</text><view class="choices"><button v-for="mode in repairModes" :key="mode" class="choice" :class="{ on: beginMode === mode }" @click="beginMode = mode">{{ mode }}</button></view></template>
              <text class="muted">签到成功后才能填写本次维修日志。</text>
            </SectionCard>
            <SectionCard title="签到定位"><text v-if="repairLocationCheckEnabled" class="muted">距当前售后项目任一维护位置300米以内可正常打卡。</text><LocationPanel :sites="clockSites" :radius-meters="REPAIR_RADIUS_METERS" :location="clockLocation" :locating="locating" :status-label="clockLocation.status === 'NORMAL' ? '已定位' : ''" @refresh="refreshClockLocation" /></SectionCard>
            <SectionCard v-if="repairLocationCheckEnabled && clockLocation.status === 'OUT_OF_RANGE'" title="打卡异常原因">
              <text class="muted">当前位置超出300米范围，请如实填写异常原因。</text>
              <textarea v-model="clockAbnormalReason" class="textarea" maxlength="2000" placeholder="请输入打卡异常原因（必填）" :disabled="submitting" />
              <ReportAttachments v-model:photos="clockPhotos" :videos="[]" photos-only photo-watermark :readonly="submitting" @busy="mediaBusy = $event" />
            </SectionCard>
          </template>
          <template v-else-if="screen === 'checkout' && selected && currentLog">
            <SectionCard title="待签退"><text class="title">{{ selected.project }} · {{ selected.product }}</text><view class="kv"><text>签到时间</text><text>{{ formatTime(currentLog.startedAt) }}</text></view><text class="muted">日志已保存，请完成签退。本次作业在签退成功前仍处于进行中。</text></SectionCard>
            <SectionCard v-if="!isAssistantWork" title="签退后办理">
              <view class="choices"><button class="choice" :class="{ on: checkoutNext === 'completion' }" :disabled="submitting" @click="checkoutNext = 'completion'">提交完成</button><button class="choice" :class="{ on: checkoutNext === 'detail' }" :disabled="submitting" @click="checkoutNext = 'detail'">需要复修</button></view>
              <text class="muted">选择提交完成：签退成功后填写完工申请，确认后再提交审批。选择需要复修：签退后返回维修详情。</text>
            </SectionCard>
            <SectionCard title="签退定位"><LocationPanel :location="clockLocation" :locating="locating" :status-label="clockLocation.status === 'NORMAL' ? '已定位' : ''" @refresh="refreshClockLocation" /></SectionCard>
            <SectionCard v-if="!completionSubmitted" title="忘记签退？"><text class="muted">已离开现场，可填写实际结束时间和原因办理补签退。</text><button class="btn" :disabled="submitting || workDetail?.actions?.canEnd !== true" @click="openBackfillCheckout">补签退</button></SectionCard>
          </template>
          <template v-else-if="screen === 'logList' && selected">
            <view class="personnel-records">
              <view class="personnel-filter"><text class="personnel-filter-label">签到日期</text><picker mode="date" :value="repairLogDate" @change="changeRepairLogDate($event.detail.value)"><view class="personnel-filter-value">{{ repairLogDate || '全部日期' }}<wd-icon name="arrow-down" size="14px" /></view></picker><button v-if="repairLogDate" class="log-date-clear" @click="changeRepairLogDate('')">清除</button></view>
              <view class="personnel-list-meta"><text>{{ repairLogsLoading ? '正在查询…' : '共 ' + repairLogsTotal + ' 条记录' }}</text><text>最近签到优先</text></view>
              <text v-if="repairLogsLoading" class="muted" role="status">正在加载维修日志…</text>
              <view v-else-if="repairLogsError" class="personnel-empty"><text>{{ repairLogsError }}</text><button class="btn" @click="loadRepairLogs">重新加载</button></view>
                <view v-for="log in pagedRepairLogs" :key="log.id" class="repair-log-item">
                  <button class="repair-log-toggle" :aria-label="'查看' + (log.people || '维修人员') + '的维修日志'" @click="toggleLog(log.id)">
                    <view class="repair-log-heading"><text class="repair-log-person">{{ log.people || '维修人员' }}</text><text class="repair-log-state" :class="{ 'is-active': !log.endedAt }">{{ logState(log.id) }}</text></view>
                    <text v-if="log.mode" class="repair-log-mode">{{ log.mode }}维修</text>
                    <view class="repair-log-clock"><view><text>打卡时间</text><text>{{ log.startedAt ? formatTime(log.startedAt) : '未记录' }} - {{ log.endedAt ? formatTime(log.endedAt) : '未签退' }}</text></view><view><text>维修时长</text><text>{{ repairLogDuration(log) }}</text></view></view>
                    <view class="repair-log-description"><text class="repair-log-description-label">维修内容</text><text class="repair-log-summary">{{ log.description || (workCache[log.id] ? '尚未填写维修内容' : '摘要未返回，点击查看详情') }}</text></view>
                  </button>
                </view>

              <view v-if="!repairLogsLoading && !repairLogsError && !pagedRepairLogs.length" class="personnel-empty"><text>暂无维修日志</text><text>{{ repairLogDate ? '可清除签到日期查看其他记录' : '当前工单暂无可见的维修记录' }}</text></view>
              <view v-if="!repairLogsError && repairLogsTotal" class="repair-log-pagination"><button :disabled="repairLogsLoading || repairLogsPage <= 1" @click="repairLogsPage--; scrollToTop()">上一页</button><text>{{ repairLogsPage }} / {{ repairLogsPages }} · 每页 10 条</text><button :disabled="repairLogsLoading || repairLogsPage >= repairLogsPages" @click="repairLogsPage++; scrollToTop()">下一页</button></view>
            </view>
          </template>

          <template v-else-if="screen === 'logDetail' && selected">
            <text v-if="logDetailLoading" class="muted">正在加载维修日志…</text>
            <button v-else-if="!viewedWork" class="btn" @click="toggleLog(expandedLogId)">重新加载日志</button>
            <template v-else>
              <view class="log-detail-heading"><view class="repair-log-heading"><text class="log-detail-title">{{ viewedWork.operatorNameSnapshot || viewedSummary?.people || '维修人员' }}</text><text class="repair-log-state" :class="{ 'is-active': viewedWork.recordStatus === 'ACTIVE' }">{{ logState(expandedLogId) }}</text></view><view class="log-detail-meta"><text class="log-detail-role">{{ viewedWorkRole }}</text><text class="muted">{{ viewedSummary?.mode ? viewedSummary.mode + '维修' : '维修日志' }}</text></view></view>
              <SectionCard title="打卡信息">
                <view class="log-clock-section" :class="{ 'log-clock-abnormal': viewedClock.signInAbnormal }">
                  <view class="repair-log-heading"><text class="field-label">签到信息</text><text :class="{ 'log-clock-alert': viewedClock.signInAbnormal || viewedClock.signInName.includes('位置异常') }">{{ viewedClock.signInName }}</text></view>
                  <view class="kv"><text>签到时间</text><text>{{ formatReportedAt(viewedRecordInfo.effectiveStartedAt || viewedRecordInfo.rawStartedAt) }}</text></view>
                </view>
                <view class="log-clock-section" :class="{ 'log-clock-abnormal': viewedClock.signOutAbnormal }">
                  <view class="repair-log-heading"><text class="field-label" :class="{ 'log-clock-alert': viewedClock.corrected }">{{ viewedClock.corrected ? '补签退信息' : '签退信息' }}</text><text :class="{ 'log-clock-alert': viewedClock.corrected || viewedClock.signOutAbnormal || viewedClock.signOutName.includes('位置异常') }">{{ viewedClock.signOutName }}</text></view>
                  <view class="kv"><text>{{ viewedClock.corrected ? '实际签退时间' : '签退时间' }}</text><text>{{ viewedRecordInfo.effectiveEndedAt || viewedRecordInfo.rawEndedAt ? formatReportedAt(viewedRecordInfo.effectiveEndedAt || viewedRecordInfo.rawEndedAt) : viewedRecordInfo.signOutStatus === 'NOT_SIGNED_OUT' ? '未签退' : '未记录' }}</text></view>
                  <view v-if="viewedClock.corrected" class="kv"><text class="log-clock-alert">补签退说明</text><text>{{ viewedClock.correctionDescription }}</text></view>
                </view>
                <view v-if="viewedWork.abnormalReason" class="log-clock-note"><text>签到异常原因：{{ viewedWork.abnormalReason }}</text></view>
                <RepairServerAttachments v-if="workBeginPhotos(viewedWork).length" :files="workBeginPhotos(viewedWork)" />
                <view v-if="viewedClock.generalReason" class="log-clock-note"><text>打卡说明：{{ viewedClock.generalReason }}</text></view>
                <view class="kv"><text>本次时长</text><text>{{ viewedWork.recordStatus === 'ACTIVE' ? '进行中' : viewedWork.durationSeconds != null ? (Number(viewedWork.durationSeconds) / 3600).toFixed(2) + 'h' : '未记录' }}</text></view>
              </SectionCard>
              <SectionCard title="维修内容">
                <template v-if="viewedWork.workRole !== 'COLLABORATOR' && viewedWork.faultDescription"><text class="field-label">故障描述</text><text class="description">{{ viewedWork.faultDescription }}</text></template>
                <text class="field-label spaced">维修记录</text><text class="description">{{ viewedWork.repairDescription || '尚未填写维修内容' }}</text>
              </SectionCard>
              <SectionCard v-if="recordFiles(expandedLogId).length" title="维修照片"><RepairServerAttachments :files="recordFiles(expandedLogId)" /></SectionCard>
              <RepairLogResources v-if="viewedWork.workRole !== 'COLLABORATOR'" :detail="selected.raw" :record-id="expandedLogId" :work-detail="viewedWork" :hide-empty="true" />
            </template>
          </template>
          <template v-else-if="screen === 'log' && selected && currentLog && workDetail?.formStatus !== 'SUBMITTED'">
            <view v-if="!isAssistantWork" class="log-pagination">
              <text class="muted">第 {{ logPage + 1 }} 页 / 共 3 页</text>
              <view class="log-pagination__steps"><view v-for="(label, index) in logPages" :key="label" class="log-pagination__step" :class="{ on: index === logPage, done: index < logPage }"><text class="log-pagination__dot">{{ index + 1 }}</text><text>{{ label }}</text></view></view>
            </view>
            <view v-show="!isAssistantWork && logPage === 0">
            <SectionCard title="报修信息"><view v-for="row in reportRows" :key="row[0]" class="kv"><text>{{ row[0] }}</text><text>{{ row[1] }}</text></view><RepairServerAttachments :files="reportFiles" /></SectionCard>
            </view>
            <view v-show="isAssistantWork || logPage === 1">
            <SectionCard title="本次维修">
              <text class="title">{{ selected.project }} · {{ selected.product }}</text>
              <view v-if="!isAssistantWork" class="kv"><text>本次维修保障</text><text>{{ selected.warranty }}</text></view>
              <view class="kv"><text>开始打卡</text><text>{{ formatTime(currentLog.startedAt) }}</text></view>
              <view v-if="!isAssistantWork" class="kv"><text>维修方式</text><text>{{ currentLog.mode }}</text></view>
            </SectionCard>
            <SectionCard v-if="!isAssistantWork" title="故障检查">
              <label for="fault-description" class="field-label">故障描述<text class="required">*</text></label><textarea id="fault-description" v-model="currentLog.fault" class="textarea" maxlength="10000" placeholder="填写检查发现的问题" />
            </SectionCard>
            <SectionCard title="维修记录">
              <label for="repair-description" class="field-label">维修内容<text class="required">*</text></label><textarea id="repair-description" v-model="currentLog.description" class="textarea" maxlength="10000" placeholder="填写本次完成的维修工作" />
              <text class="field-label spaced">维修照片<text class="required">*</text></text>
              <text class="muted">至少上传 1 张照片或 1 段视频；含已上传附件最多 6 张照片、2 个视频。</text>
              <ReportAttachments v-model:photos="currentLog.photos" v-model:videos="currentLog.videos" photo-watermark :existing-photos="recordFiles(currentLog.id).filter(f => f.mediaType === 'IMAGE').length" :existing-videos="recordFiles(currentLog.id).filter(f => f.mediaType === 'VIDEO').length" compact @busy="mediaBusy = $event" />
              <RepairServerAttachments :files="recordFiles(currentLog.id)" editable :disabled="submitting || mediaBusy" @remove="currentLog.fileIds = currentLog.fileIds.filter(id => id !== $event)" />
            </SectionCard>
            </view>
            <view v-show="!isAssistantWork && logPage === 2">
              <RepairWorkResources v-if="!isAssistantWork" :detail="selected.raw" :record-id="currentLog.id" :actor-id="actor.id" :form="workDraft" :disabled="submitting" />
            </view>
            <text class="muted">提交日志后进入签退页面，签退成功才结束本次作业。未保存的内容刷新后会丢失。</text>
          </template>

          <template v-else-if="screen === 'quote' && selected && canFillQuotation">
            <SectionCard title="报价设置">
              <view class="quotation-context"><text>{{ selected.project || '未关联项目' }}</text><text>{{ selected.product || '未填写产品' }}</text></view>
              <view class="quotation-switch"><button :class="{active: quoteRequired}" :aria-pressed="quoteRequired" @click="quoteRequired = true">需要报价</button><button :class="{active: !quoteRequired}" :aria-pressed="!quoteRequired" @click="quoteRequired = false">无需报价</button></view>
              <view class="quotation-field" v-if="!quoteRequired"><label for="no-quote-reason" class="field-label">无需报价原因<text class="required"> *</text></label><textarea id="no-quote-reason" v-model="noQuoteReason" class="textarea quotation-textarea" placeholder="请说明无需报价的原因" maxlength="500" /></view>
              <view class="quotation-field" v-else><label for="quote-scope" class="field-label">故障及维修范围<text class="required"> *</text></label><textarea id="quote-scope" v-model="faultScope" class="textarea quotation-textarea" placeholder="请描述本次报价包含的故障与维修工作" maxlength="10000" /></view>
              <text class="quotation-note">{{ quoteRequired ? '提交后由负责人所属部门主管、市场主管依次审批，通过后登记客户确认。' : '登记后，已有未完成的报价流程将终止，历史记录保留。' }}</text>
            </SectionCard>
            <SectionCard v-if="quoteRequired" title="报价明细">
              <template #extra><text class="quotation-count">共 {{ quoteDraft.length }} 项</text></template>
              <RepairQuotationItems v-model="quoteDraft" :disabled="submitting" @busy="mediaBusy = $event" />
              <view class="quotation-total"><text>报价合计</text><text>¥{{ Number.isFinite(quoteTotal(quoteDraft)) ? quoteTotal(quoteDraft).toFixed(2) : '—' }}</text></view>
            </SectionCard>
          </template>

          <template v-else-if="screen === 'customer' && selected && selected.actions.canViewRepairDetail">
            <SectionCard title="维修信息">
              <view class="kv"><text>项目</text><text>{{ selected.project || '—' }}</text></view>
              <view class="kv"><text>客户</text><text>{{ selected.customer || '—' }}</text></view>
              <view class="kv"><text>产品</text><text>{{ selected.product || '—' }}</text></view>
            </SectionCard>
            <SectionCard title="报价明细">
              <view v-for="(item, index) in selected.quoteItems" :key="index" class="customer-quote-line"><text class="customer-quote-name">{{ item.name }}</text><view class="customer-quote-values"><text>{{ item.qty }} × ¥{{ item.price.toFixed(2) }}</text><text>¥{{ (Math.round(item.qty * item.price * 100) / 100).toFixed(2) }}</text></view></view>
              <text v-if="!selected.quoteItems.length" class="muted">暂无报价明细</text>
              <view class="customer-quote-total"><text>报价合计</text><text>{{ customerQuoteAmount == null ? '—' : '¥' + customerQuoteAmount.toFixed(2) }}</text></view>
            </SectionCard>
            <SectionCard title="客户确认价格">
              <label for="customer-repair-price" class="field-label">客户确认维修价格（元）<text class="required"> *</text></label>
              <view class="customer-price-input"><text>¥</text><input id="customer-repair-price" v-model="priceInput" type="digit" :disabled="submitting" placeholder="请输入确认金额" /></view>
              <text class="customer-price-hint">默认带入本次报价合计，可按客户确认的金额修改，允许 0 元。</text>
              <template v-if="customerPriceChanged"><label for="customer-price-reason" class="field-label spaced">金额变更原因<text class="required"> *</text></label><textarea id="customer-price-reason" v-model="customerPriceRemark" class="textarea" :disabled="submitting" maxlength="1000" placeholder="请说明与审批通过的报价金额不一致的原因" /></template>
            </SectionCard>
          </template>
          <template v-else-if="['completion', 'approval'].includes(screen) && selected && (selected.actions.canViewRepairDetail || (screen === 'approval' && reviewTasks.length))">
            <SectionCard :title="title">
              <picker v-if="screen === 'approval' && reviewTaskOptions.length > 1" :range="reviewTaskOptions" range-key="label" :disabled="submitting || !!mergedPending" @change="selectReviewTask"><view class="picker-value">{{ reviewTask ? (reviewTask.task.departmentName || reviewTask.task.name) : '请选择待办审批任务' }} · 共 {{ reviewTaskOptions.length }} 项</view></picker>
              <template v-if="isCollaborationApproval">
                <text class="assist-approval-type">{{ isInternalCollaborationApproval ? '受邀部门及协助原因' : collaborationApproval.typeLabel }}</text>
                <view v-for="(entry,index) in collaborationApproval.entries" :key="index" class="assist-approval-entry">
                  <view class="assist-approval-target"><text v-if="!isInternalCollaborationApproval">{{ collaborationApproval.targetLabel }}</text><text>{{ entry.target }}</text></view>
                  <text v-if="!isInternalCollaborationApproval" class="assist-approval-label">协助原因</text><text class="assist-approval-reason">{{ entry.reason }}</text>
                </view>
                <text v-if="collaborationApproval.staffing" class="muted">{{ collaborationApproval.staffing }}</text>
                <text v-if="collaborationApproval.note && !isInternalCollaborationApproval" class="muted">{{ collaborationApproval.note }}</text>
              </template>
              <template v-else-if="screen === 'approval' && reviewTask">
                <view class="kv"><text>当前申请</text><text>{{ applicationNames[reviewTask.application.applicationType] || reviewTask.workflow.title }}</text></view>
                <view class="kv"><text>审批节点</text><text>{{ reviewTask.task.name }}</text></view>
                <view v-for="department in reviewDepartments" :key="department.departmentId" class="panel"><view class="kv"><text>{{ department.departmentName || '受邀部门' }}</text><text>{{ collaborationStatusText(department.status) }}</text></view><text>{{ department.reason }}</text><ApprovalReuseInfo :department="department" :detail="selected.raw" /></view>
                <view v-if="reviewTask.application.reason" class="kv"><text>申请原因</text><text>{{ reviewTask.application.reason }}</text></view>
                <view v-for="row in approvalFormRows" :key="row[0]" class="kv"><text>{{ row[0] }}</text><text>{{ row[1] }}</text></view>
              </template>
              <template v-if="!isCollaborationApproval">
              <view v-if="screen === 'approval'" class="kv"><text>报修信息</text><button class="link" :disabled="submitting || !!mergedPending" @click="openApprovalReport">查看报修单</button></view>
              <view v-else class="completion-project"><text class="completion-project-name">{{ selected.project }}</text><text class="completion-product">维修产品：{{ selected.product || '—' }}</text></view>
              <view class="kv"><text>报价状态</text><text>{{ quotationText(selected.quotationStatus) }}</text></view>
              <view v-if="screen === 'completion' && selected.quoteItems.length" class="completion-quotes">
                <text class="completion-section-title">报价明细</text>
                <view v-for="(item, i) in selected.quoteItems" :key="i" class="customer-quote-line"><text class="customer-quote-name">{{ item.name }}</text><view class="customer-quote-values"><text>{{ item.qty }} × ¥{{ item.price.toFixed(2) }}</text><text>小计 ¥{{ (Math.round(item.qty * item.price * 100) / 100).toFixed(2) }}</text></view></view>
                <view class="customer-quote-total"><text>报价合计</text><text>¥{{ (customerQuoteAmount ?? quoteTotal(selected.quoteItems)).toFixed(2) }}</text></view>
              </view>
              <template v-if="screen !== 'completion'">
              <view v-for="(item, i) in selected.quoteItems" :key="i" class="kv"><text>{{ item.name }}</text><text>{{ item.qty }} × ¥{{ item.price }}</text></view>
              <view v-if="selected.quoteItems.length" class="kv"><text>报价合计</text><text>¥{{ quoteTotal(selected.quoteItems).toFixed(2) }}</text></view>
              </template>
              <view v-if="selected.confirmedPrice != null" class="kv"><text>客户确认价</text><text>¥{{ selected.confirmedPrice.toFixed(2) }}</text></view>
              </template>
              <template v-if="!isCollaborationApproval && (screen === 'completion' || selected.completion === '待审批')">
                <view class="kv completion-duration"><text>累计维修时长</text><text>{{ (Number(selected.raw.order.effectiveDurationSeconds || 0) / 3600).toFixed(2) }}h</text></view>
                <text class="muted">提交时由后端核验作业、报价、物料是否全部结清。</text>
              </template>
              <view v-if="screen === 'completion' && completionNeedsPrice" class="completion-price"><label for="repair-price" class="field-label">最终维修价格（元）<text class="required"> *</text></label><view class="customer-price-input"><text>¥</text><input id="repair-price" v-model="priceInput" :disabled="submitting" type="digit" placeholder="请输入最终金额" /></view><text class="customer-price-hint">默认带入客户确认价；如有调整，请填写价格变更原因。</text></view>
              <template v-if="screen === 'completion'">
                <template v-if="completionMissingQuotation">
                  <text class="field-label spaced">是否需要报价<text class="required"> *</text></text>
                  <view class="choices"><button class="choice" :class="{on:completionQuotationChoice === true}" :disabled="submitting || !canFillQuotation" @click="completionQuotationChoice = true">需要报价</button><button class="choice" :class="{on:completionQuotationChoice === false}" :disabled="submitting || !canFillQuotation" @click="completionQuotationChoice = false">无需报价</button></view>
                  <text class="muted">{{ completionQuotationChoice === true ? '请先填写报价单，完成审批及客户确认后再提交完工。' : '无需报价时，仅填写完工说明；该说明同时作为无需报价原因保存。' }}</text>
                </template>
                <label for="completion-description" class="field-label spaced">完工说明<text class="required"> *</text></label><textarea id="completion-description" v-model="completionDescription" class="textarea" placeholder="说明维修完成情况" />
                <template v-if="completionPriceChanged"><label for="amount-change-reason" class="field-label spaced">价格变更原因<text class="required"> *</text></label><textarea id="amount-change-reason" v-model="amountChangeReason" class="textarea" placeholder="说明与客户确认价不一致的原因" /></template>
              </template>
              <picker v-if="screen === 'approval' && reviewTask?.application.applicationType === 'COMPLETION'" :range="returnTypes" range-key="label" @change="returnType = returnTypes[Number($event.detail.value)].value"><view class="picker-value">完工驳回方式：{{ returnTypes.find(v => v.value === returnType)?.label }}<wd-icon name="arrow-down" /></view></picker>
              <view v-if="mergedApproval && approvalDecision === 'approve'" class="approval-assignees">
                <text v-if="candidateLoading" class="muted">正在加载候选人员…</text>
                <view v-if="candidateError"><text>{{ candidateError }}</text><button :disabled="!!mergedPending" @click="loadReviewCandidates">重新加载</button></view>
                <view v-for="department in reviewCandidates?.departments || []" :key="department.departmentId" class="approval-assignees__department">
                  <text class="field-label">{{ department.departmentName }} · 指定内协人员</text>
                  <text v-if="department.reason" class="muted">{{ department.reason }}</text>
                  <text v-if="!department.members.length" class="muted">该部门暂无可选人员，不能直接通过</text>
                  <view class="approval-assignees__members">
                    <button v-for="member in department.members" :key="member.value" :disabled="!!mergedPending" :class="{ 'is-selected': (reviewChosen[department.departmentId] || []).includes(member.value) }" @click="toggleReviewMember(department.departmentId,member.value)">{{ (reviewChosen[department.departmentId] || []).includes(member.value) ? '✓ ' : '' }}{{ member.label }}</button>
                  </view>
                </view>
              </view>
              <template v-if="screen === 'approval'"><view v-if="!isCollaborationApproval && selected.finalPrice != null" class="kv"><text>最终维修价</text><text>¥{{ selected.finalPrice.toFixed(2) }}</text></view><label v-if="!isInternalCollaborationApproval || approvalDecision" for="approval-reason" class="field-label spaced">{{ approvalDecision === 'reject' ? '驳回原因（必填）' : '审批意见（选填）' }}</label><textarea v-if="!isInternalCollaborationApproval || approvalDecision" id="approval-reason" :disabled="!!mergedPending" v-model="approvalReason" class="textarea" maxlength="1000" placeholder="填写审批意见" /></template>
            </SectionCard>
          </template>

          <template v-else-if="screen === 'exception' && selected && owner">
            <SectionCard title="关联维修单">
              <text class="application-project">{{ selected.project }}</text>
              <view class="kv"><text>维修产品</text><text>{{ selected.product }}</text></view>
              <view class="kv"><text>当前负责人</text><text>{{ selected.owner }}</text></view>
            </SectionCard>
            <SectionCard :title="`${exceptionType}信息`">
              <view v-if="exceptionType === '转单'" class="application-field">
                <text class="field-label">接单人<text class="required"> *</text></text>
                <picker :range="transferOptions" range-key="label" :disabled="submitting" @change="targetUserId = transferOptions[Number($event.detail.value)].value"><view class="picker-value" :class="{ 'application-placeholder': !targetUserId }"><text>{{ transferOptions.find(v => v.value === targetUserId)?.label || '请选择接单人' }}</text><wd-icon name="arrow-down" /></view></picker>
                <text v-if="!transferOptions.length" class="application-help">暂无可选接单人，请核对可用人员后重新进入。</text>
              </view>
              <view class="application-field">
                <text class="field-label">{{ exceptionType }}原因<text class="required"> *</text></text>
                <picker :range="exceptionReasons" :disabled="submitting" @change="exceptionReason = exceptionReasons[Number($event.detail.value)]"><view class="picker-value" :class="{ 'application-placeholder': !exceptionReason }"><text>{{ exceptionReason || '请选择原因' }}</text><wd-icon name="arrow-down" /></view></picker>
              </view>
              <view class="application-field">
                <label for="exception-remark" class="field-label">补充说明<text class="required"> *</text></label>
                <textarea id="exception-remark" v-model="exceptionRemark" class="textarea application-remark" :disabled="submitting" maxlength="1000" :placeholder="exceptionType === '转单' ? '说明转单原因、当前进展和需要交接的事项' : '说明关闭原因及与客户沟通的情况'" />
                <text class="application-count">{{ exceptionRemark.length }}/1000</text>
              </view>
            </SectionCard>
            <view class="application-notice"><wd-icon name="info-circle" size="18px" /><text>提交后由主管审批，审批通过后才会{{ exceptionType === '关闭' ? '关闭维修单' : '变更负责人' }}。</text></view>
          </template>
          <RepairAssistanceForm v-else-if="screen === 'assistance' && selected && owner" ref="assistanceForm" :initial="assistanceInitial" @submit="submitAssistance" />
          <RepairMaterialForm v-else-if="screen === 'materials' && selected && owner" ref="materialForm" :key="materialType" :repair="selected" :type="materialType" :actor-id="actor.id" @submit="submitMaterials" />
          <RepairAdditionalForm v-else-if="screen === 'additional' && selected" :key="`${selected.id}:${additionalKind}`" ref="additionalForm" :kind="additionalKind" :detail="selected.raw" :actor-id="actor.id" :disabled="submitting || mediaBusy || mutationBlocked" @busy="mediaBusy=$event" @submit="submitAdditional" />
          <OpsPreviewInspection v-else-if="screen === 'inspection'" />
          <view v-else class="empty">当前身份无权查看此内容<button class="btn" @click="go('reports')">返回报修列表</button></view>
        </view>
      </scroll-view>
      <view v-if="footerActions.length || canShowMore" class="workflow-bottom">
        <view class="workflow-bottom__inner"><button v-for="op in footerActions" :key="op.text" class="footer-btn" :class="{ primary: op.primary }" :disabled="mediaBusy || submitting || op.disabled" @click="op.action">{{ submitting ? '正在提交…' : op.text }}</button><button v-if="canShowMore" class="footer-btn footer-more" :aria-expanded="showMore" @click="showMore = true">更多 <wd-icon name="arrow-up" size="14px" /></button></view>
      </view>
    </PageLayout>
    <wd-popup v-if="restManageAccess" v-model="showRestAssignment" :close-on-click-modal="false" position="bottom" :z-index="12000" :safe-area-inset-bottom="true" custom-style="height:92vh;border-radius:16px 16px 0 0;"><view style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px"><text>休息与转派</text><button style="margin:0;font-size:14px;min-height:44px" :disabled="restLocked" @click="showRestAssignment=false">关闭</button></view><scroll-view scroll-y style="height:calc(92vh - 70px)"><RestAssignment v-if="showRestAssignment" :initial-tab="restInitialTab" @lock-change="restLocked=$event" @changed="scheduleList" /></scroll-view></wd-popup>
    <wd-popup v-model="showBackfillCheckout" position="bottom" :z-index="12000" :close-on-click-modal="false" :safe-area-inset-bottom="true" custom-style="border-radius:16px 16px 0 0;">
      <view class="more-sheet contact-sheet">
        <view class="sheet-head"><text>补签退</text><button aria-label="关闭补签退" :disabled="submitting" @click="showBackfillCheckout = false"><wd-icon name="close" size="18px" /></button></view>
        <text class="muted">填写实际签退时间和未及时签退原因</text>
        <view class="kv"><text>签到时间</text><text>{{ formatTime(backfillCheckoutMin) }}</text></view>
        <wd-datetime-picker v-model="backfillCheckoutTime" :disabled="submitting" label="实际签退时间" type="datetime" :min-date="backfillCheckoutMin" :max-date="backfillCheckoutMax" :use-second="true" required :z-index="13000" :root-portal="true" :safe-area-inset-bottom="true" />
        <label for="repair-backfill-reason" class="field-label spaced">未及时签退原因<text class="required"> *</text></label>
        <textarea id="repair-backfill-reason" v-model="backfillCheckoutReason" :disabled="submitting" class="textarea" maxlength="500" placeholder="请如实填写未及时签退的原因" />
        <text class="muted spaced">补签退不走审批，按实际结束时间计算本次维修时长。</text>
        <text v-if="backfillCheckoutError" class="backfill-error" role="alert">{{ backfillCheckoutError }}</text>
        <view class="backfill-actions"><button class="btn" :disabled="submitting" @click="showBackfillCheckout = false">取消</button><button class="btn" :disabled="submitting || mutationBlocked" @click="submitBackfillCheckout">{{ submitting ? '正在补签退…' : '确认补签退' }}</button></view>
      </view>
    </wd-popup>
    <wd-popup v-model="showQuoteDetails" position="bottom" :z-index="12000" :close-on-click-modal="!submitting" :safe-area-inset-bottom="true" custom-style="border-radius:16px 16px 0 0;">
      <view v-if="selected && latestQuotation" class="more-sheet contact-sheet">
        <view class="sheet-head"><text>报价详情</text><button :disabled="submitting" @click="showQuoteDetails = false"><wd-icon name="close" size="18px" /></button></view>
        <view class="kv"><text>报价状态</text><text>{{ quotationText(selected.quotationStatus) }}</text></view>
        <view class="kv"><text>提交时间</text><text>{{ formatReportedAt(quotationApplication?.submittedAt || latestQuotation.createTime) }}</text></view>
        <template v-if="selected.quotationStatus === 'NOT_REQUIRED'"><text class="field-label spaced">无需报价原因</text><text class="description">{{ latestQuotation.noQuoteReason || '—' }}</text></template>
        <template v-else>
          <text v-if="latestQuotation.faultScope" class="description">{{ latestQuotation.faultScope }}</text>
          <RepairQuotationTable :items="selected.quoteItems" />
          <view class="kv"><text>报价合计</text><text>¥{{ Number(latestQuotation.totalAmount ?? quoteTotal(selected.quoteItems)).toFixed(2) }}</text></view>
          <view v-if="selected.confirmedPrice != null" class="kv"><text>客户确认价</text><text>¥{{ selected.confirmedPrice.toFixed(2) }}</text></view>
        </template>
        <text v-if="selected.quoteReason" class="description">审批意见：{{ selected.quoteReason }}</text>
        <button v-if="canEditQuotationDetails" class="btn" :disabled="submitting || mutationBlocked" @click="editQuotationDetails">修改报价</button>
        <text v-if="quotationAwaitingWithdrawal" class="description">报价已提交，改为无需报价须先撤回。{{ canWithdrawQuotation ? '撤回成功后可重新选择。' : '当前状态不允许撤回，暂不能修改报价决定。' }}</text>
        <button v-if="canWithdrawQuotation" class="btn" :disabled="submitting || mutationBlocked" @click="withdrawQuotation">{{ submitting ? '正在撤回…' : '撤回修改' }}</button>
        <text v-if="error" class="quotation-error">{{ error }}</text>
      </view>
    </wd-popup>
    <wd-popup v-model="showContact" position="bottom" :z-index="12000" :safe-area-inset-bottom="true" custom-style="border-radius:16px 16px 0 0;">
      <view v-if="selected" class="more-sheet contact-sheet">
        <view class="sheet-head"><text>客户联系资料</text><button aria-label="关闭客户联系资料" @click="showContact = false"><wd-icon name="close" size="18px" /></button></view>
        <view class="kv"><text>客户</text><text>{{ selected.customer || '—' }}</text></view>
        <view class="kv"><text>联系人</text><text>{{ selected.raw.order.contactPerson || '未填写' }}</text></view>
        <view class="kv"><text>联系电话</text><text>{{ selected.raw.order.contactPhone || '未填写' }}</text></view>
        <view class="kv"><text>服务地址</text><text>{{ selected.raw.order.serviceAddress || '未填写' }}</text></view>
      </view>
    </wd-popup>
    <wd-popup v-model="showMore" position="bottom" :z-index="12000" :safe-area-inset-bottom="true" custom-style="border-radius:16px 16px 0 0;">
      <view class="more-sheet"><view class="sheet-head"><text>更多操作</text><button aria-label="关闭更多操作" @click="showMore = false"><wd-icon name="close" size="18px" /></button></view>
        <view v-for="group in moreGroups" :key="group.title" class="more-group"><text class="more-label">{{ group.title }}</text><view class="more-items"><button v-for="op in group.items" :key="op.text" :disabled="op.disabled" @click="runMore(op)">{{ op.text }}<wd-icon name="arrow-right" size="14px" /></button></view></view>
      </view>
    </wd-popup>
    <RepairApprovalPopup ref="quotationApprovalPopup" @processed="quotationApprovalProcessed" />
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { getImplementationLocation, isFreshLocation } from '@/utils/implementationLocation'
import { repairSites, nearestRepairSite, repairAbnormalEvidence, REPAIR_RADIUS_METERS, type RepairSite } from '@/service/repairLocation'
import dayjs from 'dayjs'
import { approvalRows } from '@/service/repairApproval'
import RepairApprovalPopup from './RepairApprovalPopup.vue'
import { isWorkSelf, repairOutsources, restoreRepairPeople } from '@/service/repairWorkPeople'
import { repairAttachment, repairEventContent, repairLogContent } from '@/service/repairPresentation'
import { useUserStore } from '@/store/user'
import RepairMaterialStatistics from './RepairMaterialStatistics.vue'
import { canChangeRepairQuotation, quotationLockReason } from '@/service/repairQuotationAccess'
import { readOperationsUsers } from '@/service/operationsMembership'
import { repairCoverageName } from '@/service/repairCoverage'
import { repairOrderApi, repairCaseView, repairReportPayload, uploadRepairAttachment } from '@/service/repairOrder'
import PageLayout from '@/components/PageLayout/PageLayout.vue'
import SectionCard from '@/components/SectionCard/SectionCard.vue'
import ReportDutyRoster from './ReportDutyRoster.vue'
import RestAssignment from './RestAssignment.vue'
import { restApi } from './restAssignment.api'
const showRestAssignment = ref(false), restLocked=ref(false), restInitialTab=ref('rest'), restManageAccess=ref(false)
import LocationPanel from '../LocationPanel.vue'
import ReportAttachments from './ReportAttachments.vue'
import RepairServerAttachments from './RepairServerAttachments.vue'
import OpsPreviewInspection from './OpsPreviewInspection.vue'
import RepairAssistanceForm from './RepairAssistanceForm.vue'
import RepairMaterialForm from './RepairMaterialForm.vue'
import RepairWorkResources from './RepairWorkResources.vue'
import RepairQuotationItems from '@/pages/home/components/RepairQuotationItems.vue'
import RepairQuotationTable from '@/pages/home/components/RepairQuotationTable.vue'
import { workMaterialItems, materialItemsPayload } from '@/service/repairWorkMaterials'
import RepairLogResources from './RepairLogResources.vue'
import RepairAdditionalForm from './RepairAdditionalForm.vue'
import { canAdditional, repairActionTitles, type RepairAdditionalKind } from '@/service/repairAdditional'
import { repairClockDisplay, repairCompletionSubmitted } from '@/service/repairWorkDisplay'
import { type MaterialLine } from './repairView'
import RepairCollaborationProgress from './RepairCollaborationProgress.vue'
import ApprovalReuseInfo from './ApprovalReuseInfo.vue'
import type { RepairTodoTarget } from '@/service/repairCollaboration'
import { parseApprovalCandidates, approvalAssignments, type ApprovalCandidates } from '@/service/collaborationApproval'
import { availableAssignments, collaborationPayload, repairReviewTasks, collaborationStatusText, collaborationApprovalSummary, canInviteCollaboration, canReapplyCollaboration, collaborationPrefill, collaborationManagementPayload, type CollaborationDraft, type CollaborationPrefill, type CollaborationManagementAction } from '@/service/repairCollaboration'
import { loadRepairQuotationDictionary, repairQuotationText } from '@/service/repairQuotationDictionary'
import { isOwner, quoteTotal, waitText, type RepairRole, type RepairCase, type ReportDraft, type QuoteLine } from './repairView'
const quotationOptions = ref<any[]>([])
const quotationText = (value: unknown) => {
  if (['HEAD_REVIEW', 'GM_REVIEW'].includes(String(value))) {
    return '报价审批中'
  }
  return repairQuotationText(value, quotationOptions.value)
}
let quotationLoad = 0
async function loadQuotationDictionary() {
  const generation = ++quotationLoad
  try { const rows = await loadRepairQuotationDictionary(); if (generation === quotationLoad) quotationOptions.value = rows }
  catch { if (generation === quotationLoad) quotationOptions.value = [] }
}
const props = defineProps<{ canManage: boolean; directDetail?: boolean }>()
const emit = defineEmits<{ close: []; 'role-change': [role: RepairRole] }>()
type Screen = 'logList' | 'logDetail' | 'reportCancel' | 'additional' | 'checkout' | 'begin' | 'create' | 'reports' | 'records' | 'detail' | 'log' | 'quote' | 'customer' | 'completion' | 'approval' | 'exception' | 'inspection' | 'assistance' | 'materials'
const additionalKind=ref<RepairAdditionalKind>('withdraw')
const additionalForm=ref<InstanceType<typeof RepairAdditionalForm>>()
const additionalActions=computed(() => selected.value ? (Object.keys(repairActionTitles) as RepairAdditionalKind[]).filter(kind => canAdditional(kind,selected.value!.raw,actor.value.id)) : [])
function openAdditional(kind:RepairAdditionalKind) { if(!additionalActions.value.includes(kind))return; additionalKind.value=kind;go('additional') }
function submitAdditional(payload:Record<string,any>, paths:string[]) { void transact(async()=>{
  const kind=additionalKind.value
  if(!additionalActions.value.includes(kind))throw new Error('当前操作权限已变化，请刷新详情')
  const ids=await files(paths)
  const data={...payload,...(kind==='clockCorrection'?{fileIds:ids}:{}),...(kind==='missingClock'?{afterFileIds:ids}:{})}
  return repairOrderApi[kind](data)
}) }
const assistanceForm = ref<InstanceType<typeof RepairAssistanceForm>>()
const collaborationPanel = ref<InstanceType<typeof RepairCollaborationProgress>>()
const assistanceInitial = ref<CollaborationPrefill>()
function openAssistance(applicationId?: string) {
  if (!selected.value || !canInviteCollaboration(selected.value.raw,actor.value.id) || submitting.value || mutationBlocked.value) return
  assistanceInitial.value=undefined
  if (applicationId) {
    const application=(selected.value.raw.applications || []).find((a:any)=>a.id===applicationId)
    if (!canReapplyCollaboration(application,selected.value.raw,actor.value.id)) { error.value='该申请当前不可修改重提，请刷新详情';return }
    assistanceInitial.value=collaborationPrefill(application)
  }
  go('assistance')
}
async function manageCollaboration(input: CollaborationManagementAction): Promise<boolean> {
  const saved=await transact(async()=>{
    if(!selected.value)throw new Error('请重新打开维修详情')
    const payload=collaborationManagementPayload(selected.value.raw,actor.value.id,input)
    return repairOrderApi[input.kind](payload)
  })
  if(saved)message.value=input.kind==='memberExit'?'内协人员已移除，历史记录保留':'申请已撤回，可在协助管理中修改重提'
  return saved===true
}
const materialForm = ref<InstanceType<typeof RepairMaterialForm>>()
const materialType = ref<'领料' | '还料'>('领料')
function submitAssistance(draft: CollaborationDraft) {
  void transact(async () => {
    if (!selected.value || !canInviteCollaboration(selected.value.raw,actor.value.id)) throw new Error('当前不能邀请协助，请刷新详情')
    return repairOrderApi.collaboration(collaborationPayload(selectedId.value,draft))
  })
}
function submitMaterials(lines: MaterialLine[], remark: string, useDate?: string) { void transact(async () => {
  if (materialType.value === '领料' && (!useDate || !/^\d{4}-\d{2}-\d{2}$/.test(useDate) || !dayjs(useDate).isValid() || dayjs(useDate).format('YYYY-MM-DD') !== useDate)) throw new Error('请选择有效的使用时间')
  if (!lines.length || lines.some(l => !Number.isFinite(l.qty) || (materialType.value === '还料' ? l.qty < 0 : l.qty <= 0) || !/^\d+(\.\d{1,4})?$/.test(String(l.qty)))) throw new Error('请填写大于 0、最多 4 位小数的申请数量；不申请的行请移除')
  if (materialType.value === '还料') {
    if (!lines.some(l => l.qty > 0)) throw new Error('请至少填写一项大于 0 的还料数量')
    const ids = new Set<string>()
    for (const line of lines) {
      const m = line.material
      if (!m?.materialId || !m.unit || m.availableReturnQty == null || !Number.isFinite(m.availableReturnQty) || line.qty > m.availableReturnQty) throw new Error('还料数量超出可还量或物料信息不完整，请重新选择')
      if (line.qty !== m.availableReturnQty && !line.reason?.trim()) throw new Error('请填写还料差异原因')
      if (ids.has(m.materialId)) throw new Error('同一物料存在不同历史单位，请分别申请，勿合并数量')
      ids.add(m.materialId)
    }
  }
  const itemList = lines.map(l => {
    return {materialId:l.material?.materialId || l.id,...(materialType.value === '还料' ? {unitName:l.material!.unit,unitQty:l.qty} : {applyQty:l.qty}),...(l.reason?.trim() ? {remark:l.reason.trim()} : {})}
  })
  await repairOrderApi.materialApply({repairOrderId:selectedId.value,periodId:selected.value!.raw.order.periodId,usageType:'MAINTENANCE',applyType:materialType.value === '领料' ? 'OUT' : 'IN',...(materialType.value === '领料' ? {useDate} : {}),itemList,...(remark.trim() ? {remark:remark.trim()} : {})})
}) }
function openMaterials(type: '领料' | '还料') { materialType.value = type; go('materials') }
const screen = ref<Screen>('reports'), source = ref<Screen>('reports')
watch(screen,async value=>{if(value!=='records')return;try{const result=await restApi('GET','/repair/rest/options');restManageAccess.value=result.canManage===true}catch{restManageAccess.value=false}},{immediate:true})
const showContact = ref(false), showReportDetails = ref(false)
watch(screen, () => { showContact.value = false })
const user = useUserStore()
const actor = computed(() => ({ id: user.identity.userId, name: user.userInfo.realname || user.userInfo.username, role: (props.canManage ? 'supervisor' : 'technician') as RepairRole }))
watch(() => actor.value.role, role => emit('role-change', role), { immediate: true })
const showSettings = ref(false), showMore = ref(false), showEvents = ref(false)
const expandedLogId = ref(''), showQuoteDetails = ref(false)
const scrollTop = ref(0)
function scrollToTop() { scrollTop.value = 1; void nextTick(() => { scrollTop.value = 0 }) }
type LiveCase = RepairCase & { raw: Record<string, any>; actions: Record<string, boolean> }
function cardApprovalText(c: LiveCase): string {
  const status = c.raw.order?.approvalStatus ?? c.raw.approvalStatus
  return ({ TRANSFER_PENDING:'转单审批中', COMPLETION_PENDING:'完工审批中', CLOSE_PENDING:'关闭审批中' } as Record<string,string>)[status] || ''
}
const cases = ref<LiveCase[]>([]), selectedId = ref('')
watch(selectedId, () => { showContact.value = false; showReportDetails.value = false })
watch(() => selectedId.value, () => { expandedLogId.value = ''; showQuoteDetails.value = false })
const uncertainKey = `repair-report-uncertain:${actor.value.id}`
const loading = ref(false), submitting = ref(false), total = ref(0), submitUncertain = ref(uni.getStorageSync(uncertainKey) === true)
let listGeneration = 0, detailGeneration = 0
const selected = computed(() => cases.value.find(c => c.id === selectedId.value))
const owner = computed(() => !!selected.value && isOwner(selected.value, actor.value))
const terminal = computed(() => !!selected.value && ['已完成', '已关闭'].includes(selected.value.state))
const workDetail = ref<any>(null), workDraft = ref<any>(null)
const workCache = ref<Record<string, any>>({})
const workLoading = ref(false)
let workGeneration = 0
watch(selectedId, () => { ++workGeneration; workDetail.value = null; workDraft.value = null; workCache.value = {}; workLoading.value = false })
const currentLog = computed(() => (workDraft.value && (workDetail.value?.recordStatus === 'ACTIVE' || ['log','checkout'].includes(screen.value)) ? workDraft.value : undefined) || selected.value?.logs.find(l => l.actorId === actor.value.id && selected.value?.raw.workRecords?.find((r: any) => r.id === l.id)?.recordStatus === 'ACTIVE'))
function installWork(data: any) {
  if (!data?.recordId || data.orderId !== selectedId.value) throw new Error('维修记录响应不完整，请重新查询')
  workCache.value[data.recordId] = data
  workDetail.value = data
  const summary = selected.value?.logs.find(l => l.id === data.recordId)
  workDraft.value = {...summary,id:data.recordId,startedAt:Date.parse(data.effectiveStartedAt || data.rawStartedAt),fault:data.faultDescription || '',description:data.repairDescription || '',photos:[],videos:[],
    fileIds:[...(data.fileIds || [])],persons:restoreRepairPeople(data,selected.value?.raw.members || []).filter((p:any) => !isWorkSelf(p, actor.value.id) && !isWorkSelf(p, selected.value?.ownerId)),vehicleValue:data.vehicleValue ?? null,materialItems:workMaterialItems(data,selected.value?.raw || {},data.recordId)}
}
async function openWork(recordId?: string, target: 'log' | 'checkout' = 'log') {
  if (workLoading.value) return
  const orderId = selectedId.value, generation = ++workGeneration
  workLoading.value = true; error.value = ''
  try {
    const data = await repairOrderApi.workDetail(orderId,recordId)
    if (generation !== workGeneration || orderId !== selectedId.value) return
    if (target === 'checkout' && (data.actions?.canEnd !== true || completionSubmitted.value)) throw new Error('当前日志不可签退，请重新查看详情')
    installWork(data)
    if (data.formStatus === 'SUBMITTED' && target === 'log') {
      if (data.actions?.canEnd === true && !completionSubmitted.value) go('checkout')
      else await toggleLog(data.recordId)
    } else go(target)
  } catch (e:any) { error.value = e.message || '维修日志加载失败' }
  finally { if (generation === workGeneration) workLoading.value = false }
}
const logDetailLoading = ref(false)
let logDetailGeneration = 0
const viewedWork = computed(() => workCache.value[expandedLogId.value])
const viewedSummary = computed(() => pagedRepairLogs.value.find(l => l.id === expandedLogId.value) || selected.value?.logs.find(l => l.id === expandedLogId.value))
// 分页返回打卡状态；详情只覆盖实际提供的字段，不能用缺省值抹掉同条日志的信息。
const viewedRecordInfo = computed(() => {
  const record = repairLogRecords.value.find(r => r.id === expandedLogId.value) || {}
  return { ...record, ...Object.fromEntries(Object.entries(viewedWork.value || {}).filter(([,value]) => value != null)) } as Record<string, any>
})
const viewedWorkRole = computed(() => {
  const record = viewedRecordInfo.value
  return record.workRoleName || ({ RESPONSIBLE: '维修负责人', OWNER: '维修负责人', COLLABORATOR: '内协人员' } as Record<string,string>)[record.operatorRole || record.workRole] || '未记录'
})
const viewedClock = computed(() => repairClockDisplay(viewedRecordInfo.value))
const completionSubmitted = computed(() => repairCompletionSubmitted(selected.value?.raw))
function logState(id: string) {
  const record = workCache.value[id] || repairLogRecords.value.find(r => r.id === id) || selected.value?.raw.workRecords?.find((r:any) => r.id === id) || {}
  return record.recordStatus === 'PENDING_CORRECTION' ? '待补卡' : record.recordStatus === 'ENDED' ? '已签退' : record.formStatus === 'SUBMITTED' ? '已提交' : record.formStatus === 'DRAFT' ? '草稿' : '进行中'
}
async function toggleLog(id: string) {
  if (!id || logDetailLoading.value || (screen.value === 'logDetail' && expandedLogId.value === id && workCache.value[id])) return
  expandedLogId.value = id; go('logDetail')
  const orderId = selectedId.value, generation = ++logDetailGeneration
  delete workCache.value[id]; logDetailLoading.value = true
  try {
    const data = await repairOrderApi.workDetail(orderId,id)
    if (orderId !== selectedId.value || generation !== logDetailGeneration || screen.value !== 'logDetail') return
    if (data.orderId !== orderId || data.recordId !== id) throw new Error('日志详情不匹配，请重新加载')
    workCache.value[id] = data
  } catch (e:any) { if (generation === logDetailGeneration && orderId === selectedId.value) error.value = e.message || '日志详情加载失败' }
  finally { if (generation === logDetailGeneration) logDetailLoading.value = false }
}
const resourceBusy = ref(false)
const logPage = ref(0)
const logPages = ['报修信息', '维修信息', '用人用车用料']
watch(() => currentLog.value?.id, () => { logPage.value = 0 })
function changeLogPage(page: number) {
  if (submitting.value || mediaBusy.value || resourceBusy.value) return
  logPage.value = Math.max(0, Math.min(2, page)); error.value = ''; scrollToTop()
}
function updateResources(detail: any) {
  // Refresh only resource records, preserving unsaved text and attachment drafts.
  if (selected.value && detail?.order?.id === selectedId.value) {
    selected.value.raw.materialUses = detail.materialUses || []
    selected.value.raw.materialLinks = detail.materialLinks || []
  }
}
// Non-owner work is available only when the server grants start permission or
// returns this user's own active record; list scope alone never grants access.
const isAssistantWork = computed(() => workDetail.value ? workDetail.value.workRole === 'COLLABORATOR' : !!selected.value && !owner.value && selected.value.actions.canStartWork === true)
const repairLogDate = ref(''), repairLogsPage = ref(1), repairLogsTotal = ref(0)
const repairLogRecords = ref<any[]>([]), repairLogsLoading = ref(false), repairLogsError = ref('')
let repairLogsGeneration = 0
const pagedRepairLogs = computed(() => repairCaseView({order:{id:selectedId.value || '_'},workRecords:repairLogRecords.value}).logs)
const repairLogsPages = computed(() => Math.max(1,Math.ceil(repairLogsTotal.value / 10)))
async function loadRepairLogs() {
  const generation = ++repairLogsGeneration, orderId = selectedId.value
  repairLogRecords.value = []; repairLogsError.value = ''; repairLogsLoading.value = true
  try {
    const result = await repairOrderApi.workPage(orderId,repairLogsPage.value,10,repairLogDate.value)
    if (generation !== repairLogsGeneration || orderId !== selectedId.value || screen.value !== 'logList') return
    if (!Array.isArray(result?.records) || result.total == null || !Number.isFinite(Number(result.total)) || Number(result.total) < 0) throw new Error('维修日志分页响应不完整')
    if (result.records.some((record:any) => !record.id || record.orderId && String(record.orderId) !== String(orderId))) throw new Error('维修日志与当前工单不匹配')
    repairLogRecords.value = result.records
    repairLogsTotal.value = Number(result.total)
    if (repairLogsPage.value > repairLogsPages.value) repairLogsPage.value = repairLogsPages.value
  } catch (e:any) { if (generation === repairLogsGeneration) repairLogsError.value = e.message || '维修日志读取失败，请重试' }
  finally { if (generation === repairLogsGeneration) repairLogsLoading.value = false }
}
function changeRepairLogDate(date:string) { repairLogDate.value = date; repairLogsPage.value = 1 }
watch(selectedId, () => { ++repairLogsGeneration; repairLogDate.value='';repairLogsPage.value=1;repairLogRecords.value=[];repairLogsTotal.value=0 })
onBeforeUnmount(() => { ++repairLogsGeneration })
watch(() => [screen.value,selectedId.value,repairLogDate.value,repairLogsPage.value], () => {
  if (screen.value === 'logList' && selectedId.value) void loadRepairLogs()
  else { ++repairLogsGeneration; repairLogsLoading.value=false }
})
const repairSummaryRows = computed(() => {
  const c=selected.value
  const seconds=c?.raw.order.effectiveDurationSeconds
  const hasDuration=seconds != null && seconds !== '' && Number.isFinite(Number(seconds)) && Number(seconds)>=0
  return [
    {label:'维修状态',value:c?.state || '—',missing:false},
    {label:'维修人',value:c?.owner || '—',missing:false},
    {label:'累计维修工时',value:hasDuration ? (Number(seconds)/3600).toFixed(2)+'h' : '待接口提供',missing:!hasDuration},
  ]
})
const canViewSelected = computed(() => !!selected.value)
const reportFiles = computed(() => selected.value?.raw.reportAttachments || (selected.value?.raw.attachments || []).filter((a: any) => a.attachmentScene === 'REPORT_FAULT'))
function workBeginPhotos(record: any) {
  return (record?.photoFileIds || []).map((fileId: string) => repairAttachment(
    record.photos?.find((file: any) => file.fileId === fileId) || {fileId, mediaType: 'IMAGE', fileNameSnapshot: '签到照片'}
  ))
}
function recordFiles(id: string) {
  const detail = workCache.value[id]
  if (!detail) return []
  const ids = workDraft.value?.id === id && ['log','checkout'].includes(screen.value) ? workDraft.value.fileIds : detail.fileIds
  return (ids || []).map((fileId:string) => repairAttachment(detail.files?.find((f:any) => f.fileId === fileId) || {fileId,fileNameSnapshot:'已保存附件（类型未返回）'}))
}
const events = ref<{id:string;operator:string;time:string;action:string;content:string}[]>([]), eventTotal = ref(0), eventLoading = ref(false)
const eventError = ref('')
let eventPage = 0
async function loadEvents() {
  if (eventLoading.value) return
  const id = selectedId.value
  eventError.value = ''
  eventLoading.value = true
  try {
    const result = await repairOrderApi.logs(id,eventPage + 1,20)
    if (id !== selectedId.value) return
    events.value.push(...(result.records || []).map((r:any) => ({id:r.id,operator:r.operatorName || '系统',time:formatReportedAt(r.occurredAt),action:r.eventName || '处理动态',content:repairEventContent(r.content)})))
    eventTotal.value = result.total; eventPage++
  } catch (e: any) { if (id === selectedId.value) eventError.value = e.message || '处理日志加载失败' }
  finally { eventLoading.value = false }
}
function toggleEvents() { showEvents.value = !showEvents.value; if (showEvents.value && !events.value.length) void loadEvents() }
const error = ref(''), message = ref(''), mediaBusy = ref(false)
const query = ref(''), searchDraft = ref(''), filter = ref('全部'), page = ref(0), relation = ref('我负责的'), pendingOnly = ref(false)
const mainFilters = ['全部', '待处理', '进行中', '已完成', '已关闭']
const relations = ['我负责的', '我协助的', '历史负责', '全部可见']
const repairModes = ['线上', '线下', '检修'] as const
const checkoutNext = ref<'completion' | 'detail' | ''>('')
const showBackfillCheckout = ref(false)
const backfillCheckoutTime = ref(Date.now()), backfillCheckoutMin = ref(0), backfillCheckoutMax = ref(Date.now())
const backfillCheckoutReason = ref(''), backfillCheckoutError = ref('')
function openBackfillCheckout() {
  if (completionSubmitted.value) { error.value = '已提交完工，不可再补签退'; return }
  if (submitting.value || screen.value !== 'checkout' || !currentLog.value || workDetail.value?.actions?.canEnd !== true) return
  const start = currentLog.value.startedAt, now = Date.now()
  if (!Number.isFinite(start) || start > now) { error.value = '签到时间异常，请重新加载本次日志'; return }
  backfillCheckoutMin.value = start; backfillCheckoutMax.value = now; backfillCheckoutTime.value = now
  backfillCheckoutReason.value = ''; backfillCheckoutError.value = ''; showBackfillCheckout.value = true
}
async function submitBackfillCheckout() {
  if (!showBackfillCheckout.value || submitting.value) return
  if (completionSubmitted.value) { backfillCheckoutError.value = '已提交完工，不可再补签退'; return }
  if (mutationBlocked.value) { backfillCheckoutError.value = '上次操作结果需要核对，请返回列表重新打开详情'; return }
  if (screen.value !== 'checkout' || !currentLog.value || workDetail.value?.actions?.canEnd !== true) { backfillCheckoutError.value = '当前记录不可补签退，请重新查看日志'; return }
  const time = Number(backfillCheckoutTime.value)
  if (!Number.isFinite(time) || time < backfillCheckoutMin.value || time > Date.now()) { backfillCheckoutError.value = '实际签退时间须在签到时间至当前时间之间'; return }
  if (!backfillCheckoutReason.value.trim()) { backfillCheckoutError.value = '请填写未及时签退原因'; return }
  if (!isAssistantWork.value && !checkoutNext.value) { backfillCheckoutError.value = '请先选择提交完成或需要复修'; return }
  const orderId = selectedId.value, recordId = currentLog.value.id
  const wantsCompletion = !isAssistantWork.value && checkoutNext.value === 'completion'
  submitting.value = true; backfillCheckoutError.value = ''
  let submitted = false
  try {
    const latestOrder = await repairOrderApi.detail(orderId)
    if (repairCompletionSubmitted(latestOrder)) throw new Error('已提交完工，不可再补签退')
    // Re-read before writing so an already completed record is never submitted again.
    let record = await repairOrderApi.workDetail(orderId,recordId)
    if (String(record.recordId) !== String(recordId)) throw new Error('维修记录不匹配，请重新打开日志')
    if (record.recordStatus !== 'ENDED') {
      if (record.actions?.canEnd !== true) throw new Error('请先正式提交维修日志，或刷新核对签退权限')
      await repairOrderApi.clockCorrection({orderId,recordId,effectiveEndedAt:dayjs(time).format('YYYY-MM-DD HH:mm:ss'),reason:backfillCheckoutReason.value.trim()})
      submitted = true
      record = await repairOrderApi.workDetail(orderId,recordId)
    }
    if (String(record.recordId) !== String(recordId) || record.recordStatus !== 'ENDED') {
      throw new Error('补签退已提交，但本次作业尚未结束。请联系管理员确认后端已启用免审批补签退，勿重复提交。')
    }
    submitted = true
    await refreshSelected()
    workDetail.value = null; workDraft.value = null
    events.value = []; eventPage = 0; eventTotal.value = 0; showEvents.value = false
    showBackfillCheckout.value = false; go('detail')
    message.value = '补签退成功'; uni.showToast({title:'补签退成功',icon:'success'})
    if (wantsCompletion && owner.value && !terminal.value && selected.value?.actions.canOwnerApply && selected.value.actions.canViewRepairDetail) openForm('completion')
  } catch (e:any) {
    mutationBlocked.value = submitted || e.uncertain === true
    backfillCheckoutError.value = submitted ? (e.message?.includes('尚未结束') ? e.message : '补签退已提交，但结果刷新失败。请返回列表重新查看，勿重复提交。') : e.uncertain ? '补签退结果尚未确认，请返回列表重新查看，勿重复提交。' : e.message || '补签退失败，请稍后重试'
  } finally { submitting.value = false }
}
watch(() => [screen.value, selectedId.value, currentLog.value?.id], () => { showBackfillCheckout.value = false; backfillCheckoutError.value = '' })
watch(() => currentLog.value?.id, () => { checkoutNext.value = '' })
const clockNow = ref(Date.now())
function repairLogDuration(log: { id: string; endedAt?: number }) {
  if (!log.endedAt) return '进行中'
  const seconds = repairLogRecords.value.find(record => record.id === log.id)?.durationSeconds ?? selected.value?.raw.workRecords?.find((record: any) => record.id === log.id)?.durationSeconds
  return seconds != null && seconds !== '' && Number.isFinite(Number(seconds)) && Number(seconds) >= 0 ? `${(Number(seconds) / 3600).toFixed(2)}h` : '未提供'
}
const timer = setInterval(() => { clockNow.value = Date.now() }, 60000)
onBeforeUnmount(() => clearInterval(timer))
const scopeText = computed(() => screen.value === 'reports' ? '我提交的报修单' : '当前账号可见的维修任务')
const filtered = computed(() => cases.value.filter(c => !query.value || [c.customer,c.project,c.product,c.applicant,c.orderId].join(' ').includes(query.value)))
const listBusy = ref(false), listError = ref(''), hasMore = ref(true)
const listPageSize = 20
const paged = computed(() => filtered.value)
watch([filter, relation], () => { scrollToTop(); scheduleList() })
const titles: Record<Screen, string> = { logList:'维修记录', logDetail:'维修日志详情',reportCancel:'取消报修',additional:'维修办理',checkout: '维修签退', begin: '维修签到', create: '填写报修', reports: '报修管理', records: '维修列表', detail: '维修详情', log: '填写维修日志', quote: '填写报价', customer: '客户确认维修', completion: '提交完工', approval: '审批详情', exception: '申请处理', inspection: '巡检管理', assistance: '申请协助', materials: '物料申请' }
const title = computed(() => screen.value==='create' && editingReport.value ? '修改报修' : screen.value === 'additional' ? repairActionTitles[additionalKind.value] : screen.value === 'materials' ? `${materialType.value}申请` : screen.value === 'detail' && source.value === 'reports' ? '报修详情' : titles[screen.value])
const reportRows = computed(() => selected.value ? [['客户', selected.value.customer], ['项目', selected.value.project], ['产品', selected.value.product], ['本次维修保障', selected.value.warranty], ...((Array.isArray(selected.value.raw.products) ? selected.value.raw.products : []).map((product: Record<string, any>, index: number) => [`产品保障 ${index + 1}`, `${product.productNameSnapshot || product.productName || '未命名产品'} · ${repairCoverageName(product)}`])), ['报修人', selected.value.applicant], ['报修时间', formatReportedAt(selected.value.reportedAt)], ['故障现象', selected.value.fault], ['备注', selected.value.remark || '—']] : [])
const emptyDraft = (): ReportDraft => ({ customerId: '', projectId: '', product: '', fault: '', reportedAt: dayjs().format('YYYY-MM-DD'), remark: '', photos: [], videos: [] })
const draft = reactive(emptyDraft())
const editingReport=ref(''), reportChangeReason=ref(''), reportCancelReason=ref(''), originalReporterName=ref('')
const retainedReportFiles=ref<any[]>([])
const reporterName = computed(() => actor.value.name)
const reportTimestamp = ref(Date.now())
type ReportOptionLevel = 'customers' | 'projects' | 'products'
const optionBusy = reactive({ customers: false, projects: false, products: false })
const optionGeneration = { customers: 0, projects: 0, products: 0 }
const customerOptions = ref<{id:string;name:string}[]>([])
const projects = ref<{id:string;name:string;periodId?:string}[]>([])
// 项目选档案ID，产品按productId选择，同名产品不合并。
const productOptions = ref<{id:string;name:string}[]>([])
const selectedProducts = ref<string[]>([])
const originalReportProducts = ref<{productId:string;assetId?:string;serviceId?:string}[]>([])
const archiveOptions = ref<{products:any[];assets:any[]}>({products:[],assets:[]})
const reportServices = ref<Record<string,string>>({})
function serviceChoices(productId:string) {
  return (archiveOptions.value.products.find(p=>p.id===productId)?.coverage?.applicableServices || []).map((s:any)=>({value:s.id,label:s.serviceName || s.contractName || s.id}))
}
function reportProductRows() {
  return selectedProducts.value.flatMap(productId=>{
    const originals=originalReportProducts.value.filter(p=>p.productId===productId)
    if(originals.length)return originals.map(p=>({...p,...(!p.serviceId && reportServices.value[productId]?{serviceId:reportServices.value[productId]}:{})}))
    const choices=serviceChoices(productId)
    const serviceId=reportServices.value[productId]
    if(choices.length>1 && !serviceId)throw new Error('请为所选产品选择适用保障')
    if(serviceId && !choices.some((s:any)=>s.value===serviceId))throw new Error('产品保障已变化，请重新选择')
    return [{productId,...(serviceId?{serviceId}:{})}]
  })
}
watch(()=>reportTimestamp.value,()=>{if(screen.value==='create' && draft.projectId)void loadOptions('products')})
const customer = ref<{id:string;name:string}>()
const project = ref<{id:string;name:string;periodId?:string}>()
async function chooseCustomer(index: number) {
  if (submitting.value || editingReport.value) return
  customer.value = customerOptions.value[index]
  draft.customerId = customer.value?.id || ''; draft.projectId = ''; selectedProducts.value = []
  project.value = undefined; projects.value = []; productOptions.value = []
  ++optionGeneration.projects; ++optionGeneration.products
  optionBusy.products = false
  if (draft.customerId) await loadOptions('projects')
}
async function chooseProject(index: number) {
  if (submitting.value || editingReport.value) return
  project.value = projects.value[index]
  draft.projectId = project.value?.id || ''; selectedProducts.value = []
  productOptions.value = []; reportServices.value={};archiveOptions.value={products:[],assets:[]}; ++optionGeneration.products
  if (draft.projectId) await loadOptions('products')
}
const quoteDraft = ref<QuoteLine[]>([]), priceInput = ref(''), approvalReason = ref('')
const beginMode = ref<typeof repairModes[number]>('线下')
const transferOptions = ref<{ value: string; label: string }[]>([]), targetUserId = ref('')
const quoteRequired = ref(true), noQuoteReason = ref(''), faultScope = ref('')
const completionDescription = ref(''), amountChangeReason = ref('')
const completionMissingQuotation = computed(() => typeof selected.value?.raw.order.quotationRequired !== 'boolean')
const completionQuotationChoice = ref<boolean | null>(null)
watch(selectedId, () => { completionQuotationChoice.value = null })
const completionNeedsPrice = computed(() => selected.value?.raw.order.quotationRequired === true)
const completionPriceChanged = computed(() => completionNeedsPrice.value && selected.value?.confirmedPrice != null && priceInput.value.trim() !== '' && Math.round(Number(priceInput.value) * 100) !== Math.round(selected.value.confirmedPrice * 100))
const returnType = ref('MATERIAL_SUPPLEMENT')
const returnTypes = [{value: 'MATERIAL_SUPPLEMENT', label: '补充资料'}, {value: 'REWORK', label: '重新维修'}]
const applicationNames: Record<string,string> = {QUOTATION:'报价审批',COLLABORATION:'协助申请',TRANSFER:'转单申请',CLOSE:'关闭申请',COMPLETION:'完工申请',CLOCK_CORRECTION:'补卡申请',MATERIAL_WRITEOFF:'物料核销'}
const approvalDecision = ref<'approve'|'reject'|''>('')
const chosenReviewTaskId = ref('')
const reviewTasks = computed(() => repairReviewTasks(selected.value?.raw || {}))
const quotationApprovalPopup = ref<InstanceType<typeof RepairApprovalPopup>>()
async function quotationApprovalProcessed() {
  try { await refreshSelected() }
  catch { error.value = '审批已提交，维修单刷新失败，请重新打开详情' }
}
const reviewTask = computed(() => chosenReviewTaskId.value ? reviewTasks.value.find((r:any)=>r.task.id===chosenReviewTaskId.value) : reviewTasks.value[0])
const isCollaborationApproval = computed(() => screen.value === 'approval' && reviewTask.value?.application.applicationType === 'COLLABORATION')
const isInternalCollaborationApproval = computed(() => isCollaborationApproval.value && Array.isArray(reviewTask.value?.application.formData?.departments) && reviewTask.value?.application.formData?.personType !== 'EXTERNAL')
const collaborationApproval = computed(() => collaborationApprovalSummary(reviewTask.value?.application,selected.value?.raw || {}))
const mergedApproval = computed(() => isInternalCollaborationApproval.value && reviewTask.value?.application.formData?.assignmentMode === 'WITH_APPROVAL')
const reviewCandidates = ref<ApprovalCandidates>(), reviewChosen = ref<Record<string,string[]>>({})
const candidateLoading = ref(false), candidateError = ref('')
const mergedPending = ref<Record<string,unknown>>()
let candidateGeneration=0
async function loadReviewCandidates(){
  const current=++candidateGeneration, task=reviewTask.value
  reviewCandidates.value=undefined;candidateError.value=''
  if(!mergedApproval.value || !task){candidateLoading.value=false;return}
  candidateLoading.value=true
  try{
    const data=await repairOrderApi.approvalCandidates(task.application.id,task.task.id)
    if(current===candidateGeneration)reviewCandidates.value=parseApprovalCandidates(data,task.task.id)
  }catch(e:any){if(current===candidateGeneration)candidateError.value=e.message || '候选人员读取失败'}
  finally{if(current===candidateGeneration)candidateLoading.value=false}
}
watch(()=>[screen.value,reviewTask.value?.task.id,mergedApproval.value],()=>{
  reviewChosen.value={};mergedPending.value=undefined;approvalDecision.value=''
  void loadReviewCandidates()
})
function toggleReviewMember(departmentId:string,userId:string){
  if(mergedPending.value)return
  const ids=reviewChosen.value[departmentId] || []
  reviewChosen.value={...reviewChosen.value,[departmentId]:ids.includes(userId)?ids.filter(id=>id!==userId):[...ids,userId]}
}
const reviewTaskOptions = computed(() => reviewTasks.value.map((r:any)=>({...r,label:`${applicationNames[r.application.applicationType] || '审批'} · ${r.task.departmentName || r.task.name}`})))
function selectReviewTask(event:any){ chosenReviewTaskId.value=reviewTaskOptions.value[Number(event.detail.value)]?.task.id || '';approvalReason.value='';approvalDecision.value='';if(reviewTask.value?.application.applicationType==='QUOTATION'){go('detail');openForm('approval')} }
watch(selectedId,()=>{chosenReviewTaskId.value='';approvalReason.value='';approvalDecision.value=''})
const reviewDepartments = computed(() => Array.isArray(reviewTask.value?.application.formData?.departments) ? reviewTask.value!.application.formData.departments : [])
async function collaborationChanged(){try{await refreshSelected();message.value='内协人员已指定入组';uni.showToast({title:'人员指定成功',icon:'success',duration:2000})}catch(e:any){error.value='人员已指定，详情刷新失败，请重新打开详情核对'}}
const approvalFormRows = computed(() => {
  if (reviewTask.value?.application.applicationType === 'COLLABORATION') return []
  const form = reviewTask.value?.application.formData
  if (!form || typeof form !== 'object') return []
  return approvalRows({snapshot:{form}}, {fields:[{key:'form',name:'申请内容'}]}).filter(row => !/^(?:报修产品|产品)(?:\s*\d+)?$/.test(row.label.trim()) && !(row.label === '申请原因' && row.value === reviewTask.value?.application.reason)).map(row => [row.label,row.value])
})
let approvalReportNextOpenAt = 0
function openApprovalReport() {
  if (!selectedId.value || submitting.value || mergedPending.value || Date.now() < approvalReportNextOpenAt) return
  approvalReportNextOpenAt = Date.now() + 1000
  uni.navigateTo({url:`/pages/ops/repairDetail?id=${encodeURIComponent(selectedId.value)}`,fail:()=>{approvalReportNextOpenAt=0;uni.showToast({title:'报修单打开失败，请重试',icon:'none'})}})
}
const exceptionType = ref<'转单' | '关闭'>('转单'), exceptionReason = ref(''), exceptionRemark = ref('')
const exceptionReasons = computed(() => exceptionType.value === '关闭' ? ['客户弃修', '不是问题', '其他'] : ['个人问题', '病假'])
watch(exceptionType, () => { exceptionReason.value = ''; exceptionRemark.value = '' })
let listScheduled = false
function scheduleList() {
  ++listGeneration; listBusy.value = false; listError.value = ''; page.value = 0; cases.value = []; total.value = 0; hasMore.value = true
  if (listScheduled) return
  listScheduled = true
  void nextTick(() => { listScheduled = false; if (['reports','records'].includes(screen.value)) void loadList() })
}
function go(target: Screen) { if (!['reports', 'records'].includes(target)) { ++listGeneration; listBusy.value = false }; error.value = ''; message.value = ''; screen.value = target; showMore.value = false; scrollToTop(); if (target === 'create') { editingReport.value='';originalReportProducts.value=[];reportServices.value={};archiveOptions.value={products:[],assets:[]};retainedReportFiles.value=[];reportChangeReason.value='';Object.assign(draft,emptyDraft());selectedProducts.value=[];customer.value=undefined;project.value=undefined;reportTimestamp.value = Date.now(); void loadOptions() }; if (['reports', 'records'].includes(target)) scheduleList() }
function back() {
  if(restLocked.value){uni.showToast({title:'提交结果待确认，请先核对或重试',icon:'none'});return}
  if(showRestAssignment.value){showRestAssignment.value=false;return}
  if (props.directDetail && screen.value === 'detail' && !submitting.value && !showQuoteDetails.value && !showContact.value && !showMore.value) { emit('close'); return }
  // The home workbench keeps this component mounted. Hidden form/popup state
  // must not consume a list-level back action on the next visit.
  if (['reports', 'records', 'inspection'].includes(screen.value)) {
    if (submitting.value) { uni.showToast({title:'正在提交，请稍候',icon:'none'}); return }
    ++listGeneration; ++detailGeneration; ++workGeneration; ++logDetailGeneration
    listBusy.value=false;loading.value=false;workLoading.value=false;logDetailLoading.value=false
    showQuoteDetails.value=false;showContact.value=false;showMore.value=false;showSettings.value=false
    mediaBusy.value=false
    emit('close')
    return
  }
  if (showQuoteDetails.value) { if (!submitting.value) showQuoteDetails.value = false; return }
  if (showContact.value) { showContact.value = false; return }
  if (submitting.value || mediaBusy.value) { uni.showToast({title:'正在处理，请稍候',icon:'none'}); return }
  ++listGeneration; ++detailGeneration; ++workGeneration; ++logDetailGeneration; logDetailLoading.value = false; workLoading.value = false; loading.value = false
  if (showMore.value || showSettings.value) { showMore.value = false; showSettings.value = false; return }
  if(screen.value==='create' && editingReport.value){editingReport.value='';originalReportProducts.value=[];reportServices.value={};archiveOptions.value={products:[],assets:[]};retainedReportFiles.value=[];go('detail');return}
  if (['detail', 'create'].includes(screen.value)) { go(source.value === 'detail' ? 'reports' : source.value); selectedId.value = '' }
  else if (screen.value === 'logDetail') go('logList')
  else go('detail')
}
function resetFilters() { searchDraft.value = ''; query.value = ''; filter.value = '全部'; pendingOnly.value = false; relation.value = '我负责的'; page.value = 0; if (['reports', 'records'].includes(screen.value)) scheduleList() }
function search() { query.value = searchDraft.value.trim() }
function openHomeEntry(entry: 'reports' | 'records' | 'inspection') {
  void loadQuotationDictionary()
  ++detailGeneration; ++workGeneration; ++logDetailGeneration
  loading.value=false;workLoading.value=false;logDetailLoading.value=false
  showQuoteDetails.value=false;showContact.value=false;showMore.value=false;mediaBusy.value=false
  const target = entry === 'records' && actor.value.role === 'reporter' ? 'reports' : entry
  source.value = target; selectedId.value = ''; resetFilters(); showSettings.value = false; go(target)
}
async function openOrder(id: string, target?: RepairTodoTarget, quotation = false) {
  const loaded=await openCase({ id } as RepairCase)
  if (loaded && quotation && selectedId.value === id) { openQuotationEntry(); return }
  if(!loaded || !target || selectedId.value!==id || target.orderId!==id)return
  await nextTick()
  if(selectedId.value!==id || screen.value!=='detail')return
  if(target.view==='approval'){
    const matches=reviewTasks.value.filter((r:any)=>(!target.taskId || r.task.id===target.taskId)
      && (!target.instanceId || r.workflow.id===target.instanceId)
      && (!target.applicationId || r.application.id===target.applicationId)
      && (!target.departmentId || r.task.departmentId===target.departmentId))
    if((!target.taskId && !target.instanceId && !target.applicationId) || !matches.length){
      chosenReviewTaskId.value='__unavailable_todo__'
      error.value='该审批待办已处理、权限已变化或定位信息不完整，请返回待办列表刷新核对'
      return
    }
    chosenReviewTaskId.value=matches[0].task.id
    openForm('approval')
    if(matches.length>1)message.value='该申请有多项待审批任务，请确认上方所选审批任务'
  } else if(target.view==='collaboration'){
    if(!target.applicationId || !collaborationPanel.value?.showInvitation(target.applicationId,target.departmentId))error.value='未找到对应协助邀请，请返回待办列表刷新核对'
  }
}
defineExpose({ openHomeEntry, openOrder })
async function openCase(c: RepairCase) {
  if (loading.value || submitting.value) return
  if (screen.value === 'detail' && selectedId.value === c.id) return true
  ++listGeneration; listBusy.value = false
  const generation = ++detailGeneration
  source.value = screen.value; selectedId.value = ''; error.value = ''; loading.value = true
  try {
    const detail = await repairOrderApi.detail(c.id)
    if (generation !== detailGeneration) return
    mutationBlocked.value = false
    const row = repairCaseView(detail) as LiveCase
    const index = cases.value.findIndex(item => item.id === c.id)
    if (index >= 0) cases.value[index] = row
    else cases.value.unshift(row)
    if (source.value === 'records' && row.actions.canViewRepairDetail !== true) source.value = 'reports'
    selectedId.value = row.id; showEvents.value = false; events.value = []; eventPage = 0; eventTotal.value = 0; go('detail')
    return true
  } catch (e: any) { if (generation === detailGeneration) error.value = e.message || '详情加载失败' }
  finally { if (generation === detailGeneration) loading.value = false }
}
function displayNumber(c: RepairCase) { return c.orderId }
function stateTone(state: string) { return state === '已完成' ? 'badge--success' : state === '已关闭' ? 'badge--closed' : state === '待处理' ? 'badge--warn' : '' }
function formatTime(value: number) { return dayjs(value).format('MM-DD HH:mm') }
function formatReportedAt(value: string) { if(!value)return '—'; const date=dayjs(value);return date.isValid()?date.format('YYYY-MM-DD HH:mm:ss'):value.replace('T',' ') }
function detailStatus(c: RepairCase) {
  const raw = (c as LiveCase).raw
  if (raw?.order?.progressText) return raw.order.progressText
  if (!raw?.order) return c.state
  return `${c.state} · ${quotationText(c.quotationStatus)}`
}
async function loadOptions(level: ReportOptionLevel = 'customers') {
  const generation = ++optionGeneration[level]
  const customerId = draft.customerId, archiveId = draft.projectId, asOf=dayjs(reportTimestamp.value).format('YYYY-MM-DD')
  if (level !== 'customers' && !customerId || level === 'products' && !archiveId) return
  optionBusy[level] = true; error.value = ''
  try {
    const options = await repairOrderApi.reportOptions({
      ...(level !== 'customers' ? {customerId} : {}),
      ...(level === 'products' ? {archiveId} : {}),
    })
    const extra=level==='products' ? await repairOrderApi.archiveReportOptions(archiveId,asOf) : undefined
    if (generation !== optionGeneration[level] || (level !== 'customers' && customerId !== draft.customerId) || (level === 'products' && archiveId !== draft.projectId)) return
    if (level === 'customers') customerOptions.value = options.customers.map(c => ({id:c.customerId,name:c.customerName}))
    if (level === 'projects') projects.value = options.projects.filter(p => p.customerId === customerId).map(p => ({id:p.archiveId,name:p.projectName,periodId:p.periodId}))
    if (level === 'products' && extra) archiveOptions.value=extra
    if (level === 'products') productOptions.value = options.products.filter(p => p.productId && (!p.archiveId || p.archiveId === archiveId)).map(p => ({id:p.productId,name:p.productName}))
  } catch (e: any) {
    if (generation === optionGeneration[level]) {
      if (level === 'customers') customerOptions.value = []
      if (level === 'projects') projects.value = []
      if (level === 'products') productOptions.value = []
      error.value = e.message || '候选信息加载失败'
    }
  } finally { if (generation === optionGeneration[level]) optionBusy[level] = false }
}
function loadMore() {
  if (!['reports', 'records'].includes(screen.value) || listBusy.value || listError.value || !hasMore.value) return
  return loadList(page.value > 0)
}
async function loadList(append = false) {
  if (append && (listBusy.value || !hasMore.value)) return
  const generation = ++listGeneration
  const nextPage = append ? page.value + 1 : 1
  listBusy.value = true; listError.value = ''
  if (!append) { page.value = 0; cases.value = []; total.value = 0; hasMore.value = true }
  try {
    const scope = screen.value === 'reports' ? 'REPORTED' : relation.value === '我协助的' ? 'HELPING' : relation.value === '历史负责' ? 'HISTORY' : relation.value === '我负责的' ? 'RESPONSIBLE' : 'ALL'
    const workStatus = ({ 待处理: 'PENDING', 进行中: 'PROCESSING', 已完成: 'COMPLETED', 已关闭: 'CLOSED' } as Record<string, string>)[filter.value]
    const data = await repairOrderApi.list({ scope, pageNo: nextPage, pageSize: listPageSize, ...(workStatus ? { workStatus } : {}) })
    if (generation !== listGeneration) return
    const rows = data.records.map(row => repairCaseView(row) as LiveCase)
    cases.value = [...new Map([...(append ? cases.value : []), ...rows].map(row => [row.id, row])).values()]
    total.value = data.total; page.value = nextPage
    hasMore.value = data.records.length > 0 && nextPage * listPageSize < data.total
  } catch (e: any) { if (generation === listGeneration) listError.value = e.message || '列表加载失败' }
  finally { if (generation === listGeneration) listBusy.value = false }
}
const uploadedFiles = new Map<string, string>()
async function editReport() {
  if(selected.value?.actions.canEditReport!==true || submitting.value)return
  const order=selected.value.raw.order, oldFiles=[...reportFiles.value]
  if (!order.archiveId) { error.value='该历史报修未关联售后档案，无法使用档案报修修改接口';return }
  go('create');editingReport.value=order.id
  Object.assign(draft,{customerId:order.customerId,projectId:order.archiveId,fault:order.faultDescription || '',remark:order.reportRemark || '',photos:[],videos:[]})
  originalReporterName.value=order.reporterName || selected.value.applicant || reporterName.value
  selectedProducts.value=[...new Set<string>((selected.value.raw.products || []).map((p:any)=>p.productId).filter(Boolean))]
  originalReportProducts.value=(selected.value.raw.products || []).map((p:any)=>({productId:p.productId,assetId:p.assetId,serviceId:p.serviceId}))
  customer.value={id:order.customerId,name:selected.value.customer};project.value={id:order.archiveId,name:selected.value.project,periodId:order.periodId}
  reportTimestamp.value=dayjs(order.reportTime).valueOf();retainedReportFiles.value=oldFiles
  await Promise.all([loadOptions('projects'),loadOptions('products')])
}
function saveReportEdit() { void transact(async()=>{
  if(selected.value?.actions.canEditReport!==true || editingReport.value!==selectedId.value)throw new Error('当前报修不可修改，请返回详情核对')
  if(draft.projectId!==selected.value.raw.order.archiveId)throw new Error('修改报修不能变更所属档案')
  if(!reportChangeReason.value.trim() || reportChangeReason.value.trim().length>1000)throw new Error('请填写修改原因，最多 1000 字符')
  if(Object.values(optionBusy).some(Boolean))throw new Error('选项正在加载，请稍候')
  const input={archiveId:draft.projectId,products:reportProductRows(),faultDescription:draft.fault,reportTime:dayjs(reportTimestamp.value).format('YYYY-MM-DD HH:mm:ss'),reporterName:originalReporterName.value,reportRemark:draft.remark,fileIds:retainedReportFiles.value.map(f=>f.fileId)}
  repairReportPayload(input)
  if(retainedReportFiles.value.filter(f=>f.mediaType==='IMAGE').length+draft.photos.length>6 || retainedReportFiles.value.filter(f=>f.mediaType==='VIDEO').length+draft.videos.length>2)throw new Error('附件最多 6 张照片、2 段视频（含已有附件）')
  const candidates=await repairOrderApi.reportOptions({customerId:draft.customerId,archiveId:draft.projectId})
  if(!candidates.projects.some(p=>p.archiveId===draft.projectId && p.customerId===draft.customerId)||!selectedProducts.value.every(id=>candidates.products.some(p=>(!p.archiveId || p.archiveId===draft.projectId) && p.productId===id)))throw new Error('所选项目或产品已不可用，请重新选择')
  input.fileIds=[...new Set([...input.fileIds,...await files([...draft.photos,...draft.videos])])]
  return repairOrderApi.reportEdit(editingReport.value,input,reportChangeReason.value)
}) }
function openReportCancel(){if(selected.value?.actions.canCancelReport!==true)return;reportCancelReason.value='';go('reportCancel')}
function cancelReport(){void transact(async()=>{if(selected.value?.actions.canCancelReport!==true)throw new Error('当前报修不可取消，请返回详情核对');return repairOrderApi.reportCancel(selectedId.value,reportCancelReason.value)})}
async function createReport() {
  if(editingReport.value){saveReportEdit();return}
  if (mediaBusy.value || submitting.value || submitUncertain.value) return
  let posting = false
  try {
    const input = { archiveId: draft.projectId, products: reportProductRows(), faultDescription: draft.fault, reportTime: dayjs(reportTimestamp.value).format('YYYY-MM-DD HH:mm:ss'), reporterName: reporterName.value, reportRemark: draft.remark, fileIds: [] as string[] }
    repairReportPayload(input)
    if (Object.values(optionBusy).some(Boolean)) throw new Error('选项正在加载，请稍候')
    if (customer.value?.id !== draft.customerId || project.value?.id !== draft.projectId) throw new Error('请重新选择客户和项目')
    submitting.value = true
    const candidates = await repairOrderApi.reportOptions({customerId: draft.customerId, archiveId: draft.projectId})
    if (!candidates.projects.some(p => p.archiveId === draft.projectId && p.customerId === draft.customerId) || !selectedProducts.value.every(id => candidates.products.some(p => (!p.archiveId || p.archiveId === draft.projectId) && p.productId === id))) throw new Error('所选项目或产品已不可用，请重新选择')
    for (const path of [...draft.photos, ...draft.videos]) {
      if (!uploadedFiles.has(path)) uploadedFiles.set(path, await uploadRepairAttachment(path))
      input.fileIds.push(uploadedFiles.get(path)!)
    }
    posting = true
    const detail = await repairOrderApi.submit(input)
    const row = repairCaseView(detail) as LiveCase
    cases.value.unshift(row); selectedId.value = row.id; source.value = 'reports'
    Object.assign(draft, emptyDraft()); selectedProducts.value = []; customer.value = undefined; project.value = undefined; projects.value = []; productOptions.value = []; uploadedFiles.clear(); go('detail')
    message.value = '报修已提交，已由系统自动派单。'
    uni.showToast({title:'报修提交成功',icon:'success',duration:2000})
  } catch (e: any) {
    if (posting && e?.success !== false && e?.code == null) { submitUncertain.value = true; uni.setStorageSync(uncertainKey,true) }
    error.value = submitUncertain.value ? '提交结果暂未确认，请先返回报修列表核对，勿重复提交。' : e.message || '提交失败，请检查填写内容'
    scrollToTop()
  } finally { submitting.value = false }
}
function resolveReportUncertainty() {
  uni.showModal({title:'确认已核对报修列表',content:'若上次报修已创建，请勿再次提交。只有确认没有创建时才解除保护。',confirmText:'确认未创建',success:r => {if(r.confirm){submitUncertain.value = false;uni.removeStorageSync(uncertainKey)}}})
}
async function refreshSelected() {
  const id = selectedId.value
  const detail = await repairOrderApi.detail(id)
  const index = cases.value.findIndex(c => c.id === id)
  if (index >= 0) cases.value[index] = repairCaseView(detail) as LiveCase
}
function installDetail(data: any) {
  if (!data?.order?.id || data.order.id !== selectedId.value) return false
  const index = cases.value.findIndex(c => c.id === data.order.id)
  if (index < 0) return false
  const draft = screen.value === 'quote' ? currentLog.value : undefined
  const updated = repairCaseView(data) as LiveCase
  const pending = draft && updated.logs.find(log => log.id === draft.id && !log.endedAt)
  if (draft && pending) Object.assign(pending, {position:draft.position,fault:draft.fault,description:draft.description,result:draft.result,reason:draft.reason,photos:[...draft.photos],videos:[...draft.videos]})
  cases.value[index] = updated
  return true
}
function orderBase() {
  const order = selected.value?.raw.order
  if (!order?.id) throw new Error('请重新打开详情')
  return { orderId: order.id }
}
const mutationBlocked = ref(false)
async function transact(action: () => Promise<unknown>, target: Screen = 'detail') {
  if (submitting.value || mediaBusy.value) return
  if (mutationBlocked.value) { error.value = '上次操作结果需要核对。请返回列表，重新打开详情确认后再办理。'; return }
  submitting.value = true; error.value = ''
  let saved = false
  try {
    const detail = await action(); saved = true
    if ((detail as any)?.recordId && (detail as any)?.formStatus) installWork(detail)
    if (!installDetail(detail)) await refreshSelected()
    events.value = []; eventPage = 0; eventTotal.value = 0; showEvents.value = false
    go(target); message.value = '操作已提交成功'
    uni.showToast({title:'提交成功',icon:'success',duration:2000})
    return true
  } catch (e: any) { mutationBlocked.value = saved || e.uncertain === true; error.value = saved ? '操作已成功，但详情刷新失败。请返回列表重新查看，勿重复提交。' : e.uncertain ? '操作结果不确定，已暂停提交。请返回列表重新打开详情核对，勿直接重试。' : e.message || e.errMsg || '请求失败，请刷新核对后重试'; scrollToTop() }
  finally { submitting.value = false }
}
// Backend contract verified: GCJ02 coordinates plus optional abnormal evidence.
const repairLocationCheckEnabled = true
const locating = ref(false)
const clockLocation = ref<{name: string; address: string; latitude?: number; longitude?: number; accuracy?:number; acquiredAt?:number; coordinateSystem?:string; status: 'PENDING' | 'NORMAL' | 'OUT_OF_RANGE' | 'FAILED' | 'NO_SITE'}>({name:'尚未获取当前位置',address:'打卡前请先完成定位',status:'PENDING'})
const clockSites=ref<RepairSite[]>([]), clockAbnormalReason=ref(''), clockPhotos=ref<string[]>([])
let clockLocatedAt = 0, clockRequest = 0
async function refreshClockLocation() {
  const request = ++clockRequest, orderId=selectedId.value, forBegin=screen.value==='begin'
  clockSites.value=[]
  clockLocatedAt = 0; locating.value = true
  clockLocation.value = {name:'正在定位',address:'请保持定位权限开启',status:'PENDING'}
  try {
    if (typeof window !== 'undefined' && window.isSecureContext === false) throw new Error('当前网页无法定位，请使用 HTTPS 安全地址访问，并确认手机已信任证书')
    if(forBegin && repairLocationCheckEnabled) {
      const archiveId=selected.value?.raw?.order?.archiveId
      const sites=repairSites(await repairOrderApi.archiveLocations(archiveId))
      if(request!==clockRequest || orderId!==selectedId.value)return
      clockSites.value=sites
      if(!sites.length){clockLocation.value={name:'未配置有效位置',address:'请联系管理员维护售后项目位置后重试',status:'NO_SITE'};return}
      const verified=await getImplementationLocation()
      if(request!==clockRequest || orderId!==selectedId.value)return
      const nearest=nearestRepairSite(verified.latitude,verified.longitude,sites)
      clockLocation.value={...verified,status:nearest.status,name:nearest.status==='NORMAL'?`已进入“${nearest.site.locationName}”范围`:`距最近位置“${nearest.site.locationName}”约${Math.round(nearest.distance)}米`,address:`允许范围300米 · 定位精度约${Math.round(verified.accuracy)}米`}
      clockLocatedAt=verified.acquiredAt
      return
    }
    const p: any = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('定位超时，请重新定位')), 20000)
      uni.getLocation({type:'gcj02',geocode:true,isHighAccuracy:true,
        success: p => { clearTimeout(timer); resolve(p) },
        fail: () => { clearTimeout(timer); reject(new Error('定位失败，请开启系统及浏览器定位权限后重试')) },
      })
    })
    if (request !== clockRequest) return
    if (!Number.isFinite(p.longitude) || !Number.isFinite(p.latitude) || Math.abs(p.longitude) > 180 || Math.abs(p.latitude) > 90) throw new Error('定位坐标无效，请重新定位')
    const address = typeof p.address === 'string' ? p.address : [p.address?.province,p.address?.city,p.address?.district,p.address?.street,p.address?.streetNum].filter(Boolean).join('')
    clockLocation.value = {name: '当前位置', address: address || `经度 ${p.longitude.toFixed(6)}，纬度 ${p.latitude.toFixed(6)}`,longitude:p.longitude,latitude:p.latitude,status:'NORMAL'}
    clockLocatedAt = Date.now()
  } catch (e: any) { if (request === clockRequest) clockLocation.value = {name:'定位失败',address:e.message || '请重新定位',status:'FAILED'} }
  finally { if (request === clockRequest) locating.value = false }
}
function location() {
  if (locating.value || !['NORMAL','OUT_OF_RANGE'].includes(clockLocation.value.status)) throw new Error('请先完成定位后再打卡')
  if (Date.now() - clockLocatedAt > 120000) throw new Error('定位已超过 2 分钟，请重新定位后打卡')
  return {longitude:clockLocation.value.longitude!,latitude:clockLocation.value.latitude!,coordinateSystem:'GCJ02'}
}
watch(selectedId,()=>{++clockRequest;clockLocatedAt=0;locating.value=false;clockSites.value=[];clockAbnormalReason.value='';clockPhotos.value=[];clockLocation.value={name:'请重新定位',address:'维修单已切换',status:'PENDING'}})
onBeforeUnmount(()=>{++clockRequest})
watch(screen, value => { if (value === 'begin' || value === 'checkout') void refreshClockLocation(); else { ++clockRequest; locating.value = false; clockLocatedAt = 0 } })
async function files(paths: string[]) {
  const ids: string[] = []
  for (const path of paths) {
    if (!uploadedFiles.has(path)) uploadedFiles.set(path, await uploadRepairAttachment(path))
    ids.push(uploadedFiles.get(path)!)
  }
  return ids
}
async function startWork() {
  if (!selected.value?.actions.canStartWork) return
  clockAbnormalReason.value=''; clockPhotos.value=[]
  go('begin')
  beginMode.value = '线下'
}
function beginWork() {
  void transact(async () => {
    if (!selected.value?.actions.canStartWork) throw new Error('当前账号不能开始此维修单作业，请刷新详情')
    const orderId=selectedId.value, archiveId=selected.value.raw.order.archiveId, request=clockRequest
    const position = await location()
    let evidence: {abnormalReason?: string; photoFileIds?: string[]} = {}
    if (repairLocationCheckEnabled) {
      if(!isFreshLocation(clockLocation.value)) throw new Error('定位无效或已过期，请重新定位')
      const reason=clockAbnormalReason.value, photos=[...clockPhotos.value]
      repairAbnormalEvidence(clockLocation.value.status==='OUT_OF_RANGE',reason,photos)
      const sites=repairSites(await repairOrderApi.archiveLocations(archiveId))
      if(orderId!==selectedId.value || request!==clockRequest || screen.value!=='begin')throw new Error('维修单或定位已变化，请重新打卡')
      const nearest=nearestRepairSite(position.latitude,position.longitude,sites)
      clockSites.value=sites
      clockLocation.value={...clockLocation.value,status:nearest.status,name:nearest.status==='NORMAL'?`已进入“${nearest.site.locationName}”范围`:`距最近位置“${nearest.site.locationName}”约${Math.round(nearest.distance)}米`}
      const abnormal=nearest.status==='OUT_OF_RANGE'
      repairAbnormalEvidence(abnormal,reason,photos)
      const photoFileIds=abnormal ? await files(photos) : []
      if(orderId!==selectedId.value || request!==clockRequest || screen.value!=='begin')throw new Error('维修单或定位已变化，请重新打卡')
      if(!isFreshLocation(clockLocation.value))throw new Error('定位已过期，请重新定位；已填写原因和照片会保留')
      evidence=repairAbnormalEvidence(abnormal,reason,photoFileIds)
    }
    if(orderId!==selectedId.value || request!==clockRequest || screen.value!=='begin')throw new Error('维修单或定位已变化，请重新打卡')
    const detail = await repairOrderApi.begin({orderId,repairMethod:({线上:'ONLINE',线下:'OFFLINE',检修:'INSPECTION'})[beginMode.value],longitude:position.longitude,latitude:position.latitude,...evidence})
    if (!detail.recordId) throw Object.assign(new Error('签到响应缺少 recordId，请重新打开详情核对，勿重复签到'), {uncertain:true})
    // begin now returns an acknowledgement, not an order detail.
    if (detail.orderId !== orderId || detail.recordStatus !== 'ACTIVE') throw Object.assign(new Error('签到响应与当前工单不一致，请重新打开详情核对，勿重复签到'), {uncertain:true})
    try { installWork(await repairOrderApi.workDetail(orderId,detail.recordId)) }
    catch { throw Object.assign(new Error('签到已成功，但日志加载失败。请返回详情继续填写，勿重复签到'), {uncertain:true}) }
    return detail
  }, 'log')
}
async function saveLog(draftOnly = false) {
  if (resourceBusy.value) throw new Error('用料记录正在提交，请稍后保存日志')
  const invalid = (message: string): never => { if (!isAssistantWork.value) { logPage.value = 1; scrollToTop() }; throw new Error(message) }
  const log = currentLog.value
  const detail = workDetail.value
  if (!log || detail?.recordId !== log.id) throw new Error('请重新打开维修日志获取当前权限')
  if (detail.formStatus === 'SUBMITTED') throw new Error('维修日志已提交，不可修改；仅可在提交完工前补充签退')
  const permission = draftOnly ? 'canSaveDraft' : 'canSubmit'
  if (detail.actions?.[permission] !== true) throw new Error('当前记录不可执行此操作，请重新打开日志')
  if (!draftOnly && !log.description.trim()) invalid('请填写维修内容')
  if (!draftOnly && (log.description.length > 10000 || !isAssistantWork.value && log.fault.length > 10000)) invalid('维修内容及负责人故障描述最多各 10000 字符')
  if (!draftOnly && !isAssistantWork.value && !log.fault.trim()) invalid('请填写故障描述')
  const old = recordFiles(log.id)
  const photoCount = old.filter((a: any) => a.mediaType === 'IMAGE').length + log.photos.length
  const videoCount = old.filter((a: any) => a.mediaType === 'VIDEO').length + log.videos.length
  if (!draftOnly && !photoCount && !videoCount) invalid('请上传至少 1 张维修照片或 1 段视频')
  if (!draftOnly && (photoCount > 6 || videoCount > 2)) invalid('维修照片最多 6 张、视频最多 2 个（含已上传附件）')
  if (isAssistantWork.value) {
    const payload = {orderId:selectedId.value,recordId:log.id,repairDescription:log.description.trim(),
      fileIds:[...new Set([...log.fileIds,...await files(log.photos),...await files(log.videos)])]}
    return draftOnly ? repairOrderApi.saveDraft(payload) : repairOrderApi.submitWork(payload)
  }
  if (!draftOnly && !isAssistantWork.value) {
    for (const [flag,type,label] of [['hasInternalParticipants','INTERNAL','内协人员'],['hasExternalParticipants','EXTERNAL','外协单位']]) {
      if (log[flag] && !log.persons.some((p:any) => p.personType === type)) {
        logPage.value = 2; scrollToTop(); throw new Error(`请选择本次实际参与的${label}，或将参与选项改为“否”`)
      }
    }
  }
  let materialItems:any[]
  let outsources:any[]
  try {
    outsources = repairOutsources(log.persons,selected.value?.raw.members || [],draftOnly)
    materialItems = materialItemsPayload(log.materialItems || [],draftOnly,selected.value?.raw || {},actor.value.id,log.id,[])
  } catch (e:any) { logPage.value = 2; scrollToTop(); throw e }
  const payload = {orderId:selectedId.value,recordId:log.id,
    faultDescription:log.fault.trim(),repairDescription:log.description.trim(),
    fileIds:[...new Set([...log.fileIds,...await files(log.photos),...await files(log.videos)])],
    persons:log.persons.filter((p:any) => !isWorkSelf(p, actor.value.id) && !isWorkSelf(p, selected.value?.ownerId)).map((p:any) => ({personType:p.personType,sourcePersonId:p.sourcePersonId})),outsources,vehicleValue:log.vehicleValue || null,materialItems}
  return draftOnly ? repairOrderApi.saveDraft(payload) : repairOrderApi.submitWork(payload)
}
async function endWork() {
  const wantsCompletion = !isAssistantWork.value && checkoutNext.value === 'completion'
  if (completionSubmitted.value) { error.value = '已提交完工，不可再签退'; return }
  if (!isAssistantWork.value && !checkoutNext.value) { error.value = '请选择提交完成或需要复修'; return }
  const success = await transact(async () => {
    const position = location()
    if (workDetail.value?.actions?.canEnd !== true) throw new Error('请先提交维修日志，或刷新核对签退权限')
    const result = await repairOrderApi.end({orderId:selectedId.value,recordId:workDetail.value.recordId,location:position})
    workDetail.value = null; workDraft.value = null
    return result
  })
  if (success && wantsCompletion) {
    if (owner.value && !terminal.value && selected.value?.actions.canOwnerApply && selected.value.actions.canViewRepairDetail) openForm('completion')
    else message.value = '已签退。当前暂无提交完工权限，请在详情核对状态。'
  }
}
function submitLogForCheckout() { void transact(() => saveLog(), workDetail.value?.recordStatus === 'ENDED' ? 'detail' : 'checkout') }
const customerQuoteAmount = computed(() => {
  const current = selected.value
  if (!current) return null
  const quotation = current.raw.quotations?.find((q: any) => q.id === current.raw.order.latestQuotationId)
  const total = quotation?.totalAmount
  if (total != null && String(total).trim() !== '' && Number.isFinite(Number(total)) && Number(total) >= 0) return Number(total)
  if (!current.quoteItems.length || current.quoteItems.some(item => !Number.isFinite(item.qty) || !Number.isFinite(item.price))) return null
  return quoteTotal(current.quoteItems)
})
const customerPriceRemark = ref('')
const customerPriceChanged = computed(() => customerQuoteAmount.value != null && /^\d+(\.\d{1,2})?$/.test(priceInput.value.trim()) && Math.round(Number(priceInput.value) * 100) !== Math.round(customerQuoteAmount.value * 100))
function openForm(target: Screen) {
  if (target === 'approval' && reviewTask.value?.application.applicationType === 'QUOTATION') {
    const current = reviewTask.value
    showMore.value = false
    void quotationApprovalPopup.value?.open(String(current.workflow.id), {
      orderId:selectedId.value, applicationId:current.application.id, taskId:current.task.id,
    })
    return
  }
  if (target === 'quote') { if (!canFillQuotation.value) return; quoteRequired.value = selected.value?.raw.order.quotationRequired !== false; noQuoteReason.value = '' }
  if (target === 'completion') { completionDescription.value = ''; amountChangeReason.value = '' }
  if (target === 'customer') customerPriceRemark.value = ''
  quoteDraft.value = selected.value?.quoteItems.length ? selected.value.quoteItems.map(i => ({ ...i })) : []
  priceInput.value = target === 'customer' ? (customerQuoteAmount.value == null ? '' : customerQuoteAmount.value.toFixed(2)) : selected.value?.confirmedPrice == null ? '' : String(selected.value.confirmedPrice)
  approvalReason.value = ''; approvalDecision.value=''; go(target)
  faultScope.value = selected.value?.fault || ''
}
function amount() { if (!/^\d+(\.\d{1,2})?$/.test(priceInput.value.trim())) throw new Error('请输入非负金额，最多两位小数'); return Number(priceInput.value) }
function confirmPrice() { void transact(async () => {
  const quotation = selected.value!.raw.quotations?.find((q: any) => q.id === selected.value!.raw.order.latestQuotationId && q.stage === 'WAIT_CUSTOMER')
  if (!quotation) throw new Error('当前没有待客户确认的报价，请刷新')
  const confirmedAmount = amount()
  if (customerQuoteAmount.value == null) throw new Error('缺少审批通过的报价金额，请刷新后重试')
  if (customerPriceChanged.value && !customerPriceRemark.value.trim()) throw new Error('请填写金额变更原因')
  return repairOrderApi.customerPrice({orderId:selectedId.value,quotationId:quotation.id,amount:confirmedAmount,...(customerPriceChanged.value ? {remark:customerPriceRemark.value.trim()} : {})})
}) }
function complete() { void transact(async () => {
  if (completionMissingQuotation.value && completionQuotationChoice.value !== false) throw new Error('请选择是否需要报价；需要报价请先填写报价单')
  if (!completionDescription.value.trim()) throw new Error('请填写完工说明')
  if (completionMissingQuotation.value) {
    if (!canFillQuotation.value) throw new Error('当前不可修改报价决定，请刷新核对')
    const decided = await repairOrderApi.quotation({orderId:selectedId.value,quotationRequired:false,reason:completionDescription.value.trim()})
    try {
      if (!installDetail(decided)) await refreshSelected()
      if (selected.value?.raw.order.quotationRequired !== false) throw new Error('无需报价决定尚未确认，请重新打开详情核对')
    } catch (e:any) { e.uncertain = true; throw e }
  }
  if (completionNeedsPrice.value && selected.value?.confirmedPrice == null) throw new Error('缺少已审批并经客户确认的价格，请先刷新核对报价')
  if (completionPriceChanged.value && !amountChangeReason.value.trim()) throw new Error('请填写价格变更原因')
  const data = {orderId:selectedId.value, description:completionDescription.value.trim(),finalAmount:completionNeedsPrice.value ? amount() : 0,...(completionPriceChanged.value ? {amountChangeReason:amountChangeReason.value.trim()} : {})}
  return repairOrderApi.completion(data)
}) }
async function review(approved: boolean) {
  const originalTask=reviewTask.value
  const orderId=selectedId.value
  const applicationId=originalTask?.application.id || ''
  const wasMerged=mergedApproval.value
  const previous=new Set(availableAssignments(selected.value?.raw || {},actor.value.id,applicationId).map((d:any)=>d.departmentId))
  const saved=await transact(async () => {
  const task = reviewTask.value
  if (!task) throw new Error('没有可办理的审批任务，请刷新')
  if (!approved && !approvalReason.value.trim()) throw new Error('请填写驳回原因')
  const data = {applicationId:task.application.id,instanceId:task.workflow.id,taskId:task.task.id,approve:approved,comment:approvalReason.value.trim(),...(!approved && task.application.applicationType === 'COMPLETION' ? {returnType:returnType.value} : {})}
  if(wasMerged && !mergedPending.value){
    if(approved && (candidateLoading.value || candidateError.value))throw new Error(candidateError.value || '正在加载候选人员')
    mergedPending.value={...data,requestId:`review-${Date.now()}-${Math.random().toString(36).slice(2)}`,...approvalAssignments(reviewCandidates.value,reviewChosen.value,approved)}
  }
  let result
  try{result=await repairOrderApi.review(wasMerged ? mergedPending.value! : data)}
  catch(e:any){
    if(e.success===false)mergedPending.value=undefined
    if(wasMerged && mergedPending.value)throw new Error('审批结果未确认，请使用原名单重试本次审批')
    throw e
  }
  mergedPending.value=undefined
  chosenReviewTaskId.value='';approvalReason.value=''
  return result
})
  if(wasMerged || !saved || !approved || !applicationId || selectedId.value!==orderId)return
  await nextTick()
  if(selectedId.value!==orderId || screen.value!=='detail')return
  const eligible=availableAssignments(selected.value?.raw || {},actor.value.id,applicationId)
  const targets=eligible.filter((d:any)=>d.departmentId===originalTask?.task.departmentId || !previous.has(d.departmentId))
  if(targets.length){
    message.value='审批已通过，请依次指定本部门内协人员；稍后也可从待办继续办理'
    collaborationPanel.value?.showAssignments(targets)
  }
}
function sendQuotation() { void transact(async () => {
  if (!canFillQuotation.value) throw new Error('当前不能修改报价决定，请刷新核对')
  if (quotationAwaitingWithdrawal.value) throw new Error('报价已提交，请先撤回后再修改报价决定或明细')
  if (quoteRequired.value && !faultScope.value.trim()) throw new Error('请填写故障范围')
  if (!quoteRequired.value && !noQuoteReason.value.trim()) throw new Error('请填写无需报价原因')
  if (quoteRequired.value && (!quoteDraft.value.length || quoteDraft.value.length > 200 || quoteDraft.value.some(i => !i.name.trim() || !/^\d+(\.\d{1,3})?$/.test(String(i.qty)) || Number(i.qty) <= 0 || !/^\d+(\.\d{1,2})?$/.test(String(i.price))))) throw new Error('请检查报价名称、数量和单价，明细须为 1 至 200 项')
  const data = {orderId:selectedId.value, quotationRequired:quoteRequired.value,
    ...(quoteRequired.value ? {faultScope:faultScope.value.trim(),items:quoteDraft.value.map(i => ({itemName:i.name.trim(),quantity:Number(i.qty),unitPrice:Number(i.price)}))} : {reason:noQuoteReason.value.trim()})}
  return repairOrderApi.quotation(data)
}) }
function sendException() { void transact(async () => {
  if (!selected.value || !owner.value || terminal.value || !selected.value.actions.canOwnerApply) throw new Error('当前不能提交此申请，请刷新维修详情')
  if (!exceptionReason.value || !exceptionRemark.value.trim()) throw new Error('请填写原因和说明')
  const data = {...orderBase(),reason:`${exceptionReason.value}：${exceptionRemark.value.trim()}`}
  if (exceptionType.value === '转单') {
    if (!targetUserId.value || targetUserId.value === selected.value.ownerId || !transferOptions.value.some(p => p.value === targetUserId.value)) throw new Error('请选择有效且不同于当前维修人的接单人')
    return repairOrderApi.transfer({...data,targetUserId:targetUserId.value})
  } else {
    const closeType = ({客户弃修:'CUSTOMER_ABANDONED',不是问题:'NOT_A_PROBLEM',其他:'OTHER'} as Record<string,string>)[exceptionReason.value]
    if (!closeType) throw new Error('请选择有效的关闭原因')
    return repairOrderApi.close({...data,closeType})
  }
}) }
interface FooterAction { text: string; action: () => void; primary?: boolean; disabled?: boolean }
const latestQuotation = computed(() => selected.value?.raw.quotations?.find((q:any) => q.id === selected.value?.raw.order.latestQuotationId))
const quotationApplication = computed(() => {
  const list = (selected.value?.raw.applications || []).filter((a:any) => a.applicationType === 'QUOTATION')
  if (latestQuotation.value?.applicationId) return list.find((a:any) => a.id === latestQuotation.value.applicationId)
  const pending = list.filter((a:any) => a.applicationStatus === 'PENDING')
  return pending.length === 1 ? pending[0] : undefined
})
const canWithdrawQuotation = computed(() => !quotationLockedMessage.value && !!latestQuotation.value && selected.value?.raw.order.quotationStatus === 'HEAD_REVIEW' && quotationApplication.value?.applicationStatus === 'PENDING' && quotationApplication.value?.applicantUserId === actor.value.id && quotationApplication.value?.canWithdraw !== false)
async function withdrawQuotation() {
  const items = selected.value?.quoteItems.map(i => ({...i})) || [], scope = latestQuotation.value?.faultScope || selected.value?.fault || ''
  const success = await transact(async () => {
    if (!canWithdrawQuotation.value) throw new Error('当前报价不可撤回，请刷新详情')
    return repairOrderApi.withdraw({applicationId:quotationApplication.value.id,reason:'撤回修改报价'})
  })
  if (!success) return
  showQuoteDetails.value = false
  if (canFillQuotation.value) { openForm('quote'); quoteDraft.value = items; faultScope.value = scope }
  else message.value = '已撤回，当前接口尚未开放报价编辑，请刷新核对'
}
const quotationLockedMessage = computed(() => quotationLockReason(selected.value?.raw || {}))
const canFillQuotation = computed(() => canChangeRepairQuotation(selected.value?.raw || {}))
const quotationAwaitingWithdrawal = computed(() => ['HEAD_REVIEW','GM_REVIEW','WAIT_CUSTOMER'].includes(selected.value?.raw.order.quotationStatus))
const canEditNoQuotation = computed(() => canFillQuotation.value && (selected.value?.raw.order.quotationRequired === false || selected.value?.quotationStatus === 'NOT_REQUIRED'))
const quotationEntryText = computed(() => canEditNoQuotation.value ? '修改报价信息' : latestQuotation.value ? '查看详情' : canFillQuotation.value ? '办理报价' : '')
const canEditQuotationDetails = computed(() => !!latestQuotation.value && canFillQuotation.value && !['HEAD_REVIEW','GM_REVIEW','WAIT_CUSTOMER','CONFIRMED'].includes(selected.value?.raw.order.quotationStatus))
function openQuotationEntry() {
  if (submitting.value || showQuoteDetails.value) return
  if (canEditNoQuotation.value) { editQuotationDetails(); return }
  if (latestQuotation.value) { showQuoteDetails.value = true; error.value = '' }
  else if (canFillQuotation.value) openForm('quote')
}
function editQuotationDetails() {
  if ((!canEditQuotationDetails.value && !canEditNoQuotation.value) || submitting.value || mutationBlocked.value) return
  showQuoteDetails.value = false; openForm('quote')
  faultScope.value = latestQuotation.value?.faultScope || selected.value?.fault || ''
  noQuoteReason.value = latestQuotation.value?.noQuoteReason || ''
}
const canShowMore = computed(() => screen.value === 'detail' && source.value !== 'reports' && (selected.value?.actions.canEditReport === true || selected.value?.actions.canCancelReport === true || selected.value?.actions.canOwnerApply === true || canFillQuotation.value || additionalActions.value.length>0 || !!currentLog.value || reviewTasks.value.length>0 || selected.value?.actions.canStartWork === true))
const footerActions = computed<FooterAction[]>(() => {
  const c = selected.value
  const primary = (text: string, action: () => void): FooterAction[] => [{ text, action, primary: true }]
  if (screen.value === 'create') return [{text:editingReport.value?'保存修改':'提交报修',action:createReport,primary:true,disabled:editingReport.value ? mutationBlocked.value : submitUncertain.value}]
  if (!c || !canViewSelected.value) return []
  if(screen.value==='reportCancel')return c.actions.canCancelReport ? [{text:'确认取消报修',action:cancelReport,primary:true,disabled:mutationBlocked.value}]:[]
  if (screen.value === 'logList') return [{text:'返回维修详情',action:()=>go('detail')}]
  if (screen.value === 'logDetail') {
    if (logDetailLoading.value || !viewedWork.value) return []
    const actions = viewedWork.value.actions || {}
    return [...(viewedWork.value.formStatus !== 'SUBMITTED' && (actions.canSaveDraft || actions.canSubmit) ? [{text:'编辑本次日志',action:()=>{void openWork(expandedLogId.value)},disabled:workLoading.value}] : []), ...(actions.canEnd && !completionSubmitted.value ? [{text:'去签退',action:()=>{void openWork(expandedLogId.value,'checkout')},primary:true,disabled:workLoading.value}] : [])]
  }
  if (screen.value === 'additional') return additionalActions.value.includes(additionalKind.value) ? [{text:additionalKind.value==='evaluation'?'提交评价':additionalKind.value==='clockCorrection'?'提交审批':'确认提交',action:()=>additionalForm.value?.submit(),primary:true,disabled:mutationBlocked.value}] : []
  if (screen.value === 'detail') {
    if (reviewTasks.value.length) return primary('办理审批', () => { chosenReviewTaskId.value='';openForm('approval') })
    if (source.value === 'reports') return [...(c.actions.canCancelReport ? [{text:'取消报修',action:openReportCancel}]:[]),...(c.actions.canEditReport ? [{text:'修改报修',action:()=>{void editReport()},primary:true}]:[]),...(c.actions.canViewRepairDetail ? primary('维修详情', () => { source.value = 'records'; scrollToTop() }) : [])]
    if (reviewTask.value) return primary('办理审批', () => openForm('approval'))
    if (c.actions.canEvaluate) return primary('回访评价',()=>openAdditional('evaluation'))
    if (currentLog.value) return [{text:'继续本次作业',action:() => { void openWork(currentLog.value.id) },primary:true,disabled:workLoading.value}]
    if (c.actions.canOwnerApply && c.quotationStatus === 'WAIT_CUSTOMER') return primary('客户确认维修', () => openForm('customer'))
    if (c.actions.canStartWork) return primary(isAssistantWork.value ? '填写维修日志' : c.logs.length ? '继续维修' : '开始维修', startWork)
    return []
  }
  if (screen.value === 'approval' && reviewTask.value && isInternalCollaborationApproval.value) {
    if(mergedPending.value)return [{text:'重试本次审批',action:()=>review(mergedPending.value!.approve === true),primary:true}]
    if(!approvalDecision.value)return [
      {text:'驳回',action:()=>{approvalDecision.value='reject';approvalReason.value=''}},
      {text:'同意',action:()=>{approvalDecision.value='approve';approvalReason.value=''},primary:true},
    ]
    return [{text:'重新选择',action:()=>{approvalDecision.value='';approvalReason.value=''}},
      {text:approvalDecision.value==='reject'?'确认驳回':mergedApproval.value?'确认同意':'确认同意并继续',action:()=>review(approvalDecision.value==='approve'),primary:true}]
  }
  if (screen.value === 'approval' && reviewTask.value) return [{ text: '驳回', action: () => review(false) }, { text: '审批通过', action: () => review(true), primary: true }]
  if (screen.value === 'begin' && c.actions.canStartWork) return [{text:'签到打卡',action:beginWork,primary:true,disabled:locating.value || !['NORMAL','OUT_OF_RANGE'].includes(clockLocation.value.status)}]
  if (screen.value === 'checkout' && currentLog.value) return [{text:'返回维修详情',action:() => go('detail')}, {text:'确认并签退',action:endWork,primary:true,disabled:completionSubmitted.value || workDetail.value?.actions?.canEnd !== true || locating.value || clockLocation.value.status !== 'NORMAL' || (!isAssistantWork.value && !checkoutNext.value)}]
  if (screen.value === 'log' && currentLog.value) {
    const blocked = mediaBusy.value || resourceBusy.value
    if (workDetail.value?.formStatus === 'SUBMITTED') return workDetail.value?.actions?.canEnd && !completionSubmitted.value ? [{text:'去签退',action:() => go('checkout'),primary:true,disabled:blocked}] : []
    if (!isAssistantWork.value) return [
      ...(logPage.value > 0 ? [{text:'上一步',action:() => changeLogPage(logPage.value - 1),disabled:blocked}] : []),
      ...(logPage.value < 2 ? [{text:'下一步',action:() => changeLogPage(logPage.value + 1),primary:true,disabled:blocked}] : [
        ...(workDetail.value?.actions?.canSaveDraft ? [{text:'保存草稿',action:() => { void transact(() => saveLog(true), 'log') },disabled:blocked}] : []),
        ...(workDetail.value?.actions?.canSubmit ? [{text:'提交日志，去签退',action:submitLogForCheckout,primary:true,disabled:blocked}] : []),
      ]),
    ]
    return [...(workDetail.value?.actions?.canSaveDraft ? [{text:'保存草稿',action:() => { void transact(() => saveLog(true), 'log') }}] : []), ...(workDetail.value?.actions?.canSubmit ? primary('提交日志，去签退', submitLogForCheckout) : [])]
  }
  if (screen.value === 'quote') return canFillQuotation.value ? primary(quoteRequired.value ? '提交报价审批' : '登记无需报价', sendQuotation) : []
  if (!owner.value || terminal.value || !c.actions.canOwnerApply) return []
  if (screen.value === 'assistance') return primary('提交协助申请', () => assistanceForm.value?.submit())
  if (screen.value === 'materials') return primary(`提交${materialType.value}申请`, () => materialForm.value?.submit())
  if (screen.value === 'customer') return primary('确认维修价格', confirmPrice)
  if (screen.value === 'completion') return completionMissingQuotation.value
    ? (canFillQuotation.value ? primary(completionQuotationChoice.value === true ? '去填写报价单' : '提交完工审批', completionQuotationChoice.value === true ? () => openForm('quote') : complete) : [])
    : primary('提交完工审批', complete)
  if (screen.value === 'exception') return primary(`提交${exceptionType.value}申请`, sendException)
  return []
})
async function openException(type: '转单' | '关闭') {
  transferOptions.value = []
  exceptionType.value = type; exceptionReason.value = ''; exceptionRemark.value = ''; targetUserId.value = ''; go('exception')
  if (type === '转单') try { transferOptions.value = (await readOperationsUsers()).filter(p => p.value !== selected.value?.ownerId) } catch (e: any) { error.value = e.message || '运维部人员加载失败' }
}
const moreGroups = computed(() => {
  const c = selected.value
  if (!c || !canShowMore.value) return []
  const work: FooterAction[] = [...footerActions.value]
  if (currentLog.value && !work.some(op => op.text === '继续本次作业')) work.push({text:'继续本次作业',action:()=>{void openWork(currentLog.value!.id)},disabled:workLoading.value})
  if (c.actions.canOwnerApply && c.quotationStatus === 'WAIT_CUSTOMER' && !work.some(op=>op.text==='客户确认维修')) work.push({text:'客户确认维修',action:()=>openForm('customer')})
  if (!currentLog.value && c.actions.canStartWork && !work.some(op => op.text === '继续维修' || op.text === '开始维修')) work.push({ text: '再开始一次维修', action: startWork })
  if (c.actions.canOwnerApply) work.push({text:'提交完工',action:() => openForm('completion')})
  if(c.actions.canEditReport)work.push({text:'修改报修',action:()=>{void editReport()}})
  if(c.actions.canCancelReport)work.push({text:'取消报修',action:openReportCancel})
  return [
    ...(work.length ? [{ title: '维修办理', items: work }] : []),
    ...([{title:'回访评价',kinds:['evaluation']},{title:'其他申请撤回',kinds:['withdraw']}].map(group=>({title:group.title,items:group.kinds.filter(kind=>additionalActions.value.includes(kind as RepairAdditionalKind)).map(kind=>({text:repairActionTitles[kind as RepairAdditionalKind],action:()=>openAdditional(kind as RepairAdditionalKind)}))})).filter(group=>group.items.length)),
    ...(canInviteCollaboration(c.raw,actor.value.id) ? [{title:'协助办理',items:[{text:'邀请协助',disabled:submitting.value || mutationBlocked.value,action:()=>openAssistance()}]}] : []),
    ...(c.actions.canOwnerApply ? [{ title: '物料办理', items: [{ text: '领料申请', action: () => openMaterials('领料') }, { text: '申请还料', action: () => openMaterials('还料') }] },
    { title: '单据流转', items: [{ text: '申请转单', action: () => openException('转单') }, { text: '申请关闭', action: () => openException('关闭') }] }] : []),
  ]
})
function runMore(op: FooterAction) { if (op.disabled) return; showMore.value = false; op.action() }
</script>

<style scoped lang="scss">
@use './preview.scss';
.log-date-clear { margin:0; padding:0 10px; min-height:44px; line-height:44px; font-size:13px; color:#176ac7; background:transparent; }
.backfill-actions { display: flex; gap: 12px; margin-top: 20px; }
.backfill-actions .btn { flex: 1; min-height: 44px; }
.backfill-error { display: block; margin-top: 12px; color: #b42318; font-size: 14px; line-height: 1.6; }
.approval-assignees__department { display: flex; flex-direction: column; gap: 8px; margin: 16px 0; }
.approval-assignees__members { display: flex; flex-wrap: wrap; gap: 8px; }
.approval-assignees__members button { margin: 0; padding: 0 12px; min-height: 44px; font-size: 14px; }
.approval-assignees__members .is-selected { color: #245eaa; background: #eaf2ff; }

.ops-form-page .field-label { margin-bottom:10px; font-size:15px; line-height:1.5; color:#344054; }
.ops-form-page .spaced { margin-top:24px; }
.ops-form-page .picker-value, .ops-form-page .input { min-height:48px; box-sizing:border-box; padding:12px; border:1px solid #d5dce5; border-radius:8px; background:#f8fafc; font-size:16px; line-height:1.5; }
.ops-form-page .picker-value { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.ops-form-page .picker-value > text { min-width:0; overflow-wrap:anywhere; }
.ops-form-page .textarea { width:100%; height:120px; box-sizing:border-box; padding:12px; border:1px solid #d5dce5; border-radius:8px; background:#f8fafc; font-size:16px; line-height:1.65; }
.ops-form-page .choices { margin:16px 0; gap:10px; }
.ops-form-page .quote-line { padding:20px 0; }
.application-project { display:block; color:#202939; font-size:17px; font-weight:600; line-height:1.6; margin-bottom:8px; overflow-wrap:anywhere; }
.application-field + .application-field { margin-top:24px; }
.ops-form-page .application-placeholder { color:#667085; }
.ops-form-page .application-remark { height:144px; }
.application-help { display:block; margin-top:8px; color:#667085; font-size:14px; line-height:1.6; }
.application-count { display:block; margin-top:8px; text-align:right; color:#667085; font-size:12px; }
.application-notice { display:flex; align-items:flex-start; gap:8px; margin:4px 12px 20px; padding:12px 14px; border-radius:8px; background:#eaf4ff; color:#245b91; font-size:14px; line-height:1.65; }
.application-notice > text { flex:1; min-width:0; }
.repair-log-overview { display:flex; justify-content:space-between; gap:12px; font-size:14px; color:#536176; padding-bottom:8px; }
.report-row { display:flex; align-items:flex-start; gap:12px; width:100%; box-sizing:border-box; padding:12px 0; font-size:15px; line-height:24px; }
.report-label { flex:0 0 64px; color:#606266; text-align:left; }
.report-value { flex:1; min-width:0; color:#303133; text-align:left; white-space:pre-wrap; overflow-wrap:anywhere; word-break:break-word; }
.report-customer { margin:0; border:0; border-radius:0; background:transparent; text-align:left; font-weight:400; }
.report-customer::after { border:0; }
.report-customer .report-value { color:#1769bb; }
.report-customer:focus-visible { outline:2px solid #1769bb; outline-offset:2px; }
.report-extra { border-top:1px solid #edf0f3; margin-top:4px; padding-top:4px; }
.report-attachments-row { align-items:center; }
.fold-button.report-expand { justify-content:center; gap:8px; margin-top:12px; padding:12px 0 0; border-top:1px solid #edf0f3; }
.report-expand::after { border:0; }
.contact-sheet { max-height:70vh; overflow-y:auto; }
.quotation-error { display:block; margin-top:12px; color:#b42318; font-size:14px; line-height:1.6; }
.quotation-entry { flex:none; min-height:44px; margin:-8px 0; padding:0 4px; line-height:44px; background:transparent; color:#1769c2; font-size:14px; border:0; }
.quotation-entry::after { border:0; }
.quotation-entry:focus-visible { outline:2px solid #1769c2; outline-offset:2px; }
.quotation-context { display:flex; flex-direction:column; gap:4px; padding-bottom:16px; color:#344054; font-size:15px; line-height:1.6; overflow-wrap:anywhere; }
.quotation-context > text:last-child { color:#536176; font-size:14px; }
.quotation-switch { display:flex; gap:4px; padding:4px; background:#f2f4f7; border-radius:8px; }
.quotation-switch button { flex:1; min-width:0; margin:0; padding:0 8px; min-height:44px; line-height:44px; font-size:15px; background:transparent; color:#536176; border-radius:6px; }
.quotation-switch button.active { background:#eaf4ff; color:#1769c2; font-weight:600; }
.quotation-switch button::after, .quotation-item-head button::after, .quotation-add::after { border:0; }
.quotation-field { margin-top:20px; }
.ops-form-page .quotation-textarea { height:112px; min-height:112px; }
.quotation-note { display:block; margin-top:12px; color:#536176; font-size:13px; line-height:1.6; }
.quotation-count { color:#536176; font-size:14px; }
.quotation-item { padding:0 0 16px; margin-bottom:16px; border-bottom:1px solid #edf0f3; }
.quotation-item-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:8px; }
.ops-form-page .quotation-item-head .field-label { margin-bottom:0; }
.quotation-item-head button { margin:0; padding:0 4px; min-width:44px; min-height:44px; line-height:44px; font-size:14px; color:#b42318; background:transparent; }
.quotation-item-head button[disabled] { color:#667085; }
.quotation-inputs { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; margin-top:16px; }
.quotation-inputs > view { min-width:0; }
.quotation-subtotal { display:flex; justify-content:flex-end; gap:12px; margin-top:12px; color:#536176; font-size:14px; line-height:1.6; font-variant-numeric:tabular-nums; }
.quotation-add { display:flex; align-items:center; justify-content:center; gap:8px; width:100%; min-height:44px; margin:0; padding:8px 12px; border:1px dashed #a6c8ff; border-radius:8px; background:#f5f9ff; color:#1769c2; font-size:15px; line-height:24px; }
.quotation-total { display:flex; align-items:baseline; justify-content:space-between; gap:12px; padding-top:20px; font-size:15px; color:#344054; }
.quotation-total > text:last-child { color:#1769c2; font-size:22px; font-weight:600; overflow-wrap:anywhere; font-variant-numeric:tabular-nums; }
.log-detail-heading { display:flex; flex-direction:column; gap:8px; padding:18px 16px; margin:12px; background:#fff; border-radius:12px; }
.log-detail-title { font-size:20px; font-weight:600; line-height:1.5; color:#303133; overflow-wrap:anywhere; }
.log-detail-meta { display:flex; flex-wrap:wrap; align-items:center; gap:8px 16px; }
.log-detail-role { font-size:13px; color:#176ac7; }
.log-clock-section + .log-clock-section { margin-top:12px; padding-top:16px; border-top:1px solid #edf0f3; }
.log-clock-section.log-clock-abnormal text { color:#b42318; }
.log-clock-note { margin-top:12px; color:#606266; font-size:13px; line-height:1.6; overflow-wrap:anywhere; }
.repair-log-item { margin-bottom:12px; background:#fff; border-radius:12px; }
.repair-log-item:last-child { border-bottom:0; }
.repair-log-toggle { display:block; width:100%; margin:0; padding:16px; background:transparent; text-align:left; line-height:1.6; border-radius:12px; }
.repair-log-toggle::after { border:0; }
.repair-log-heading { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; font-size:16px; color:#303133; font-weight:600; }
.repair-log-mode { display:block; margin-top:3px; font-weight:400; color:#606266; font-size:13px; }
.repair-log-state { flex-shrink:0; padding:2px 8px; border-radius:4px; font-size:12px; color:#536176; background:#f1f3f5; font-weight:400; }
.repair-log-state.is-active { color:#176ac7; background:#edf5ff; }
.repair-log-time { display:block; color:#536176; font-size:14px; margin-top:4px; }
.repair-log-summary { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; color:#303133; font-size:15px; margin-top:8px; overflow-wrap:anywhere; }
.repair-log-content { padding:0 0 16px; }
.repair-log-toggle:focus-visible { outline:2px solid #176ac7; outline-offset:2px; }
.log-pagination { margin:12px 0; }
.log-pagination__steps { display:flex; padding:14px 0 4px; gap:6px; }
.log-pagination__step { flex:1; min-width:0; display:flex; align-items:center; justify-content:center; gap:4px; padding:8px 3px; font-size:13px; color:#606266; text-align:center; background:#eee; border-radius:6px; }
.log-pagination__step.on { color:#176ac7; font-weight:600; background:#eaf4ff; }
.log-pagination__step.done { color:#267b54; background:#edf8f2; }
.repair-steps { padding: 12px 16px; margin-bottom: 12px; background: #fff; border-radius: 12px; }
.repair-steps__labels { display: flex; justify-content: space-between; gap: 12px; margin-top: 8px; color: #536176; font-size: 14px; }
.repair-steps__labels .active { color: #176ac7; font-weight: 600; }
/* Above the tab bar (998), but not above UniApp's native picker/toast layer (999). */
.workflow { position: fixed; inset: 0; z-index: 999; color: #333; background: #f3f5f8; font-size: 14px; overflow-wrap: anywhere; }
.workflow-shell { height: 100%; background: #f3f5f8; }
.workflow-body { flex: 1; height: 0; min-height: 0; }
.workflow-content { box-sizing: border-box; max-width: 760px; margin: 0 auto; padding: 12px 12px calc(24px + env(safe-area-inset-bottom)); }
.workflow-content.with-actions, .workflow-content.with-add { padding-bottom: calc(100px + env(safe-area-inset-bottom)); }
.workflow-content :deep(.section-card) { margin: 0 0 12px; }
.readonly-note { display: block; font-size: 12px; line-height: 1.7; color: #667085; margin-top: 8px; }
.loading-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 44px; color: #667085; font-size: 12px; }
.loading-toolbar button { margin: 0; padding: 0 4px 0 12px; min-height: 44px; line-height: 44px; background: transparent; color: #176ac7; font-size: 12px; }
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
.report-time-trigger { display:flex; align-items:center; justify-content:space-between; gap:12px; min-height:48px; padding:0 12px; border:1px solid #dce3ec; border-radius:10px; background:#f6f8fa; color:#172b4d; font-size:15px; font-variant-numeric:tabular-nums; }
.form-row picker { flex: 1; min-width: 0; }
.picker-value { display: flex; align-items: center; justify-content: space-between; min-height: 44px; gap: 12px; }
.report-text-field { margin-bottom: 20px; }
.report-field-heading { display: flex; align-items: baseline; gap: 8px; margin-bottom: 10px; color: #344054; font-size: 14px; line-height: 22px; }
.report-optional { color: #667085; font-size: 12px; }
.report-text-box { padding: 12px; background: #f7f8fa; border: 1px solid #dce1e8; border-radius: 10px; }
.report-text-box:focus-within { border-color: #176ac7; }
.report-textarea { display: block; width: 100%; height: 112px; box-sizing: border-box; padding: 0; color: #202939; font-size: 16px; line-height: 1.6; background: transparent; }
.report-textarea--remark { height: 80px; }
:deep(.report-placeholder) { color: #727c8b; font-size: 14px; line-height: 1.6; }
.report-count { display: block; margin-top: 8px; color: #667085; font-size: 12px; line-height: 18px; text-align: right; }
.spaced { margin-top: 16px; }
.full { width: 100%; }
.input, .textarea { font-size: 16px; }
.case-list { display: flex; flex-direction: column; gap: 12px; background: transparent; }
.case-card { cursor: pointer; box-sizing: border-box; min-width: 0; padding: 16px; background: #fff; border: 1px solid #e8edf3; border-radius: 12px; overflow-wrap: anywhere; }
.case-card:active { background: #f5f8fc; }
.card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
.card-head .badge { flex-shrink: 0; }
.card-no { min-width: 0; color: #667085; font-size: 12px; overflow-wrap: anywhere; }
.card-name { margin-bottom: 12px; color: #202939; font-size: 17px; font-weight: 600; line-height: 1.5; }
.case-card .kv { align-items: flex-start; gap: 12px; padding: 4px 0; }
.case-card .kv > text:first-child { flex: 0 0 64px; }
.card-statuses { display:flex; flex-direction:column; align-items:flex-end; gap:4px; flex-shrink:0; }
.card-approval { color:#176ac7; font-size:12px; line-height:1.5; }
.fault-summary { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.card-progress { display: flex; align-items: center; justify-content: space-between; gap: 12px; background: #f0f7ff; border-radius: 8px; padding: 10px; margin-top: 12px; color: #176ac7; font-size: 13px; line-height: 1.5; }
.card-progress .waiting { margin: 0; }
.badge--closed { background: #f0f1f3; color: #596574; }
.fold-button { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; min-height: 44px; margin: 0; padding: 8px 0; line-height: 1.5; color: #176ac7; background: transparent; font-size: 14px; text-align: left; }
.case-card:focus-visible, button:focus-visible { outline: 2px solid #176ac7; outline-offset: 2px; }
.waiting { display: block; margin-top: 8px; color: #886013; }
.list-status { padding: 16px 12px; text-align: center; color: #667085; font-size: 13px; line-height: 1.6; }
.list-status text { display: block; }
.list-status button { min-height: 44px; line-height: 44px; margin: 4px auto 0; padding: 0 16px; background: transparent; color: #176ac7; font-size: 14px; }
.list-status button::after { border: 0; }
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
.assist-approval-type { display:block;margin:4px 0 16px;font-size:16px;font-weight:600;color:#344054; }
.assist-approval-entry { padding:0 0 18px;margin:0 0 18px;border-bottom:1px solid #edf0f3; }
.assist-approval-target { display:flex;align-items:flex-start;gap:16px;font-size:15px;line-height:1.7; }
.assist-approval-target > text:first-child:not(:last-child) { flex-shrink:0;color:#667085; }
.assist-approval-target > text:last-child { min-width:0;overflow-wrap:anywhere;color:#344054;font-weight:600; }
.assist-approval-label { display:block;margin-top:14px;font-size:14px;color:#667085; }
.assist-approval-reason { display:block;margin-top:6px;font-size:16px;line-height:1.75;color:#344054;white-space:pre-wrap;overflow-wrap:anywhere; }
button::after { border: none; }
button[disabled] { opacity: .5; }
.event-timeline { padding:12px 0 0 6px; }
.event-toggle { display:flex; align-items:center; gap:6px; margin:0; padding:0 4px 0 12px; min-height:44px; background:transparent; color:#176ac7; font-size:13px; line-height:1.5; }
.event-toggle::after { border:0; }
.event-toggle:focus-visible { outline:2px solid #176ac7; outline-offset:2px; }
.event-item { position:relative; padding:0 0 22px 20px; }
.event-item::before { content:''; position:absolute; left:0; top:6px; width:7px; height:7px; background:#176ac7; border-radius:50%; }
.event-item:not(:last-child)::after { content:''; position:absolute; left:3px; top:15px; bottom:0; width:1px; background:#dce5ef; }
.event-heading { display:flex; align-items:baseline; justify-content:space-between; flex-wrap:wrap; gap:4px 12px; }
.event-operator { font-size:14px; font-weight:600; overflow-wrap:anywhere; }
.event-time { color:#606266; font-size:12px; }
.event-action { display:block; margin-top:6px; font-size:14px; line-height:1.6; }
.event-content { display:block; margin-top:4px; color:#606266; font-size:13px; line-height:1.6; white-space:pre-wrap; overflow-wrap:anywhere; }
.summary-missing { color:#767676; font-size:13px; }
.repair-summary-row > text:first-child { width:112px; flex:0 0 112px; }
.repair-log-pagination { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:12px; font-size:13px; color:#606266; }
.repair-log-pagination button { margin:0; min-height:44px; line-height:44px; padding:0 12px; font-size:13px; background:#edf5ff; color:#176ac7; }
.repair-log-pagination button[disabled] { color:#777; background:#f5f5f5; }
.repair-log-pagination button::after { border:0; }
.personnel-records { margin:12px; }
.personnel-filter { display:flex; align-items:center; justify-content:space-between; gap:16px; min-height:54px; padding:0 16px; border-radius:12px; background:#fff; font-size:14px; }
.personnel-filter-label { flex-shrink:0; color:#606266; }
.personnel-filter picker { flex:1; min-width:0; }
.personnel-filter-value { display:flex; align-items:center; justify-content:flex-end; gap:10px; min-height:44px; overflow-wrap:anywhere; }
.personnel-list-meta { display:flex; justify-content:space-between; gap:8px; padding:14px 2px 10px; color:#606266; font-size:12px; }
.repair-log-person { min-width:0; overflow-wrap:anywhere; }
.repair-log-clock { display:flex; flex-direction:column; gap:6px; padding:10px 0; font-size:13px; color:#606266; font-variant-numeric:tabular-nums; }
.repair-log-clock > view { display:flex; align-items:baseline; gap:8px; }
.repair-log-clock > view > text:first-child { flex:0 0 56px; }
.repair-log-clock > view > text:last-child { min-width:0; overflow-wrap:anywhere; color:#303133; }
.repair-log-description { border-top:1px solid #edf0f3; padding-top:8px; }
.repair-log-description-label { display:block; font-size:13px; color:#606266; }
.personnel-empty { display:flex; flex-direction:column; align-items:center; gap:8px; padding:36px 16px; background:#fff; border-radius:12px; color:#606266; font-size:14px; }
.customer-quote-line { padding:12px 0; border-bottom:1px solid #edf0f3; }
.completion-project { padding:4px 0 14px; }
.completion-project-name { display:block; color:#303133; font-size:16px; font-weight:600; line-height:1.6; overflow-wrap:anywhere; }
.completion-product { display:block; margin-top:8px; color:#606266; font-size:14px; line-height:1.6; overflow-wrap:anywhere; }
.completion-quotes { margin:16px 0; padding:16px 0; border-top:1px solid #edf0f3; border-bottom:1px solid #edf0f3; }
.completion-section-title { display:block; font-size:15px; font-weight:600; color:#303133; }
.completion-duration > text:first-child { width:112px; flex:0 0 112px; }
.completion-price { margin-top:24px; padding-top:20px; border-top:1px solid #edf0f3; }
.customer-quote-name { display:block; font-size:15px; line-height:1.6; overflow-wrap:anywhere; color:#303133; }
.customer-quote-values { display:flex; justify-content:space-between; gap:12px; margin-top:6px; font-size:13px; line-height:1.6; color:#606266; font-variant-numeric:tabular-nums; }
.customer-quote-total { display:flex; justify-content:space-between; gap:12px; padding-top:16px; font-size:16px; font-weight:600; color:#303133; }
.customer-price-input { display:flex; align-items:center; gap:10px; margin-top:12px; padding:12px; border:1px solid #dce3ec; border-radius:10px; background:#f6f8fa; font-size:20px; color:#172b4d; }
.customer-price-input:focus-within { border-color:#176ac7; }
.customer-price-input input { flex:1; min-width:0; height:32px; font-size:20px; font-variant-numeric:tabular-nums; }
.customer-price-hint { display:block; margin-top:10px; font-size:13px; line-height:1.6; color:#606266; }
.personnel-empty text:last-child { font-size:12px; }
.kv button.link { margin:0; padding:0 8px; min-height:44px; line-height:44px; font-size:14px; background:transparent; color:#176ac7; }
.kv button.link::after { border:0; }
.kv button.link:focus-visible { outline:2px solid #176ac7; }
.repair-log-heading .log-clock-alert, .kv .log-clock-alert { color:#b42318; }
</style>
