<template>
  <view>
    <view v-if="!selected" class="stack">
      <input
        v-model="query"
        class="input"
        placeholder="搜索巡检任务单号、客户"
      />
      <view class="choices"
        ><button
          v-for="s in ['全部', '未完成', '已完成']"
          :key="s"
          class="choice"
          :class="{ on: filter === s }"
          @click="filter = s"
        >
          {{ s }}
        </button></view
      >
      <view v-for="task in filteredTasks" :key="task.id" class="panel">
        <view class="row"
          ><text class="section-title">{{ task.id }}</text
          ><text
            class="badge"
            :class="task.done ? 'badge--success' : 'badge--warn'"
            >{{ task.done ? "已完成" : "未完成" }}</text
          ></view
        >
        <view class="title">{{ task.customer }}</view
        ><view class="muted">任务时间：2026-09-01 至 2026-09-30</view>
        <view class="kv"
          ><text>巡检项目</text
          ><text>{{ task.objects.map((o) => o.name).join("、") }}</text></view
        >
        <view class="row"
          ><text class="muted"
            >已填写 {{ completed(task) }}/{{ task.objects.length }} 个对象 ·
            异常 {{ abnormal(task) }} 项</text
          ><button
            class="btn btn--text"
            @click="
              selected = task;
              current = 0;
            "
          >
            {{ task.done ? "查看详情" : "填写巡检" }}
          </button></view
        >
      </view>
      <view v-if="!filteredTasks.length" class="empty"
        >暂无符合条件的巡检任务<br />试试其他关键词或状态</view
      >
    </view>
    <template v-else>
      <button
        class="btn btn--text back"
        @click="
          selected = null;
          error = '';
        "
      >
        返回巡检任务
      </button>
      <view class="panel"
        ><view class="title">{{ selected.customer }}</view
        ><view class="muted"
          >{{ selected.id }} · 巡检人员：当前操作人（示例）</view
        ><view class="progress"
          ><view
            :style="{
              width:
                (completed(selected) / selected.objects.length) * 100 + '%',
            }" /></view
        ><view class="row"
          ><text class="muted"
            >{{ completed(selected) }}/{{
              selected.objects.length
            }}
            个对象已填写</text
          ><text
            class="badge"
            :class="abnormal(selected) ? 'badge--danger' : 'badge--success'"
            >异常 {{ abnormal(selected) }} 项</text
          ></view
        ></view
      >
      <view v-if="error" class="error">{{ error }}</view>
      <view class="inspection-layout">
        <view class="object-menu"
          ><button
            v-for="(obj, i) in selected.objects"
            :key="obj.name"
            class="object"
            :class="{ on: current === i }"
            @click="
              current = i;
              error = '';
            "
          >
            <text>{{ obj.name }}</text
            ><text
              v-if="obj.items.some((item) => !item.value)"
              class="dot"
              aria-label="未填完"
            /></button
        ></view>
        <view class="object-content">
          <view class="section-title">{{ activeObject.name }}</view>
          <view class="field"
            ><text class="field-label">位置编号</text
            ><input
              v-model="activeObject.location"
              class="input"
              :disabled="selected.done"
              placeholder="如：入口 A1"
          /></view>
          <view
            v-for="item in activeObject.items"
            :key="item.label"
            class="check-item"
            ><text class="field-label">{{ item.label }}</text
            ><view class="choices"
              ><button
                v-for="v in ['正常', '异常']"
                :key="v"
                :disabled="selected.done"
                class="choice"
                :class="{
                  on: item.value === v,
                  abnormal: item.value === '异常' && v === '异常',
                }"
                @click="item.value = v"
              >
                {{ v }}
              </button></view
            ><textarea
              v-if="item.value === '异常'"
              v-model="item.remark"
              class="textarea spaced"
              :disabled="selected.done"
              placeholder="描述异常及处理情况"
              maxlength="500"
            />
          </view>
          <view class="field"
            ><text class="field-label">巡检结论</text
            ><textarea
              v-model="activeObject.conclusion"
              class="textarea"
              :disabled="selected.done"
              placeholder="填写检查结论或需跟进的问题"
              maxlength="1000"
            />
          </view>
          <view class="photos"
            ><image
              v-for="photo in activeObject.photos"
              :key="photo"
              :src="photo"
              class="photo"
              mode="aspectFill"
              @click="previewPhoto(photo)"
          /></view>
          <button
            v-if="!selected.done"
            class="btn"
            :disabled="activeObject.photos.length >= 6"
            @click="choosePhotos"
          >
            选择本地照片 {{ activeObject.photos.length }}/6
          </button>
          <text class="muted"
            >切换对象保留本次填写，退出预览后清空；照片不上传。</text
          >
        </view>
      </view>
      <view v-if="!selected.done" class="actions"
        ><button
          class="btn btn--primary"
          :disabled="completed(selected) !== selected.objects.length"
          @click="submit"
        >
          预览提交结果
        </button></view
      >
      <view v-else class="panel spaced"
        ><view class="section-title">{{
          selected.closed ? "办结说明" : "巡检已完成（演示）"
        }}</view
        ><text v-if="selected.closed" class="muted">{{
          selected.closeRemark
        }}</text
        ><template v-else>
          <textarea
            v-model="selected.closeRemark"
            class="textarea"
            placeholder="填写办结说明"
          /><button class="btn spaced" @click="closeTask">
            演示办结
          </button></template
        ><button
          class="btn btn--text"
          @click="info = '巡检单导出需要正式接口，当前仅展示页面。'"
        >
          导出巡检单（待接入）
        </button></view
      >
    </template>
    <view v-if="info" class="notice spaced" role="status">{{ info }}</view>
  </view>
