<template>
  <wd-root-portal><wd-toast selector="project-acceptance" :z-index="1100" /></wd-root-portal>
  <wd-popup
    v-model="visible"
    position="bottom"
    :z-index="999"
    :root-portal="true"
    :close-on-click-modal="false"
    :safe-area-inset-bottom="false"
    custom-style="border-radius:16px 16px 0 0;overflow:hidden;"
  >
    <view class="acceptance">
      <view class="acceptance__head"
        ><button v-if="editingType" :disabled="busy" @click="editingType = null">返回</button
        ><text>{{ editingType ? `${editingType === 'INTERNAL' ? '内部' : '外部'}验收填写` : '验收结果' }}</text
        ><button :disabled="busy" @click="close">关闭</button></view
      >
      <scroll-view scroll-y :scroll-into-view="focusedSection" class="acceptance__body">
        <view class="acceptance__body-content">
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
            <view v-if="!editingType" class="acceptance__section-head">
            <view class="acceptance__title">{{
              type === "INTERNAL" ? "内部验收" : "外部验收"
            }}</view>
            <text class="acceptance__status" :class="`acceptance__status--${summaryFor(type)?.status || 'NONE'}`">{{ statusText(forms[type]) }}</text>
            </view>
            <view v-if="lastRejected(type)" class="acceptance__rejection">
              <text>最近一次驳回</text>
              <text>验收负责人：{{ lastRejected(type).acceptLeaderName || '—' }}</text>
              <text>验收日期：{{ String(lastRejected(type).acceptEndDate || '—').slice(0, 10) }}</text>
              <text>驳回原因：{{ lastRejected(type).remark || '—' }}</text>
            </view>
            <text v-if="!forms[type].id" class="acceptance__empty">当前施工轮次暂无验收记录</text>
            <template v-else-if="editingType !== type || !canEdit(type)">
              <view v-if="savedRecord(type).acceptStatus === 'COMPLETED' && ['PASSED', 'FAILED'].includes(savedRecord(type).result)" class="acceptance__summary">
                <view><text>验收结果</text><text>{{ savedRecord(type).result ? resultText(savedRecord(type).result) : '待提交' }}</text></view>
                <view><text>验收负责人</text><text>{{ savedRecord(type).acceptLeaderName || '—' }}</text></view>
                <view><text>验收日期</text><text>{{ String(savedRecord(type).acceptEndDate || '—').slice(0, 10) }}</text></view>
                <view v-if="type === 'CUSTOMER'"><text>客户验收负责人</text><text>{{ savedRecord(type).acceptUnitLeader || '—' }}</text></view>
                <view v-if="type === 'CUSTOMER'"><text>负责人角色</text><text>{{ customerRoleLabel(savedRecord(type).acceptUnitName) }}</text></view>
                <view v-if="savedRecord(type).remark"><text>验收说明</text><text>{{ savedRecord(type).remark }}</text></view>
                <view v-for="path in files(savedRecord(type).acceptanceFormFileId)" :key="path"><text>验收文件</text><text>{{ fileName(path) }}</text></view>
              </view>
              <button v-if="canEdit(type)" class="acceptance__start" :disabled="busy" @click="startEditing(type)">提交{{ type === 'INTERNAL' ? '内部' : '外部' }}验收结果</button>
            </template>
            <template v-else>
              <view class="acceptance__field"
                ><text>验收日期</text
                ><wd-datetime-picker
                  type="date"
                  title="选择验收日期"
                  :model-value="acceptDateValue(type)"
                  :root-portal="true"
                  :z-index="1001"
                  :safe-area-inset-bottom="true"
                  :disabled="!canEdit(type) || busy"
                  @confirm="confirmAcceptDate(type, $event)"
                  ><view class="acceptance__input acceptance__date-trigger"
                    >{{
                      forms[type].acceptDate ||
                      (canEdit(type) ? "请选择验收日期" : "—")
                    }}
                    <wd-icon name="arrow-down" size="14px" /></view></wd-datetime-picker
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
              <view v-if="type === 'CUSTOMER'" class="acceptance__field">
                <text>客户验收负责人角色</text>
                <wd-picker
                  :columns="customerRoleOptions"
                  label-key="label"
                  value-key="value"
                  :model-value="String(forms[type].acceptUnitName || '')"
                  title="客户验收负责人角色"
                  :root-portal="true"
                  :z-index="1001"
                  :disabled="busy || customerRolesLoading || customerRolesError || customerRoleOptions.length <= 1"
                  @confirm="selectCustomerRole"
                >
                  <view class="acceptance__input acceptance__date-trigger">
                    <text>{{ customerRolesLoading ? '正在加载角色…' : forms[type].acceptUnitName ? customerRoleLabel(forms[type].acceptUnitName) : '请选择客户验收负责人角色' }}</text>
                    <wd-icon name="arrow-down" size="14px" />
                  </view>
                </wd-picker>
                <button v-if="customerRolesError" :disabled="busy || customerRolesLoading" @click="loadCustomerRoles">角色加载失败，点击重试</button>
                <text v-else-if="!customerRolesLoading && customerRoleOptions.length <= 1">暂无可选角色，请联系管理员配置</text>
              </view>
              <view class="acceptance__field"
                ><text>验收结果</text
                ><wd-picker
                  :columns="resultOptions"
                  label-key="label"
                  value-key="value"
                  :model-value="forms[type].result || ''"
                  title="选择验收结果"
                  :root-portal="true"
                  :z-index="1001"
                  :disabled="!canEdit(type) || busy"
                  @confirm="confirmAcceptanceResult(type, $event)"
                  ><view class="acceptance__input acceptance__date-trigger"
                    >{{ resultText(forms[type].result) }}
                    <wd-icon name="arrow-down" size="14px" /></view></wd-picker
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
                  <text>{{ fileName(path) }}</text>
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
            </template>
          </view>
          <text
            v-if="editingType && canEdit(editingType)"
            class="acceptance__muted"
            >每类验收附件合计最多 3 个（含验收单），每次上传 1
            个；支持图片、Word、PDF、Excel。附件随验收结果统一提交，关闭前未提交的内容不保存。</text
          >
        </template>
        </view>
      </scroll-view>
      <view v-if="editingType" class="acceptance__footer acceptance__footer--edit">
        <button type="primary" :loading="submitting" :disabled="busy || !canEdit(editingType)" @click="submit(editingType)">提交验收结果</button>
      </view>
      <view v-else-if="!editingType && !loading && (canApplyNormal || canApplyRecheck || permission.hasPermission('project:rework:approve'))" class="acceptance__footer">
        <button v-if="canApplyNormal" :disabled="busy" @click="openApplication('NORMAL')">{{ normalApplicationLabel }}</button>
        <button v-if="canApplyRecheck" :disabled="busy" @click="openApplication('WITHOUT_RECTIFICATION')">申请复审</button>
        <button v-if="permission.hasPermission('project:rework:approve')" :disabled="busy" @click="approvalOpen = true">返工审批</button>
      </view>
    </view>
  </wd-popup>
  <wd-popup v-model="applicationOpen" position="bottom" :root-portal="true" :z-index="1000" :close-on-click-modal="false" :safe-area-inset-bottom="false" custom-style="border-radius:16px 16px 0 0;overflow:hidden;">
    <view class="acceptance acceptance-application">
      <view class="acceptance__head"><text>{{ applicationMode === 'NORMAL' ? normalApplicationLabel : '申请复审' }}</text><button :disabled="busy" @click="applicationOpen = false">取消</button></view>
      <view class="acceptance-application__body">
      <view class="acceptance-application__label">复审类型<text>可多选</text></view>
      <checkbox-group class="acceptance-application__types" @change="applicationTypes = $event.detail.value">
        <label v-for="type in types" :key="type" class="acceptance-application__option" :class="{ 'is-disabled': !selectableTypes.includes(type) }">
          <checkbox color="#176ac7" :value="type" :checked="applicationTypes.includes(type)" :disabled="busy || !selectableTypes.includes(type)" />
          <view><text>{{ type === 'INTERNAL' ? '内部验收' : '外部验收' }}</text><text class="acceptance-application__status">{{ statusText(forms[type]) }}</text></view>
        </label>
      </checkbox-group>
      <label class="acceptance-application__label" for="acceptance-application-reason">申请原因<text>必填</text></label>
      <textarea id="acceptance-application-reason" v-model="applicationReason" class="acceptance__textarea" :disabled="busy" :maxlength="400" placeholder-style="color:#667085" :placeholder="applicationMode === 'NORMAL' ? '请说明本次申请复审的原因' : '请说明无需整改、申请复审的原因'" />
      <text class="acceptance-application__count">{{ applicationReason.length }}/400</text>
      </view>
      <view class="acceptance__footer acceptance__footer--edit">
        <button type="primary" :disabled="busy" :loading="submitting" @click="submitApplication">提交复审申请</button>
      </view>
    </view>
  </wd-popup>
  <wd-popup v-model="approvalOpen" position="bottom" :root-portal="true" :z-index="1000" :close-on-click-modal="false" :safe-area-inset-bottom="false">
    <view class="acceptance">
      <view class="acceptance__head"><text>返工审批</text><button :disabled="reworkBusy" @click="approvalOpen = false">关闭</button></view>
      <scroll-view scroll-y class="acceptance__body">
        <view class="acceptance__body-content">
        <ProjectReworkPanel v-if="approvalOpen" approval-only :period-id="periodId" :project="project" :failed-sources="[]" @busy="reworkBusy = $event" @changed="emit('changed')" />
        </view>
      </scroll-view>
    </view>
  </wd-popup>
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
  type AcceptanceType,
} from "@/service/projectAcceptance";
import { readCachedProjectMembership } from "@/service/projectMembership";
import { readInternalAcceptanceAccess } from "@/service/internalAcceptanceAccess";
import ProjectReworkPanel from "./ProjectReworkPanel.vue";
const emit = defineEmits<{ changed: [] }>();
const toast = useToast('project-acceptance'),
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
const approvalOpen = ref(false), reworkBusy = ref(false);
const latestStatus = ref<any>({});
const summaryFor = (type: AcceptanceType) => latestStatus.value[type === "INTERNAL" ? "internal" : "customer"];
const identityReady = ref(false), manager = ref(false), identityError = ref('');
const operationsMember = ref(false);
let identitySequence = 0;
async function loadIdentity() {
  const sequence = ++identitySequence, id = periodId.value, uid = userId.value;
  identityReady.value = false;
  manager.value = false;
  operationsMember.value = false;
  identityError.value = '';
  if (!id || !uid) return;
  if (!['project:internalAccept', 'project:accept', 'project:acceptance:submit', 'project:rework:apply'].some((code) => permission.hasPermission(code))) {
    identityReady.value = true;
    return;
  }
  const [membership, internalAccess] = await Promise.allSettled([
    readCachedProjectMembership(id, uid, JSON.stringify([user.userInfo.token, user.userInfo.tenantId])),
    permission.hasPermission('project:internalAccept')
      ? readInternalAcceptanceAccess(user.identity)
      : Promise.resolve(false),
  ]);
  if (sequence !== identitySequence || id !== periodId.value || uid !== userId.value || !visible.value) return;
  manager.value = membership.status === 'fulfilled' && membership.value.manager;
  operationsMember.value = internalAccess.status === 'fulfilled' && internalAccess.value;
  identityReady.value = true;
  identityError.value = [
    internalAccess.status === 'rejected' ? '内部验收主管资格查询失败，请重试' : '',
    membership.status === 'rejected' ? '项目经理身份查询失败，外部验收暂不可编辑，请重试' : '',
  ].filter(Boolean).join('；');
}
watch(() => JSON.stringify([userId.value, user.userInfo.token, user.userInfo.tenantId, user.identity.roleCodes, user.identity.responsibleDepartmentIds]), () => {
  identityReady.value = false;
  operationsMember.value = false;
  if (visible.value) void loadIdentity();
}, { flush: 'sync' });
const canOperate = (type: AcceptanceType) =>
  identityReady.value && (type === "INTERNAL"
    ? operationsMember.value && permission.hasPermission("project:internalAccept")
    : manager.value && permission.hasPermission("project:accept"));
