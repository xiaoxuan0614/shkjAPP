<template>
  <!-- THESIS: 墨刀运维操作流，按任务分屏。OWN-WORLD: 沿用蓝白、12px圆角、系统字体。
       STORY: 报修按值班表自动分配、勘查报价、内部确认后维修；巡检独立。FIRST VIEWPORT: 顶栏、预览提示、任务入口。
       FORM: 用户指定墨刀结构的局部扩展，无新视觉体系。FINISH: 检查移动布局，记录接口边界。 -->
  <view class="ops-preview">
    <PageLayout class="preview-shell" :nav-title="screen === 'reports' ? intakeTitle : titles[screen]" nav-left-text="返回" nav-background-color="#176ac7" type="popup" @nav-back="back">
      <view class="notice"
        >页面演示 · 不提交业务。返回首页保留本次数据，刷新、退出登录或切换账号后清空。</view
      >
      <scroll-view
        class="preview-body"
        scroll-y
        :scroll-top="scrollTop"
        @scroll="lastScroll = $event.detail.scrollTop"
      >
        <view class="preview-content">
          <view v-if="message" class="feedback row" role="status"
            ><text>{{ message }}</text
            ><button class="btn btn--text" @click="message = ''">
              关闭
            </button></view
          >
          <OpsIntake ref="intakePanel" v-show="screen === 'reports'" :entry="intakeEntry" :request="intakeRequest" :can-manage="canManage" @title-change="intakeTitle = $event" @order-created="receiveOrder" @open-order="openIntakeOrder" />
          <template v-if="screen === 'records'">
            <view class="repair-filters">
              <view class="repair-search">
                <input v-model="searchDraft" class="repair-input" placeholder="工单号、客户或设备名称" confirm-type="search" aria-label="搜索维修工单" @confirm="searchOrders" />
                <button class="repair-query" @click="searchOrders">查询</button>
              </view>
              <view class="repair-filter-row">
                <picker class="repair-picker" :range="orderStatuses" @change="statusFilter = orderStatuses[Number($event.detail.value)]; page = 1">
                  <view class="repair-select"><text>状态：{{ statusFilter }}</text><wd-icon name="arrow-down" size="14px" /></view>
                </picker>
                <button class="repair-reset" :disabled="!searchDraft && !query && statusFilter === '全部状态' && modeFilter === '全部'" @click="resetOrders">重置</button>
              </view>
              <view class="repair-tabs">
                <button v-for="m in ['全部', '线下维修', '线上维修']" :key="m" :class="{ active: modeFilter === m }" @click="modeFilter = m; page = 1">{{ m }}</button>
              </view>
            </view>
            <view class="muted list-count">共 {{ filteredOrders.length }} 条 · 每页 5 条</view>
            <view v-for="order in pagedOrders" :key="order.id" class="repair-card" role="button" tabindex="0" :aria-label="'查看维修单 ' + order.id" @click="openOrder(order)" @keydown.enter="openOrder(order)">
              <view class="repair-card__head"><text class="repair-card__no">{{ order.id }}</text><StatusBadge :value="order.status" :dict="repairStatusOptions" /></view>
              <view class="repair-card__name">{{ order.projectName || order.equipment || '维修工单' }}</view>
              <view class="repair-row"><text class="repair-label">客户</text><text class="repair-value">{{ order.customer }}</text></view>
              <view class="repair-row"><text class="repair-label">类型</text><text class="repair-value">{{ order.mode === 'online' ? '线上维修' : '线下维修' }} · {{ order.nature }}</text></view>
              <view class="repair-row"><text class="repair-label">故障</text><text class="repair-value repair-fault">{{ order.fault }}</text></view>
              <view class="repair-row"><text class="repair-label">负责人</text><text class="repair-value">{{ order.owner }}</text></view>
            </view>
            <view v-if="!filteredOrders.length" class="empty"
              >暂无匹配工单，请调整筛选条件</view
            >
            <view v-if="filteredOrders.length" class="pagination"
              ><button class="btn" :disabled="page === 1" @click="page--">
                上一页</button
              ><text>{{ page }}/{{ Math.ceil(filteredOrders.length / 5) }}</text
              ><button
                class="btn"
                :disabled="page * 5 >= filteredOrders.length"
                @click="page++"
              >
                下一页
              </button></view
            >
          </template>
          <template v-else-if="screen === 'detail' && selectedOrder">
            <view class="panel"
              ><view class="row"
                ><text class="muted">{{ selectedOrder.id }}</text
                ><text class="badge" :class="tone(selectedOrder.status)">{{
                  selectedOrder.status
                }}</text></view
              ><view class="order-title">{{ selectedOrder.customer }}</view
              ><view class="muted"
                >{{ selectedOrder.equipment }} ·
                {{
                  selectedOrder.mode === "online" ? "线上维修" : "线下维修"
                }}</view
              ><view class="divider" /><view class="kv"
                ><text>客户地址</text
                ><text>{{ selectedOrder.address }}</text></view
              ><view class="kv"
                ><text>联系人</text
                ><text>{{ selectedOrder.contact }}</text></view
              ><view class="kv"
                ><text>联系电话</text
                ><text>{{ selectedOrder.phone }}</text></view
              ><view class="kv"
                ><text>维护性质</text
                ><text>{{ selectedOrder.nature }}</text></view
              ><view class="kv"
                ><text>维保期限</text
                ><text>2026-01-01 至 2026-12-31（示例）</text></view
              ><view class="kv"
                ><text>负责人</text><text>{{ selectedOrder.owner }}</text></view
              ><view class="kv"
                ><text>故障描述</text
                ><text>{{ selectedOrder.fault }}</text></view
              ></view
            >
            <view v-if="selectedOrder.mode === 'offline'" class="panel"
              ><view class="row"
                ><text class="section-title">预约信息</text
                ><button
                  v-if="canOperate && selectedOrder.status === '未开始'"
                  class="btn btn--text"
                  @click="navigate('reservation')"
                >
                  修改
                </button></view
              ><view class="kv"
                ><text>预约时间</text
                ><text>{{ selectedOrder.appointment }}</text></view
              ><view class="kv"
                ><text>还料状态</text
                ><text>{{ selectedOrder.returnState }}</text></view
              ></view
            >
            <view class="panel"
              ><view class="row"
                ><text class="section-title">维修记录</text
                ><text class="muted"
                  >{{ selectedOrder.logs.length }} 条</text
                ></view
              ><view v-if="!selectedOrder.logs.length" class="muted"
                >尚未填写维修日志</view
              ><view v-for="(log, i) in selectedOrder.logs" :key="i" class="log"
                ><view class="row"
                  ><text>第 {{ i + 1 }} 次维修</text
                  ><text class="badge">{{ log.result }}</text></view
                ><view class="log-desc">{{ log.description }}</view
                ><view v-if="log.reason" class="muted"
                  >复修原因：{{ log.reason }}</view
                ><view v-if="log.people.length" class="muted"
                  >内协：{{ log.people.join("、") }}</view
                ><view v-if="log.vehicle" class="muted"
                  >用车：{{ log.vehicle }} · {{ log.mileage || "—" }} km</view
                ><view v-for="m in log.materials" :key="m.name" class="muted"
                  >{{ m.name }}：{{ m.qty }} {{ m.unit }}</view
                ><view class="photos"
                  ><image
                    v-for="photo in log.photos"
                    :key="photo"
                    class="photo"
                    :src="photo"
                    mode="aspectFill"
                    @click="viewPhotos(photo, log.photos)" /></view></view
            ></view>
            <view v-if="selectedOrder.assistance?.requested" class="panel"
              ><view class="section-title">预约协助人员</view
              ><view v-if="selectedOrder.assistance.people.length" class="kv"
                ><text>内协人员</text
                ><text>{{
                  selectedOrder.assistance.people.join("、")
                }}</text></view
              ><template v-if="selectedOrder.assistance.outsource"
                ><view class="kv"
                  ><text>外协单位</text
                  ><text>{{ selectedOrder.assistance.outsource }}</text></view
                ><view class="kv"
                  ><text>人数 / 工时</text
                  ><text
                    >{{ selectedOrder.assistance.count }} 人 /
                    {{ selectedOrder.assistance.hours }} h</text
                  ></view
                ></template
              ></view
            >
            <view
              v-for="(log, i) in selectedOrder.logs.filter(
                (log) => log.outsource,
              )"
              :key="`outsource-${i}`"
              class="panel"
              ><view class="section-title">维修外协记录</view
              ><view class="kv"
                ><text>外协单位</text><text>{{ log.outsource }}</text></view
              ><view class="kv"
                ><text>人数 / 工时</text
                ><text
                  >{{ log.outsourceCount || "—" }} 人 /
                  {{ log.outsourceHours || "—" }} h</text
                ></view
              ></view
            >
            <view v-if="selectedOrder.transfer" class="panel"
              ><view class="row"
                ><text class="section-title">转单信息</text
                ><text class="badge">{{
                  selectedOrder.transfer.status
                }}</text></view
              ><view class="kv"
                ><text>接收人员</text
                ><text>{{ selectedOrder.transfer.to }}</text></view
              ><view class="kv"
                ><text>转单原因</text
                ><text>{{ selectedOrder.transfer.reason }}</text></view
              ><template v-if="canOperate && selectedOrder.transfer.status === '待接收'"
                ><text class="muted"
                  >以下按钮仅演示不同处理结果，正式版需按办理人权限显示。</text
                ><view class="actions"
                  ><button class="btn" @click="respondTransfer('已撤回')">
                    演示撤回</button
                  ><button class="btn" @click="respondTransfer('已驳回')">
                    演示驳回</button
                  ><button
                    class="btn btn--primary"
                    @click="respondTransfer('已接收')"
                  >
                    演示接收
                  </button></view
                ></template
              ></view
            >
            <view class="panel"
              ><view class="section-title">工单动态</view
              ><view
                v-for="(event, i) in selectedOrder.events"
                :key="i"
                class="timeline"
                >{{ event }}</view
              ></view
            >
            <view v-if="selectedOrder.status === '已完结'" class="panel"
              ><view class="section-title">客户评价（示例）</view
              ><view class="kv"><text>响应速度</text><text>5 分</text></view
              ><view class="kv"><text>处理速度</text><text>5 分</text></view
              ><view class="kv"><text>服务态度</text><text>5 分</text></view
              ><text class="muted">问题已解决，设备运行正常。</text></view
            >
            <view v-if="canOperate" class="detail-actions">
              <template
                v-if="['未开始', '进行中'].includes(selectedOrder.status)"
                ><button class="btn" @click="openAction('更多操作')">
                  更多操作</button
                ><button
                  class="btn btn--primary"
                  @click="navigate(selectedOrder.mode)"
                >
                  {{
                    selectedOrder.logs.at(-1)?.result === "维修完成"
                      ? "补充日志"
                      : "开始维修"
                  }}
                </button></template
              >
              <button
                v-if="
                  selectedOrder.status === '进行中' &&
                  selectedOrder.logs.at(-1)?.result === '维修完成'
                "
                class="btn btn--primary"
                @click="openAction('提交审核')"
              >
                提交审核
              </button>
              <button
                v-if="selectedOrder.status === '待审批'"
                class="btn"
                @click="openAction('撤回审核')"
              >
                撤回审核
              </button>
              <text v-if="selectedOrder.status === '待确认'" class="muted"
                >等待客户确认维修结果</text
              >
              <button
                v-if="selectedOrder.status === '待评价'"
                class="btn btn--primary"
                @click="openAction('客户评价')"
              >
                查看评价邀请
              </button>
            </view>
          </template>
          <OpsPreviewForm
            v-else-if="canOperate && ['reservation', 'offline', 'online'].includes(screen)"
            :key="formKey"
            :mode="formMode"
            :order="selectedOrder || undefined"
            @complete="completeForm"
            @focus-top="focusTop"
          />
          <template v-else-if="screen === 'material'">
            <view class="panel"
              ><view class="section-title">{{
                materialMode === "return" ? "申请还料" : "领料申请"
              }}</view
              ><view class="kv"
                ><text>关联工单</text
                ><text>{{ selectedOrder?.id || "未选择" }}</text></view
              ><view class="notice">示例数量，不读取或扣减真实库存。</view
              ><view
                v-for="m in materialRows"
                :key="m.name"
                class="material-row"
                ><view class="row"
                  ><text>{{ m.name }}</text
                  ><text class="muted">{{ m.unit }}</text></view
                ><view class="row"
                  ><text class="muted"
                    >{{ materialMode === "return" ? "可还" : "库存" }}
                    {{ m.available }} · {{ m.model }}</text
                  ><input
                    v-model.number="m.qty"
                    class="input material-qty"
                    type="digit"
                    :aria-label="m.name + '数量'" /></view></view
              ><textarea
                v-model="remark"
                class="textarea"
                placeholder="备注（选填）"
              /><view v-if="actionError" class="error">{{ actionError }}</view
              ><button class="btn btn--primary" @click="submitMaterial">
                预览申请结果
              </button></view
            >
          </template>
          <OpsPreviewInspection v-show="screen === 'inspection'" />
          <view class="preview-footer">首汇科技 · 运维页面预览</view>
        </view>
      </scroll-view>
      <view v-if="action" class="sheet-mask" @click.self="action = ''">
        <view class="sheet"
          ><view class="row"
            ><text class="title">{{ action }}</text
            ><button class="btn btn--text" @click="action = ''">
              取消
            </button></view
          ><view class="muted">仅演示页面交互，不发送真实申请。</view>
          <view v-if="actionError" class="error spaced">{{ actionError }}</view>
          <template v-if="action === '更多操作'"
            ><view class="action-menu"
              ><button class="btn" @click="openAction('临时邀约')">
                人员协作 · 临时邀约</button
              ><button class="btn" @click="openMaterial('apply')">
                物料办理 · 领料申请</button
              ><button class="btn" @click="openMaterial('return')">
                物料办理 · 申请还料</button
              ><button class="btn btn--danger" @click="openAction('关闭工单')">
                工单管理 · 关闭工单
              </button></view
            ></template
          >
          <template v-else-if="action === '客户评价'"
            ><view class="empty"
              >客户评价二维码展示区<br /><text class="muted"
                >正式链接及二维码待后端提供，不生成虚假二维码。</text
              ></view
            ></template
          >
          <template v-else>
            <template v-if="action === '转单' || action === '临时邀约'"
              ><text class="field-label spaced">{{
                action === "转单" ? "接收人员" : "内协人员（多选）"
              }}</text
              ><view class="choices"
                ><button
                  v-for="p in peopleOptions"
                  :key="p"
                  class="choice"
                  :class="{ on: selectedPeople.includes(p) }"
                  @click="selectPerson(p)"
                >
                  {{ p }}
                </button></view
              ></template
            >
            <template v-if="action === '提交审核'"
              ><view class="notice spaced">{{
                selectedOrder?.returnState === "待申请" ||
                selectedOrder?.returnState === "待库管入库"
                  ? "待库管核对还料并完成入库后，才可提交审核。"
                  : "当前示例工单无待处理还料，可预览审核提交。"
              }}</view
              ><view class="split spaced"
                ><view
                  ><text class="field-label">人工费（元）</text
                  ><input
                    v-model="laborCost"
                    class="input"
                    type="digit" /></view
                ><view
                  ><text class="field-label">材料费（元）</text
                  ><input
                    v-model="materialCost"
                    class="input"
                    type="digit" /></view></view
              ><view class="kv"
                ><text>费用合计</text><text>¥ {{ totalCost }}</text></view
              ></template
            >
            <textarea
              v-if="action !== '撤回审核'"
              v-model="remark"
              class="textarea spaced"
              :placeholder="
                ['关闭工单', '转单'].includes(action)
                  ? '请填写原因（必填）'
                  : '填写备注（选填）'
              "
              maxlength="500"
            />
            <view v-else class="muted spaced"
              >撤回后返回进行中，可继续修改维修内容。</view
            >
            <button class="btn btn--primary spaced full" @click="confirmAction">
              确认演示
            </button>
          </template>
        </view>
      </view>
    </PageLayout>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import OpsPreviewForm from "./OpsPreviewForm.vue";
