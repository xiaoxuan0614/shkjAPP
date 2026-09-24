<route lang="json5">
{
  style: {
    navigationBarTitleText: "项目详情",
    navigationStyle: "custom",
  },
}
</route>
<template>
  <PageLayout class="project-detail" navTitle="项目详情" navLeftText="返回" navBackgroundColor="#176ac7" type="popup" @navBack="goBack">
    <view v-if="!detail.id" class="detail-loading">正在加载项目详情…</view>
    <scroll-view v-else class="page" :scroll-y="true">
      <view class="status-card">
        <view class="project-heading">
          <text class="project-heading__main">{{
            detail.mainProjectName || "主项目名称未返回"
          }}</text>
          <text class="project-heading__period">{{
            detail.periodName || "分期名称未返回"
          }}</text>
        </view>
        <view class="project-heading__meta">
          <StatusBadge :value="detail.rawStatus" :dict="projectStatusOptions" />
          <text
            >项目经理：{{
              detail.projectManagerName ||
              (detail.managerLoadFailed ? "加载失败" : "未配置")
            }}</text
          >
        </view>
        <button class="project-info-toggle" :aria-expanded="projectInfoExpanded" @click="projectInfoExpanded = !projectInfoExpanded">
          <text>{{ projectInfoExpanded ? '收起项目信息' : '展开项目信息' }}</text>
          <wd-icon :name="projectInfoExpanded ? 'arrow-up' : 'arrow-down'" size="14px" />
        </button>
        <view v-show="projectInfoExpanded" class="project-info-content">
          <view class="row"><text class="label">项目单号</text><text class="val">{{ detail.xmNo }}</text></view>
          <view class="row"><text class="label">客户名称</text><text class="val">{{ detail.customerName }}</text></view>
          <view class="row"><text class="label">项目周期</text><text class="val">{{ periodWithHours(detail.startDate, detail.endDate) }}</text></view>
          <view class="row"><text class="label">到货状态</text><text class="val">{{ Number(detail.arrivalStatus) === 1 ? '已到货' : '未到货' }}</text></view>
        </view>
      </view>

      <SectionCard
        v-if="showImplementation"
        title="实施情况"
        extra="全部记录"
        @extra-click="openImplementRecords()"
      >
        <button v-if="processesError" @click="load">
          工序加载失败，点击重试
        </button>
        <text v-else-if="!processRows.length" class="process-empty"
          >暂无实施工序</text
        >
        <template v-else>
          <view
            v-for="group in processGroups"
            :key="group.key"
            class="process-group"
          >
            <button
              v-if="group.collapsible"
              class="process-group__toggle"
              :aria-expanded="expandedGroups[group.key]"
              @click="expandedGroups[group.key] = !expandedGroups[group.key]"
            >
              <text>{{ group.label }}（{{ group.items.length }}）</text
              ><wd-icon
                :name="expandedGroups[group.key] ? 'arrow-up' : 'arrow-down'"
                size="14px"
              />
            </button>
            <template v-if="!group.collapsible || expandedGroups[group.key]">
              <view
                v-for="process in group.items"
                :key="process.id"
                class="process-item"
              >
                <view class="process-item__head"
                  ><text class="process-item__name">{{ process.label }}</text
                  ><StatusBadge
                    :value="process.status"
                    :dict="processStatusOptions"
                /></view>
                <view class="process-item__row"
                  ><text>现场负责人</text
                  ><text>{{ process.siteLeaderName || "未配置" }}</text></view
                >
                <view class="process-item__row"
                  ><text>计划时间</text
                  ><text
                    >{{ process.plannedStartTime || "未设置" }} ~
                    {{ process.plannedEndTime || "未设置" }}</text
                  ></view
                >
                <view class="process-item__foot">
                  <text :class="{ 'process-overdue': process.overdue }">{{
                    process.durationText
                  }}</text>
                </view>
              </view>
            </template>
          </view>
        </template>
      </SectionCard>

      <!-- 计划信息 -->
      <SectionCard
        v-if="showPlanInfo"
        title="计划信息"
        extra="查看计划"
        @extra-click="openPlanInfo"
      >
        <view class="row"
          ><text class="label">计划周期</text
          ><text class="val">{{
            periodWithHours(detail.startDate, detail.endDate)
          }}</text></view
        >
        <view class="row"
          ><text class="label">计划内容</text
          ><text class="val link" @click="openPlanInfo"
            >方案、用料、人员、工序、位置及回款 ›</text
          ></view
        >
      </SectionCard>
      <!-- 用料统计 -->
      <SectionCard v-if="showImplementation" title="用料统计" :extra="materialStatsEmpty ? '' : materialStatsExpanded ? '收起' : '展开'" @header-click="!materialStatsEmpty && (materialStatsExpanded = !materialStatsExpanded)">
        <view v-if="materialStatsEmpty" class="row">暂无用料统计</view>
        <view v-else v-show="materialStatsExpanded">
        <view v-if="materialStatsLoading" class="row">正在加载用料统计…</view>
        <button
          v-else-if="materialStatsFailed"
          @click="loadMaterialStats(materialStatsPage)"
        >
          用料统计加载失败，点击重试
        </button>
        <template v-else-if="materialStats.length">
          <view class="stat-head">
            <text>物料</text>
            <text>计划</text>
            <text>出库</text>
            <text>已还</text>
            <text>使用</text>
            <text>待处置</text>
          </view>
          <view
            class="stat-row"
            v-for="m in materialStats"
            :key="m.materialId || m.id"
          >
            <view class="stat-name"
              ><text>{{ m.name }}</text
              ><text v-if="m.brandSpec" class="stat-brand-spec">{{
                m.brandSpec
              }}</text
              ><text class="stat-unit">{{ m.unit }}</text></view
            >
            <text class="stat-num">{{ m.planQty }}</text>
            <text class="stat-num">{{ m.outQty }}</text>
            <text class="stat-num">{{ m.returnedQty }}</text>
            <text class="stat-num">{{ m.usedQty }}</text>
            <text class="stat-num">{{ m.returnQty }}</text>
          </view>
        </template>
        <view v-if="materialStats.length && !materialStatsFailed" class="stat-pagination">
          <button
            :disabled="materialStatsLoading || materialStatsPage <= 1"
            @click="loadMaterialStats(materialStatsPage - 1)"
          >
            上一页
          </button>
          <text
            >{{ materialStatsPage }} /
            {{ Math.max(1, Math.ceil(materialStatsTotal / 5)) }} · 共
            {{ materialStatsTotal }} 条</text
          >
          <button
            :disabled="
              materialStatsLoading ||
              materialStatsPage * 5 >= materialStatsTotal
            "
            @click="loadMaterialStats(materialStatsPage + 1)"
          >
            下一页
          </button>
        </view>
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
          <text class="val link" @click="openAcceptance">查看 ›</text>
        </view>
        <view class="row">
          <text class="label">验收记录</text>
          <text class="val link" @click="openAcceptance">查看 ›</text>
        </view>
      </SectionCard>
      <SectionCard
        v-if="
          [
            'INTERNAL_ACCEPTING',
            'ACCEPTING', 'REACCEPTING', 'FAILED',
            'REWORKING',
            'WARRANTY',
            'COMPLETED',
            'CLOSED',
          ].includes(detail.rawStatus)
        "
        title="验收结果"
        extra="查看验收结果"
        @extraClick="openAcceptance"
      >
        <view class="row">
          <text class="label">内部验收结果</text>
          <text class="val">{{ acceptanceSummary.INTERNAL }}</text>
        </view>
        <view class="row">
          <text class="label">外部验收结果</text>
          <text class="val">{{ acceptanceSummary.CUSTOMER }}</text>
        </view>
      </SectionCard>
      <view
        class="detail-scroll-end"
        :class="{ 'detail-scroll-end--safe': !ops.length }"
      />
    </scroll-view>

    <PlanApprovalPopup ref="planInfoPopup" readonly />
    <ProcessCompletePopup ref="processCompletePopup" @success="load" />
    <ProjectAcceptancePopup ref="acceptancePopup" @changed="load" />
    <ContractFilePreview ref="arrivalFilePreview" />
    <!-- 底部操作 -->
    <view class="bottom" v-if="ops.length">
      <button
        v-for="op in primaryOps"
        :key="op.text"
        class="btn"
        :class="op.type"
        :disabled="acceptanceSubmitting"
        @click="op.action"
      >
        {{ op.text }}
      </button>
      <button
        v-if="moreGroups.length"
        class="btn btn--more"
        :aria-expanded="showMore"
        @click="showMore = true"
      >
        更多 <wd-icon name="arrow-up" size="14px" />
      </button>
    </view>
    <wd-popup
      v-model="showMore"
      position="bottom"
      :root-portal="true"
      :safe-area-inset-bottom="true"
      custom-style="border-radius:16px 16px 0 0;"
    >
      <view class="project-more">
        <view class="project-more__head"
          ><text>更多操作</text
          ><button aria-label="关闭更多操作" @click="showMore = false">
            <wd-icon name="close" size="18px" /></button
        ></view>
        <view
          v-for="group in moreGroups"
          :key="group.title"
          class="project-more__group"
        >
          <text class="project-more__label">{{ group.title }}</text>
          <view class="project-more__items"
            ><button
              v-for="op in group.items"
              :key="op.text"
              @click="runMore(op)"
            >
              {{ op.text }}<wd-icon name="arrow-right" size="14px" /></button
          ></view>
        </view>
      </view>
    </wd-popup>

    <ProjectMemberInvite
      v-if="showInvite"
      :period-id="id"
      :project-name="detail.name"
      @close="showInvite = false"
      @invited="onInvited"
    />

    <!-- 延期弹窗 -->
    <wd-popup
      v-model="showDelay"
      position="bottom"
      custom-style="border-radius:16px 16px 0 0;"
    >
      <view class="popup">
        <view class="popup__title">申请延期</view>
        <view class="form-row">
          <text class="label">项目名称</text>
          <text class="val">{{ detail.projectLabel || detail.name }}</text>
        </view>
        <view class="form-row">
          <text class="label">延期工序</text>
          <picker
            class="val"
            :range="delayProcesses"
            range-key="label"
            :value="delayProcessIndex"
            :disabled="
              delayLoading || delaySubmitting || !delayProcesses.length
            "
            @change="changeDelayProcess"
          >
            <view class="picker-value"
              >{{
                delayLoading
                  ? "正在加载…"
                  : selectedDelayProcess?.label || "请选择可申请延期的工序"
              }}
              <wd-icon name="arrow-down" size="14px"
            /></view>
          </picker>
        </view>
        <view class="form-row">
          <text class="label">计划时间</text>
          <text class="val">{{
            selectedDelayProcess
              ? periodWithHours(
                  selectedDelayProcess.plannedStartTime,
                  selectedDelayProcess.plannedEndTime,
                )
              : "—"
          }}</text>
        </view>
        <view v-if="delayError" class="form-row"
          ><button @click="loadDelayProcesses">
            工序或申请资格加载失败，点击重试
          </button></view
        >
        <view
          v-else-if="!delayLoading && !delayProcesses.length"
          class="form-row"
          >暂无可申请延期的工序，仅工序现场负责人或本分期项目经理可申请</view
        >
        <view class="form-row form-row--top">
          <text class="label">延期原因</text>
          <textarea
            class="textarea"
            v-model="delay.reason"
            placeholder="必填"
            placeholder-style="color:#bbb"
          />
        </view>
        <view class="form-row delay-date-row">
          <text class="label">预计完成时间</text>
          <picker
            class="delay-date-picker"
            mode="date"
            :value="delay.expectTime"
            :disabled="delaySubmitting"
            @change="(e: any) => (delay.expectTime = e.detail.value)"
          >
            <view
              class="picker-value"
              :class="{ 'date-placeholder': !delay.expectTime }"
              >{{ delay.expectTime || "请选择预计完成时间" }}
              <wd-icon name="arrow-down" size="14px"
            /></view>
          </picker>
        </view>
        <view class="popup__btns">
          <text class="btn btn--plain" @click="showDelay = false">取消</text>
          <text class="btn btn--primary" @click="submitDelay">{{
            delaySubmitting ? "提交中…" : "提交"
          }}</text>
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
          <text class="val">{{
            detail.projectName || detail.name || "—"
          }}</text>
        </view>
        <view class="arrival-popup__row">
          <text class="label">分期名称</text>
          <text class="val">{{ detail.periodName || detail.name || "—" }}</text>
        </view>
        <view class="arrival-popup__row">
          <text class="label">回款周期</text>
          <text class="val">
            {{
              arrivalLoading
                ? "加载中…"
                : arrivalPlan
                  ? `${arrivalRollbackDays} 天`
                  : "未配置到货款计划"
            }}
          </text>
        </view>
        <view class="arrival-popup__row">
          <text class="label">预计回款</text>
          <text class="val arrival-popup__expected">
            {{ arrivalPlan ? arrivalExpectedDate : "—" }}
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

        <view
          v-if="!arrivalLoading && !arrivalPlan"
          class="arrival-popup__error"
        >
          此合同没有到货款，无需确认到货。
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
            :class="{
              disabled: arrivalLoading || !arrivalPlan || arrivalSubmitting,
            }"
            @click="confirmArrival"
          >
            {{ arrivalSubmitting ? "处理中…" : "确认执行" }}
          </text>
        </view>
      </view>
    </wd-popup>
  </PageLayout>
