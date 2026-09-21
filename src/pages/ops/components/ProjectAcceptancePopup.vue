<template>
  <wd-popup
    v-model="visible"
    position="bottom"
    :root-portal="true"
    :close-on-click-modal="false"
    :safe-area-inset-bottom="true"
    custom-style="border-radius:16px 16px 0 0;overflow:hidden;"
  >
    <view class="acceptance">
      <view class="acceptance__head"
        ><text>验收</text
        ><button :disabled="busy" @click="close">关闭</button></view
      >
      <scroll-view scroll-y :scroll-into-view="focusedSection" class="acceptance__body">
        <view v-if="identityError"><text>{{ identityError }}</text><button @click="loadIdentity">重试身份查询</button></view>
        <text v-if="loading">正在加载验收记录…</text>
        <view v-else-if="error"
          ><text>{{ error }}</text
          ><button @click="load">重新加载</button></view
        >
        <template v-else>
          <text v-if="!visibleTypes.length" class="acceptance__muted"
            >当前账号无内部或外部验收办理权限</text
          >
          <view
            v-for="type in visibleTypes"
            :id="`acceptance-${type}`"
            :key="type"
            class="acceptance__section"
          >
            <view class="acceptance__title">{{
              type === "INTERNAL" ? "内部验收" : "外部验收"
            }}</view>
            <text v-if="!forms[type].id">当前施工轮次暂无验收记录</text>
            <view v-else-if="!canEdit(type)" class="acceptance__field">
              <text>状态：{{ statusText(forms[type]) }}</text>
              <text
                >验收负责人：{{
                  forms[type].acceptLeaderName ||
                  "—"
                }}</text
              >
              <text v-if="type === 'CUSTOMER'">客户验收负责人：{{ forms[type].acceptUnitLeader || "—" }}</text>
              <text v-if="type === 'CUSTOMER'">客户验收负责人角色：{{ customerRoleLabel(forms[type].acceptUnitName) }}</text>
              <text>验收日期：{{ forms[type].acceptEndDate || "—" }}</text>
              <text v-if="forms[type].remark"
                >验收说明：{{ forms[type].remark }}</text
              >
            </view>
            <template v-else>
              <view v-if="type === 'CUSTOMER'" class="acceptance__field">
                <text>客户验收负责人角色</text>
                <picker :range="customerRoleOptions" range-key="label" :disabled="busy" @change="forms[type].acceptUnitName = customerRoleOptions[Number($event.detail.value)].value">
                  <view class="acceptance__input">{{ customerRoleLabel(forms[type].acceptUnitName) }}</view>
                </picker>
              </view>
              <view class="acceptance__field"
                ><text>验收日期</text
                ><picker
                  mode="date"
                  :value="forms[type].acceptDate"
                  :disabled="!canEdit(type) || busy"
                  @change="forms[type].acceptDate = $event.detail.value"
                  ><view class="acceptance__input"
                    >{{
                      forms[type].acceptDate ||
                      (canEdit(type) ? "请选择验收日期" : "—")
                    }}
                    <wd-icon name="arrow-down" size="14px" /></view></picker
              ></view>
              <view class="acceptance__field"
                ><text>验收负责人</text
                ><text class="acceptance__input">{{ canEdit(type) ? userName : forms[type].acceptLeaderName || "—" }}</text>
              </view>
              <view v-if="type === 'CUSTOMER'" class="acceptance__field"
                ><label for="customer-acceptance-leader">客户验收负责人</label
                ><input
                  id="customer-acceptance-leader"
                  v-model="forms[type].acceptUnitLeader"
                  :disabled="!canEdit(type) || busy"
                  class="acceptance__input"
                  placeholder="请输入客户验收负责人姓名"
                />
              </view>
              <view v-if="type === 'CUSTOMER'" class="acceptance__field"
                ><text>联系电话</text
                ><input
                  v-model="forms[type].acceptUnitPhone"
                  :disabled="!canEdit(type) || busy"
                  class="acceptance__input"
                  placeholder="选填"
              /></view>
              <view class="acceptance__field"
                ><text>验收结果</text
                ><picker
                  :range="resultOptions"
                  range-key="label"
                  :value="forms[type].result === 'FAILED' ? 1 : 0"
                  :disabled="!canEdit(type) || busy"
                  @change="
                    forms[type].result =
                      resultOptions[Number($event.detail.value)].value
                  "
                  ><view class="acceptance__input"
                    >{{ resultText(forms[type].result) }}
                    <wd-icon name="arrow-down" size="14px" /></view></picker
              ></view>
              <view
                v-for="field in fileFields(type)"
                :key="field.key"
                class="acceptance__field"
              >
                <text>{{ field.label }}</text>
                <view
                  v-for="path in files(forms[type][field.key])"
                  :key="path"
                  class="acceptance__file"
                >
                  <button @click="preview(path)">
                    {{ fileName(path) }} · 预览
                  </button>
                  <button
                    v-if="canEdit(type)"
                    :disabled="busy"
                    @click="removeFile(type, field.key, path)"
                  >
                    移除
                  </button>
                </view>
                <button
                  v-if="
                    canEdit(type) &&
                    files(forms[type][field.key]).length < field.limit &&
                    attachmentCount(type) < 3
                  "
                  :disabled="busy"
                  @click="upload(type, field.key, field.limit)"
                >
                  上传{{ field.label }}
                </button>
              </view>
              <view
                v-if="
                  forms[type].result === 'FAILED' ||
                  (!canEdit(type) && forms[type].remark)
                "
                class="acceptance__field"
                ><text>{{
                  forms[type].result === "FAILED"
                    ? "不通过原因（必填）"
                    : "验收说明"
                }}</text
                ><textarea
                  v-model="forms[type].remark"
                  :disabled="!canEdit(type) || busy"
                  class="acceptance__textarea"
                  placeholder="请输入说明"
                />
              </view>
              <button
                v-if="canEdit(type)"
                type="primary"
                :loading="submitting"
                :disabled="busy"
                @click="submit(type)"
              >
                提交{{ type === "INTERNAL" ? "内部" : "外部" }}验收结果
              </button>
            </template>
          </view>
          <text
            v-if="visibleTypes.some((type) => canEdit(type))"
            class="acceptance__muted"
            >每类验收附件合计最多 3 个（含验收单），每次上传 1
            个；支持图片、Word、PDF、Excel。附件随验收结果统一提交，关闭前未提交的内容不保存。</text
          >
        </template>
      </scroll-view>
      <view v-if="!loading" class="acceptance__footer">
        <button :disabled="busy" @click="openHistory">查看详情</button>
        <button v-if="canApplyNormal" :disabled="busy" @click="openApplication('NORMAL')">申请验收</button>
        <button v-if="canApplyRecheck" :disabled="busy" @click="openApplication('WITHOUT_RECTIFICATION')">申请验收（免整改复验）</button>
        <button v-if="canApplyRework" :disabled="busy" @click="openReworkApplication">申请返工</button>
      </view>
    </view>
  </wd-popup>
  <wd-popup v-model="applicationOpen" position="bottom" :root-portal="true" :z-index="180" :close-on-click-modal="false" :safe-area-inset-bottom="true">
    <view class="acceptance__section" style="padding:20px">
      <view class="acceptance__title">{{ applicationMode === 'NORMAL' ? '申请验收' : '申请验收（免整改复验）' }}</view>
      <checkbox-group @change="applicationTypes = $event.detail.value">
        <label v-for="type in types" :key="type" class="acceptance__field">
          <checkbox :value="type" :checked="applicationTypes.includes(type)" :disabled="busy || !selectableTypes.includes(type)" />
          {{ type === 'INTERNAL' ? '内部验收' : '外部验收' }}（{{ statusText(forms[type]) }}）
        </label>
      </checkbox-group>
      <label for="acceptance-application-reason">申请原因（必填）</label>
      <textarea id="acceptance-application-reason" v-model="applicationReason" class="acceptance__textarea" :disabled="busy" :maxlength="400" :placeholder="applicationMode === 'NORMAL' ? '请填写申请原因（最多400字）' : '请填写免整改复验原因（最多400字）'" />
      <view class="acceptance__footer">
        <button :disabled="busy" @click="applicationOpen = false">取消</button>
        <button :disabled="busy" :loading="submitting" @click="submitApplication">提交申请</button>
      </view>
    </view>
  </wd-popup>
  <wd-popup v-model="reworkApplicationOpen" position="bottom" :root-portal="true" :z-index="170" :close-on-click-modal="false" :safe-area-inset-bottom="true">
    <view class="acceptance">
      <view class="acceptance__head"><text>申请返工</text><button :disabled="reworkBusy" @click="reworkApplicationOpen = false">关闭</button></view>
      <scroll-view scroll-y class="acceptance__body">
        <ProjectReworkPanel v-if="reworkApplicationOpen" :period-id="periodId" :project="project" :failed-sources="[reworkSource]" :initial-source="reworkSource" @busy="reworkBusy = $event" @changed="emit('changed')" />
      </scroll-view>
    </view>
  </wd-popup>
  <wd-popup
    v-model="historyOpen"
    position="right"
    :root-portal="true"
    :z-index="150"
    :close-on-click-modal="false"
    :safe-area-inset-bottom="true"
    custom-style="width:94vw;height:100%;overflow:hidden;"
  >
    <view class="acceptance" style="height: 100%">
      <view class="acceptance__head"
        ><text>验收详情</text
        ><button :disabled="reworkBusy" @click="historyOpen = false">
          关闭
        </button></view
      >
      <view class="acceptance__head">
        <button
          :disabled="reworkBusy"
          :type="historyTab === 'acceptance' ? 'primary' : 'default'"
          @click="historyTab = 'acceptance'"
        >
          历史验收记录
        </button>
        <button
          :disabled="reworkBusy"
          :type="historyTab === 'rework' ? 'primary' : 'default'"
          @click="historyTab = 'rework'"
        >
          返工申请审批记录
        </button>
      </view>
      <scroll-view scroll-y class="acceptance__body">
        <template v-if="historyTab === 'acceptance'">
          <text v-if="historyLoading">正在加载记录…</text>
          <view v-else-if="historyError"
            ><text>{{ historyError }}</text
            ><button @click="loadHistoryPage(historyPage)">重试</button></view
          >
          <text v-else-if="!historyRows.length">本页暂无已办理验收记录</text>
          <view
            v-for="row in historyRows"
            :key="row.acceptType + row.id"
            class="acceptance__section"
          >
            <view class="acceptance__title"
              >{{ row.acceptType === "INTERNAL" ? "内部验收" : "外部验收" }} ·
              {{ statusText(row) }}</view
            >
            <view class="acceptance__field">
              <text>轮次：{{ row.reworkId ? "返工复验" : "首次验收" }}</text>
              <text
                >验收负责人：{{
                  row.acceptLeaderName || "—"
                }}</text
              >
              <text v-if="row.acceptType === 'CUSTOMER'">客户验收负责人：{{ row.acceptUnitLeader || "—" }}</text>
              <text v-if="row.acceptType === 'CUSTOMER'">客户验收负责人角色：{{ customerRoleLabel(row.acceptUnitName) }}</text>
              <text>日期：{{ row.acceptEndDate || "—" }}</text>
              <text>说明：{{ row.remark || "—" }}</text>
            </view>
            <button
              v-for="path in files(
                [row.acceptanceFormFileId, row.completionReportFileId]
                  .filter(Boolean)
                  .join(','),
              )"
              :key="path"
              @click="preview(path)"
            >
              {{ fileName(path) }}
            </button>
          </view>
        </template>
        <view v-if="historyTab === 'acceptance'" class="acceptance__head">
          <button
            :disabled="historyLoading || historyPage <= 1"
            @click="loadHistoryPage(historyPage - 1)"
          >
            上一页
          </button>
          <text>第 {{ historyPage }} 页</text>
          <button
            :disabled="historyLoading || historyPage * 10 >= historyTotal"
            @click="loadHistoryPage(historyPage + 1)"
          >
            下一页
          </button>
        </view>
        <view v-show="historyTab === 'rework'">
          <ProjectReworkPanel
            v-if="historyOpen && reworkVisited"
            :key="periodId"
            :period-id="periodId"
            :project="project"
            :failed-sources="[]"
            @busy="reworkBusy = $event"
            @changed="emit('changed')"
          />
        </view>
      </scroll-view>
    </view>
  </wd-popup>
  <ContractFilePreview ref="filePreview" />
