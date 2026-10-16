<template>
  <wd-popup
    v-model="visible"
    position="bottom"
    :root-portal="true"
    :z-index="2100"
    :close-on-click-modal="!submitting"
    :safe-area-inset-bottom="true"
  >
    <view class="plan-review">
      <view class="plan-review__head">
        <text class="plan-review__title">{{ readonly ? '计划信息' : '计划审批' }}</text>
        <button
          class="plan-review__close"
          aria-label="关闭计划审批"
          :disabled="submitting"
          @click="close"
        >
          <wd-icon name="close" size="20px" />
        </button>
      </view>
      <scroll-view
        class="plan-review__body"
        scroll-y
        :scroll-into-view="scrollTarget"
      >
        <view class="plan-review__context">
          <text class="plan-review__project">{{
            project.projectName || projectLabel || "项目计划"
          }}</text>
          <text v-if="project.periodName" class="plan-review__subtitle">{{
            project.periodName
          }}</text>
          <text class="plan-review__subtitle"
            >项目经理：{{ managerName || "—" }} </text
          >
          <text v-if="!contextLoading && !contextFailed" class="plan-review__subtitle">审批状态：{{ statusText }}</text>
          <text v-if="latestApproval?.approvalReason" class="plan-review__subtitle">审批意见：{{ latestApproval.approvalReason }}</text>
          <text v-if="approvalHistory.length" class="plan-review__subtitle">审批记录：{{ approvalHistory.length }} 轮</text>
          <button
            v-if="contextFailed"
            class="plan-review__link"
            @click="loadContext"
          >
            项目信息加载失败，点击重试
          </button>
          <text v-else-if="contextLoading" class="plan-review__subtitle"
            >正在加载项目信息…</text
          >
        </view>
        <view
          v-for="section in sections"
          :id="`plan-${section.key}`"
          :key="section.key"
          class="plan-review__section"
        >
          <button
            class="plan-review__toggle"
            :aria-expanded="section.expanded"
            @click="toggle(section)"
          >
            <view class="plan-review__heading">
              <text>{{ section.title }}</text>
              <text class="plan-review__summary">{{
                section.loading
                  ? "正在加载…"
                  : section.failed
                    ? "加载失败，展开重试"
                    : section.summary
              }}</text>
            </view>
            <wd-icon
              :name="section.expanded ? 'arrow-up' : 'arrow-down'"
              size="18px"
            />
          </button>
          <view v-if="section.expanded" class="plan-review__content">
            <text v-if="section.loading" class="plan-review__subtitle"
              >正在读取{{ section.title }}…</text
            >
            <button
              v-else-if="section.failed"
              class="plan-review__link"
              @click="loadSection(section)"
            >
              加载失败，点击重试
            </button>
            <template v-else>
              <view v-if="section.key === 'materials'" class="plan-review__search-row">
              <input
                v-model="keyword"
                class="plan-review__search"
                placeholder="搜索物料名称、品牌或规格"
                aria-label="搜索计划物料"
                confirm-type="search"
                @confirm="loadSection(section, 1)"
              />
              <button class="plan-review__query" @click="loadSection(section, 1)">查询</button>
              </view>
              <text
                v-if="!displayEntries(section).length"
                class="plan-review__subtitle"
                >{{
                  section.key === "materials" && keyword
                    ? "没有匹配的物料"
                    : "暂无记录"
                }}</text
              >
              <ReadOnlyTable v-if="section.key === 'materials' && section.entries.length" label="用料计划" :columns="materialColumns" :rows="tableRows(section.entries, 4)" min-width="380px" />
              <template v-if="section.key === 'people'">
                <view v-for="group in peopleTables(section)" :key="group.title" class="plan-review__people-group">
                  <text class="plan-review__name">{{ group.title }}（{{ group.rows.length }}）</text>
                  <text v-if="!group.rows.length" class="plan-review__subtitle">暂无{{ group.title }}</text>
                  <ReadOnlyTable v-else class="plan-review__people-scroll" :label="group.title" :columns="peopleColumns(group.headers, group.outsource)" :rows="tableRows(group.rows, group.outsource ? 4 : 2, group.outsource ? 4 : undefined)" :min-width="group.outsource ? '500px' : '0px'" />
                </view>
              </template>
              <template v-if="section.key === 'payments'">
                <view v-if="section.entries[0]" class="plan-review__entry">
                  <text class="plan-review__name">{{ section.entries[0].title }}</text>
                  <view v-for="field in section.entries[0].fields" :key="field[0]" class="plan-review__field"><text>{{ field[0] }}</text><text>{{ field[1] }}</text></view>
                </view>
                <text v-if="section.entries.length <= 1" class="plan-review__subtitle">暂无回款节点</text>
                <ReadOnlyTable v-else label="回款计划" :columns="paymentColumns" :rows="tableRows(section.entries.slice(1), 3, 3)" min-width="360px" />
              </template>
              <template v-if="section.key === 'processes'">
                <view v-if="section.entries[0]" class="plan-review__entry">
                  <text class="plan-review__name">验收安排</text>
                  <view v-for="field in section.entries[0].fields" :key="field[0]" class="plan-review__field"><text>{{ field[0] }}</text><text>{{ field[1] }}</text></view>
                </view>
                <text v-if="section.entries.length <= 1" class="plan-review__subtitle">暂无工序计划</text>
                <ReadOnlyTable v-else label="工序计划" :columns="processColumns" :rows="tableRows(section.entries.slice(1), 2, 2)" />
              </template>
              <template v-if="!['materials', 'people', 'payments', 'processes'].includes(section.key)">
              <view
                v-for="(entry, index) in displayEntries(section)"
                :key="index"
                class="plan-review__entry"
              >
                <button v-if="entry.location" class="plan-review__location-link" @click="locationPreview?.open(entry.location)">
                  <text>{{ entry.title }}</text><text class="plan-review__location-hint">查看地图 ›</text>
                </button>
                <text v-else
                  :class="
                    entry.group ? 'plan-review__group' : 'plan-review__name'
                  "
                  >{{ entry.title }}</text
                >
                <view
                  v-for="(field, fieldIndex) in entry.fields"
                  :key="fieldIndex"
                  class="plan-review__field"
                >
                  <text>{{ field[0] }}</text
                  ><text>{{ field[1] }}</text>
                </view>
                <button
                  v-if="entry.file"
                  class="plan-review__link"
                  @click="filePreview?.open(entry.file)"
                >
                  预览文件
                </button>
              </view>
              </template>
              <view v-if="section.key === 'materials'" class="plan-review__pagination">
                <button :disabled="materialPage <= 1" @click="loadSection(section, materialPage - 1)">上一页</button>
                <text>{{ materialPage }} / {{ Math.max(1, Math.ceil(materialTotal / materialPageSize)) }} · 共 {{ materialTotal }} 条</text>
                <button :disabled="materialPage * materialPageSize >= materialTotal" @click="loadSection(section, materialPage + 1)">下一页</button>
              </view>
            </template>
          </view>
        </view>
        <view v-if="rejecting" id="plan-reason" class="plan-review__reason">
          <text class="plan-review__name">驳回原因</text>
          <textarea
            v-model="rejectReason"
            :disabled="submitting"
            maxlength="2000"
            placeholder="请填写驳回原因"
            aria-label="驳回原因"
          />
          <text class="plan-review__subtitle"
            >驳回原因将记录到本轮审批。</text
          >
        </view>
        <text v-if="!readonly && !canAudit && !contextLoading" class="plan-review__notice">{{
          readonlyReason
        }}</text>
      </scroll-view>
      <view v-if="canAudit" class="plan-review__actions">
        <wd-button plain block :disabled="submitting" @click="secondary">{{
          rejecting ? "取消" : "驳回"
        }}</wd-button>
        <wd-button
          block
          :type="rejecting ? 'error' : 'primary'"
          :loading="submitting"
          :disabled="submitting"
          @click="decide(!rejecting)"
        >
          {{ rejecting ? "确认驳回" : "通过" }}
        </wd-button>
      </view>
    </view>
  </wd-popup>
  <ContractFilePreview ref="filePreview" />
  <PlanLocationPreview v-if="visible" ref="locationPreview" />
  <wd-popup v-model="confirmVisible" position="center" :root-portal="true" :z-index="2300" :close-on-click-modal="false" custom-style="width: min(88vw, 360px); border-radius: 12px;">
    <view class="plan-review__confirmation">
      <text class="plan-review__name">{{ confirmApprove ? '通过计划审批' : '驳回计划' }}</text>
      <text class="plan-review__subtitle">{{ confirmApprove ? '确认通过？项目将进入筹备中。' : '确认驳回？项目将回到未开始，驳回原因会保存。' }}</text>
      <view class="plan-review__actions">
        <wd-button plain block @click="finishConfirmation(false)">取消</wd-button>
        <wd-button block :type="confirmApprove ? 'primary' : 'error'" @click="finishConfirmation(true)">{{ confirmApprove ? '确认通过' : '确认驳回' }}</wd-button>
      </view>
    </view>
  </wd-popup>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref } from "vue";