</template>

<script lang="ts" setup>
import { onLoad } from "@dcloudio/uni-app";
import { ref, computed } from "vue";
import dayjs from "dayjs";
import { useToast } from "wot-design-uni";
import { normalizeProject, projectApi, unwrapRecords } from "@/service/shkj";
import { http } from "@/utils/http";
import { usePermissionStore } from "@/store/permission";
import { readProjectMembership } from "@/service/projectMembership";
import { findArrivalPayment, isArrivalStage } from "@/service/arrivalPayment";
import { useUserStore } from "@/store/user";
import StatusBadge from "@/components/StatusBadge/StatusBadge.vue";
import SectionCard from "@/components/SectionCard/SectionCard.vue";
import PlanApprovalPopup from "@/pages/home/components/PlanApprovalPopup.vue";
import ProcessCompletePopup from "./components/ProcessCompletePopup.vue";
import ProjectMemberInvite from "./components/ProjectMemberInvite.vue";
import ProjectAcceptancePopup from "./components/ProjectAcceptancePopup.vue";
import { readAcceptanceRecords, currentAcceptance } from "@/service/projectAcceptance";
import ContractFilePreview from "../home/components/ContractFilePreview.vue";

const toast = useToast();
const permissionStore = usePermissionStore();
const goBack = () => {
  const fallback = () => {
    if (permissionStore.hasPageAccess("/pages/ops/project")) {
      uni.redirectTo({ url: "/pages/ops/project" });
    } else {
      uni.switchTab({ url: "/pages/home/index" });
    }
  };
  if (getCurrentPages().length > 1) uni.navigateBack({ delta: 1, fail: fallback });
  else fallback();
};
const detail = ref<any>({});
const projectInfoExpanded = ref(false);
const acceptancePopup = ref<InstanceType<typeof ProjectAcceptancePopup>>();
const arrivalFilePreview = ref<InstanceType<typeof ContractFilePreview>>();
const openAcceptance = () => acceptancePopup.value?.open(id.value, "", detail.value);
const acceptanceSummary = ref({ INTERNAL: "—", CUSTOMER: "—" });
const acceptanceResultText = (row: any) => {
  if (!row) return "未提交";
  if (row.acceptStatus === "IN_PROGRESS") return "待填写";
  if (row.acceptStatus === "CANCELLED") return "已取消";
  return ({ PASSED: "通过", FAILED: "不通过" } as Record<string, string>)[row.result] || row.result || "待填写";
};
const loadAcceptanceSummary = async (periodId: string, reworkId: string, request: number) => {
  await Promise.all((["INTERNAL", "CUSTOMER"] as const).map(async type => {
    try {
      const rows = await readAcceptanceRecords(periodId, type);
      if (request !== detailRequest || periodId !== id.value) return;
      acceptanceSummary.value[type] = acceptanceResultText(currentAcceptance(rows, reworkId));
    } catch {
      if (request === detailRequest && periodId === id.value) acceptanceSummary.value[type] = "加载失败，请查看详情重试";
    }
  }));
};
const canStartAcceptance = computed(
  () =>
    delayIsProjectManager.value &&
    permissionStore.hasPermission("project:acceptance:submit"),
);
const processRows = ref<any[]>([]),
  processesError = ref(false);