import OpsPreviewInspection from "./OpsPreviewInspection.vue";
import OpsIntake from './OpsIntake.vue';
import PageLayout from '@/components/PageLayout/PageLayout.vue';
import StatusBadge from '@/components/StatusBadge/StatusBadge.vue';
import type { IntakeView } from './intakeFlow';
import { useUserStore } from '@/store/user';
const props = defineProps<{ canManage: boolean }>();
const userStore = useUserStore();
const intakeEntry = ref<IntakeView>('reports');
const intakeRequest = ref(0);
const intakeTitle = ref('报修列表');
const intakePanel = ref<InstanceType<typeof OpsIntake>>();
import {
  createOrders,
  materialOptions,
  peopleOptions,
  type PreviewOrder,
  type PreviewFormData,
} from "./previewData";
const emit = defineEmits<{ close: [] }>();
type Screen =
  | "reports"
  | "records"
  | "detail"
  | "reservation"
  | "offline"
  | "online"
  | "material"
  | "inspection";
const titles: Record<Screen, string> = {
  reports: "报修列表",
  records: "维修列表",
  detail: "工单详情",
  reservation: "线下预约",
  offline: "线下维修",
  online: "线上维修",
  material: "物料办理",
  inspection: "巡检管理",
};
const screen = ref<Screen>("records");
const history = ref<Screen[]>([]);
const orders = ref(createOrders(userStore.identity.userId));
const selectedOrder = ref<PreviewOrder | null>(null);
const canOperate = computed(() => !!selectedOrder.value && (props.canManage ||
  (!!userStore.identity.userId && selectedOrder.value.ownerId === userStore.identity.userId)));