import dayjs from "dayjs";
import { http } from "@/utils/http";
import { usePermissionStore } from "@/store/permission";
import { planApprovalApi, planList, planResult, resolvePeriodApproval, type PeriodApprovalRecord } from "@/service/planApproval";
import { parseTodoActionParams, resolvePlanApprovalPeriodId, type TodoRecord } from "@/service/todo";
import { useUserStore } from "@/store/user";
import type { ContractFile } from "@/utils/contractFile";
import ContractFilePreview from "./ContractFilePreview.vue";
import PlanLocationPreview from "@/pages/ops/components/PlanLocationPreview.vue";
import ReadOnlyTable from '@/components/ReadOnlyTable/ReadOnlyTable.vue';
import type { ReadOnlyColumn, ReadOnlyRow } from '@/components/ReadOnlyTable/types';
const locationPreview = ref<InstanceType<typeof PlanLocationPreview>>();

type Entry = {
  title: string;
  group?: string;
  fields: string[][];
  file?: ContractFile;
  location?: { locationName?: string; description?: string; longitude?: unknown; latitude?: unknown };
};
const makeColumns = (labels: string[], widths: string[], numeric = false): ReadOnlyColumn[] =>
  labels.map((label, index) => ({ key: index === 0 ? 'title' : `field${index - 1}`, label, width: widths[index], align: numeric && index > 0 ? 'right' : 'left' }));