const projectStatusOptions = ref<
  { value: string; label: string; color: string }[]
>([]);
const processStatusOptions = ref<
  { value: string; label: string; color: string }[]
>([]);
const expandedGroups = ref<Record<string, boolean>>({
  pending: false,
  completed: false,
});
const processGroups = computed(() =>
  [
    {
      key: "active",
      label: "进行中",
      collapsible: false,
      items: processRows.value.filter((item) =>
        ["IN_PROGRESS", "PROCESSING"].includes(item.status),
      ),
    },
    {
      key: "pending",
      label: "未开始",
      collapsible: true,
      items: processRows.value.filter((item) => item.status === "NOT_STARTED"),
    },
    {
      key: "completed",
      label: "已完成",
      collapsible: true,
      items: processRows.value.filter((item) => item.status === "COMPLETED"),
    },
    {
      key: "other",
      label: "其他工序",
      collapsible: false,
      items: processRows.value.filter(
        (item) =>
          !["IN_PROGRESS", "PROCESSING", "NOT_STARTED", "COMPLETED"].includes(
            item.status,
          ),
      ),
    },
  ].filter((group) => group.items.length),
);
const dictionaryOptions = (rows: any[]) =>
  rows.map((item) => ({
    value: String(item.value ?? "")
      .trim()
      .toUpperCase(),
    label: item.text || item.label || String(item.value),
    color: /^#[0-9a-f]{6}$/i.test(item.color || "") ? item.color : "#176ac7",
  }));