const editingType = ref<AcceptanceType | null>(null);
const hasEditingSession = ref(false);
const visibleTypes = computed(() => editingType.value ? [editingType.value] : types);
const savedRecord = (type: AcceptanceType) => summaryFor(type)?.acceptance || {};
function startEditing(type: AcceptanceType) {
  if (busy.value || !canEdit(type)) return;
  if (!forms.value[type].acceptDate) {
    forms.value[type].acceptDate = dayjs().format('YYYY-MM-DD');
  }
  editingType.value = type;
  hasEditingSession.value = true;
  focusedSection.value = `acceptance-${type}`;
}
const focusedSection = ref('');
const applicationOpen = ref(false), applicationReason = ref('');
const applicationMode = ref<'NORMAL' | 'WITHOUT_RECTIFICATION'>('NORMAL');
const applicationTypes = ref<AcceptanceType[]>([]);
const lastRejected = (type: AcceptanceType) => summaryFor(type)?.status === 'PASSED' ? null : summaryFor(type)?.lastRejectedAcceptance;
const failedTypes = computed(() => types.filter(type => latestStatus.value.canSubmitReacceptance === true && summaryFor(type)?.status === 'FAILED'));
const normalTypes = computed(() => types.filter(type =>
  latestStatus.value.canSubmitReacceptance === true && summaryFor(type)?.status === 'PENDING_REACCEPTANCE'));
