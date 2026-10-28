<template>
  <!-- THESIS: 墨刀运维操作流，按任务分屏。OWN-WORLD: 沿用蓝白、12px圆角、系统字体。
       STORY: 接单到预约/日志，再到还料审核；巡检独立。FIRST VIEWPORT: 顶栏、预览提示、任务入口。
       FORM: 用户指定墨刀结构的局部扩展，无新视觉体系。FINISH: 检查移动布局，记录接口边界。 -->
  <view class="ops-preview">
    <view class="preview-shell">
      <view class="preview-nav"
        ><button class="btn btn--text nav-back" @click="back">
          <wd-icon name="arrow-left" size="18px" /><text>{{
            screen === "hub" ? "退出" : "返回"
          }}</text></button
        ><text class="title">{{ titles[screen] }}</text
        ><button class="btn btn--text" @click="navigate('hub')">
          目录
        </button></view
      >
      <view class="notice"
        >页面预览 · 全部为示例数据，仅在本次打开期间保留，不会提交业务。</view
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
          <template v-if="screen === 'hub'">
            <view class="panel intro"
              ><view class="title">运维工作台</view
              ><view class="muted"
                >从报修受理到维修归档，逐页预览操作流程。</view
              ><view class="summary"
                ><button @click="navigate('reports')">
                  <strong>{{
                    reports.filter((r) => r.status === "未处理").length
                  }}</strong
                  ><text>待接报修</text></button
                ><button @click="navigate('records')">
                  <strong>{{
                    orders.filter((o) => o.status === "进行中").length
                  }}</strong
                  ><text>维修中</text></button
                ><button @click="navigate('inspection')">
                  <strong>巡检</strong><text>查看任务</text>
                </button></view
              ></view
            >
            <view class="panel entry-panel"
              ><view class="section-title">维修办理</view><view class="entry-grid"><button
                v-for="entry in entries"
                :key="entry.screen"
                class="entry"
                :aria-label="`${entry.label}，${entry.description}`"
                @click="openEntry(entry.screen)"
              >
                <view class="entry-icon"
                  ><wd-icon :name="entry.icon" size="24px" /></view
                ><text class="entry-label">{{ entry.label }}</text></button
            ></view></view>
            <view class="panel recent-orders">
            <view class="section-title">最近维修工单</view>
            <view
              v-for="order in orders.slice(0, 3)"
              :key="order.id"
              class="recent-order"
              ><view class="row"
                ><text class="muted">{{ order.id }}</text
                ><text class="badge" :class="tone(order.status)">{{
                  order.status
                }}</text></view
              ><view class="order-title">{{ order.customer }}</view
              ><view class="muted"
                >{{ order.equipment }} ·
                {{ order.mode === "online" ? "线上维修" : "线下维修" }}</view
              ><button
                class="btn btn--text detail-link"
                @click="openOrder(order)"
              >
                查看工单<wd-icon name="arrow-right" /></button
            ></view>
            </view>
          </template>
          <template v-else-if="screen === 'reports'">
            <input
              v-model="query"
              class="input"
              placeholder="搜索报修单号、客户、设备"
            />
            <view class="tabs"
              ><button
                v-for="s in reportStatuses"
                :key="s"
                :class="{ active: reportFilter === s }"
                @click="
                  reportFilter = s;
                  page = 1;
                "
              >
                {{ s
                }}<text v-if="s === '未处理'">
                  {{ reports.filter((r) => r.status === s).length }}</text
                >
              </button></view
            >
            <view class="muted list-count"
              >共 {{ filteredReports.length }} 条报修</view
            >
            <view v-for="r in pagedReports" :key="r.id" class="panel"
              ><view class="row"
                ><text class="muted">{{ r.id }}</text
                ><text class="badge" :class="tone(r.status)">{{
                  r.status
                }}</text></view
              ><view class="order-title">{{ r.customer }}</view
              ><view class="kv"
                ><text>报修项目</text><text>{{ r.equipment }}</text></view
              ><view class="kv"
                ><text>故障描述</text><text>{{ r.fault }}</text></view
              ><view class="muted">{{ r.time }} 申请</view
              ><view class="actions"
                ><button
                  class="btn"
                  @click="
                    selectedReport = r;
                    navigate('report');
                  "
                >
                  查看详情</button
                ><button
                  v-if="r.status === '未处理'"
                  class="btn btn--primary"
                  @click="
                    selectedReport = r;
                    openAction('接单');
                  "
                >
                  接单
                </button></view
              ></view
            >
            <view v-if="!filteredReports.length" class="empty"
              >没有找到相关报修<br />请调整关键词或状态</view
            >
            <view v-if="filteredReports.length > 5" class="pagination"
              ><button class="btn" :disabled="page === 1" @click="page--">
                上一页</button
              ><text
                >{{ page }} / {{ Math.ceil(filteredReports.length / 5) }}</text
              ><button
                class="btn"
                :disabled="page * 5 >= filteredReports.length"
                @click="page++"
              >
                下一页
              </button></view
            >
          </template>
          <template v-else-if="screen === 'report' && selectedReport">
            <view class="panel"
              ><view class="row"
                ><text class="title">{{ selectedReport.equipment }}报修</text
                ><text class="badge" :class="tone(selectedReport.status)">{{
                  selectedReport.status
                }}</text></view
              ><view class="muted">{{ selectedReport.id }}</view
              ><view class="divider" /><view class="kv"
                ><text>客户名称</text
                ><text>{{ selectedReport.customer }}</text></view
              ><view class="kv"
                ><text>客户地址</text><text>示例园区 · 一号作业区</text></view
              ><view class="kv"
                ><text>联系人</text><text>客户联系人（示例）</text></view
              ><view class="kv"><text>联系电话</text><text>未填写</text></view
              ><view class="kv"
                ><text>故障描述</text
                ><text>{{ selectedReport.fault }}</text></view
              ><view class="kv"
                ><text>报故时间</text
                ><text>{{ selectedReport.time }}</text></view
              ><view class="muted">故障照片：暂无示例附件</view></view
            >
            <view class="panel"
              ><view class="section-title">处理记录</view
              ><view class="timeline">{{ selectedReport.time }} · 发起报修</view
              ><view v-if="selectedReport.status !== '未处理'" class="timeline"
                >{{ selectedReport.status }} · 当前操作人（示例）<view
                  class="muted"
                  >{{ selectedReport.reason }}</view
                ></view
              ></view
            >
            <view v-if="selectedReport.status === '未处理'" class="actions"
              ><button class="btn btn--danger" @click="openAction('驳回')">
                驳回</button
              ><button class="btn btn--primary" @click="openAction('接单')">
                接单
              </button></view
            >
          </template>
          <template v-else-if="screen === 'records'">
            <view class="choices"
              ><button
                v-for="m in ['全部', '线下维修', '线上维修']"
                :key="m"
                class="choice"
                :class="{ on: modeFilter === m }"
                @click="
                  modeFilter = m;
                  page = 1;
                "
              >
                {{ m }}
              </button></view
            >
            <view class="search-row"
              ><input
                v-model="query"
                class="input"
                placeholder="搜索工单号、客户" /><picker
                :range="orderStatuses"
                @change="
                  statusFilter = orderStatuses[Number($event.detail.value)];
                  page = 1;
                "
                ><view class="filter"
                  >{{ statusFilter
                  }}<wd-icon name="arrow-down" /></view></picker
            ></view>
            <view class="muted list-count"
              >共 {{ filteredOrders.length }} 条 · 每页 5 条</view
            >
            <view v-for="order in pagedOrders" :key="order.id" class="panel"
              ><view class="row"
                ><text class="muted">{{ order.id }}</text
                ><text class="badge" :class="tone(order.status)">{{
                  order.status
                }}</text></view
              ><view class="order-title">{{ order.customer }}</view
              ><view class="muted"
                >{{ order.equipment }} · {{ order.nature }} ·
                {{ order.mode === "online" ? "线上" : "线下" }}</view
              ><view class="kv"
                ><text>故障描述</text><text>{{ order.fault }}</text></view
              ><view class="row"
                ><text class="muted">{{ order.owner }}</text
                ><button class="btn btn--text" @click="openOrder(order)">
                  查看详情<wd-icon name="arrow-right" /></button></view
            ></view>
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
                  v-if="selectedOrder.status === '未开始'"
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
                  >用车：{{ log.vehicle }}</view
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
              ><template v-if="selectedOrder.transfer.status === '待接收'"
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
            <view class="detail-actions">
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
            v-else-if="['reservation', 'offline', 'online'].includes(screen)"
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
              ><button class="btn" @click="openAction('转单')">
                人员协作 · 转单</button
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
          <template v-else-if="action === '接单'"
            ><view class="choices spaced"
              ><button
                class="choice"
                :class="{ on: acceptMode === 'offline' }"
                @click="acceptMode = 'offline'"
              >
                线下预约</button
              ><button
                class="choice"
                :class="{ on: acceptMode === 'online' }"
                @click="acceptMode = 'online'"
              >
                线上维修
              </button></view
            ><view class="actions"
              ><button class="btn" @click="confirmAccept(false)">
                接单后稍后处理</button
              ><button class="btn btn--primary" @click="confirmAccept(true)">
                接单并继续
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
                ['驳回', '关闭工单', '转单'].includes(action)
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
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import OpsPreviewForm from "./OpsPreviewForm.vue";
import OpsPreviewInspection from "./OpsPreviewInspection.vue";
import {
  createOrders,
  createReports,
  materialOptions,
  peopleOptions,
  type PreviewOrder,
  type RepairMode,
  type PreviewFormData,
} from "./previewData";
const emit = defineEmits<{ close: [] }>();
type Screen =
  | "hub"
  | "reports"
  | "report"
  | "records"
  | "detail"
  | "reservation"
  | "offline"
  | "online"
  | "material"
  | "inspection";