const periodWithHours = (start?: string, end?: string) => {
  const range = `${start || "—"} ~ ${end || "—"}`;
  if (!start || !end) return range;
  const from = dayjs(start);
  const to = dayjs(end);
  if (!from.isValid() || !to.isValid() || to.isBefore(from)) return range;
  const hours = (to.startOf("day").diff(from.startOf("day"), "day") + 1) * 8;
  return `${range}（${hours}h）`;
};
const implementationStatuses = [
  "IMPLEMENTING",
  "DEBUGGING",
  "DEBUG_COMPLETED",
  "IMPLEMENT_COMPLETED",
  "PENDING_ACCEPT",
  "INTERNAL_ACCEPTING",
  "ACCEPTING", "REACCEPTING", "FAILED",
  "REWORKING",
  "WARRANTY",
  "COMPLETED",
];
const hasImplementation = (status: string) =>
  implementationStatuses.includes(status);
const hasPlan = (status: string) =>
  ["PREPARING", "PENDING_APPROVAL"].includes(status) ||
  hasImplementation(status);
const showPlanInfo = computed(() => hasPlan(detail.value.rawStatus));
const showImplementation = computed(() =>
  hasImplementation(detail.value.rawStatus),
);
const planInfoPopup = ref<InstanceType<typeof PlanApprovalPopup>>();
const openPlanInfo = () =>
  planInfoPopup.value?.open({ bizSubId: id.value, summary: detail.value.name });
const id = ref("");
const openImplementRecords = (processId = "") =>
  uni.navigateTo({
    url: `/pages/ops/implementRecords?periodId=${encodeURIComponent(id.value)}&projectName=${encodeURIComponent(detail.value.projectLabel || detail.value.name || "")}${processId ? `&processId=${encodeURIComponent(processId)}` : ""}`,
  });
const showInvite = ref(false);
const onInvited = () => {
  showInvite.value = false;
  toast.success("邀请已发送，等待对方确认");
  void load();
};
const materialStats = ref<any[]>([]);
const materialStatsExpanded = ref(false);
const materialStatsPage = ref(1);
const materialStatsTotal = ref(0);
const materialStatsLoading = ref(false);
const materialStatsFailed = ref(false);
const materialStatsEmpty = computed(() => !materialStatsLoading.value && !materialStatsFailed.value && !materialStats.value.length && materialStatsTotal.value === 0);
let materialStatsRequest = 0;
const loadMaterialStats = async (pageNo = 1) => {
  const request = ++materialStatsRequest;
  const periodId = id.value;
  materialStatsLoading.value = true;
  materialStatsFailed.value = false;
  materialStatsPage.value = pageNo;
  try {
    const response: any = await projectApi.materialAccounts(periodId, {
      pageNo,
      pageSize: 5,
    });
    const page = response?.result ?? response;
    if (!Array.isArray(page?.records) || !Number.isFinite(Number(page.total)))
      throw new Error("用料统计响应异常");
    if (request !== materialStatsRequest || periodId !== id.value) return;
    const quantity = (value: any) =>
      value == null || value === "" ? "—" : value;
    materialStats.value = page.records.map((row: any) => ({
      id: row.id,
      materialId: row.materialId,
      name: row.materialName || "—",
      brandSpec: [row.brand, row.model].filter(Boolean).join(" / "),
      unit: row.baseUnitName || "—",
      planQty: quantity(row.plannedQty),
      outQty: quantity(row.outboundQty),
      returnedQty: quantity(row.actualReturnQty),
      usedQty: quantity(row.consumedQty),
      returnQty: quantity(row.remainingReturnQty),
    }));
    materialStatsTotal.value = Number(page.total);
  } catch {
    if (request === materialStatsRequest) materialStatsFailed.value = true;
  } finally {
    if (request === materialStatsRequest) materialStatsLoading.value = false;
  }
};
const showDelay = ref(false);
const delay = ref({ processId: "", reason: "", expectTime: "" });
const userStore = useUserStore();
const delayLoading = ref(false),
  delayError = ref(false),
  delaySubmitting = ref(false);
