<route lang="json5">
{ style: { navigationBarTitleText: '实施日志详情' } }
</route>
<template>
  <PageLayout :navbarShow="false">
    <scroll-view scroll-y class="log-page">
      <text v-if="loading" class="state">正在加载实施日志…</text>
      <view v-else-if="error" class="state"><text>{{ error }}</text><button @click="load">重新加载</button></view>
      <template v-else-if="log">
        <view class="log-heading">
          <text class="log-title">{{ log.submitterName || '提交人未返回' }}的实施日志</text>
          <text class="process-tag">{{ processName || '实施日志' }}</text>
          <text class="project-name">{{ projectName || '项目名称未返回' }}</text>
          <text class="time">签到时间：{{ log.signInTime || '—' }}</text>
          <text class="time">签退时间：{{ log.signOutTime || '尚未签退' }}</text>
          <text class="time">工时：{{ hoursText }}</text>
        </view>
        <view v-if="leaderError" class="state"><text>工序负责人信息加载失败，参与人员和用料记录暂不显示</text><button @click="loadLeader">重新加载负责人信息</button></view>
        <SectionCard v-if="isSiteLeader" title="参与人员">
          <text class="subheading">内部参与人员</text>
          <text v-if="namesLoading" class="hint">正在加载人员名称…</text>
          <text v-else class="body-text">{{ participantNames.length ? participantNames.join('、') : '暂无其他内部参与人员' }}</text>
          <text class="subheading">外协人员</text>
          <view v-for="(item, index) in log.outsources || []" :key="index" class="entry">
            <text class="entry-title">{{ item.unitName || outsourceNames[String(item.outsourceMemberId)] || '外协单位名称未返回' }}</text>
            <text>人数：{{ item.headcount ?? '—' }} 人</text>
            <text>工时：{{ item.workHours ?? '—' }} 小时</text>
            <text v-if="item.remark">备注：{{ item.remark }}</text>
          </view>
          <text v-if="!log.outsources?.length" class="hint">无外协记录</text>
          <button v-if="namesError" @click="loadNames">部分人员或外协名称加载失败，点击重试</button>
        </SectionCard>
        <SectionCard title="实施记录">
          <text class="subheading">实施位置</text>
          <text class="body-text">{{ log.implementLocationName || '未填写' }}</text>
          <text class="subheading">实施内容</text>
          <text class="body-text">{{ log.workContent || '未填写' }}</text>
          <text class="subheading">现场影像</text>
          <view class="media-grid">
            <view v-for="path in photos" :key="path" class="media-item">
              <text v-if="failedMedia.includes(path)" class="media-error">影像加载失败</text>
              <VideoCover v-else-if="isRecordVideo(path)" :src="recordMediaUrl(path)" @preview="previewVideo(path)" />
              <image v-else :src="recordMediaUrl(path)" mode="aspectFill" @click="previewPhoto(path)" @error="mediaError(path)" />
              <button v-if="failedMedia.includes(path)" @click="retryMedia(path)">重新加载</button>
            </view>
          </view>
          <text v-if="!photos.length" class="hint">未上传现场影像</text>
        </SectionCard>
        <SectionCard title="用车记录">
          <view class="entry"><text>使用车辆：{{ log.vehicleNo || '未填写' }}</text><text>公里数：{{ log.mileage ?? '—' }} km</text></view>
        </SectionCard>
        <SectionCard v-if="isSiteLeader" title="用料记录" :extra="log.materials?.length ? (showMaterials ? '收起明细' : '用料清单') : ''" @extra-click="showMaterials = !showMaterials">
          <text v-if="!log.materials?.length" class="hint">无用料记录</text>
          <text v-else class="hint">共 {{ log.materials.length }} 项物料</text>
          <template v-if="showMaterials">
            <view v-for="(item, index) in log.materials || []" :key="item.id || index" class="entry material">
              <text class="entry-title">{{ item.materialName || '物料名称未返回' }}</text>
              <text v-if="item.brand || item.model" class="hint">{{ [item.brand, item.model].filter(Boolean).join(' · ') }}</text>
              <text>使用数量：{{ item.usedQty ?? '—' }} {{ item.unit || '' }}</text>
              <text v-if="item.remark">备注：{{ item.remark }}</text>
            </view>
          </template>
        </SectionCard>
      </template>
    </scroll-view>
    <wd-popup v-model="videoVisible" position="center" :root-portal="true" :z-index="2400">
      <view class="video-preview">
        <video v-if="videoVisible" :key="videoPath" :src="recordMediaUrl(videoPath)" controls :autoplay="false" object-fit="contain" @error="videoFailed = true" />
        <text v-if="videoFailed" class="hint">视频无法播放，请检查网络或视频编码，可尝试 H.264 编码的 MP4 文件。</text>
        <button @click="videoVisible = false">关闭预览</button>
      </view>
    </wd-popup>
  </PageLayout>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import { onLoad } from '@dcloudio/uni-app'
