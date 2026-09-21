<template>
  <view class="rework">
    <view class="title">返工申请与审批记录</view>
    <text v-if="error" class="notice">{{ error }}</text>
    <button :disabled="busy" @click="load(true)">刷新返工记录</button>
    <template v-if="!editing">
      <button
        v-for="source in sources"
        :key="source.id"
        :disabled="busy"
        @click="create(source)"
      >
        申请返工（{{
          source.acceptType === "INTERNAL" ? "内部" : "外部"
        }}验收不通过）
      </button>
      <text v-if="!rows.length && !busy && !error">暂无返工记录</text>
      <view v-for="row in rows" :key="row.id" class="record">
        <text
          >{{ row.reworkNo || "返工申请" }} ·
          {{ approvalText(row.approvalStatus) }}</text
        >
        <text
          >申请人：{{ row.applyUserName || "—" }} ·
          {{ row.submitTime || row.applyTime || "—" }}</text
        >
        <text>原因：{{ row.reason || "—" }}</text
        ><text>预计再次验收日期：{{ row.expectedAcceptanceDate || "—" }}</text>
        <text
          >审批人：{{ row.approvalUserName || "—" }}；意见：{{
            row.approvalReason || "—"
          }}</text
        >
        <button :disabled="busy" @click="view(row.id)">查看 / 办理</button>
      </view>
      <button v-if="rows.length < total" :disabled="busy" @click="load(false)">
        加载更多
      </button>
      <view v-if="selected.id" class="record">
        <view class="title">{{ "返工详情" }}</view
        ><text
          >预计再次验收日期：{{ selected.expectedAcceptanceDate || "—" }}</text
        >
        <text
          >审批：{{ approvalText(selected.approvalStatus) }}；实施：{{
            executionText(selected)
          }}</text
        >
        <view v-for="(process, index) in plan.process" :key="index"
          ><text>{{ process.processName }}</text
          ><text>现场负责人：{{ process.siteLeaderName || "—" }}</text>
          <text
            >计划：{{ process.plannedStartTime || "—" }} 至
            {{ process.plannedEndTime || "—" }}；预计
            {{ process.plannedHours ?? "—" }} 小时</text
          >
        </view>
        <text v-for="item in plan.outsources" :key="item.unitId"
          >{{ item.unitName || item.unitId }}：{{ item.headcount }}人，{{
            item.workHours
          }}小时</text
        >
        <text v-for="(item, index) in plan.materials" :key="item.materialId"
          >额外领料 {{ index + 1 }}：{{
            item.materialName || item.materialId
          }}
          × {{ item.plannedQty }}</text
        >
        <view class="title">提交和审批历史</view>
        <text v-if="!history.length">暂无历史明细</text>
        <view v-for="(entry, index) in history" :key="index" class="record"
          ><text v-for="(value, key) in entry" :key="key"
            >{{ historyLabel(String(key)) }}：{{ value ?? "—" }}</text
          ></view
        >
        <button
          v-if="canEdit(selected)"
          :disabled="busy"
          @click="edit(selected)"
        >
          修改 / 提交申请
        </button>
        <button
          v-if="canWithdraw(selected)"
          :disabled="busy"
          @click="act('withdraw')"
        >
          撤回申请
        </button>
        <template v-if="canApprove(selected)">
          <textarea
            v-model="comment"
            placeholder="审批意见；驳回时必填"
            :disabled="busy"
          />
          <button :disabled="busy" @click="act('AGREE')">通过返工申请</button
          ><button :disabled="busy" @click="act('REJECT')">驳回返工申请</button>
        </template>
        <button
          v-for="process in selected.processes ||
          (selected.processId ? [{ id: selected.processId }] : [])"
          :key="process.id"
          :disabled="busy"
          @click="logs(process.id)"
        >
          查看{{ process.processName || "本轮" }}实施日志
        </button>
        <text v-if="String(selected.approvalStatus) === '1'"
          >审批通过后使用项目实施入口签到、写日志并签退；一次签退不代表整个返工完成。</text
        >
      </view>
    </template>
    <view v-else class="form">
      <text>返工原因（必填）</text
      ><textarea
        v-model="form.reason"
        :disabled="busy"
        placeholder="说明返工原因"
      />
      <text>返工说明</text
      ><textarea
        v-model="form.description"
        :disabled="busy"
        placeholder="选填"
      />
      <view
        v-for="(process, index) in form.process"
        :key="index"
        class="record"
      >
        <text>工序名称（必填）</text
        ><input
          v-model="process.processName"
          :disabled="busy"
          placeholder="请输入工序名称"
        />
        <text>现场负责人（必填）</text
        ><picker
          :range="leaders"
          range-key="label"
          :disabled="busy"
          @change="chooseLeader($event, process)"
          ><view class="readonly">{{
            process.siteLeaderName || "请选择"
          }}</view></picker
        >
        <text>计划开始日期（必填）</text
        ><picker
          mode="date"
          :value="process.plannedStartTime"
          :disabled="busy"
          @change="process.plannedStartTime = $event.detail.value"
          ><view class="readonly">{{
            process.plannedStartTime || "请选择"
          }}</view></picker
        >
        <text>计划结束日期（必填）</text
        ><picker
          mode="date"
          :value="process.plannedEndTime"
          :disabled="busy"
          @change="process.plannedEndTime = $event.detail.value"
          ><view class="readonly">{{
            process.plannedEndTime || "请选择"
          }}</view></picker
        >
        <text>预计工时（必填，小时）</text
        ><input
          v-model="process.plannedHours"
          type="digit"
          :disabled="busy"
          placeholder="请输入预计工时"
        />
        <button :disabled="busy" @click="form.process.splice(index, 1)">
          移除工序
        </button></view
      >
      <button
        :disabled="busy"
        @click="form.process.push({ processName: '', plannedHours: '' })"
      >
        添加工序
      </button>
      <text>预计再次验收日期（选填）</text>
      <picker
        mode="date"
        :value="form.expectedAcceptanceDate || ''"
        :disabled="busy"
        @change="form.expectedAcceptanceDate = $event.detail.value"
        ><view class="readonly">{{
          form.expectedAcceptanceDate || "请选择日期"
        }}</view></picker
      >
      <text v-if="expectedDateError" role="alert">{{ expectedDateError }}</text>
      <button
        v-if="form.expectedAcceptanceDate"
        :disabled="busy"
        @click="form.expectedAcceptanceDate = null"
      >
        清空预计验收日期
      </button>
      <text>是否需要补料</text
      ><switch
        :checked="needsMaterials"
        :disabled="busy"
        @change="
          needsMaterials = $event.detail.value;
          needsMaterials && materialPage === 0 && loadMaterials();
        "
      />
      <template v-if="needsMaterials">
        <text>额外领料计划（无额外领料可留空，不重复申请现场余料）</text>
        <view
          v-for="(item, index) in form.materials"
          :key="item.materialId"
          class="record"
          ><text>{{ item.materialName || item.materialId }}</text
          ><input
            v-model="item.plannedQty"
            type="digit"
            :disabled="busy"
            placeholder="额外领料数量（必填，大于0）"
          /><button :disabled="busy" @click="form.materials.splice(index, 1)">
            移除
          </button></view
        >
        <button
          :disabled="busy"
          @click="
            materialPage === 0 ? loadMaterials() : (choosingMaterial = true)
          "
        >
          选择额外领料物料
        </button>
        <template v-if="choosingMaterial"
          ><input
            v-model="materialKeyword"
            placeholder="搜索已加载物料名称或编码"
          /><picker
            :range="availableMaterials"
            range-key="label"
            :disabled="busy"
            @change="chooseMaterial"
            ><view class="readonly"
              >请选择物料（已选物料不重复显示）</view
            ></picker
          ><button v-if="materialMore" :disabled="busy" @click="loadMaterials">
            加载更多物料
          </button></template
        >
      </template>
      <text>是否需要外协</text
      ><switch
        :checked="needsOutsource"
        :disabled="busy"
        @change="
          needsOutsource = $event.detail.value;
          needsOutsource && outsourcePage === 0 && loadOutsources();
        "
      />
      <template v-if="needsOutsource">
        <view
          v-for="(item, index) in form.outsources"
          :key="index"
          class="record"
        >
          <text>外协单位（必选）</text
          ><picker
            :range="availableOutsources(index)"
            range-key="unitName"
            :disabled="busy"
            @change="chooseOutsource($event, index)"
            ><view class="readonly">{{
              item.unitName || "请选择外协单位"
            }}</view></picker
          >
          <text>人数（至少1人）</text
          ><input v-model="item.headcount" type="number" :disabled="busy" />
          <text>工时（大于0，最多两位小数）</text
          ><input v-model="item.workHours" type="digit" :disabled="busy" />
          <button :disabled="busy" @click="form.outsources.splice(index, 1)">
            移除外协
          </button>
        </view>
        <button
          :disabled="busy"
          @click="
            form.outsources.push({ unitId: '', headcount: 1, workHours: '' })
          "
        >
          添加外协
        </button>
        <button v-if="outsourceMore" :disabled="busy" @click="loadOutsources">
          加载更多外协单位
        </button>
      </template>
      <button type="primary" :disabled="busy" @click="save()">提交审批</button
      ><button :disabled="busy" @click="editing = false">取消编辑</button>
    </view>
  </view>