const delayProcessRows = ref<any[]>([]);
const delayIsProjectManager = ref(false);
const isProjectParticipant = ref(false);
const hasUnfinishedParticipation = ref(false);
const currentUserId = computed(() =>
  String(userStore.userInfo.userid || (userStore.userInfo as any).id || ""),
);
const delayProcesses = computed(() =>
  delayProcessRows.value.filter(
    (item) =>
      currentUserId.value &&
      (delayIsProjectManager.value ||
        String(item.siteLeaderId || "") === currentUserId.value) &&
      String(item.status || "").toUpperCase() !== "COMPLETED" &&
      (!detail.value.currentReworkId ||
        String(item.reworkId || "") === String(detail.value.currentReworkId)),
  ),
);
const selectedDelayProcess = computed(() =>
  delayProcesses.value.find(
    (item) => String(item.id) === delay.value.processId,
  ),
);
const delayProcessIndex = computed(() =>
  Math.max(
    0,
    delayProcesses.value.findIndex(
      (item) => String(item.id) === delay.value.processId,
    ),
  ),
);
const changeDelayProcess = (event: any) => {
  delay.value.processId = String(
    delayProcesses.value[Number(event.detail.value)]?.id || "",
  );
  delay.value.expectTime = "";
};
const loadDelayManager = async () => {
  isProjectParticipant.value = false;
  const access = await readProjectMembership(id.value, currentUserId.value);
  isProjectParticipant.value = access.participant;
  return access.manager;
};
const loadDelayProcesses = async () => {
  if (delayLoading.value) return false;
  delayLoading.value = true;
  delayError.value = false;
  try {
    const [response, dictionary, isManager] = await Promise.all([
      projectApi.processes(id.value),
      http.get("/sys/dict/getDictItems/work_type").catch(() => null),
      loadDelayManager(),
    ]);
    delayIsProjectManager.value = isManager;
    const names = Object.fromEntries(
      unwrapRecords(dictionary).map((item) => [
        String(item.value),
        item.text || item.label,
      ]),
    );
    delayProcessRows.value = unwrapRecords(response).map((item) => ({
      ...item,
      label:
        names[String(item.processName)] ||
        item.processName_dictText ||
        item.processName ||
        "未命名工序",
    }));
    // 首次打开或加载重试默认选首项；提交前刷新不替换用户已选工序。
    if (!delay.value.processId)
      delay.value.processId = String(delayProcesses.value[0]?.id || "");
    return true;
  } catch {
    delayProcessRows.value = [];
    delayIsProjectManager.value = false;
    delayError.value = true;
    return false;
  } finally {
    delayLoading.value = false;
  }
};
const openDelay = () => {
  delay.value = { processId: "", reason: "", expectTime: "" };
  delayProcessRows.value = [];
  delayIsProjectManager.value = false;
  showDelay.value = true;
  void loadDelayProcesses();
};
const showArrival = ref(false);
const arrivalLoading = ref(false);
const arrivalSubmitting = ref(false);
const arrivalPlan = ref<any>();
const hasArrivalPayment = ref(false);
const arrivalContract = ref<any>({});
const arrivalMaterialFile = ref<any>({});

const canConfirmArrival = computed(
  () =>
    (permissionStore.fullAccess ||
      permissionStore.hasPermission("project:arrival:confirm")) &&
    hasArrivalPayment.value &&
    isArrivalStage({
      status: detail.value.rawStatus,
      arrivalStatus: detail.value.arrivalStatus,
    }),
);
const arrivalRollbackDays = computed(() => {
  const value = Number(arrivalPlan.value?.rollbackTime ?? 7);
  return Number.isInteger(value) && value >= 0 ? value : 7;
});
const arrivalExpectedDate = computed(() =>
  dayjs().add(arrivalRollbackDays.value, "day").format("YYYY-MM-DD"),
);
const arrivalMaterialSource = computed(
  () =>
    arrivalMaterialFile.value?.fileId ||
    arrivalMaterialFile.value?.url ||
    arrivalContract.value?.materialFileId ||
    arrivalContract.value?.materialListFileId ||
    arrivalContract.value?.materialListFilePath ||
    "",
);
const arrivalMaterialName = computed(() => {
  const sourceName =
    arrivalMaterialFile.value?.fileName ||
    arrivalContract.value?.materialFileName ||
    arrivalContract.value?.materialListFileName;
  if (sourceName) return sourceName;
  const name =
    String(arrivalMaterialSource.value).split("/").pop() || "合同货物清单";
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
});