import SectionCard from '@/components/SectionCard/SectionCard.vue'
import VideoCover from './components/VideoCover.vue'
import { useUserStore } from '@/store/user'
import { projectApi, unwrapRecords } from '@/service/shkj'
import { implementationRecordsApi, mediaPaths, isRecordVideo, recordMediaUrl } from '@/service/implementationRecords'
const id = ref(''), periodId = ref(''), projectName = ref(''), processName = ref('')
const log = ref<any>(null), loading = ref(false), error = ref('')
const userStore = useUserStore()
const siteLeaderId = ref(''), leaderError = ref(false), leaderLoading = ref(false)
const isSiteLeader = computed(() => {
  const userId = String(userStore.userInfo.userid || (userStore.userInfo as any).id || '')
  return Boolean(userId && siteLeaderId.value && userId === siteLeaderId.value)
})
const hoursText = computed(() => {
  const signInTime = log.value?.signInTime
  const signOutTime = log.value?.signOutTime
  if (!signOutTime) return '尚未签退，暂不计算'
  if (!signInTime) return '缺少签到时间，无法计算'
  const start = dayjs(signInTime), end = dayjs(signOutTime)
  if (!start.isValid() || !end.isValid() || end.isBefore(start)) return '签到或签退时间异常，无法计算'
  const hours = end.diff(start, 'millisecond') / 3600000
  if (hours > 0 && hours < 0.01) return '不足 0.01 小时'
  return `${Number(hours.toFixed(2))} 小时`
})
const userNames = ref<Record<string, string>>({}), outsourceNames = ref<Record<string, string>>({}), namesError = ref(false), namesLoading = ref(false)
const showMaterials = ref(false), failedMedia = ref<string[]>([])
const videoVisible = ref(false), videoPath = ref(''), videoFailed = ref(false)
const previewVideo = (path: string) => { videoPath.value = path; videoFailed.value = false; videoVisible.value = true }
const photos = computed(() => [...new Set([...mediaPaths(log.value?.photos), ...mediaPaths(log.value?.videos)])])
const participantNames = computed(() => mediaPaths(log.value?.internalParticipantIds).map((key) => userNames.value[key] || '人员姓名未返回'))
const mediaError = (path: string) => { if (!failedMedia.value.includes(path)) failedMedia.value.push(path) }
const retryMedia = (path: string) => { failedMedia.value = failedMedia.value.filter((item) => item !== path) }
const previewPhoto = (path: string) => uni.previewImage({
  current: recordMediaUrl(path), urls: photos.value.filter((item) => !isRecordVideo(item)).map(recordMediaUrl),
  fail: () => uni.showToast({ title: '照片预览失败，请重试', icon: 'none' }),
})
let request = 0
const loadNames = async () => {
  if (!isSiteLeader.value) return
  const current = request
  namesError.value = false
  namesLoading.value = true
  const results = await Promise.allSettled([
    log.value?.internalParticipantIds ? projectApi.members(periodId.value) : Promise.resolve(null),
    log.value?.outsources?.length ? projectApi.outsources(periodId.value) : Promise.resolve(null),
  ])
  if (current !== request || !isSiteLeader.value) return
  namesError.value = results.some((result) => result.status === 'rejected')
  if (results[0].status === 'fulfilled') userNames.value = Object.fromEntries(unwrapRecords(results[0].value).map((row: any) => [String(row.userId), row.userName || row.realname]))
  if (results[1].status === 'fulfilled') outsourceNames.value = Object.fromEntries(unwrapRecords(results[1].value).map((row: any) => [String(row.id || row.outsourceMemberId), row.unitName]))
  namesLoading.value = false
}
const loadLeader = async () => {
  if (!log.value?.processId || leaderLoading.value) return
  const current = request
  const processId = String(log.value.processId)
  leaderLoading.value = true; leaderError.value = false; siteLeaderId.value = ''
  try {
    const response = await projectApi.processes(periodId.value)
    if (current !== request) return
    const process = unwrapRecords(response).find(item => String(item.id) === processId)
    if (!process) throw new Error('未找到日志所属工序')
    siteLeaderId.value = String(process.siteLeaderId || '')
    if (isSiteLeader.value) void loadNames()
  } catch { if (current === request) leaderError.value = true }
  finally { if (current === request) leaderLoading.value = false }
}
const load = async () => {
  const current = ++request
  loading.value = true; error.value = ''; log.value = null; failedMedia.value = []
  siteLeaderId.value = ''; leaderError.value = false; leaderLoading.value = false
  userNames.value = {}; outsourceNames.value = {}; namesLoading.value = false; namesError.value = false; showMaterials.value = false
  try {
    if (!id.value || !periodId.value) throw new Error('缺少日志或项目分期信息，请返回记录列表重新进入')
    const response: any = await implementationRecordsApi.detail(id.value)
    if (current !== request) return
    const result = response?.result
    if (!result?.id) throw new Error('日志不存在或已被删除')
    if (String(result.periodId) !== periodId.value) throw new Error('日志不属于当前项目分期')
    log.value = result
    if (result.processId) void loadLeader()
    else leaderError.value = true
  } catch (reason: any) { if (current === request) error.value = reason?.message || '实施日志加载失败，请重试' }
  finally { if (current === request) loading.value = false }
}
onLoad((query) => {
  id.value = String(query?.id || ''); periodId.value = String(query?.periodId || '')
  projectName.value = String(query?.projectName || ''); processName.value = String(query?.processName || '')
  void load()
})
</script>
<style scoped>
.video-preview { width: min(92vw, 640px); padding: 12px; box-sizing: border-box; background: #fff; }
.video-preview video { display: block; width: 100%; height: 52vh; background: #000; }
.video-preview button { margin-top: 12px; min-height: 44px; font-size: 16px; }
.log-page { height: calc(100vh - 44px); background: #f5f7fa; color: #253247; padding-bottom: env(safe-area-inset-bottom); box-sizing: border-box; }
.log-heading { padding: 20px 16px; background: #fff; }
.log-title { font-size: 20px; font-weight: 600; display: block; overflow-wrap: anywhere; }
.process-tag { display: inline-block; color: #176ac7; background: #edf5ff; border-radius: 4px; padding: 4px 8px; margin-top: 10px; font-size: 14px; }
.project-name { display: block; margin: 12px 0; font-size: 16px; overflow-wrap: anywhere; }
.time { display: block; font-size: 14px; color: #536176; line-height: 1.9; }
.subheading { display: block; font-size: 16px; font-weight: 600; margin: 18px 0 8px; }
.subheading:first-child { margin-top: 0; }
.body-text { display: block; font-size: 16px; line-height: 1.75; white-space: pre-wrap; overflow-wrap: anywhere; }
.hint { display: block; color: #536176; font-size: 14px; line-height: 1.7; }
.entry { padding: 10px 0; border-bottom: 1px solid #edf0f4; }
.entry:last-child { border-bottom: 0; }
.entry text { display: block; font-size: 15px; line-height: 1.8; overflow-wrap: anywhere; white-space: pre-wrap; }
.entry .entry-title { font-size: 16px; font-weight: 600; }
.media-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.media-item { min-width: 0; }
.media-item image, .media-item video { width: 100%; height: 140px; border-radius: 6px; background: #edf0f4; }
.media-error { display: block; padding: 24px 8px; background: #f1f4f8; font-size: 14px; color: #a13a3a; text-align: center; }
.state { display: block; padding: 32px 16px; line-height: 1.7; }
.state button { margin-top: 16px; }
.pagination { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-top: 12px; font-size: 14px; }
.pagination button, .media-item button { min-height: 44px; margin: 0; font-size: 14px; }
</style>
