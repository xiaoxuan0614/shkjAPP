<template>
  <view>
    <view v-if="mode !== 'reservation'" class="steps">
      <view
        v-for="(label, i) in steps"
        :key="label"
        class="step"
        :class="{ active: i === step, complete: i < step }"
      >
        <text class="step-number">{{ i + 1 }}</text
        ><text>{{ label }}</text>
      </view>
    </view>
    <view v-if="error" class="error" role="alert">{{ error }}</view>
    <template v-if="mode === 'reservation' || step === 0">
      <view class="panel">
        <view class="section-title">客户信息</view>
        <view class="field">
          <text class="field-label"
            >客户名称<text class="required">*</text></text
          >
          <input
            v-model="form.customer"
            class="input"
            placeholder="输入客户名称，搜索示例客户"
          />
          <view
            v-if="!order && form.customer && !customerChosen"
            class="customer-results"
          >
            <button
              v-for="name in customerMatches"
              :key="name"
              class="btn btn--text"
              @click="chooseCustomer(name)"
            >
              {{ name }}
            </button>
            <text v-if="!customerMatches.length" class="muted"
              >暂无匹配示例客户，可直接填写名称。</text
            >
          </view>
        </view>
        <view class="field"
          ><text class="field-label">客户地址</text
          ><input
            v-model="form.address"
            class="input"
            placeholder="填写客户地址"
        /></view>
        <view class="split">
          <view class="field"
            ><text class="field-label">客户联系人</text
            ><input
              v-model="form.contact"
              class="input"
              placeholder="填写联系人"
          /></view>
          <view class="field"
            ><text class="field-label">联系电话</text
            ><input
              v-model="form.phone"
              class="input"
              type="text"
              placeholder="填写联系电话"
          /></view>
        </view>
        <view class="kv"
          ><text>维保期限</text
          ><text>2026-01-01 至 2026-12-31（示例）</text></view
        >
        <view class="field"
          ><text class="field-label">维护性质</text
          ><view class="choices"
            ><button
              v-for="n in natures"
              :key="n"
              class="choice"
              :class="{ on: form.nature === n }"
              @click="form.nature = n"
            >
              {{ n }}
            </button></view
          ></view
        >
        <view class="field"
          ><text class="field-label">维护类型</text
          ><picker
            :range="equipmentOptions"
            @change="
              form.equipment = equipmentOptions[Number($event.detail.value)]
            "
            ><view class="input picker"
              >{{ form.equipment }}<wd-icon name="arrow-down" /></view></picker
        ></view>
      </view>
      <view v-if="mode === 'reservation'" class="panel">
        <view class="section-title">预约信息</view>
        <view class="field"
          ><text class="field-label">报故时间</text
          ><view class="split"
            ><picker
              mode="date"
              :value="form.faultDate"
              @change="form.faultDate = $event.detail.value"
              ><view class="input picker">{{ form.faultDate }}</view></picker
            ><picker
              mode="time"
              :value="form.faultTime"
              @change="form.faultTime = $event.detail.value"
              ><view class="input picker">{{ form.faultTime }}</view></picker
            ></view
          ></view
        >
        <view class="field"
          ><text class="field-label"
            >维修预约时间<text class="required">*</text></text
          ><view class="split"
            ><picker
              mode="date"
              :value="form.date"
              @change="form.date = $event.detail.value"
              ><view class="input picker">{{ form.date }}</view></picker
            ><picker
              mode="time"
              :value="form.time"
              @change="form.time = $event.detail.value"
              ><view class="input picker">{{ form.time }}</view></picker
            ></view
          ></view
        >
        <view class="field"
          ><text class="field-label">故障描述</text
          ><textarea
            v-model="form.fault"
            class="textarea"
            maxlength="1000"
            placeholder="填写客户反馈的故障现象"
          />
        </view>
      </view>
      <view v-if="mode === 'offline'" class="panel">
        <view class="section-title">到岗签到</view>
        <view class="notice">预览不获取定位，不产生考勤记录。</view>
        <view class="kv"
          ><text>作业地点</text
          ><text>{{ form.address || "示例园区 · 一号作业区" }}</text></view
        >
        <button
          class="btn"
          :class="{ 'btn--primary': !signedIn }"
          :disabled="signedIn"
          @click="signedIn = true"
        >
          {{ signedIn ? "已演示签到" : "演示到岗签到" }}
        </button>
      </view>
      <view v-if="mode !== 'offline'" class="panel">
        <view class="section-title">人员信息</view>
        <view class="kv"
          ><text>运维人员</text><text>当前操作人（示例）</text></view
        >
        <view class="row"
          ><text class="field-label">{{
            mode === "online" ? "需要内协" : "协助需求"
          }}</text
          ><switch
            :checked="form.assistance"
            color="#2f86ff"
            @change="form.assistance = $event.detail.value"
        /></view>
        <template v-if="form.assistance">
          <view v-if="mode === 'reservation'" class="choices"
            ><button
              v-for="kind in ['内协', '外协']"
              :key="kind"
              class="choice"
              :class="{ on: form.assistTypes.includes(kind) }"
              @click="toggle(form.assistTypes, kind)"
            >
              {{ kind }}
            </button></view
          >
          <view
            v-if="mode === 'online' || form.assistTypes.includes('内协')"
            class="field spaced"
            ><text class="field-label">内协人员（多选）</text
            ><view class="choices"
              ><button
                v-for="p in peopleOptions"
                :key="p"
                class="choice"
                :class="{ on: form.people.includes(p) }"
                @click="toggle(form.people, p)"
              >
                {{ p }}
              </button></view
            ></view
          >
          <template
            v-if="mode === 'reservation' && form.assistTypes.includes('外协')"
          >
            <view class="field spaced"
              ><text class="field-label">外协单位</text
              ><input
                v-model="form.outsource"
                class="input"
                placeholder="填写外协单位"
            /></view>
            <view class="split"
              ><view class="field"
                ><text class="field-label">人数</text
                ><input
                  v-model="form.outsourceCount"
                  class="input"
                  type="number" /></view
              ><view class="field"
                ><text class="field-label">工时（h）</text
                ><input
                  v-model="form.outsourceHours"
                  class="input"
                  type="digit" /></view
            ></view>
          </template>
        </template>
      </view>
    </template>
    <template v-if="mode !== 'reservation' && step === 1">
      <view class="panel">
        <view class="section-title">维修记录</view>
        <view class="field"
          ><text class="field-label">维修状态</text
          ><view class="choices"
            ><button
              v-for="s in resultOptions"
              :key="s"
              class="choice"
              :class="{ on: form.result === s }"
              @click="form.result = s"
            >
              {{ s }}
            </button></view
          ></view
        >
        <view class="field"
          ><text class="field-label"
            >维修描述<text class="required">*</text></text
          ><textarea
            v-model="form.description"
            class="textarea"
            maxlength="2000"
            placeholder="描述本次检查、维修过程及处理结果"
          />
        </view>
        <view v-if="form.result === '需要复修'" class="field"
          ><text class="field-label"
            >复修原因<text class="required">*</text></text
          ><textarea
            v-model="form.reason"
            class="textarea"
            maxlength="500"
            placeholder="说明未解决的问题及下次维修准备"
          />
        </view>
        <view v-if="mode === 'online'" class="field"
          ><text class="field-label">报故时间</text
          ><view class="split"
            ><picker
              mode="date"
              :value="form.faultDate"
              @change="form.faultDate = $event.detail.value"
              ><view class="input picker">{{ form.faultDate }}</view></picker
            ><picker
              mode="time"
              :value="form.faultTime"
              @change="form.faultTime = $event.detail.value"
              ><view class="input picker">{{ form.faultTime }}</view></picker
            ></view
          ></view
        >
        <view
          v-if="mode === 'online' && form.result === '维修完成'"
          class="field"
          ><text class="field-label">完成时间</text
          ><view class="split"
            ><picker
              mode="date"
              :value="form.date"
              @change="form.date = $event.detail.value"
              ><view class="input picker">{{ form.date }}</view></picker
            ><picker
              mode="time"
              :value="form.time"
              @change="form.time = $event.detail.value"
              ><view class="input picker">{{ form.time }}</view></picker
            ></view
          ></view
        >
        <view class="field"
          ><text class="field-label">维修后照片</text
          ><view class="photos"
            ><view v-for="(photo, i) in form.photos" :key="photo"
              ><image
                class="photo"
                :src="photo"
                mode="aspectFill"
                @click="previewPhoto(photo)"
              /><button class="btn btn--text" @click="form.photos.splice(i, 1)">
                移除
              </button></view
            ><button
              v-if="form.photos.length < 6"
              class="btn"
              @click="choosePhotos"
            >
              选择照片 {{ form.photos.length }}/6
            </button></view
          ><text class="muted">仅在当前页面预览，不上传。</text></view
        >
      </view>
      <view class="panel">
        <view class="section-title">故障信息</view>
        <view class="field"
          ><text class="field-label">故障位置</text
          ><input
            v-model="form.faultPosition"
            class="input"
            placeholder="如：铅封机显示屏"
        /></view>
        <view class="field"
          ><text class="field-label">故障描述</text
          ><textarea
            v-model="form.fault"
            class="textarea"
            maxlength="1000"
            placeholder="填写故障现象和排查结果"
          />
        </view>
        <view class="field"><text class="field-label">报价情况</text><text class="muted">{{ order?.quoteStatus || '历史示例，未关联报价' }} · 需要报价时，维修前完成内部确认</text></view>
      </view>
    </template>
    <template v-if="mode === 'offline' && step === 2">
      <view class="panel">
        <view class="section-title">用料记录</view>
        <view v-for="m in materials" :key="m.name" class="material-line"
          ><view
            ><view>{{ m.name }}</view
            ><text class="muted"
              >{{ m.model }} · 可用 {{ m.available }} {{ m.unit }}</text
            ></view
          ><input
            v-model.number="m.qty"
            class="input qty"
            type="digit"
            :aria-label="m.name + '使用数量'"
        /></view>
      </view>
      <view class="panel"
        ><view class="section-title">用车记录</view
        ><view class="field"
          ><text class="field-label">使用车辆</text
          ><input
            v-model="form.vehicle"
            class="input"
            placeholder="选填，填写车牌号" /></view
        ><view class="field"
          ><text class="field-label">行驶里程（km）</text
          ><input
            v-model="form.mileage"
            class="input"
            type="digit"
            placeholder="选填" /></view
      ></view>
      <view class="panel"
        ><view class="section-title">参与人员</view
        ><text class="field-label">内协人员</text
        ><view class="choices"
          ><button
            v-for="p in peopleOptions"
            :key="p"
            class="choice"
            :class="{ on: form.people.includes(p) }"
            @click="toggle(form.people, p)"
          >
            {{ p }}
          </button></view
        ><view class="field spaced"
          ><text class="field-label">外协单位</text
          ><input
            v-model="form.outsource"
            class="input"
            placeholder="选填" /></view
        ><view class="split"
          ><view
            ><text class="field-label">外协人数</text
            ><input
              v-model="form.outsourceCount"
              type="number"
              class="input" /></view
          ><view
            ><text class="field-label">外协工时（h）</text
            ><input
              v-model="form.outsourceHours"
              type="digit"
              class="input" /></view></view
      ></view>
    </template>
    <view v-if="mode === 'offline' && step === 3" class="panel">
      <view class="section-title">结束打卡</view
      ><view class="kv"
        ><text>维修结果</text><text>{{ form.result }}</text></view
      ><view class="kv"
        ><text>维修描述</text><text>{{ form.description }}</text></view
      >
      <view class="row"
        ><text>演示位置异常</text
        ><switch
          :checked="locationAbnormal"
          color="#2f86ff"
          @change="locationAbnormal = $event.detail.value"
      /></view>
      <textarea
        v-if="locationAbnormal"
        v-model="locationReason"
        class="textarea spaced"
        placeholder="请填写位置异常原因"
      />
      <view class="notice spaced"
        >演示签退只更新本页预览，不读取位置、不提交考勤。</view
      >
    </view>
    <view class="muted"
      >离开此表单会清空未完成填写；完成演示后可在工单详情查看。</view
    >
    <view class="actions form-actions"
      ><button
        v-if="step > 0"
        class="btn"
        @click="
          step--;
          error = '';
          emit('focus-top');
        "
      >
        上一步</button
      ><button
        class="btn btn--primary"
        @click="
          next();
          emit('focus-top');
        "
      >
        {{
          mode === "reservation"
            ? "预览预约结果"
            : step === steps.length - 1
              ? "完成演示"
              : "下一步"
        }}
      </button></view
    >
  </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import {
  materialOptions,
  peopleOptions,
  type PreviewOrder,
  type PreviewFormData,
} from "./previewData";
const props = defineProps<{
  mode: "reservation" | "offline" | "online";
  order?: PreviewOrder;
}>();
const emit = defineEmits<{
  complete: [data: PreviewFormData];
  "focus-top": [];
}>();
const natures = ["全包", "半包", "质保", "非质保"];
const equipmentOptions = ["铅封机", "闸口软件", "车牌摄像头", "无人地磅"];
const step = ref(0);
const error = ref("");
const signedIn = ref(false);
const locationAbnormal = ref(false);
const locationReason = ref("");
const customerChosen = ref(false);
const steps = computed(() =>
  props.mode === "online"
    ? ["客户与人员", "维修记录"]
    : ["基本信息", "维修记录", "用料与人员", "结束打卡"],
);
const resultOptions = computed(() =>
  props.mode === "online"
    ? ["暂未开始", "需要复修", "维修完成"]
    : ["维修完成", "需要复修", "客户弃修"],
);
const materials = reactive(materialOptions.map((m) => ({ ...m })));
const savedAssistance = props.order?.assistance;
const form = reactive<PreviewFormData>({
  customer: props.order?.customer || "",
  address: props.order?.address || "",
  contact: props.order?.contact || "",
  phone: props.order?.phone === "未填写" ? "" : props.order?.phone || "",
  nature: props.order?.nature || "全包",
  equipment:
    props.order?.equipment || (props.mode === "online" ? "闸口软件" : "铅封机"),
  fault: props.order?.fault || "",
  faultPosition: "",
  faultDate: "2026-09-24",
  faultTime: "09:00",
  date: props.order?.appointment?.split(" ")[0] || "2026-09-24",
  time: props.order?.appointment?.split(" ")[1] || "14:00",
  assistance: savedAssistance?.requested || false,
  assistTypes: [...(savedAssistance?.types || ["内协"])],
  people: [...(savedAssistance?.people || [])],
  outsource: savedAssistance?.outsource || "",
  outsourceCount: savedAssistance?.count || "",
  outsourceHours: savedAssistance?.hours || "",
  result: "维修完成",
  description: "",
  reason: "",
  photos: [],
  quote: props.order?.quoteStatus || '',
  vehicle: "",
  mileage: "",
  materials,
});
const customerMatches = computed(() =>
  ["滨海堆场（示例）", "港区物流（示例）", "智慧园区（示例）"].filter((n) =>
    n.includes(form.customer.trim()),
  ),
);
function chooseCustomer(name: string) {
  form.customer = name;
  form.address = "示例园区 · 一号作业区";
  form.contact = "客户联系人（示例）";
  customerChosen.value = true;
}
function toggle(items: string[], value: string) {
  const i = items.indexOf(value);
  i < 0 ? items.push(value) : items.splice(i, 1);
}
function choosePhotos() {
  uni.chooseImage({
    count: 6 - form.photos.length,
    success: (r) => {
      form.photos.push(...r.tempFilePaths.slice(0, 6 - form.photos.length));
    },
  });
}
function previewPhoto(photo: string) {
  uni.previewImage({ current: photo, urls: form.photos });
}
function next() {
  error.value = "";
  if (!form.customer.trim()) {
    error.value = "请填写客户名称";
    return;
  }
  if (props.mode === "reservation" && form.assistance) {
    if (!form.assistTypes.length) {
      error.value = "请选择协助类型";
      return;
    }
    if (form.assistTypes.includes("内协") && !form.people.length) {
      error.value = "请选择内协人员";
      return;
    }
    if (
      form.assistTypes.includes("外协") &&
      (!form.outsource.trim() ||
        !Number.isInteger(Number(form.outsourceCount)) ||
        Number(form.outsourceCount) <= 0 ||
        !Number.isFinite(Number(form.outsourceHours)) ||
        Number(form.outsourceHours) <= 0)
    ) {
      error.value = "请填写外协单位、有效人数和工时";
      return;
    }
  }
  if (
    props.mode === "online" &&
    step.value === 0 &&
    form.assistance &&
    !form.people.length
  ) {
    error.value = "请选择内协人员";
    return;
  }
  if (props.mode === "offline" && step.value === 0 && !signedIn.value) {
    error.value = "请先演示到岗签到";
    return;
  }
  if (props.mode !== "reservation" && step.value === 1) {
    if (!form.description.trim()) {
      error.value = "请填写维修描述";
      return;
    }
    if (form.result === "需要复修" && !form.reason.trim()) {
      error.value = "请填写复修原因";
      return;
    }
  }
  if (
    props.mode === "offline" &&
    step.value === 2 &&
    materials.some(
      (m) =>
        !Number.isFinite(Number(m.qty)) ||
        Number(m.qty) < 0 ||
        Number(m.qty) > m.available,
    )
  ) {
    error.value = "使用数量须在 0 与可用数量之间";
    return;
  }
  if (
    step.value === 3 &&
    locationAbnormal.value &&
    !locationReason.value.trim()
  ) {
    error.value = "请填写位置异常原因";
    return;
  }
  if (props.mode !== "reservation" && step.value < steps.value.length - 1) {
    step.value++;
    return;
  }
  const includePeople =
    props.mode === "offline" ||
    (form.assistance &&
      (props.mode === "online" || form.assistTypes.includes("内协")));
  const includeOutsource =
    props.mode === "offline" ||
    (form.assistance && form.assistTypes.includes("外协"));
  emit("complete", {
    ...form,
    people: includePeople ? [...form.people] : [],
    outsource: includeOutsource ? form.outsource : "",
    outsourceCount: includeOutsource ? form.outsourceCount : "",
    outsourceHours: includeOutsource ? form.outsourceHours : "",
    photos: [...form.photos],
    materials: materials.map((m) => ({ ...m, qty: Number(m.qty) })),
  });
}
</script>

<style scoped lang="scss">
@use "./preview.scss";
.steps {
  display: flex;
  padding: 8px 0 22px;
  gap: 4px;
}
.step {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  color: #667085;
  font-size: 12px;
}
.step-number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #e5eaf2;
}
.step.active {
  color: #176ac7;
  font-weight: 600;
}
.step.active .step-number {
  background: #2f86ff;
  color: #fff;
}
.step.complete .step-number {
  color: #176ac7;
  background: #dce8ff;
}
.picker {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.spaced {
  margin-top: 16px;
}
.material-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid #eef0f5;
  font-size: 14px;
}
.qty {
  width: 76px;
  flex-shrink: 0;
  text-align: center;
}
.form-actions {
  position: sticky;
  bottom: 0;
  padding: 12px 0;
  background: #f3f5f8;
}
.customer-results {
  margin-top: 8px;
}
</style>