</template>
<script setup lang="ts">
import { computed, ref, watch } from "vue";
import dayjs from "dayjs";
import { useToast } from "wot-design-uni";
import { useUserStore } from "@/store/user";
import { usePermissionStore } from "@/store/permission";
import { http } from "@/utils/http";
import {
  acceptanceApi,
  currentAcceptance,
  readAcceptanceRecords,
  type AcceptanceType,
} from "@/service/projectAcceptance";
import { isAcceptanceHistory } from "@/utils/acceptanceWorkflow";
import { readCachedProjectMembership } from "@/service/projectMembership";
import ProjectReworkPanel from "./ProjectReworkPanel.vue";
import ContractFilePreview from "../../home/components/ContractFilePreview.vue";
const emit = defineEmits<{ changed: [] }>();
const toast = useToast(),
  user = useUserStore(),
  permission = usePermissionStore();
const visible = ref(false),
  loading = ref(false),
  submitting = ref(false),
  uploading = ref(false),
  error = ref("");
const busy = computed(
  () => loading.value || submitting.value || uploading.value,
);
const periodId = ref(""),
  project = ref<any>({});
const attachmentCount = (type: AcceptanceType) =>
  files(forms.value[type].acceptanceFormFileId).length;
const types: AcceptanceType[] = ["INTERNAL", "CUSTOMER"];
const forms = ref<Record<AcceptanceType, any>>({ INTERNAL: {}, CUSTOMER: {} });
const records = ref<Record<AcceptanceType, any[]>>({
  INTERNAL: [],
  CUSTOMER: [],
});
const userId = computed(() =>
  String(user.userInfo.userid || (user.userInfo as any).id || ""),
);
const userName = computed(() =>
  String(
    (user.userInfo as any).realname ||
      (user.userInfo as any).realName ||
      user.userInfo.username ||
      "",
  ),
);
const historyOpen = ref(false),
  historyTab = ref("acceptance"),
  reworkBusy = ref(false);