const materialColumns = makeColumns(['物料', '合同量', '计划量', '库存', '单位'], ['minmax(120px, 1.8fr)', '1fr', '1fr', '1fr', '52px'], true);
materialColumns[4].align = 'center';
const paymentColumns = makeColumns(['回款项', '比例', '计划金额', '回款周期'], ['1.1fr', '.7fr', '1.4fr', '1fr'], true);
const processColumns = makeColumns(['工序', '现场负责人', '计划周期'], ['minmax(0, 1fr)', 'minmax(0, 1fr)', 'minmax(0, 1.8fr)']);
const peopleColumns = (headers: string[], outsource: boolean) => makeColumns(headers, outsource
  ? ['minmax(120px, 1.5fr)', '52px', '60px', 'minmax(80px, 1fr)', '120px']
  : ['minmax(0, 1fr)', 'minmax(0, 1.5fr)', 'minmax(0, 1fr)']);
const tableRows = (entries: Entry[], fieldCount: number, remarkIndex?: number): ReadOnlyRow[] => entries.map((entry, index) => {
  const remark = remarkIndex === undefined ? '' : entry.fields[remarkIndex]?.[1];
  return {
    key: index, title: entry.title,
    ...Object.fromEntries(Array.from({ length: fieldCount }, (_, i) => [`field${i}`, entry.fields[i]?.[1]])),
    ...(remark && remark !== '—' ? { remark } : {}),
  };
});
type Section = {
  key: string;
  title: string;
  expanded: boolean;
  visited: boolean;
  loading: boolean;
  failed: boolean;
  summary: string;
  entries: Entry[];
  raw: any;
};
const sections = reactive<Section[]>(
  [
    ["files", "方案文件"],
    ["materials", "用料计划"],
    ["people", "人员配置"],
    ["processes", "实施计划"],
    ["locations", "实施位置"],
    ["payments", "回款计划"],
  ].map(([key, title]) => ({
    key,
    title,
    expanded: false,
    visited: false,
    loading: false,
    failed: false,
    summary: "",
    entries: [],
    raw: null,
  })),
);
const permission = usePermissionStore();
const userStore = useUserStore();
const visible = ref(false);
const periodId = ref("");
const todoApprovalId = ref("");
const approvalHistory = ref<PeriodApprovalRecord[]>([]);
const projectLabel = ref("");
const project = ref<any>({});
const managerName = ref("");
const contextLoading = ref(false);
const contextFailed = ref(false);
const submitting = ref(false);
const rejecting = ref(false);
const rejectReason = ref("");
const keyword = ref("");
const materialPage = ref(1);
const materialTotal = ref(0);
const materialPageSize = 5;
const materialQuery = ref('');
const scrollTarget = ref("");
const filePreview = ref<InstanceType<typeof ContractFilePreview>>();
const emit = defineEmits<{ processed: [] }>();
let sequence = 0;
const approvalState = computed(() => resolvePeriodApproval(project.value, approvalHistory.value));
const pending = computed(() => approvalState.value.waiting);
const latestApproval = computed(() => [...approvalHistory.value].sort((a, b) => Number(b.roundNo) - Number(a.roundNo))[0]);
const props = defineProps<{ readonly?: boolean }>();
const canAudit = computed(
  () =>
    !props.readonly && !contextLoading.value &&
    !contextFailed.value &&
    pending.value &&
    !!todoApprovalId.value &&
    String(approvalState.value.current?.id) === todoApprovalId.value &&
    ((permission.loaded && permission.hasPermission("project:period:approve")) ||
      userStore.identity.roleCodes.includes("admin")),
);
const statusText = computed(() =>
  pending.value
    ? "待审批"
    : String(
        project.value.approvalStatus_dictText ||
          project.value.status_dictText ||
          project.value.status ||
          "状态待确认",
      ),
);
const readonlyReason = computed(() => {
  if (contextFailed.value) return "审批状态加载失败，请重试后审批";
  if (approvalState.value.legacy) return "当前计划为旧审批记录，请项目经理重新提交审批";
  if (!todoApprovalId.value) return "待办缺少审批轮次 ID，仅可查看";
  if (approvalState.value.current?.id !== todoApprovalId.value) return "此待办不是当前审批轮次，仅可查看";
  if (!pending.value) return "当前计划不在待审批状态，仅可查看";
  return "当前账号未取得计划审批权限，仅可查看";
});
const text = (value: any) =>
  value == null || value === "" ? "—" : String(value);