</template>
<script setup lang="ts">
import { computed, reactive, ref } from "vue";
function objects(done = false) {
  return ["龙门杆体", "车牌摄像头", "一体机柜"].map((name) => ({
    name,
    location: done ? "入口 A1" : "",
    conclusion: done ? "检查正常（示例）" : "",
    photos: [] as string[],
    items: ["安装是否牢固", "设备运行是否正常", "外观是否完好"].map(
      (label) => ({ label, value: done ? "正常" : "", remark: "" }),
    ),
  }));
}
const tasks = reactive([
  {
    id: "DEMO-XJ-001",
    customer: "滨海堆场（示例）",
    done: false,
    closed: false,
    closeRemark: "",
    objects: objects(),
  },
  {
    id: "DEMO-XJ-002",
    customer: "智慧园区（示例）",
    done: true,
    closed: true,
    closeRemark: "设备检查正常，已完成例行维护（示例）。",
    objects: objects(true),
  },
]);
type Task = (typeof tasks)[number];
const selected = ref<Task | null>(null);
const current = ref(0);
const query = ref("");
const filter = ref("全部");
const error = ref("");
const info = ref("");
const activeObject = computed(() => selected.value!.objects[current.value]);
const filteredTasks = computed(() =>
  tasks.filter(
    (t) =>
      `${t.id}${t.customer}`
        .toLowerCase()
        .includes(query.value.trim().toLowerCase()) &&
      (filter.value === "全部" || (filter.value === "已完成") === t.done),
  ),
);
function completed(t: Task) {
  return t.objects.filter((o) => o.items.every((i) => i.value)).length;
}
function abnormal(t: Task) {
  return t.objects.reduce(
    (n, o) => n + o.items.filter((i) => i.value === "异常").length,
    0,
  );
}
function choosePhotos() {
  const target = activeObject.value;
  uni.chooseImage({
    count: 6 - target.photos.length,
    success: (r) =>
      target.photos.push(...r.tempFilePaths.slice(0, 6 - target.photos.length)),
  });
}
function previewPhoto(current: string) {
  uni.previewImage({ current, urls: activeObject.value.photos });
}
function submit() {
  if (
    !selected.value ||
    completed(selected.value) !== selected.value.objects.length
  )
    return;
  selected.value.done = true;
  info.value = "已展示提交后状态；未发送到服务器。";
}
function closeTask() {
  if (!selected.value) return;
  if (!selected.value.closeRemark.trim()) {
    error.value = "请填写办结说明";
    return;
  }
  selected.value.closed = true;
  error.value = "";
  info.value = "已展示办结状态；未发送到服务器。";
}
</script>
<style scoped lang="scss">
@use "./preview.scss";
.back {
  margin-bottom: 10px;
}
.inspection-layout {
  display: flex;
  align-items: stretch;
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
}
.object-menu {
  flex: 0 0 90px;
  background: #f3f5f8;
}
.object {
  display: flex;
  align-items: center;
  gap: 5px;
  text-align: left;
  padding: 18px 10px;
  width: 100%;
  margin: 0;
  border-radius: 0;
  font-size: 13px;
  line-height: 1.6;
  background: transparent;
  color: #56667c;
}
.object::after {
  border: none;
}
.object.on {
  background: #fff;
  color: #176ac7;
  font-weight: 600;
}
.dot {
  flex: 0 0 5px;
  height: 5px;
  border-radius: 50%;
  background: #c33c4a;
}
.object-content {
  flex: 1;
  min-width: 0;
  padding: 16px 12px;
}
.check-item {
  padding: 14px 0;
  border-top: 1px solid #eef0f5;
}
.abnormal.on {
  color: #ae3540;
  background: #fff0f1;
  border-color: #ae3540;
}
.spaced {
  margin-top: 14px;
}
.progress {
  height: 5px;
  border-radius: 3px;
  background: #e9edf5;
  margin: 16px 0 8px;
  overflow: hidden;
}
.progress > view {
  height: 100%;
  background: #2f86ff;
}
</style>