</template>
<script setup lang="ts">
import { computed, ref, watch } from "vue";
import dayjs from "dayjs";
import { expectedAcceptanceDate } from "@/utils/expectedAcceptanceDate";
import { useToast } from "wot-design-uni";
import { useUserStore } from "@/store/user";
import { usePermissionStore } from "@/store/permission";
import { http } from "@/utils/http";
import { reworkApi, reworkName, reworkPlan } from "@/service/projectRework";
import { assertAcceptanceApplication } from "@/service/projectAcceptance";
const props = defineProps<{
  periodId: string;
  project: any;
  failedSources: any[];
  initialReworkId?: string;
  initialSource?: any;
}>();
const emit = defineEmits<{ changed: []; busy: [value: boolean] }>();
const toast = useToast(),
  user = useUserStore(),
  permission = usePermissionStore();
const busy = ref(false),
  error = ref(""),
  rows = ref<any[]>([]),
  total = ref(0),
  page = ref(0),
  selected = ref<any>({}),
  editing = ref(false),
  comment = ref("");
const form = ref<any>({ process: [], materials: [], outsources: [] }),
  plan = ref<any>({ process: [], materials: [], outsources: [] }),
  leaders = ref<any[]>([]);
const needsMaterials = ref(false),
  needsOutsource = ref(false);