const reworkVisited = ref(false);
watch(historyTab, (tab) => {
  if (tab === "rework") reworkVisited.value = true;
});
const historyRows = ref<any[]>([]);
const historyPage = ref(1),
  historyTotal = ref(0),
  historyLoading = ref(false),
  historyError = ref("");
const historyCache = new Map<number, { records: any[]; total: number }>();
let historySequence = 0;
async function loadHistoryPage(page = 1) {
  const sequence = ++historySequence;
  const id = periodId.value;
  historyLoading.value = true;
  historyError.value = "";
  try {
    let result = historyCache.get(page);
    if (!result) {
      const response: any = await http.get("/project/acceptance/list", {
        periodId: id,
        pageNo: page,
        pageSize: 10,
      });
      if (sequence !== historySequence || id !== periodId.value) return;
      result = {
        records: (response.result?.records || []).filter(isAcceptanceHistory),
        total: Number(response.result?.total || 0),
      };
      historyCache.set(page, result);
    }
    historyRows.value = result.records;
    historyTotal.value = result.total;
    historyPage.value = page;
  } catch (error: any) {
    if (sequence === historySequence)
      historyError.value = error?.message || "历史验收加载失败";
  } finally {
    if (sequence === historySequence) historyLoading.value = false;
  }
}
function openHistory() {
  reworkVisited.value = false;
  historyTab.value = "acceptance";
  historyOpen.value = true;
  void loadHistoryPage(historyPage.value);
}
const round = () => String(project.value.currentReworkId || "");
const identityReady = ref(false), manager = ref(false), identityError = ref('');
const operationsMember = computed(() => Boolean(userId.value && user.identity.canHandleInternal));
let identitySequence = 0;
async function loadIdentity() {
  const sequence = ++identitySequence, id = periodId.value, uid = userId.value;
  identityReady.value = false;
  manager.value = false;
  identityError.value = '';
  if (!id || !uid) return;
  if (!['project:accept', 'project:acceptance:submit', 'project:rework:apply'].some((code) => permission.hasPermission(code))) {
    identityReady.value = true;
    return;
  }
  const [membership] = await Promise.allSettled([
    readCachedProjectMembership(id, uid, JSON.stringify([user.userInfo.token, user.userInfo.tenantId])),
  ]);
  if (sequence !== identitySequence || id !== periodId.value || uid !== userId.value || !visible.value) return;
  manager.value = membership.status === 'fulfilled' && membership.value.manager;
  identityReady.value = true;
  if (membership.status === 'rejected') identityError.value = '项目经理身份查询失败，外部验收暂不可编辑，请重试';
}
watch(userId, () => {
  identityReady.value = false;
  if (visible.value) void loadIdentity();
}, { flush: 'sync' });
const canOperate = (type: AcceptanceType) =>
  (type === "INTERNAL" || identityReady.value) && (type === "INTERNAL"
    ? operationsMember.value && permission.hasPermission("project:internalAccept")
    : manager.value && permission.hasPermission("project:accept"));