const canApplyNormal = computed(() => !loading.value && !error.value && normalTypes.value.length > 0);
const canApplyRecheck = computed(() => !loading.value && !error.value && failedTypes.value.length > 0);
const normalApplicationLabel = computed(() => normalTypes.value.some(type => summaryFor(type)?.status === 'PENDING_REACCEPTANCE') ? '申请复审' : '申请验收');
const selectableTypes = computed(() => applicationMode.value === 'NORMAL' ? normalTypes.value : failedTypes.value);
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
    await load(selected.length === 1 ? selected[0] : undefined);
    applicationOpen.value = false;
    focusedSection.value = succeeded.includes('CUSTOMER') ? 'acceptance-CUSTOMER' : '';
    toast.success(succeeded.includes('CUSTOMER') ? '申请成功，请填写外部验收内容' : '申请成功，等待运维负责人验收');
  } catch (error: any) { toast.error(error?.message || '申请失败，输入已保留'); }
  finally { submitting.value = false; if (succeeded.length) { emit('changed'); } }
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
function confirmAcceptanceResult(type: AcceptanceType, event: { value: string | number }) {
  if (busy.value || !canEdit(type)) return;
  if (resultOptions.some((item) => item.value === event.value)) forms.value[type].result = event.value;
}
const acceptDateValue = (type: AcceptanceType) => {
  const value = forms.value[type].acceptDate;
  const date = value ? dayjs(value) : null;
  return date?.isValid() ? date.valueOf() : '';
};
function confirmAcceptDate(type: AcceptanceType, event: { value: number | string }) {
  if (busy.value || !canEdit(type) || event.value === '') return;
  const date = dayjs(event.value);
  if (date.isValid()) forms.value[type].acceptDate = date.format('YYYY-MM-DD');
}
const customerRoleOptions = ref<{ label: string; value: string }[]>([{ label: '未选择', value: '' }]);
let customerRolesLoaded = false;
const customerRolesLoading = ref(false);
const customerRolesError = ref(false);
function selectCustomerRole(event: any) {
  if (busy.value || !canEdit('CUSTOMER')) return;
  const option = customerRoleOptions.value.find((item) => item.value === String(event.value));
  if (option) forms.value.CUSTOMER.acceptUnitName = option.value;
}
async function loadCustomerRoles() {
  if (customerRolesLoaded || customerRolesLoading.value) return;
  customerRolesLoading.value = true;
  customerRolesError.value = false;
  try {
    const response: any = await http.get('/sys/dict/getDictItems/client_role');
    const rows = Array.isArray(response) ? response : response?.result;
    if (!Array.isArray(rows)) throw new Error('字典响应异常');
    customerRoleOptions.value = [{ label: '未选择', value: '' }, ...rows.map((item: any) => ({ label: String(item.text ?? item.label ?? item.value), value: String(item.value) }))];
    customerRolesLoaded = true;
  } catch {
    customerRolesError.value = true;
    toast.warning('客户验收角色字典加载失败，请重新打开重试');
  } finally {
    customerRolesLoading.value = false;
  }
}
const customerRoleLabel = (value: unknown) => customerRoleOptions.value.find((item) => item.value === String(value ?? ''))?.label || String(value || '未选择');
const resultText = (value: string) =>
  value === "PASSED" ? "通过" : value === "FAILED" ? "不通过" : "请选择结果";