const orderStatuses = [
  "全部状态",
  "未开始",
  "进行中",
  "待审批",
  "待确认",
  "待评价",
  "已完结",
  "已关闭",
];
const modeFilter = ref("全部");
const statusFilter = ref("全部状态");
const query = ref("");
const searchDraft = ref('');
const repairStatusOptions = orderStatuses.slice(1).map(status => ({
  value: status, label: status,
  color: status === '已完结' ? '#237046' : status === '已关闭' ? '#667085' : ['待审批', '待确认', '待评价'].includes(status) ? '#996515' : '#176ac7',
}));
function searchOrders() { query.value = searchDraft.value.trim(); page.value = 1; }
function resetOrders() { searchDraft.value = ''; query.value = ''; statusFilter.value = '全部状态'; modeFilter.value = '全部'; page.value = 1; }
const page = ref(1);
const formKey = ref(0);
const scrollTop = ref(0);
const lastScroll = ref(0);
const message = ref("");
const action = ref("");
const actionError = ref("");
const remark = ref("");
const selectedPeople = ref<string[]>([]);
const laborCost = ref("0");
const materialCost = ref("0");
const materialMode = ref<"apply" | "return">("apply");
const materialRows = ref(materialOptions.map((m) => ({ ...m })));
const formMode = computed(() =>
  screen.value === "reservation"
    ? "reservation"
    : screen.value === "online"
      ? "online"
      : "offline",
);
const totalCost = computed(() =>
  ((Number(laborCost.value) || 0) + (Number(materialCost.value) || 0)).toFixed(
    2,
  ),
);
const filteredOrders = computed(() =>
  orders.value.filter(
    (o) =>
      (props.canManage || (!!userStore.identity.userId && o.ownerId === userStore.identity.userId)) &&
      (statusFilter.value === "全部状态" || o.status === statusFilter.value) &&
      (modeFilter.value === "全部" ||
        o.mode === (modeFilter.value === "线上维修" ? "online" : "offline")) &&
      `${o.id}${o.customer}${o.equipment}${o.projectName || ''}`
        .toLowerCase()
        .includes(query.value.trim().toLowerCase()),
  ),
);
const pagedOrders = computed(() =>
  filteredOrders.value.slice((page.value - 1) * 5, page.value * 5),
);
watch(query, () => {
  page.value = 1;
});
async function focusTop() {
  scrollTop.value = lastScroll.value;
  await nextTick();
  scrollTop.value = 0;
}
watch(screen, focusTop);
function navigate(target: Screen) {
  if (['reservation', 'offline', 'online', 'material'].includes(target) && !canOperate.value) return;
  if (target === screen.value) return;
  history.value.push(screen.value);
  screen.value = target;
  action.value = "";
  actionError.value = "";
  formKey.value++;
}
function back() {
  if (action.value) {
    action.value = "";
    return;
  }
  if (screen.value === 'reports' && intakePanel.value?.backToList()) return;
  if (!history.value.length) emit("close");
  else {
    screen.value = history.value.pop() || "records";
    formKey.value++;
  }
}
function openOrder(order: PreviewOrder) {
  selectedOrder.value = order;
  navigate("detail");
}
function openHomeEntry(entry: IntakeView | 'records' | 'inspection') {
  if (entry === 'records') resetOrders();
  if (entry === 'records' || entry === 'inspection') screen.value = entry;
  else {
    intakeEntry.value = entry;
    intakeRequest.value++;
    screen.value = 'reports';
  }
  history.value = [];
  action.value = '';
  query.value = '';
  page.value = 1;
}
function receiveOrder(order: PreviewOrder) { orders.value.unshift(order); }
function openIntakeOrder(id: string) {
  const order = orders.value.find(item => item.id === id);
  if (order) openOrder(order);
}
defineExpose({ openHomeEntry });
function tone(status: string) {
  return ["已完结", "已接单"].includes(status)
    ? "badge--success"
    : ["已关闭", "已驳回"].includes(status)
      ? "badge--muted"
      : ["未处理", "未开始", "待审批"].includes(status)
        ? "badge--warn"
        : "";
}
function openAction(name: string) {
  if (!canOperate.value) return;
  action.value = name;
  actionError.value = "";
  remark.value = "";
  selectedPeople.value = [];
  laborCost.value = String(selectedOrder.value?.costs?.labor || 0);
  materialCost.value = String(selectedOrder.value?.costs?.material || 0);
}
function selectPerson(p: string) {
  if (action.value === "转单") selectedPeople.value = [p];
  else {
    const i = selectedPeople.value.indexOf(p);
    i < 0 ? selectedPeople.value.push(p) : selectedPeople.value.splice(i, 1);
  }
}
function completeForm(data: PreviewFormData) {
  if (!canOperate.value || !selectedOrder.value) return;
  const order = selectedOrder.value;
  Object.assign(order, {
    customer: data.customer,
    contact: data.contact,
    phone: data.phone || "未填写",
    address: data.address,
    nature: data.nature,
    equipment: data.equipment,
    fault: data.fault,
  });
  if (screen.value === "reservation") {
    order.appointment = `${data.date} ${data.time}`;
    order.assistance = {
      requested: data.assistance,
      types: [...data.assistTypes],
      people: [...data.people],
      outsource: data.outsource,
      count: data.outsourceCount,
      hours: data.outsourceHours,
    };
    order.events.push("预约信息已填写（演示）");
  } else {
    order.status = "进行中";
    order.logs.push({
      description: data.description,
      result: data.result,
      reason: data.reason,
      photos: [...data.photos],
      vehicle: data.vehicle,
      mileage: data.mileage,
      people: [...data.people],
      outsource: data.outsource,
      outsourceCount: data.outsourceCount,
      outsourceHours: data.outsourceHours,
      faultPosition: data.faultPosition,
      quote: data.quote,
      materials: data.materials
        .filter((m) => m.qty > 0)
        .map((m) => ({ name: m.name, qty: m.qty, unit: m.unit })),
    });
    order.events.push(`${data.result} · 日志已填写（演示）`);
  }
  selectedOrder.value = order;
  message.value = "已展示填写结果；未发送到服务器。";
  navigate("detail");
  history.value = ["records"];
}
function openMaterial(mode: "apply" | "return") {
  if (!canOperate.value) return;
  materialMode.value = mode;
  materialRows.value = materialOptions.map((m) => ({ ...m }));
  remark.value = "";
  navigate("material");
}
function submitMaterial() {
  if (!canOperate.value) return;
  if (!selectedOrder.value) return;
  if (
    materialRows.value.some(
      (m) =>
        !Number.isFinite(Number(m.qty)) ||
        Number(m.qty) < 0 ||
        Number(m.qty) > m.available,
    ) ||
    !materialRows.value.some((m) => Number(m.qty) > 0)
  ) {
    actionError.value = "请填写至少一项数量，且不能超过示例可用数量";
    return;
  }
  if (materialMode.value === "return")
    selectedOrder.value.returnState = "待库管入库";
  selectedOrder.value.events.push(
    `${materialMode.value === "return" ? "还料" : "领料"}申请（演示）：${materialRows.value
      .filter((m) => Number(m.qty) > 0)
      .map((m) => `${m.name} ${m.qty}${m.unit}`)
      .join("、")}`,
  );
  message.value = "已展示申请结果；未发送到服务器。";
  navigate("detail");
}
function confirmAction() {
  if (!canOperate.value) return;
  if (
    ["关闭工单", "转单"].includes(action.value) &&
    !remark.value.trim()
  ) {
    actionError.value = "请填写原因";
    return;
  }
  if (
    ["转单", "临时邀约"].includes(action.value) &&
    !selectedPeople.value.length
  ) {
    actionError.value = "请选择人员";
    return;
  }
  const order = selectedOrder.value;
  if (order) {
    if (action.value === "提交审核") {
      if (["待申请", "待库管入库"].includes(order.returnState)) {
        actionError.value = "还料尚未入库，当前不能演示提交审核";
        return;
      }
      if (
        [laborCost.value, materialCost.value].some(
          (v) => !Number.isFinite(Number(v)) || Number(v) < 0,
        )
      ) {
        actionError.value = "请填写有效的非负金额";
        return;
      }
      order.costs = {
        labor: Number(laborCost.value),
        material: Number(materialCost.value),
      };
      order.status = "待审批";
    }
    if (action.value === "关闭工单") order.status = "已关闭";
    if (action.value === "撤回审核") order.status = "进行中";
    if (action.value === "转单")
      order.transfer = {
        to: selectedPeople.value[0],
        reason: remark.value,
        status: "待接收",
      };
    order.events.push(
      `${action.value}（演示）${selectedPeople.value.length ? " · " + selectedPeople.value.join("、") : ""}${remark.value ? "：" + remark.value : ""}`,
    );
  }
  message.value = `${action.value === "转单" ? "已展示转单申请，待接收人确认" : "已展示" + action.value + "结果"}；未发送到服务器。`;
  action.value = "";
}
function respondTransfer(status: "已接收" | "已驳回" | "已撤回") {
  if (!canOperate.value) return;
  const order = selectedOrder.value;
  if (!order?.transfer || order.transfer.status !== "待接收") return;
  order.transfer.status = status;
  if (status === "已接收") order.owner = order.transfer.to;
  order.events.push(`转单${status}（演示）`);
  message.value = `已展示转单${status}状态；未发送到服务器。`;
}
function viewPhotos(current: string, urls: string[]) {
  uni.previewImage({ current, urls });
}
</script>