const visibleTypes = computed(() => types);
const focusedSection = ref('');
const applicationOpen = ref(false), applicationReason = ref('');
const applicationMode = ref<'NORMAL' | 'WITHOUT_RECTIFICATION'>('NORMAL');
const applicationTypes = ref<AcceptanceType[]>([]);
const reworkApplicationOpen = ref(false), reworkSource = ref<any>({});
const failedTypes = computed(() => types.filter((type) => forms.value[type].id && forms.value[type].acceptStatus === 'COMPLETED' && forms.value[type].result === 'FAILED'));
const projectStatus = () => project.value.periodStatus ?? project.value.status;
const normalTypes = computed(() => types.filter((type) => !forms.value[type].id || forms.value[type].acceptStatus === 'NOT_STARTED'));
const canApplyNormal = computed(() => identityReady.value && manager.value && permission.hasPermission('project:acceptance:submit') && ['IMPLEMENTING','DEBUGGING','PENDING_ACCEPT','ACCEPTING'].includes(projectStatus()) && normalTypes.value.length > 0);
const canApplyRecheck = computed(() => identityReady.value && manager.value && permission.hasPermission('project:acceptance:submit') && projectStatus() === 'ACCEPTING' && failedTypes.value.length > 0);
const selectableTypes = computed(() => applicationMode.value === 'NORMAL' ? normalTypes.value : failedTypes.value);
const canApplyRework = computed(() => manager.value && permission.hasPermission('project:rework:apply') && projectStatus() === 'ACCEPTING' && failedTypes.value.length > 0);
function openApplication(mode: 'NORMAL' | 'WITHOUT_RECTIFICATION' = 'NORMAL') {
  if (busy.value || error.value || !(mode === 'NORMAL' ? canApplyNormal.value : canApplyRecheck.value)) return;
  applicationMode.value = mode;
  applicationTypes.value = [...selectableTypes.value];
  applicationReason.value = '';
  applicationOpen.value = true;
}
async function submitApplication() {
  if (busy.value || !(applicationMode.value === 'NORMAL' ? canApplyNormal.value : canApplyRecheck.value)) return;
  const selected = [...new Set(applicationTypes.value)];
  if (!selected.length || selected.some((type) => !selectableTypes.value.includes(type))) return toast.warning('请选择当前可申请的验收类型');
  const reason = applicationReason.value.trim();
  if (!reason || reason.length > 400) return toast.warning('请填写1至400字的申请原因');
  submitting.value = true;
  const succeeded: AcceptanceType[] = [];
  try {
    const response: any = await acceptanceApi.apply({periodId: periodId.value, acceptTypes: selected, reason, applyMode: applicationMode.value});
    const result = response?.result;
    if (response?.success === false || !Array.isArray(result) || selected.some((type) => !result.some((row) => row?.id && row.acceptType === type)))
      throw new Error(response?.message || '申请结果未确认，请重新打开查询后再操作');
    for (const type of selected) {
      const row = result.find((item) => item.acceptType === type);
      forms.value[type] = {...row, acceptDate: '', remark: row.remark || '', acceptUnitLeader: row.acceptUnitLeader || ''};
      records.value[type] = [row, ...records.value[type].filter((item) => item.id !== row.id)];
      succeeded.push(type);
      applicationTypes.value = applicationTypes.value.filter((item) => item !== type);
    }
    project.value = {...project.value, status: 'ACCEPTING', periodStatus: 'ACCEPTING'};
    applicationOpen.value = false;
    focusedSection.value = succeeded.includes('CUSTOMER') ? 'acceptance-CUSTOMER' : '';
    toast.success(succeeded.includes('CUSTOMER') ? '申请成功，请填写外部验收内容' : '申请成功，等待运维负责人验收');
  } catch (error: any) { toast.error(error?.message || '申请失败，输入已保留'); }
  finally { submitting.value = false; if (succeeded.length) { historyCache.clear(); emit('changed'); } }
}
function openReworkApplication() {
  if (!canApplyRework.value || busy.value) return;
  reworkSource.value = failedTypes.value.map((type) => ({...forms.value[type], acceptType: type})).sort((a,b) => String(b.createTime || '').localeCompare(String(a.createTime || '')))[0];
  reworkApplicationOpen.value = true;
}
const canEdit = (type: AcceptanceType) =>
  !error.value &&
  forms.value[type].id &&
  forms.value[type].acceptStatus === "IN_PROGRESS" &&
  canOperate(type);