const titles: Record<Screen, string> = {
  hub: "运维页面预览",
  reports: "报修接单",
  report: "报修详情",
  records: "维修记录",
  detail: "工单详情",
  reservation: "线下预约",
  offline: "线下维修",
  online: "线上维修",
  material: "物料办理",
  inspection: "巡检管理",
};
const entries: {
  screen: Screen;
  label: string;
  description: string;
  icon: string;
}[] = [
  {
    screen: "reports",
    label: "报修接单",
    description: "查看报修、接单或驳回",
    icon: "notification",
  },
  {
    screen: "reservation",
    label: "线下预约",
    description: "客户、预约时间与协助人员",
    icon: "calendar",
  },
  {
    screen: "offline",
    label: "线下维修",
    description: "到岗签到、日志填写与结束打卡",
    icon: "edit-outline",
  },
  {
    screen: "online",
    label: "线上维修",
    description: "无需预约，直接填写维修日志",
    icon: "computer",
  },
  {
    screen: "records",
    label: "维修记录",
    description: "工单进度、用料与审核",
    icon: "calendar",
  },
  {
    screen: "inspection",
    label: "巡检管理",
    description: "巡检任务、对象检查与异常办结",
    icon: "search",
  },
];
const screen = ref<Screen>("hub");
const history = ref<Screen[]>([]);
const orders = ref(createOrders());
const reports = ref(createReports());
const selectedOrder = ref<PreviewOrder | null>(null);
const selectedReport = ref<ReturnType<typeof createReports>[number] | null>(
  null,
);
const reportStatuses = ["全部", "未处理", "已接单", "已驳回"];
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
const reportFilter = ref("全部");
const modeFilter = ref("全部");
const statusFilter = ref("全部状态");
const query = ref("");
const page = ref(1);
const formKey = ref(0);
const scrollTop = ref(0);
const lastScroll = ref(0);
const message = ref("");
const action = ref("");
const actionError = ref("");
const remark = ref("");
const acceptMode = ref<RepairMode>("offline");
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
const filteredReports = computed(() =>
  reports.value.filter(
    (r) =>
      (reportFilter.value === "全部" || r.status === reportFilter.value) &&
      `${r.id}${r.customer}${r.equipment}`
        .toLowerCase()
        .includes(query.value.trim().toLowerCase()),
  ),
);
const filteredOrders = computed(() =>
  orders.value.filter(
    (o) =>
      (statusFilter.value === "全部状态" || o.status === statusFilter.value) &&
      (modeFilter.value === "全部" ||
        o.mode === (modeFilter.value === "线上维修" ? "online" : "offline")) &&
      `${o.id}${o.customer}`
        .toLowerCase()
        .includes(query.value.trim().toLowerCase()),
  ),
);
const pagedReports = computed(() =>
  filteredReports.value.slice((page.value - 1) * 5, page.value * 5),
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
  if (target === screen.value) return;
  if (target === "hub") history.value = [];
  else history.value.push(screen.value);
  screen.value = target;
  action.value = "";
  actionError.value = "";
  query.value = "";
  page.value = 1;
  formKey.value++;
}
function back() {
  if (action.value) {
    action.value = "";
    return;
  }
  if (screen.value === "hub") emit("close");
  else {
    screen.value = history.value.pop() || "hub";
    query.value = "";
    page.value = 1;
    formKey.value++;
  }
}
function openEntry(target: Screen) {
  selectedOrder.value =
    target === "offline"
      ? orders.value.find(
          (o) => o.mode === "offline" && o.status === "未开始",
        ) || null
      : null;
  navigate(target);
}
function openOrder(order: PreviewOrder) {
  selectedOrder.value = order;
  navigate("detail");
}
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
  action.value = name;
  actionError.value = "";
  remark.value = "";
  selectedPeople.value = [];
  acceptMode.value = "offline";
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
function confirmAccept(continueNow: boolean) {
  const report = selectedReport.value;
  if (!report || report.status !== "未处理") return;
  report.status = "已接单";
  const order: PreviewOrder = {
    ...createOrders()[0],
    id: `DEMO-GZ-${orders.value.length + 1}`,
    customer: report.customer,
    equipment: report.equipment,
    fault: report.fault,
    mode: acceptMode.value,
    events: [`关联报修 ${report.id} · 已接单（演示）`],
    logs: [],
  };
  orders.value.unshift(order);
  selectedOrder.value = orders.value[0];
  action.value = "";
  message.value = "已演示接单；未发送到服务器。";
  if (continueNow)
    navigate(acceptMode.value === "offline" ? "reservation" : "online");
}
function completeForm(data: PreviewFormData) {
  let order = selectedOrder.value;
  if (!order) {
    orders.value.unshift({
      ...createOrders()[0],
      id: `DEMO-GZ-${orders.value.length + 1}`,
      mode: screen.value === "online" ? "online" : "offline",
      logs: [],
      events: [],
    });
    order = orders.value[0];
  }
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
  history.value = ["hub", "records"];
}
function openMaterial(mode: "apply" | "return") {
  materialMode.value = mode;
  materialRows.value = materialOptions.map((m) => ({ ...m }));
  remark.value = "";
  navigate("material");
}
function submitMaterial() {
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
  if (
    ["驳回", "关闭工单", "转单"].includes(action.value) &&
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
  if (action.value === "驳回" && selectedReport.value) {
    selectedReport.value.status = "已驳回";
    selectedReport.value.reason = remark.value;
  }
  const order = selectedOrder.value;
  if (order && action.value !== "驳回") {
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
  max-width: 760px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  background: #f3f5f8;
}
.preview-nav {
  flex-shrink: 0;
  padding: env(safe-area-inset-top) 12px 0;
  min-height: 48px;
  background: #fff;
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr) 64px;
  align-items: center;
  border-bottom: 1px solid #edf0f3;
}
.preview-nav > .title {
  text-align: center;
  font-size: 16px;
}
.preview-nav > .btn:last-child {
  text-align: right;
}
.nav-back {
  display: flex;
  align-items: center;
  gap: 3px;
}
.preview-body {
  flex: 1;
  height: 0;
  min-height: 0;
}
.preview-content {
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