const outsourceOptions = ref<any[]>([]),
  outsourcePage = ref(0),
  outsourceMore = ref(true);
const availableOutsources = (index: number) =>
  outsourceOptions.value.filter(
    (row) =>
      !form.value.outsources.some(
        (item: any, i: number) =>
          i !== index && String(item.unitId) === String(row.id),
      ),
  );
function chooseOutsource(event: any, index: number) {
  const row = availableOutsources(index)[Number(event.detail.value)];
  if (row)
    Object.assign(form.value.outsources[index], {
      unitId: String(row.id),
      unitName: row.unitName,
    });
}
async function loadOutsources() {
  await run(async () => {
    if (!outsourceMore.value) return;
    const r: any = await http.get("/project/outsourcingUnit/list", {
      status: 0,
      pageNo: outsourcePage.value + 1,
      pageSize: 50,
    });
    const rows = r.result?.records;
    if (!Array.isArray(rows)) throw new Error("外协列表响应异常");
    outsourceOptions.value.push(...rows);
    outsourcePage.value++;
    outsourceMore.value =
      rows.length > 0 &&
      (r.result.total != null
        ? outsourceOptions.value.length < Number(r.result.total)
        : rows.length === 50);
  });
}
function buildOutsources() {
  if (!needsOutsource.value) return [];
  if (!form.value.outsources.length)
    throw new Error("需要外协时至少添加一家外协单位");
  const seen = new Set<string>();
  return form.value.outsources.map((row: any) => {
    if (!row.unitId || seen.has(row.unitId))
      throw new Error("请选择外协单位，且不能重复");
    seen.add(row.unitId);
    const headcount = Number(row.headcount),
      workHours = Number(row.workHours);
    if (!Number.isInteger(headcount) || headcount < 1)
      throw new Error("外协人数必须为至少1人的整数");
    if (
      !Number.isFinite(workHours) ||
      workHours <= 0 ||
      workHours > 99999999.99 ||
      Math.abs(workHours * 100 - Math.round(workHours * 100)) > 0.00001
    )
      throw new Error("外协工时必须大于0，最多两位小数");
    return { unitId: row.unitId, headcount, workHours };
  });
}
const expectedDateError = computed(() => {
  try {
    expectedAcceptanceDate(
      form.value.expectedAcceptanceDate,
      form.value.process || [],
    );
    return "";
  } catch (error: any) {
    return error.message;
  }
});
const choosingMaterial = ref(false),
  materialRows = ref<any[]>([]),
  materialPage = ref(0),
  materialMore = ref(true),
  materialKeyword = ref("");