const resultOptions = [
  { label: "通过", value: "PASSED" },
  { label: "不通过", value: "FAILED" },
];
// 暂定客户职能字段，不代表系统授权；等待后端持久化和回显。
const customerRoleOptions = [
  {label:'未选择', value:''},
  {label:'项目负责人', value:'PROJECT_LEADER'},
  {label:'技术负责人', value:'TECHNICAL_LEADER'},
  {label:'采购负责人', value:'PURCHASE_LEADER'},
  {label:'其他', value:'OTHER'},
];
const customerRoleLabel = (value: unknown) => customerRoleOptions.find((item) => item.value === value)?.label || String(value || '未选择');
const resultText = (value: string) =>
  value === "PASSED" ? "通过" : value === "FAILED" ? "不通过" : "请选择结果";
const statusText = (row: any) =>
  row.acceptStatus === "COMPLETED"
    ? resultText(row.result)
    : row.acceptStatus === "IN_PROGRESS"
      ? "验收中"
      : row.acceptStatus === "CANCELLED"
        ? "已取消"
        : "未开始";
const files = (value: string) => [
  ...new Set(
    String(value || "")
      .split(",")
      .map((path) => path.trim())
      .filter(Boolean),
  ),
];
const fileName = (path: string) => {
  try {
    return decodeURIComponent(path.split("/").pop() || "附件");
  } catch {
    return "附件";
  }
};
const fileFields = (type: AcceptanceType) =>
  [{ key: "acceptanceFormFileId", label: "验收文件", limit: 3 }].filter(
    (field) =>
      forms.value[type].result === "PASSED" ||
      (!canEdit(type) && files(forms.value[type][field.key]).length),
  );