const acceptanceSubmitting = ref(false);
const ops = computed(() => {
  const list: { text: string; type: string; action: () => void }[] = [];
  const s = detail.value.status;
  if (
    hasUnfinishedParticipation.value &&
    permissionStore.hasPageAccess("/pages/ops/implementLog")
  )
    list.push({
      text: "项目实施",
      type: "primary",
      action: () =>
        uni.navigateTo({
          url: `/pages/ops/implementLog?projectId=${encodeURIComponent(id.value)}`,
        }),
    });
  if (detail.value.rawStatus === "PENDING_ACCEPT") {
    if (canStartAcceptance.value)
      list.push({
        text: "验收",
        type: "primary",
        action: openAcceptance,
      });
  }
  if (
    [
      "INTERNAL_ACCEPTING",
      "ACCEPTING", "REACCEPTING", "FAILED",
      "REWORKING",
      "WARRANTY",
      "COMPLETED",
      "CLOSED",
    ].includes(detail.value.rawStatus) &&
    permissionStore.hasPermission("project:acceptance:view")
  )
    list.push({ text: "验收", type: "primary", action: openAcceptance });
  if (
    [
      "IMPLEMENTING",
      "DEBUGGING",
      "DEBUG_COMPLETED",
      "IMPLEMENT_COMPLETED",
      "PENDING_ACCEPT",
      "INTERNAL_ACCEPTING",
      "ACCEPTING", "REACCEPTING", "FAILED",
      "REWORKING",
    ].includes(detail.value.rawStatus)
  ) {
    if (
      (s === "implementing" || detail.value.rawStatus === "REWORKING") &&
      delayIsProjectManager.value
    )
      list.push({
        text: "临时邀约",
        type: "",
        action: () => {
          showInvite.value = true;
        },
      });
    if (
      isProjectParticipant.value &&
      permissionStore.hasPageAccess("/pages/ops/materialApply")
    )
      list.push({
        text: "领料申请",
        type: "",
        action: () =>
          uni.navigateTo({
            url: `/pages/ops/materialApply?periodId=${encodeURIComponent(id.value)}${detail.value.currentReworkId ? `&reworkId=${encodeURIComponent(detail.value.currentReworkId)}` : ""}`,
          }),
      });
    if (
      (s === "implementing" || detail.value.rawStatus === "REWORKING") &&
      delayProcesses.value.length > 0
    )
      list.push({
        text: "申请延期",
        type: "",
        action: openDelay,
      });
    if (
      ["IMPLEMENTING", "DEBUGGING", "DEBUG_COMPLETED", "REWORKING"].includes(
        detail.value.rawStatus,
      ) &&
      delayProcesses.value.some(
        (item) => String(item.status).toUpperCase() === "IN_PROGRESS",
      ) &&
      permissionStore.hasPermission("project:implement")
    ) {
      list.push({
        text: "实施完成",
        type: "",
        action: () => processCompletePopup.value?.open(id.value),
      });
    }
  }
  if (
    isProjectParticipant.value &&
    permissionStore.hasPageAccess("/pages/ops/materialReturn")
  )
    list.push({
      text: "申请还料",
      type: "",
      action: () =>
        uni.navigateTo({
          url: `/pages/ops/materialReturn?periodId=${encodeURIComponent(id.value)}`,
        }),
    });
  if (canConfirmArrival.value) {
    list.push({ text: "确认到货", type: "", action: openArrivalConfirm });
  }
  return list;
});
const showMore = ref(false);
const processCompletePopup = ref<InstanceType<typeof ProcessCompletePopup>>();
const primaryOps = computed(() =>
  ops.value.filter(
    (op) =>
      op.type === "primary" ||
      op.text === "确认到货" ||
      (op.text === "领料申请" && !canConfirmArrival.value),
  ),
);
const moreGroups = computed(() =>
  [
    { title: "物料管理", names: ["领料申请", "申请还料", "确认到货"] },
    { title: "人员协作", names: ["临时邀约"] },
    { title: "实施进度", names: ["项目实施", "申请延期", "实施完成"] },
  ]
    .map((group) => ({
      title: group.title,
      items: ops.value.filter(
        // 更多是完整操作目录；底部快捷入口不应导致这里缺少操作。
        (op) => group.names.includes(op.text),
      ),
    }))
    .filter((group) => group.items.length),
);
const runMore = (op: { action: () => void }) => {
  showMore.value = false;
  op.action();
};

const openArrivalConfirm = async () => {
  if (
    !canConfirmArrival.value ||
    arrivalLoading.value ||
    arrivalSubmitting.value
  )
    return;
  showArrival.value = true;
  arrivalLoading.value = true;
  arrivalSubmitting.value = false;
  arrivalPlan.value = undefined;
  arrivalContract.value = {};
  arrivalMaterialFile.value = {};
  try {
    const response: any = await projectApi.contractDetail(id.value);
    const result = response?.result ?? response ?? {};
    arrivalContract.value = result.contract || result;
    arrivalMaterialFile.value = result.materialFile || {};
    const records = Array.isArray(result.records) ? result.records : [];
    arrivalPlan.value = findArrivalPayment(records);
    hasArrivalPayment.value = !!arrivalPlan.value;
  } catch (error: any) {
    toast.error(error?.message || error?.msg || "合同回款信息加载失败");
  } finally {
    arrivalLoading.value = false;
  }
};

const closeArrivalPopup = () => {
  if (!arrivalSubmitting.value) showArrival.value = false;
};

const previewArrivalMaterial = () => {
  if (arrivalMaterialSource.value)
    arrivalFilePreview.value?.open({
      path: arrivalMaterialSource.value,
      name: arrivalMaterialName.value,
    });
};

const confirmArrival = async () => {
  if (
    !canConfirmArrival.value ||
    arrivalLoading.value ||
    arrivalSubmitting.value ||
    !arrivalPlan.value
  )
    return;
  arrivalSubmitting.value = true;
  try {
    const [latest, latestContract]: any[] = await Promise.all([
      projectApi.detail(id.value),
      projectApi.contractDetail(id.value),
    ]);
    const record = latest?.result;
    if (
      !record ||
      !isArrivalStage({
        ...record,
        status: record.periodStatus ?? record.status,
      }) ||
      !findArrivalPayment((latestContract?.result ?? latestContract)?.records)
    ) {
      toast.warning("到货状态或合同回款计划已变化，请刷新后操作");
      showArrival.value = false;
      await load();
      return;
    }
    await projectApi.confirmArrival(id.value);
    toast.success("已确认到货");
    showArrival.value = false;
    await load();
  } finally {
    arrivalSubmitting.value = false;
  }
};