const fields = (values: any[][]): string[][] =>
  values.map(([label, value]) => [label, text(value)]);
const message = (title: string) => uni.showToast({ icon: "none", title });
const money = (value: any) =>
  value == null || value === "" || !Number.isFinite(Number(value))
    ? "—"
    : `${Number(value).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 元`;
async function dictionary(code: string) {
  const rows = planResult(await http.get(`/sys/dict/getDictItems/${code}`));
  return Object.fromEntries(
    (Array.isArray(rows) ? rows : []).map((row: any) => [
      String(row.value),
      row.text || row.label || row.value,
    ]),
  );
}
async function loadContext() {
  const current = sequence;
  contextLoading.value = true;
  contextFailed.value = false;
  try {
    const id = periodId.value;
    const [detail, period, history] = await Promise.all([
      planApprovalApi.context(id), planApprovalApi.state(id), planApprovalApi.history(id),
    ]);
    if (current === sequence) {
      project.value = { ...detail, ...period, status: String(period.status || '').toUpperCase() };
      approvalHistory.value = history;
    }
  } catch {
    if (current === sequence) {
      project.value = {};
      approvalHistory.value = [];
      contextFailed.value = true;
    }
  } finally {
    if (current === sequence) contextLoading.value = false;
  }
}
async function loadSection(section: Section, requestedPage = materialPage.value) {
  if (section.loading) return;
  const current = sequence;
  const id = periodId.value;
  section.loading = true;
  section.failed = false;
  try {
    let raw: any;
    let entries: Entry[] = [];
    let summary = "";
    if (section.key === "files") {
      const [rows, dict] = await Promise.all([
        planList("/project/plan/list", id),
        dictionary("plan_type"),
      ]);
      raw = rows.filter((row) => row.planType !== "CONTRACT_MATERIAL_DRAFT");
      entries = raw.map((row: any) => ({
        title: text(row.planName || row.fileName),
        fields: fields([
          [
            "类型",
            row.planType_dictText ||
              dict[row.fileType ?? row.planType] ||
              row.planType,
          ],
          ["备注", row.remark],
        ]),
        ...(row.fileId || row.planFileId
          ? {
              file: {
                path: row.fileId || row.planFileId,
                name: row.fileName || row.planName || "方案文件",
              },
            }
          : {}),
      }));
      summary = `${entries.length} 个文件`;
    } else if (section.key === "materials") {
      const query = requestedPage === 1 ? keyword.value.trim() : materialQuery.value;
      const result = planResult(await http.get('/project/materialAccount/page', {
        periodId: id, pageNo: requestedPage, pageSize: materialPageSize,
        ...(query ? { keyword: query } : {}),
      }));
      if (!Array.isArray(result?.records) || !Number.isFinite(Number(result.total))) throw new Error('用料总账分页响应异常');
      raw = result.records;
      if (current !== sequence) return;
      materialPage.value = requestedPage;
      materialTotal.value = Number(result.total);
      materialQuery.value = query;
      entries = raw.map((row: any) => ({
        title: `${text(row.materialName)}${row.brand || row.model ? `（${[row.brand, row.model].filter(Boolean).join('-')}）` : ''}`,
        fields: fields([
          ['合同数量', row.candidateQty],
          ['计划用量', row.plannedQty],
          ['库存', row.stockQty],
          ['基准单位', row.baseUnitName],
        ]),
      }));
      summary = `${materialTotal.value} 条物料`;
    } else if (section.key === "people") {
      const [members, outsources, dict] = await Promise.all([
        planList("/project/member/list", id),
        planList("/project/memberOutsource/list", id),
        dictionary("member_role"),
      ]);
      raw = { members, outsources };
      entries = [
        {
          title: "参与人员",
          group: "参与人员",
          fields: fields([["人数", members.length]]),
        },
        ...members.map((row: any) => ({
          title: text(row.userName || row.realname),
          fields: fields([
            [
              "角色",
              row.memberRole_dictText ||
                String(row.memberRole ?? "")
                  .split(",")
                  .map((code) => dict[code.trim()] || code.trim())
                  .join("、"),
            ],
            [
              "邀请状态",
              row.inviteStatus_dictText ||
                ({ "0": "已拒绝", "1": "已接受" } as any)[row.inviteStatus] ||
                "待接受",
            ],
          ]),
        })),
        {
          title: "外协",
          group: "外协",
          fields: fields([["单位数", outsources.length]]),
        },
        ...outsources.map((row: any) => ({
          title: text(row.unitName),
          fields: fields([
            ["计划人数", row.headcount],
            ["计划工时", row.workHours],
            ["联系人", row.contactPerson],
            ["联系电话", row.contactPhone],
            ["备注", row.remark],
          ]),
        })),
      ];
      summary = `${members.length} 位参与人员 · ${outsources.length} 个外协单位`;
    } else if (section.key === "processes") {
      const [result, dict] = await Promise.all([
        http.get("/project/process/detail", { periodId: id }),
        dictionary("work_type"),
      ]);
      raw = planResult(result);
      if (!Array.isArray(raw?.records)) throw new Error("实施计划响应异常");
      entries = [
        {
          title: "验收安排",
          fields: fields([
            ["计划验收日期", raw.plannedAcceptanceDate],
            ["验收备注", raw.plannedAcceptanceRemark],
          ]),
        },
        ...raw.records.map((row: any) => ({
          title: text(
            row.processName_dictText ||
              dict[row.processName] ||
              row.processName,
          ),
          fields: fields([
            ["现场负责人", row.siteLeaderName],
            ["计划周期", `${text(row.plannedStartTime)} - ${text(row.plannedEndTime)}`],
            ["备注", row.remark],
          ]),
        })),
      ];
      summary = `${raw.records.length} 道工序 · 验收 ${text(raw.plannedAcceptanceDate)}`;
    } else if (section.key === "locations") {
      raw = await planList("/project/location/list", id);
      entries = raw.map((row: any) => ({
        title: text(row.locationName),
        location: { locationName: row.locationName, description: row.description, longitude: row.longitude, latitude: row.latitude },
        fields: fields([
          ["位置说明", row.description],
          ["经度", row.longitude],
          ["纬度", row.latitude],
        ]),
      }));
      summary = `${entries.length} 个实施位置`;
    } else {
      const [result, dict] = await Promise.all([
        http.get("/project/contract/queryById", { periodId: id }),
        dictionary("payback_node"),
      ]);
      raw = planResult(result);
      if (!raw?.contract || !Array.isArray(raw.records))
        throw new Error("合同回款信息异常");
      if (current === sequence)
        managerName.value =
          raw.contract.projectManagerUserName ||
          raw.contract.projectManagerName ||
          "";
      entries = [
        {
          title: "合同概况",
          fields: fields([
            ["合同编号", raw.contract.contractNo],
            ["合同金额", money(raw.contract.contractAmount)],
            ["计划交付日期", raw.contract.plannedDeliveryDate],
          ]),
        },
        ...raw.records.map((row: any) => ({
          title: text(
            row.paymentNode_dictText ||
              dict[row.paymentNode] ||
              row.paymentNode,
          ),
          fields: fields([
            ["比例", row.ratio == null ? "—" : `${row.ratio}%`],
            ["计划金额", money(row.plannedAmount)],
            ["回款周期", `${row.rollbackTime ?? 7} 天`],
            ["备注", row.remark],
          ]),
        })),
      ];
      summary = `${raw.records.length} 个回款节点`;
    }
    if (current !== sequence) return;
    Object.assign(section, { raw, entries, summary });
  } catch {
    if (current === sequence)
      Object.assign(section, { failed: true, entries: [], raw: null });
  } finally {
    if (current === sequence) section.loading = false;
  }
}
function displayEntries(section: Section) {
  return section.entries;
}
function peopleTables(section: Section) {
  const count = section.raw?.members?.length || 0;
  return [
    { title: '参与人员', outsource: false, headers: ['姓名', '角色', '邀请状态'], rows: section.entries.slice(1, count + 1) },
    { title: '外协', outsource: true, headers: ['单位', '人数', '工时', '联系人', '联系电话'], rows: section.entries.slice(count + 2) },
  ];
}
function toggle(section: Section) {
  section.expanded = !section.expanded;
  if (section.expanded) section.visited = true;
}
async function focus(id: string) {
  scrollTarget.value = "";
  await nextTick();
  scrollTarget.value = id;
}
function secondary() {
  rejecting.value = !rejecting.value;
  if (rejecting.value) void focus("plan-reason");
}
function validation() {
  const unchecked = sections.find(
    (section) => !section.visited || section.loading || section.failed,
  );
  if (unchecked) {
    unchecked.expanded = true;
    unchecked.visited = true;
    void focus(`plan-${unchecked.key}`);
    return `请先核对「${unchecked.title}」并确认加载完成`;
  }
  const processes = sections.find(
    (section) => section.key === "processes",
  )!.raw;
  const people = sections.find((section) => section.key === "people")!.raw;
  if (
    !processes.plannedAcceptanceDate ||
    !dayjs(processes.plannedAcceptanceDate).isValid()
  )
    return "计划验收日期缺失或无效，请补充后再审批";
  for (const row of processes.records) {
    if (
      !row.processName ||
      !row.siteLeaderId ||
      !people.members.some(
        (member: any) =>
          String(member.userId) === String(row.siteLeaderId) &&
          String(member.inviteStatus) === "1",
      )
    )
      return "工序缺少有效的已接受邀请现场负责人";
    if (
      !row.plannedStartTime ||
      !row.plannedEndTime ||
      !dayjs(row.plannedStartTime).isValid() ||
      !dayjs(row.plannedEndTime).isValid() ||
      dayjs(row.plannedEndTime).isBefore(dayjs(row.plannedStartTime))
    )
      return "工序计划时间缺失或起止顺序有误";
  }
  // 总账含合同候选物料，plannedQty 为 0 合法；当前分页不能替代完整计划的后端校验。
  if (
    people.outsources.some(
      (row: any) =>
        !row.unitId ||
        !(Number(row.headcount) > 0) ||
        !(Number(row.workHours) > 0),
    )
  )
    return "外协单位、人数或工时不完整，请核对";
  return "";
}
const confirmVisible = ref(false);
const confirmApprove = ref(true);
let resolveConfirmation: ((value: boolean) => void) | undefined;
function finishConfirmation(value: boolean) {
  confirmVisible.value = false;
  resolveConfirmation?.(value);
  resolveConfirmation = undefined;
}
async function decide(approve: boolean) {
  if (!canAudit.value || submitting.value) return;
  const expectedPeriodId = periodId.value;
  const expectedApprovalId = todoApprovalId.value;
  const expectedToken = userStore.userInfo.token;
  const expectedUserId = userStore.identity.userId;
  const error = approve
    ? validation()
    : !rejectReason.value.trim()
      ? "请填写驳回原因"
      : rejectReason.value.trim().length > 2000
        ? "驳回原因最多 2000 字"
      : "";
  if (error) return message(error);
  submitting.value = true;
  try {
    confirmApprove.value = approve;
    const confirmed = await new Promise<boolean>((resolve) => {
      resolveConfirmation = resolve;
      confirmVisible.value = true;
    });
    if (!confirmed) return;
    await loadContext();
    if (periodId.value !== expectedPeriodId ||
      todoApprovalId.value !== expectedApprovalId ||
      userStore.userInfo.token !== expectedToken ||
      userStore.identity.userId !== expectedUserId ||
      !canAudit.value) return message("审批轮次、项目状态或权限已变化，请刷新后查看");
    await planApprovalApi.decide(expectedPeriodId, expectedApprovalId, approve, rejectReason.value.trim());
    visible.value = false;
    sequence++;
    emit("processed");
    message(
      approve
        ? "审批通过，项目已进入筹备中"
        : "审批已驳回，项目回到未开始",
    );
  } catch (error: any) {
    message(error?.message || "审批结果未确认，请刷新后查看，请勿重复提交");
  } finally {
    submitting.value = false;
    if (visible.value) void loadContext();
  }
}
function close() {
  if (submitting.value) return;
  visible.value = false;
  sequence++;
}
function open(item: TodoRecord) {
  if (submitting.value) return;
  const id = resolvePlanApprovalPeriodId(item);
  if (!id) return message("当前待办缺少项目分期信息");
  sequence++;
  periodId.value = id;
  todoApprovalId.value = String(parseTodoActionParams(item.actionParams).approvalId || '');
  approvalHistory.value = [];
  projectLabel.value = String(item.summary || "");
  project.value = {};
  managerName.value = "";
  keyword.value = "";
  materialPage.value = 1;
  materialTotal.value = 0;
  materialQuery.value = '';
  rejecting.value = false;
  rejectReason.value = "";
  scrollTarget.value = "";
  sections.forEach((section) =>
    Object.assign(section, {
      expanded: false,
      visited: false,
      loading: false,
      failed: false,
      entries: [],
      raw: null,
      summary: "",
    }),
  );
  visible.value = true;
  void loadContext();
  sections.forEach((section) => void loadSection(section));
}
defineExpose({ open });
</script>