const filePreview = ref<InstanceType<typeof ContractFilePreview>>();
const preview = (path: string) =>
  filePreview.value?.open({ path, name: fileName(path) });
let version = 0;
async function load(onlyType?: AcceptanceType) {
  const request = ++version;
  loading.value = true;
  error.value = "";
  try {
    const [internal, customer] = await Promise.all([
      onlyType === "CUSTOMER"
        ? records.value.INTERNAL
        : readAcceptanceRecords(periodId.value, "INTERNAL"),
      onlyType === "INTERNAL"
        ? records.value.CUSTOMER
        : readAcceptanceRecords(periodId.value, "CUSTOMER"),
    ]);
    if (request !== version) return;
    if (
      !Object.prototype.hasOwnProperty.call(project.value, "currentReworkId")
    ) {
      const latest = [...internal, ...customer].sort((a, b) =>
        String(b.createTime || "").localeCompare(String(a.createTime || "")),
      )[0];
      project.value.currentReworkId = latest?.reworkId || "";
    }
    records.value = { INTERNAL: internal, CUSTOMER: customer };
    for (const type of types.filter((type) => !onlyType || type === onlyType)) {
      const row = currentAcceptance(records.value[type], round()) || {};
      forms.value[type] = {
        ...row,
        acceptDate: String(row.acceptEndDate || row.acceptDate || "").slice(
          0,
          10,
        ),
        result: row.result || "",
        remark: row.remark || "",
      };
    }
  } catch (e: any) {
    if (request === version) error.value = e?.message || "验收加载失败，请重试";
  } finally {
    if (request === version) loading.value = false;
  }
}
async function open(id: string, _reworkId = "", context: any = {}, apply = false, recheck?: { type: AcceptanceType; acceptanceId: string }) {
  if (busy.value) return;
  applicationOpen.value = false;
  reworkApplicationOpen.value = false;
  focusedSection.value = '';
  historySequence++;
  historyCache.clear();
  historyRows.value = [];
  historyPage.value = 1;
  historyTotal.value = 0;
  periodId.value = id;
  historyOpen.value = false;
  reworkVisited.value = false;
  visible.value = true;
  project.value = {
    ...context,
    ...(_reworkId ? { currentReworkId: _reworkId } : {}),
  };
  forms.value = { INTERNAL: {}, CUSTOMER: {} };
  records.value = { INTERNAL: [], CUSTOMER: [] };
  await Promise.all([loadIdentity(), load()]);
  if (apply && id === periodId.value && visible.value) openApplication('NORMAL');
  if (recheck && id === periodId.value && visible.value && !error.value) {
    if (String(forms.value[recheck.type]?.id) !== recheck.acceptanceId || !failedTypes.value.includes(recheck.type) || !canApplyRecheck.value) {
      toast.warning('该提醒已处理或当前不可申请复验，请查看最新验收记录');
      return;
    }
    openApplication('WITHOUT_RECTIFICATION');
    applicationTypes.value = [recheck.type];
  }
}
async function close() {
  if (busy.value) return;
  const result = await new Promise<boolean>((resolve) =>
    uni.showModal({
      title: "关闭验收",
      content: "未提交的内容不会保存，确定关闭？",
      success: (r) => resolve(!!r.confirm),
      fail: () => resolve(false),
    }),
  );
  if (result) {
    identitySequence++;
    identityReady.value = false;
    historyOpen.value = false;
    visible.value = false;
    version++;
  }
}
function removeFile(type: AcceptanceType, key: string, path: string) {
  if (!busy.value && canEdit(type))
    forms.value[type][key] = files(forms.value[type][key])
      .filter((item) => item !== path)
      .join(",");
}
async function upload(type: AcceptanceType, key: string, limit: number) {
  if (busy.value || !canEdit(type)) return;
  if (attachmentCount(type) >= 3) return toast.warning("验收附件合计最多 3 个");
  uploading.value = true;
  try {
    const file: any = await new Promise((resolve, reject) => {
      const options = {
        count: 1,
        type: "all" as const,
        success: (r: any) => resolve(r.tempFiles[0]),
        fail: reject,
      };
      // #ifdef H5
      uni.chooseFile(options);
      // #endif
      // #ifdef MP-WEIXIN
      uni.chooseMessageFile(options);
      // #endif
      // #ifndef H5 || MP-WEIXIN
      reject(new Error("当前端暂不支持文件选择，请使用 H5 或微信小程序"));
      // #endif
    });
    if (
      !/\.(png|jpe?g|webp|gif|bmp|docx?|pdf|xlsx?)$/i.test(
        file.name || file.path || "",
      ) ||
      Number(file.size) > 20 * 1024 * 1024
    )
      throw new Error("请选择 20MB 以内的图片、Word、PDF 或 Excel");
    const response: any = await http.upload("/sys/common/upload", {
      filePath: file.path,
      name: "file",
      formData: { biz: `${periodId.value}/` },
      // #ifdef H5
      file: file.file,
      // #endif
    });
    const data = response?.data;
    if (
      !data?.success ||
      ![0, 200].includes(Number(data.code)) ||
      !String(data.message || "").trim()
    )
      throw new Error(data?.message || "上传失败");
    if (String(data.message).includes(","))
      throw new Error("附件路径包含英文逗号，请重命名文件后重试");
    const next = [
      ...files(forms.value[type][key]),
      String(data.message).trim(),
    ];
    if (next.length > limit) throw new Error("附件数量超过上限");
    forms.value[type][key] = next.join(",");
  } catch (e: any) {
    if (!String(e?.errMsg || "").includes("cancel"))
      toast.warning(e?.message || "附件未上传，请重试");
  } finally {
    uploading.value = false;
  }
}
async function submit(type: AcceptanceType) {
  if (busy.value || !canEdit(type)) return;
  const row = forms.value[type];
  if (type === "CUSTOMER" && !String(row.acceptUnitLeader || "").trim())
    return toast.warning("请填写客户验收负责人姓名");
  if (!row.acceptDate || !dayjs(row.acceptDate).isValid())
    return toast.warning("请选择验收日期");
  if (!["PASSED", "FAILED"].includes(row.result))
    return toast.warning("请选择验收结果");
  if (row.result === "PASSED" && !files(row.acceptanceFormFileId).length)
    return toast.warning("验收通过必须上传报告");
  if (row.result === "PASSED" && attachmentCount(type) > 3)
    return toast.warning("验收附件合计最多 3 个，请移除多余附件");
  if (row.result === "FAILED" && !row.remark.trim())
    return toast.warning("请填写不通过原因");
  if (!userId.value || !userName.value)
    return toast.warning("登录人信息缺失，请重新登录");
  submitting.value = true;
  let completed = false;
  try {
    if (!canOperate(type))
      throw new Error("当前账号已无验收办理权限或本分期经理身份");
    const response: any = await acceptanceApi.complete({
      acceptanceId: String(row.id),
      periodId: periodId.value,
      acceptType: type,
      // 保持接口日期时间格式，日期精度统一使用当天零点。
      acceptEndDate: `${row.acceptDate} 00:00:00`,
      result: row.result,
      acceptUnitLeader:
        type === "INTERNAL" ? userName.value : row.acceptUnitLeader.trim(),
      ...(type === 'CUSTOMER' ? { acceptUnitName: row.acceptUnitName || '' } : {}),
      ...(type === "CUSTOMER"
        ? { acceptUnitPhone: row.acceptUnitPhone || "" }
        : {}),
      acceptanceFormFileId:
        row.result === "PASSED" ? row.acceptanceFormFileId || "" : "",
      remark: row.remark.trim(),
      ...(row.reworkId ? { reworkId: row.reworkId } : {}),
    });
    if (response?.success === false)
      throw new Error(response.message || "验收提交失败");
    completed = true;
    row.acceptStatus = "COMPLETED";
    historyCache.clear();
    await load(type);
    toast.success("验收已提交");
    emit("changed");
  } catch (e: any) {
    toast.warning(
      e?.message ||
        (completed ? "已提交，刷新失败，请重新打开" : "提交失败，内容已保留"),
    );
  } finally {
    submitting.value = false;
  }
}
defineExpose({ open });
</script>
<style scoped>
.acceptance {
  height: 86vh;
  height: 86dvh;
  max-width: 720px;
  margin: auto;
  display: flex;
  flex-direction: column;
  background: #fff;
  color: #333;
  font-family:
    -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei",
    sans-serif;
  font-size: 14px;
  line-height: 1.6;
}
.acceptance__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  border-bottom: 1px solid #edf0f3;
  flex-shrink: 0;
  font-size: 16px;
  font-weight: 600;
}
.acceptance__footer {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 14px;
  border-top: 1px solid #edf0f3;
}
.acceptance__footer button { margin: 0; min-height: 44px; font-size: 14px; }
.acceptance__head button {
  margin: 0;
  min-width: 44px;
  background: transparent;
  color: #667085;
  font-weight: 400;
}
.acceptance__head button::after {
  border: 0;
}
.acceptance__body {
  height: 0;
  flex: 1;
  min-height: 0;
  padding: 0 14px 20px;
  box-sizing: border-box;
}
.acceptance__section {
  margin: 0;
  padding: 20px 0;
  border-bottom: 1px solid #edf0f3;
}
.acceptance__title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
}
.acceptance__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0 0 16px;
  font-size: 14px;
}
.acceptance__field > text {
  color: #667085;
  font-size: 13px;
  line-height: 20px;
}
.acceptance__input {
  min-height: 44px;
  padding: 10px 12px;
  box-sizing: border-box;
  border: 1px solid #e2e6ec;
  border-radius: 8px;
  background: #f8fafc;
  font-size: 14px;
  line-height: 22px;
  font-family: inherit;
}
.acceptance__field picker .acceptance__input {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.acceptance__input:focus-within,
.acceptance__textarea:focus {
  border-color: #2f86ff;
  outline: none;
}
.acceptance__textarea {
  width: 100%;
  height: 96px;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid #e2e6ec;
  border-radius: 8px;
  background: #f8fafc;
  font-size: 14px;
  line-height: 22px;
  font-family: inherit;
}
.acceptance__muted {
  display: block;
  color: #667085;
  font-size: 12px;
  line-height: 1.7;
  margin-top: 12px;
}
.acceptance button {
  min-height: 44px;
  font-size: 14px;
  line-height: 1.6;
  padding: 10px;
  white-space: normal;
  overflow-wrap: anywhere;
  font-family: inherit;
  border-radius: 8px;
}
.acceptance__section > button[type="primary"] {
  width: 100%;
  margin-top: 20px;
  background: #2f86ff;
  color: #fff;
  font-size: 15px;
  font-weight: 500;
}
.acceptance__file {
  display: flex;
  align-items: center;
  gap: 8px;
}
.acceptance__file button:first-child {
  flex: 1;
  min-width: 0;
  margin: 0;
  text-align: left;
}
.acceptance__history {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 0;
  font-size: 14px;
  border-bottom: 1px solid #e3e8ee;
}
</style>