let detailRequest = 0;
const load = async () => {
  const request = ++detailRequest;
  const periodId = id.value;
  hasUnfinishedParticipation.value = false;
  acceptanceSummary.value = { INTERNAL: "—", CUSTOMER: "—" };
  hasArrivalPayment.value = false;
  isProjectParticipant.value = false;
  delayIsProjectManager.value = false;
  try {
    const detailRes: any = await projectApi.detail(id.value);
    if (request !== detailRequest || periodId !== id.value) return;
    const record = detailRes.result || {};
    const basic = normalizeProject({
      ...record,
      status: record.periodStatus ?? record.status,
    });
    if (hasImplementation(basic.rawStatus)) void loadMaterialStats(1);
    else {
      materialStatsRequest++;
      materialStats.value = [];
      materialStatsTotal.value = 0;
      materialStatsLoading.value = false;
    }
    const empty = () => Promise.resolve({ result: [] });
    const results = await Promise.allSettled([
      hasPlan(basic.rawStatus) ? projectApi.processes(id.value) : empty(),
      hasImplementation(basic.rawStatus)
        ? http.get("/sys/dict/getDictItems/work_type")
        : empty(),
      http.get("/sys/dict/getDictItems/project_period_status"),
      hasImplementation(basic.rawStatus)
        ? http.get("/sys/dict/getDictItems/project_process_status")
        : empty(),
      projectApi.contractDetail(id.value),
      loadDelayManager(),
      projectApi.participatedProjects({ onlyUnfinishedProcess: true }),
    ]);
    if (request !== detailRequest || periodId !== id.value) return;
    const recordsAt = (index: number) =>
      results[index].status === "fulfilled"
        ? unwrapRecords((results[index] as PromiseFulfilledResult<any>).value)
        : [];
    const processes = recordsAt(0);
    hasUnfinishedParticipation.value = recordsAt(6).some(
      (item: any) =>
        String(normalizeProject(item).id || "") === String(periodId),
    );
    if (results[6].status === "rejected")
      toast.warning("实施资格查询失败，请重新打开项目详情重试");
    delayIsProjectManager.value =
      results[5].status === "fulfilled" && results[5].value === true;
    const contractResult =
      results[4].status === "fulfilled"
        ? (results[4].value as any)?.result?.contract
        : null;
    const contractResponse =
      results[4].status === "fulfilled" ? (results[4].value as any) : null;
    hasArrivalPayment.value = !!findArrivalPayment(
      (contractResponse?.result ?? contractResponse)?.records,
    );
    processesError.value = results[0].status === "rejected";
    projectStatusOptions.value = dictionaryOptions(recordsAt(2));
    if (
      !projectStatusOptions.value.some((item) => item.value === basic.rawStatus)
    )
      projectStatusOptions.value.push({
        value: basic.rawStatus,
        label:
          record.periodStatus_dictText ||
          record.status_dictText ||
          basic.rawStatus,
        color: "#536176",
      });
    processStatusOptions.value = dictionaryOptions(recordsAt(3));
    const workTypeNames: Record<string, string> = Object.fromEntries(
      recordsAt(1).map((item: any) => [
        String(item.value ?? "").trim(),
        item.text || item.label || String(item.value ?? ""),
      ]),
    );
    processRows.value = processes.map((process: any) => {
      const status = String(process.status || "")
        .trim()
        .toUpperCase();
      const end = process.plannedEndTime ? dayjs(process.plannedEndTime) : null;
      const days = end?.isValid()
        ? end.startOf("day").diff(dayjs().startOf("day"), "day")
        : null;
      if (!processStatusOptions.value.some((item) => item.value === status))
        processStatusOptions.value.push({
          value: status,
          label: process.status_dictText || status || "状态未返回",
          color: "#536176",
        });
      return {
        ...process,
        status,
        label:
          workTypeNames[String(process.processName ?? "").trim()] ||
          process.processName_dictText ||
          process.processName ||
          "未命名工序",
        overdue: status !== "COMPLETED" && days !== null && days < 0,
        durationText:
          status === "COMPLETED"
            ? process.actualEndTime
              ? `完成时间：${process.actualEndTime}`
              : "已完成"
            : days === null
              ? "未设置计划完成时间"
              : days < 0
                ? `已超期 ${-days} 天`
                : `剩余工期 ${days + 1} 天`,
      };
    });
    // 在详情加载阶段计算申请资格，无可选工序时不显示延期入口。
    delayProcessRows.value = processRows.value;
    const processStartDates = processes
      .map((item: any) => item.plannedStartTime)
      .filter(Boolean)
      .sort();
    const processStartDate = processStartDates[0] || "";
    const processEndDates = processes
      .map((item: any) => item.plannedEndTime)
      .filter(Boolean)
      .sort();
    const processEndDate = processEndDates[processEndDates.length - 1] || "";
    const projectStartDate = basic.startDate || processStartDate;
    const projectEndDate = basic.endDate || processEndDate;
    detail.value = {
      ...basic,
      mainProjectName: record.projectName || "",
      projectManagerName:
        contractResult?.projectManagerUserName ||
        contractResult?.projectManagerName ||
        "",
      managerLoadFailed: results[4].status === "rejected",
      startDate: projectStartDate,
      endDate: projectEndDate,
    };
    if (["INTERNAL_ACCEPTING", "ACCEPTING", "REACCEPTING", "FAILED", "REWORKING", "WARRANTY", "COMPLETED", "CLOSED"].includes(basic.rawStatus)) {
      acceptanceSummary.value = { INTERNAL: "加载中…", CUSTOMER: "加载中…" };
      void loadAcceptanceSummary(periodId, String(detail.value.currentReworkId || ""), request);
    }
  } catch (e) {
    /* ignore */
  }
};

const submitDelay = async () => {
  if (delaySubmitting.value || delayLoading.value) return;
  if (!selectedDelayProcess.value)
    return toast.warning("请选择有申请权限的延期工序");
  if (!delay.value.reason.trim()) return toast.warning("请填写延期原因");
  if (!delay.value.expectTime || !dayjs(delay.value.expectTime).isValid())
    return toast.warning("请选择预计完成时间");
  delaySubmitting.value = true;
  try {
    // 提交前重新核对负责人及计划日期，不沿用项目整体结束时间。
    if (!(await loadDelayProcesses())) return;
    const process = selectedDelayProcess.value;
    if (!process) return toast.warning("该工序已不可申请延期，请重新选择");
    const originalEndTime = process.plannedEndTime;
    if (!originalEndTime || !dayjs(originalEndTime).isValid())
      return toast.warning("该工序未设置有效计划完成时间");
    if (!dayjs(delay.value.expectTime).isAfter(dayjs(originalEndTime), "day"))
      return toast.warning("预计完成时间必须晚于工序计划完成时间");
    const response: any = await projectApi.addDelay({
      projectId: detail.value.projectId,
      periodId: id.value,
      processId: process.id,
      delayReason: delay.value.reason.trim(),
      expectedEndTime: delay.value.expectTime,
    });
    const status = response?.result?.status;
    toast.success(
      String(status) === "1"
        ? "延期申请已自动审批通过"
        : String(status) === "2"
          ? "延期申请已提交，等待审批"
          : "延期申请已提交",
    );
    showDelay.value = false;
    void load();
  } catch {
    toast.warning("延期申请提交失败，请核对后重试");
  } finally {
    delaySubmitting.value = false;
  }
};