const statusText = (row: any) =>
  (row === forms.value.INTERNAL ? latestStatus.value.internal?.statusText : row === forms.value.CUSTOMER ? latestStatus.value.customer?.statusText : "") ||
  (row.acceptStatus === "COMPLETED"
    ? resultText(row.result)
    : row.acceptStatus === "IN_PROGRESS"
      ? "验收中"
      : row.acceptStatus === "CANCELLED"
        ? "已取消"
        : "未开始");
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
let version = 0;
async function load(onlyType?: AcceptanceType) {
  void loadCustomerRoles();
  const request = ++version;
  loading.value = true;
  error.value = "";
  try {
    latestStatus.value = {};
    const response: any = await acceptanceApi.latestStatus(periodId.value);
    if (request !== version) return;
    const result = response?.result;
    if (!result?.internal || !result?.customer) throw new Error('验收状态响应不完整，请重试');
    latestStatus.value = result;
    for (const type of types.filter(type => !onlyType || type === onlyType)) {
      const row = summaryFor(type)?.acceptance || {};
      records.value[type] = row.id ? [row] : [];
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
  editingType.value = null;
  hasEditingSession.value = false;
  focusedSection.value = '';
  periodId.value = id;
  approvalOpen.value = false;

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
  const result = !hasEditingSession.value || await new Promise<boolean>((resolve) =>
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
    approvalOpen.value = false;
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

    await load(type);
    editingType.value = null;
    hasEditingSession.value = false;
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
  height: 78vh;
  height: 78dvh;
  max-height: 640px;
  box-sizing: border-box;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  overflow: hidden;
  width: 100%;
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
  flex: 0 0 auto;
  position: relative;
  background: #fff;
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
  overflow: hidden;
  box-sizing: border-box;
}
.acceptance__body-content { padding: 0 16px 20px; }
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
.acceptance__section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}
.acceptance__section-head .acceptance__title { margin: 0; }
.acceptance__status { font-size: 13px; color: #667085; text-align: right; }
.acceptance__status--PASSED { color: #197347; }
.acceptance__status--FAILED { color: #b42318; }
.acceptance__summary { display: flex; flex-direction: column; gap: 12px; }
.acceptance__summary > view { display: flex; align-items: baseline; gap: 16px; }
.acceptance__summary > view > text:first-child { flex: 0 0 100px; color: #667085; }
.acceptance__summary > view > text:last-child { flex: 1; min-width: 0; text-align: right; overflow-wrap: anywhere; }
.acceptance__rejection { display: flex; flex-direction: column; gap: 4px; margin-bottom: 20px; padding: 12px; background: #fff5f4; color: #912018; font-size: 13px; overflow-wrap: anywhere; }
.acceptance__empty { display: block; color: #667085; padding-bottom: 4px; }
.acceptance .acceptance__start { width: 100%; margin: 20px 0 0; border: 1px solid #b7d2ef; background: #f3f8ff; color: #176ac7; font-weight: 500; }
.acceptance__footer--edit { flex-shrink: 0; }
.acceptance__footer--edit button { width: 100%; background: #176ac7; color: #fff; }
.acceptance button:focus-visible { outline: 2px solid #176ac7; outline-offset: 2px; }
.acceptance button[disabled] { opacity: .55; }
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
.acceptance__field > text.acceptance__input { color: #333; font-size: 14px; }
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
.acceptance__field picker .acceptance__input,
.acceptance__date-trigger {
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
.acceptance__file > text { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.acceptance__file > button { flex-shrink: 0; margin: 0; }
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
.acceptance-application { height: auto; max-height: min(640px, 78vh); max-height: min(640px, 78dvh); }
.acceptance-application__body { padding: 20px 16px 16px; overflow-y: auto; min-height: 0; }
.acceptance-application__label { display: flex; align-items: baseline; gap: 8px; margin-bottom: 12px; font-size: 14px; font-weight: 500; }
.acceptance-application__label > text { font-size: 12px; font-weight: 400; color: #667085; }
.acceptance-application__types { display: flex; gap: 16px; margin-bottom: 24px; }
.acceptance-application__option { display: flex; flex: 1; min-width: 0; align-items: center; gap: 8px; min-height: 48px; }
.acceptance-application__option checkbox { flex-shrink: 0; }
.acceptance-application__option > view { min-width: 0; }
.acceptance-application__option text { display: block; overflow-wrap: anywhere; }
.acceptance-application__status { color: #667085; font-size: 12px; margin-top: 2px; }
.acceptance-application__option.is-disabled { color: #667085; }
.acceptance-application .acceptance__textarea { height: 120px; }
.acceptance-application__count { display: block; text-align: right; color: #667085; font-size: 12px; margin-top: 8px; }
</style>
