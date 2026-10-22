<template>
  <view class="report-media">
    <MediaAttachments :items="items" :readonly="readonly" :busy="busy" :error="mediaError" :compact="compact" :max-photos="Math.max(0, 6 - existingPhotos)" :max-videos="Math.max(0, 2 - existingVideos)" busy-text="正在选择…"
      :hint="readonly ? '本次报修附件' : '可拍摄或从相册选择；提交时上传，单个文件不超过 400 MB'"
      @add="chooseAttachment" @remove="removeAttachment" @preview="previewAttachment" />
    <wd-popup v-model="videoVisible" position="center" :z-index="12000" @close="videoVisible = false">
      <view class="report-video-preview">
        <video v-if="videoVisible" :key="videoPath" :src="videoPath" controls :autoplay="false" object-fit="contain" @error="mediaError = '视频无法播放，请检查格式后重新选择'" />
        <button @click="videoVisible = false">关闭预览</button>
      </view>
    </wd-popup>
    <wd-popup v-model="imageVisible" position="center" :z-index="13000">
      <view class="report-video-preview"><image :src="imagePath" mode="aspectFit" style="width:100%;height:65vh" /><button @click="imageVisible = false">关闭预览</button></view>
    </wd-popup>
  </view>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { onHide } from '@dcloudio/uni-app'
import MediaAttachments, { type MediaAttachment } from '@/components/MediaAttachments/MediaAttachments.vue'
const props = withDefaults(defineProps<{ photos: string[]; videos: string[]; readonly?: boolean; compact?: boolean; existingPhotos?: number; existingVideos?: number }>(), { readonly: false, compact: false, existingPhotos: 0, existingVideos: 0 })
const emit = defineEmits<{ 'update:photos': [paths: string[]]; 'update:videos': [paths: string[]]; busy: [value: boolean] }>()
const busy = ref(false), mediaError = ref('')
const videoVisible = ref(false), videoPath = ref('')
const imageVisible = ref(false), imagePath = ref('')
const items = computed<MediaAttachment[]>(() => [...props.photos.map(path => ({ path, type: 'image' as const })), ...props.videos.map(path => ({ path, type: 'video' as const }))])
onHide(() => { videoVisible.value = false })
function chooseAttachment() {
  if (props.readonly || busy.value) return
  const choices = [...(props.photos.length + props.existingPhotos < 6 ? ['添加照片'] : []), ...(props.videos.length + props.existingVideos < 2 ? ['添加视频'] : [])]
  if (!choices.length) return
  uni.showActionSheet({ itemList: choices, success: result => { if (active) choices[result.tapIndex] === '添加照片' ? choosePhotos() : chooseVideo() } })
}
function removeAttachment(index: number) {
  if (props.readonly || busy.value) return
  if (index < props.photos.length) emit('update:photos', props.photos.filter((_, i) => i !== index))
  else emit('update:videos', props.videos.filter((_, i) => i !== index - props.photos.length))
}
function previewAttachment(item: MediaAttachment) {
  if (item.type === 'image') previewPhoto(item.path)
  else { mediaError.value = ''; videoPath.value = item.path; videoVisible.value = true }
}
let active = true
onBeforeUnmount(() => { active = false; emit('busy', false) })
function setBusy(value: boolean) { busy.value = value; emit('busy', value) }
function failure(error: { errMsg?: string }) {
  if (active && !/cancel/i.test(error.errMsg || '')) mediaError.value = '附件选择失败，请检查相册或相机权限后重试'
}
function choosePhotos() {
  if (props.readonly || busy.value || props.photos.length + props.existingPhotos >= 6) return
  setBusy(true); mediaError.value = ''
  uni.chooseImage({
    count: 6 - props.existingPhotos - props.photos.length, sourceType: ['album', 'camera'], sizeType: ['compressed'],
    success: result => {
      if (!active) return
      if (Array.isArray(result.tempFiles) && result.tempFiles.some(file => file.size > 419430400)) {mediaError.value = '单个文件不能超过 400 MB';return}
      emit('update:photos', [...props.photos, ...result.tempFilePaths].slice(0, Math.max(0, 6 - props.existingPhotos)))
    },
    fail: failure, complete: () => { if (active) setBusy(false) },
  })
}
function chooseVideo() {
  if (props.readonly || busy.value || props.videos.length + props.existingVideos >= 2) return
  setBusy(true); mediaError.value = ''
  uni.chooseVideo({
    sourceType: ['album', 'camera'],
    success: result => { if (active && result.tempFilePath) {
      if (result.size > 419430400) {mediaError.value = '单个视频不能超过 400 MB';return}
      emit('update:videos', [...props.videos, result.tempFilePath].slice(0, Math.max(0, 2 - props.existingVideos)))
    } },
    fail: failure, complete: () => { if (active) setBusy(false) },
  })
}
function previewPhoto(current: string) { imagePath.value = current; imageVisible.value = true }
</script>

<style scoped>
.report-media { margin-top: 16px; }
.report-video-preview { box-sizing: border-box; width: min(92vw, 640px); padding: 12px; background: #fff; }
.report-video-preview video { display: block; width: 100%; height: 52vh; background: #000; }
.report-video-preview button { margin-top: 12px; min-height: 44px; font-size: 16px; }
</style>