<style scoped lang="scss">
.plan-review__location-link {
  display: flex;
  width: 100%;
  min-height: 44px;
  margin: 0;
  padding: 0;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: transparent;
  color: #176ac7;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.5;
  text-align: left;
  overflow-wrap: anywhere;
}
.plan-review__location-link::after { border: 0; }
.plan-review__location-link:focus-visible { outline: 2px solid #176ac7; outline-offset: 2px; }
.plan-review__location-hint { flex-shrink: 0; font-size: 14px; font-weight: 400; }
.plan-review {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 680px;
  height: 92vh;
  height: 92dvh;
  margin: auto;
  background: #f5f6f8;
}
.plan-review__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: #fff;
  border-bottom: 1px solid #e1e6ec;
}
.plan-review__title {
  font-size: 18px;
  font-weight: 600;
  color: #27364a;
}
.plan-review__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  margin: 0;
  background: transparent;
}
.plan-review__body {
  height: 0;
  min-height: 0;
  flex: 1;
}
.plan-review__context {
  padding: 16px;
}
.plan-review__project,
.plan-review__subtitle,
.plan-review__name,
.plan-review__group {
  display: block;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.plan-review__project {
  color: #27364a;
  font-size: 17px;
  font-weight: 600;
}
.plan-review__subtitle,
.plan-review__summary {
  color: #596574;
  font-size: 13px;
}
.plan-review__section {
  margin: 0 12px 10px;
  background: #fff;
  border: 1px solid #e1e6ec;
  border-radius: 12px;
  overflow: hidden;
}
.plan-review__toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 14px 12px;
  margin: 0;
  background: #fff;
  text-align: left;
  font-size: 16px;
  line-height: 1.5;
  color: #27364a;
}
.plan-review__heading {
  min-width: 0;
  flex: 1;
}
.plan-review__summary {
  display: block;
  margin-top: 4px;
  overflow-wrap: anywhere;
}
.plan-review__content {
  padding: 0 12px 12px;
}
.plan-review__entry {
  padding: 12px 0;
  border-top: 1px solid #edf0f3;
}
.plan-review__name {
  color: #27364a;
  font-size: 15px;
  font-weight: 600;
}
.plan-review__group {
  margin-bottom: 6px;
  color: #176ac7;
  font-size: 14px;
}
.plan-review__field {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-top: 6px;
  font-size: 14px;
  line-height: 1.6;
}
.plan-review__field > text:first-child {
  flex: 0 0 88px;
  color: #596574;
}
.plan-review__field > text:last-child {
  min-width: 0;
  flex: 1;
  text-align: right;
  color: #27364a;
  overflow-wrap: anywhere;
}
.plan-review__link {
  min-height: 44px;
  padding: 10px 0;
  margin: 0;
  background: transparent;
  color: #176ac7;
  font-size: 14px;
  line-height: 1.6;
  text-align: left;
}
.plan-review__search {
  min-width: 0;
  flex: 1;
  height: 44px;
  padding: 0 10px;
  margin-bottom: 0;
  border: 1px solid #ccd5df;
  border-radius: 8px;
  font-size: 14px;
}
.plan-review__search-row { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.plan-review__confirmation { padding: 20px 16px 4px; }
.plan-review__confirmation > .plan-review__subtitle { margin-top: 12px; }
.plan-review__confirmation .plan-review__actions { margin-top: 16px; padding: 12px 0; }
.plan-review__people-group + .plan-review__people-group { margin-top: 16px; }
.plan-review__people-scroll { width: 100%; overflow-x: auto; margin-top: 8px; }
.plan-review__query { flex: none; min-height: 44px; margin: 0; padding: 8px 12px; color: #176ac7; background: #edf5ff; font-size: 14px; line-height: 28px; }
.plan-review__pagination { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-top: 12px; font-size: 12px; color: #596574; }
.plan-review__pagination button { flex: none; min-height: 44px; padding: 8px; margin: 0; font-size: 13px; line-height: 28px; color: #176ac7; background: #f5f6f8; }
.plan-review__pagination button[disabled] { color: #68788a; opacity: .5; }
.plan-review__reason {
  padding: 16px;
  background: #fff;
}
.plan-review__reason textarea {
  box-sizing: border-box;
  width: 100%;
  height: 110px;
  padding: 10px;
  margin: 10px 0;
  border: 1px solid #ccd5df;
  border-radius: 8px;
  font-size: 15px;
}
.plan-review__notice {
  display: block;
  padding: 12px 16px 24px;
  color: #596574;
  font-size: 14px;
}
.plan-review__actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 12px 16px;
  background: #fff;
  border-top: 1px solid #e1e6ec;
}
button::after {
  border: 0;
}
button:active {
  opacity: 0.75;
}
button:focus-visible {
  outline: 2px solid #176ac7;
  outline-offset: -2px;
}
</style>