onLoad((query) => {
  id.value = query?.id || "";
  load();
});
</script>

<style lang="scss" scoped>
.project-record-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin: 0;
  padding: 12px 0;
  min-height: 44px;
  background: transparent;
  color: #176ac7;
  font-size: 16px;
}
.project-record-link::after {
  border: 0;
}
.detail-loading { padding: 24px 14px; text-align: center; color: #667085; font-size: 14px; }
.project-detail {
  width: 100%;
  height: 100vh;
  overflow: hidden;
  /* #ifdef H5 */
  height: calc(100vh - var(--window-top, 0px));
  height: calc(100dvh - var(--window-top, 0px));
  /* #endif */
}
.project-detail :deep(.pageContent),
.project-detail :deep(.content) {
  min-height: 0;
}
.page {
  flex: 1;
  height: 0;
  min-height: 0;
  width: 100%;
  box-sizing: border-box;
}
.detail-scroll-end {
  height: 12px;
}
.detail-scroll-end--safe {
  height: calc(12px + env(safe-area-inset-bottom));
}

.project-info-toggle { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; min-height: 44px; margin: 12px 0 0; padding: 8px 0; background: transparent; color: #176ac7; font-size: 13px; line-height: 20px; border-top: 1px solid #edf0f3; border-radius: 0; }
.project-info-toggle::after { border: 0; }
.project-info-content { padding-bottom: 4px; }
.project-info-content .val { overflow-wrap: anywhere; }
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

.project-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
}
.project-heading__main {
  flex: 1;
  min-width: 0;
  font-size: 20px;
  line-height: 1.45;
  font-weight: 700;
  color: #253247;
  overflow-wrap: anywhere;
}
.project-heading__period {
  max-width: 40%;
  font-size: 14px;
  line-height: 1.5;
  color: #536176;
  text-align: right;
  overflow-wrap: anywhere;
}
.project-heading__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 16px;
  margin-top: 12px;
  font-size: 14px;
  color: #536176;
}
.process-group + .process-group {
  border-top: 1px solid #e3e8ee;
}
.process-group__toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  min-height: 44px;
  padding: 8px 0;
  margin: 0;
  border-radius: 0;
  background: transparent;
  color: #536176;
  font-size: 14px;
  line-height: 1.5;
  text-align: left;
}
.process-group__toggle::after {
  border: 0;
}
.process-item {
  padding: 14px 0 4px;
}
.process-item + .process-item {
  border-top: 1px solid #e3e8ee;
}
.process-item__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.process-item__name {
  min-width: 0;
  font-size: 16px;
  font-weight: 600;
  color: #253247;
  overflow-wrap: anywhere;
}
.process-item__row {
  display: flex;
  gap: 12px;
  margin-top: 10px;
  font-size: 14px;
  line-height: 1.6;
}
.process-item__row > text:first-child {
  flex: 0 0 84px;
  color: #536176;
}
.process-item__row > text:last-child {
  min-width: 0;
  overflow-wrap: anywhere;
  color: #253247;
}
.process-item__foot {
  margin: 10px 0;
  font-size: 14px;
  color: #536176;
}
.process-overdue {
  color: #b54708;
}
.process-empty {
  display: block;
  padding: 12px 0;
  color: #536176;
  font-size: 14px;
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

  > text,
  > .stat-name {
    min-width: 0;
    overflow-wrap: anywhere;
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
  color: #596574;
  padding-bottom: 8px;
}
:deep(.section-card__extra) {
  min-height: 44px;
  color: #176ac7;
}
:deep(.section-card__extra .extra-arrow) {
  color: #176ac7;
}
.stat-unit {
  display: block;
  color: #68788a;
  font-size: 11px;
}
.stat-brand-spec {
  display: block;
  margin-top: 4px;
  color: #536176;
  font-size: 12px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.stat-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 12px;
  font-size: 12px;
  color: #596574;
}
.stat-pagination button {
  min-height: 44px;
  margin: 0;
  padding: 8px;
  font-size: 13px;
  line-height: 28px;
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
  flex-shrink: 0;
  box-sizing: border-box;
  flex-wrap: nowrap;
  gap: 8px;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  background: #fff;
  border-top: 1px solid #f0f0f0;

  .btn {
    box-sizing: border-box;
    flex: 1;
    min-width: 0;
    min-height: 44px;
    margin: 0;
    line-height: 22px;
    white-space: nowrap;
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

.bottom .btn::after,
.project-more button::after {
  border: 0;
}
.bottom .btn--more {
  flex: 0 0 72px;
  background: #f5f6f8;
}
.project-more {
  padding: 8px 16px 20px;
  max-height: 70vh;
  overflow-y: auto;
}
.project-more__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 17px;
  font-weight: 600;
}
.project-more__head button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  margin: 0;
  background: transparent;
}
.project-more__group {
  margin-top: 12px;
}
.project-more__label {
  display: block;
  margin-bottom: 8px;
  color: #596574;
  font-size: 13px;
}
.project-more__items {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.project-more__items button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  min-height: 48px;
  padding: 10px 12px;
  margin: 0;
  color: #27364a;
  background: #f5f6f8;
  font-size: 14px;
  line-height: 1.5;
  text-align: left;
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

.delay-date-row {
  column-gap: 16px;

  .delay-date-picker {
    flex: 1;
    min-width: 0;
  }
  .picker-value {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .date-placeholder {
    color: #767676;
  }
}
</style>