<style scoped lang="scss">
@use "./preview.scss";
.ops-preview {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: #f3f5f8;
  color: #333;
  font-size: 14px;
  overflow-wrap: anywhere;
}
.preview-shell {
  height: 100%;
  background: #f3f5f8;
}
.preview-body {
  flex: 1;
  height: 0;
  min-height: 0;
}
.preview-content {
  box-sizing: border-box;
  max-width: 760px;
  margin: 0 auto;
  padding: 12px 12px calc(22px + env(safe-area-inset-bottom));
}
.intro {
  padding: 16px 14px;
}
.intro .title,
.intro .summary strong {
  color: #333;
}
.intro .muted,
.intro .summary button {
  color: #667085;
}
.intro .summary button + button {
  border-left-color: #edf0f3;
}
.feedback {
  background: #e8f5ee;
  color: #237046;
  border-radius: 8px;
  padding: 8px 12px;
  margin-bottom: 12px;
  font-size: 13px;
}
.feedback .btn {
  flex-shrink: 0;
}
.summary {
  display: flex;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #edf0f3;
}
.summary button {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: #667085;
  line-height: 1.5;
  background: transparent;
  padding: 6px;
  border-radius: 0;
}
.summary button::after {
  border: none;
}
.summary button + button {
  border-left: 1px solid #eef0f5;
}
.summary strong {
  font-size: 23px;
  color: #2f86ff;
  font-weight: 600;
}
.entry-panel {
  padding: 14px;
}
.entry-panel .section-title {
  margin-bottom: 12px;
}
.entry-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.recent-order + .recent-order {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #edf0f3;
}
.entry {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  min-width: 0;
  background: #fff;
  padding: 11px 4px 12px;
  margin: 0;
  border-radius: 0;
  text-align: center;
  line-height: 1.6;
  font-size: 15px;
  color: #333;
}
.entry::after {
  border: none;
}
.entry:focus-visible {
  outline: 2px solid #2f86ff;
  outline-offset: -2px;
  border-radius: 8px;
}
.entry-icon {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #2f86ff;
  background: #eaf4ff;
}
.entry:nth-child(4n + 2) .entry-icon {
  background: #ebf8f2;
  color: #2e9b69;
}
.entry:nth-child(4n + 3) .entry-icon {
  background: #f1edff;
  color: #7457c5;
}
.entry:nth-child(4n + 4) .entry-icon {
  background: #fff3e5;
  color: #c47618;
}
.entry-label {
  color: #4c5968;
  font-size: 12px;
  line-height: 1.5;
}
.order-title {
  font-size: 16px;
  font-weight: 600;
  margin: 8px 0 4px;
}
.detail-link {
  margin-top: 8px;
  text-align: right;
}
.tabs {
  display: flex;
  margin: 12px 0 0;
  border-bottom: 1px solid #dfe5ee;
}
.tabs button {
  flex: 1;
  font-size: 14px;
  border-radius: 0;
  background: transparent;
  color: #667085;
  padding: 12px 0;
  line-height: 1.5;
}
.tabs button::after {
  border: none;
}
.tabs button.active {
  color: #176ac7;
  border-bottom: 2px solid #2f86ff;
  font-weight: 600;
}
.list-count {
  padding: 12px 2px;
}
.repair-filters { padding: 12px; margin: -12px -12px 0; background: #fff; }
.repair-search, .repair-filter-row, .repair-select { display: flex; align-items: center; gap: 12px; }
.repair-input { flex: 1; min-width: 0; height: 44px; padding: 0 12px; font-size: 16px; background: #f4f6f8; border-radius: 8px; }
.repair-filters button { margin: 0; padding: 0 16px; font-size: 14px; line-height: 44px; flex: none; border-radius: 8px; }
.repair-filters button::after { border: 0; }
.repair-query { color: #fff; background: #176ac7; }
.repair-filter-row { margin-top: 8px; }
.repair-picker { flex: 1; min-width: 0; }
.repair-select { min-height: 44px; justify-content: space-between; font-size: 14px; color: #333; }
.repair-reset { background: #f4f6f8; color: #176ac7; }
.repair-tabs { display: flex; margin-top: 8px; border-bottom: 1px solid #eef0f5; }
.repair-tabs button { flex: 1; padding: 0 4px; color: #667085; background: transparent; border-radius: 0; }
.repair-tabs button.active { color: #176ac7; font-weight: 600; border-bottom: 2px solid #176ac7; }
.repair-card { background: #fff; border-radius: 12px; padding: 14px; margin-bottom: 12px; }
.repair-card__head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 6px; }
.repair-card__no { min-width: 0; overflow-wrap: anywhere; font-size: 14px; font-weight: 600; color: #333; }
.repair-card__name { font-size: 16px; font-weight: 600; color: #222; margin-bottom: 8px; overflow-wrap: anywhere; }
.repair-row { display: flex; margin-top: 6px; line-height: 1.6; }
.repair-label { width: 60px; font-size: 13px; color: #667085; flex: none; }
.repair-value { flex: 1; min-width: 0; font-size: 13px; color: #333; overflow-wrap: anywhere; }
.repair-fault { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.repair-card:focus-visible, .repair-input:focus-visible, .repair-filters button:focus-visible { outline: 2px solid #176ac7; outline-offset: 2px; }
.search-row {
  display: flex;
  gap: 10px;
  margin-top: 14px;
}
.search-row .input {
  flex: 1;
  min-width: 0;
}
.filter {
  height: 44px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: #667085;
}
.timeline {
  padding: 10px 0 10px 15px;
  border-left: 1px solid #d8e3f6;
  position: relative;
  line-height: 1.7;
}
.timeline::before {
  content: "";
  position: absolute;
  left: -4px;
  top: 17px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #2f86ff;
}
.log + .log {
  border-top: 1px solid #eef0f5;
  margin-top: 14px;
  padding-top: 14px;
}
.log-desc {
  margin: 12px 0;
  line-height: 1.7;
  white-space: pre-wrap;
}
.detail-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  position: sticky;
  bottom: 0;
  padding: 12px 0;
  background: #f3f5f8;
}
.detail-actions .btn {
  flex: 1;
  white-space: nowrap;
}
.preview-footer {
  text-align: center;
  color: #6c788a;
  font-size: 12px;
  padding: 24px 0 0;
}
.sheet-mask {
  position: absolute;
  inset: 0;
  background: rgba(16, 28, 48, 0.4);
  z-index: 2;
  display: flex;
  justify-content: center;
  align-items: flex-end;
}
.sheet {
  width: 100%;
  max-width: 760px;
  max-height: 80%;
  overflow-y: auto;
  box-sizing: border-box;
  padding: 20px 20px calc(20px + env(safe-area-inset-bottom));
  background: #fff;
  border-radius: 16px 16px 0 0;
}
.spaced {
  margin-top: 16px;
}
.full {
  width: 100%;
}
.action-menu {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 20px;
}
.material-row {
  padding: 16px 0;
  border-bottom: 1px solid #eef0f5;
}
.material-row .row + .row {
  margin-top: 10px;
}
.material-qty {
  width: 78px;
  text-align: center;
}
</style>