const userId = computed(() =>
  String(user.userInfo.userid || (user.userInfo as any).id || ""),
);
const canEdit = (row: any) =>
  permission.hasPermission("project:rework:apply") &&
  !!userId.value &&
  String(row.applyUserId) === userId.value &&
  ["-1", "0", "3"].includes(String(row.approvalStatus));
const canWithdraw = (row: any) =>
  permission.hasPermission("project:rework:apply") &&
  !!userId.value &&
  String(row.applyUserId) === userId.value &&
  String(row.approvalStatus) === "2";
const canApprove = (row: any) =>
  permission.hasPermission("project:rework:approve") &&
  String(row.approvalStatus) === "2";
const sources = computed(() =>
  permission.hasPermission("project:rework:apply") ? props.failedSources : [],
);
const approvalText = (status: any) =>
  ({ "-1": "待提交", "0": "驳回", "1": "通过", "2": "待审批", "3": "已撤回" })[
    String(status)
  ] || "待提交";
const executionText = (row: any) =>
  String(row.approvalStatus) !== "1"
    ? "尚未进入实施"
    : { NOT_STARTED: "未开始", IN_PROGRESS: "返工中", COMPLETED: "已完成" }[
        row.executionStatus
      ] || "—";
const history = computed(() => {
  try {
    const value =
      typeof selected.value.historyJson === "string"
        ? JSON.parse(selected.value.historyJson)
        : selected.value.historyJson;
    return Array.isArray(value)
      ? value.filter((row) => row && typeof row === "object")
      : [];
  } catch {
    return [];
  }
});
const historyLabel = (key: string) =>
  ({
    action: "操作",
    actionType: "操作",
    operateTime: "时间",
    time: "时间",
    operatorName: "操作人",
    userName: "操作人",
    approvalComment: "审批意见",
    comment: "意见",
    remark: "说明",
    approvalStatus: "审批状态",
  })[key] || key;
const availableMaterials = computed(() =>
  materialRows.value
    .filter(
      (row) =>
        !form.value.materials.some(
          (item: any) => String(item.materialId) === String(row.id),
        ) &&
        `${row.materialName || ""} ${row.materialCode || ""}`
          .toLowerCase()
          .includes(materialKeyword.value.toLowerCase()),
    )
    .map((row) => ({
      ...row,
      label: `${row.materialName || "未命名"} ${row.materialCode || ""}`,
    })),
);
async function run(action: () => Promise<void>) {
  if (busy.value) return;
  busy.value = true;
  try {
    await action();
  } catch (e: any) {
    toast.warning(e?.message || "操作失败，请重试");
  } finally {
    busy.value = false;
  }
}
async function readRows(reset: boolean) {
  const next = reset ? 1 : page.value + 1;
  const response: any = await reworkApi.list(props.periodId, next);
  rows.value = reset
    ? response.result.records
    : [...rows.value, ...response.result.records];
  page.value = next;
  total.value = Number(response.result.total || 0);
}
async function load(reset = true) {
  await run(async () => {
    error.value = "";
    try {
      await readRows(reset);
    } catch (e: any) {
      error.value = e?.message || "返工记录加载失败";
      throw e;
    }
  });
}
async function readDetail(id: string) {
  const response: any = await reworkApi.detail(id);
  const row = response.result;
  if (!row || String(row.periodId) !== props.periodId)
    throw new Error("返工记录与项目不匹配");
  return row;
}
async function view(id: string) {
  await run(async () => {
    selected.value = {};
    const row = await readDetail(id);
    plan.value = reworkPlan(row);
    selected.value = row;
    comment.value = "";
  });
}
async function loadLeaders() {
  const result: any[] = [];
  for (let pageNo = 1; ; pageNo++) {
    const r: any = await http.get("/project/member/list", {
      periodId: props.periodId,
      pageNo,
      pageSize: 100,
    });
    const list = r.result?.records || [];
    result.push(...list);
    if (
      !list.length ||
      (r.result.total != null
        ? result.length >= Number(r.result.total)
        : list.length < 100)
    )
      break;
  }
  leaders.value = [
    ...new Map(
      result
        .filter(
          (row) =>
            String(row.inviteStatus) === "1" && !Number(row.delFlag || 0),
        )
        .map((row) => [
          String(row.userId),
          {
            value: String(row.userId),
            label: row.memberName || row.userName || row.realname || row.userId,
          },
        ]),
    ).values(),
  ];
}
async function create(source: any) {
  await run(async () => {
    if (!sources.value.some((row) => row.id === source.id))
      throw new Error("当前不可申请返工");
    await readRows(true);
    while (rows.value.length < total.value) await readRows(false);
    const existing = rows.value.find(
      (row) => String(row.sourceAcceptanceId) === String(source.id),
    );
    if (existing) {
      const detail = await readDetail(existing.id);
      plan.value = reworkPlan(detail);
      selected.value = detail;
      toast.info("该验收已有返工申请，请在下方详情中修改或办理");
      return;
    }
    await assertAcceptanceApplication(
      props.periodId,
      userId.value,
      String(source.id),
      "rework",
    );
    await loadLeaders();
    form.value = {
      sourceAcceptanceId: source.id,
      reason: "",
      description: "",
      expectedAcceptanceDate: null,
      process: [
        {
          processName: await reworkName(
            String(source.reworkId || ""),
            props.periodId,
          ),
          plannedHours: "",
        },
      ],
      materials: [],
      outsources: [],
    };
    needsMaterials.value = false;
    needsOutsource.value = false;
    editing.value = true;
  });
}
async function edit(row: any) {
  await run(async () => {
    const latest = await readDetail(row.id);
    if (!canEdit(latest)) throw new Error("申请状态或权限已变化");
    await loadLeaders();
    const saved = reworkPlan(latest);
    form.value = {
      ...latest,
      process: saved.process.map((item: any) => ({ ...item })),
      outsources: saved.outsources.map((item: any) => ({ ...item })),
      materials: saved.materials.map((item: any) => ({ ...item })),
    };
    needsMaterials.value = saved.materials.length > 0;
    needsOutsource.value = saved.outsources.length > 0;
    editing.value = true;
  });
}
function chooseLeader(event: any, process: any) {
  const row = leaders.value[Number(event.detail.value)];
  if (row)
    Object.assign(process, {
      siteLeaderId: row.value,
      siteLeaderName: row.label,
    });
}
async function loadMaterials() {
  await run(async () => {
    choosingMaterial.value = true;
    if (!materialMore.value) return;
    const r: any = await http.get("/stock/material/list", {
      pageNo: materialPage.value + 1,
      pageSize: 100,
    });
    const list = r.result?.records || [];
    materialRows.value.push(...list);
    materialPage.value++;
    materialMore.value =
      list.length > 0 &&
      (r.result.total != null
        ? materialRows.value.length < Number(r.result.total)
        : list.length >= 100);
  });
}
function chooseMaterial(event: any) {
  const row = availableMaterials.value[Number(event.detail.value)];
  if (row)
    form.value.materials.push({
      materialId: String(row.id),
      materialName: row.materialName,
      plannedQty: "",
    });
}
async function save() {
  await run(async () => {
    if (!permission.hasPermission("project:rework:apply"))
      throw new Error("无返工申请权限");
    const f = form.value;
    if (!String(f.reason || "").trim()) throw new Error("请填写返工原因");
    if (!f.process.length) throw new Error("请至少添加一道工序");
    const names = new Set<string>();
    for (const p of f.process) {
      const name = String(p.processName || "").trim();
      if (!name || names.has(name)) throw new Error("工序名称必填且不能重复");
      names.add(name);
      if (
        !p.siteLeaderId ||
        !leaders.value.some((row) => row.value === p.siteLeaderId)
      )
        throw new Error("请选择现场负责人");
      if (
        !p.plannedStartTime ||
        !p.plannedEndTime ||
        !dayjs(p.plannedStartTime).isValid() ||
        !dayjs(p.plannedEndTime).isValid() ||
        dayjs(p.plannedEndTime).isBefore(dayjs(p.plannedStartTime))
      )
        throw new Error("请填写有效计划日期，结束不能早于开始");
      if (
        p.plannedHours === "" ||
        p.plannedHours == null ||
        !Number.isFinite(Number(p.plannedHours)) ||
        Number(p.plannedHours) < 0
      )
        throw new Error("预计工时必填且不能小于0");
    }
    const expectedDate = expectedAcceptanceDate(
      f.expectedAcceptanceDate,
      f.process,
    );
    const materials = needsMaterials.value ? f.materials : [];
    if (needsMaterials.value && !materials.length)
      throw new Error("需要补料时至少添加一种物料");
    const outsources = buildOutsources();
    if (
      materials.some(
        (item: any) =>
          !Number.isFinite(Number(item.plannedQty)) ||
          Number(item.plannedQty) <= 0,
      )
    )
      throw new Error("已选物料的额外领料数量必填且大于0");
    if (f.id) {
      const latest = await readDetail(f.id);
      if (!canEdit(latest) || latest.version !== f.version)
        throw new Error("返工申请已被修改，请退出后重新打开");
    }
    if (!permission.hasPermission("project:rework:apply"))
      throw new Error("当前账号无返工申请权限");
    await assertAcceptanceApplication(
      props.periodId,
      userId.value,
      String(f.sourceAcceptanceId),
      "rework",
      String(f.id || ""),
    );
    const r: any = await reworkApi.submit({
      ...(f.id ? { id: f.id, version: f.version } : {}),
      periodId: props.periodId,
      sourceAcceptanceId: f.sourceAcceptanceId,
      reason: f.reason.trim(),
      description: f.description || "",
      expectedAcceptanceDate: expectedDate,
      process: f.process.map((p: any) => ({
        ...p,
        processName: p.processName.trim(),
        plannedHours: Number(p.plannedHours),
      })),
      outsources,
      materials: materials.map((item: any) => ({
        materialId: item.materialId,
        ...(item.unitId ? { unitId: item.unitId } : {}),
        plannedQty: Number(item.plannedQty),
        remark: item.remark || "",
      })),
    });
    if (!r.result?.id)
      throw new Error("保存响应缺少返工ID，请刷新核实，勿重复新增");
    f.id = r.result.id;
    f.version = r.result.version;
    editing.value = false;
    selected.value = {};
    toast.success("已提交，等待返工审批");
    emit("changed");
    await readRows(true);
  });
}
async function act(action: "withdraw" | "AGREE" | "REJECT") {
  await run(async () => {
    if (action === "REJECT" && !comment.value.trim())
      throw new Error("请填写驳回原因");
    const confirmed = await new Promise<boolean>((resolve) =>
      uni.showModal({
        title: "确认操作",
        content:
          action === "AGREE"
            ? "通过后生成返工工序并进入返工阶段，确认通过？"
            : action === "REJECT"
              ? "确认驳回返工申请？"
              : "确认撤回返工申请？",
        success: (r) => resolve(!!r.confirm),
        fail: () => resolve(false),
      }),
    );
    if (!confirmed) return;
    const row = await readDetail(selected.value.id);
    if (
      row.version == null ||
      (action === "withdraw" ? !canWithdraw(row) : !canApprove(row))
    )
      throw new Error("状态或权限已变化，请刷新");
    const payload = { reworkId: row.id, version: row.version };
    if (action === "withdraw") await reworkApi.withdraw(payload);
    else
      await reworkApi.approve({
        ...payload,
        approvalResult: action,
        approvalComment: comment.value.trim(),
      });
    selected.value = {};
    toast.success("操作成功");
    emit("changed");
    await readRows(true);
  });
}
function logs(processId: string) {
  uni.navigateTo({
    url: `/pages/ops/implementRecords?periodId=${encodeURIComponent(props.periodId)}&processId=${encodeURIComponent(processId)}`,
  });
}
watch(busy, (value) => emit("busy", value), { flush: "sync" });
watch(
  () => props.periodId,
  async () => {
    rows.value = [];
    selected.value = {};
    editing.value = false;
    await load(true);
    if (props.initialReworkId) await view(props.initialReworkId);
    else if (props.initialSource) await create(props.initialSource);
  },
  { immediate: true },
);
</script>
<style scoped>
.rework {
  margin-top: 24px;
  border-top: 1px solid #e3e8ee;
  padding-top: 16px;
  color: #253247;
}
.title {
  font-size: 18px;
  font-weight: 600;
  margin: 12px 0;
}
.record,
.form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 0;
  border-bottom: 1px solid #e3e8ee;
  font-size: 14px;
  overflow-wrap: anywhere;
}
.readonly,
input,
textarea {
  padding: 10px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  min-height: 44px;
  box-sizing: border-box;
  font-size: 16px;
  width: 100%;
}
textarea {
  height: 96px;
}
button {
  margin: 8px 0;
  min-height: 44px;
  font-size: 14px;
  line-height: 1.6;
  padding: 10px;
}
.notice {
  color: #9a3412;
}
</style>
