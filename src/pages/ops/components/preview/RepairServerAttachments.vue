<template>
  <view v-if="files.length" class="repair-files" :class="{ 'repair-files--inline': inline }">
    <scroll-view :scroll-x="inline" class="repair-files-scroll">
    <view class="repair-files-items" :class="{ 'repair-files-items--inline': inline }">
    <button v-for="(file, index) in files" :key="file.fileId" class="repair-file" :disabled="busy" @click="preview(file)">
      <wd-icon :name="file.mediaType === 'VIDEO' ? 'play-circle' : 'image'" />
      {{ file.fileName || file.fileNameSnapshot || `附件 ${index + 1}` }}
    </button>
    </view>
    </scroll-view>
    <wd-popup v-model="showVideo" position="center" :z-index="13000" @close="closePreview">
      <view class="repair-video"><video v-if="videoUrl" :src="videoUrl" controls @error="mediaError = '视频格式无法播放，请下载原视频核实'" /><text v-if="mediaError">{{ mediaError }}</text><button @click="closePreview">关闭预览</button></view>
    </wd-popup>
    <wd-popup v-model="showImage" position="center" :z-index="13000" @close="closePreview">
      <view class="repair-video"><image v-if="imageUrl" :src="imageUrl" mode="aspectFit" style="width:100%;height:65vh" @error="mediaError = '图片加载失败，请关闭后重试'" /><text v-if="mediaError">{{ mediaError }}</text><button @click="closePreview">关闭预览</button></view>
    </wd-popup>
  </view>
</template>
<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { downloadRepairAttachment } from '@/service/repairOrder'
defineProps<{ files: {fileId:string; mediaType:string; fileName?:string; fileNameSnapshot?:string}[]; inline?:boolean }>()
const busy = ref(false), showVideo = ref(false), videoUrl = ref('')
const showImage = ref(false), imageUrl = ref('')
const mediaError = ref('')
let disposed = false
function release(url: string) {
  // #ifdef H5
  if (url.startsWith('blob:')) URL.revokeObjectURL(url)
  // #endif
}
function closePreview() {
  showImage.value = false; showVideo.value = false
  release(imageUrl.value); release(videoUrl.value)
  imageUrl.value = ''; videoUrl.value = ''; mediaError.value = ''
}
async function preview(file: {fileId:string;mediaType:string}) {
  if (busy.value) return
  busy.value = true
  try {
    const url = await downloadRepairAttachment(file.fileId)
    if (disposed) {release(url);return}
    mediaError.value = ''
    if (file.mediaType === 'VIDEO') {videoUrl.value = url;showVideo.value = true}
    else {imageUrl.value = url;showImage.value = true}
  } catch (e: any) { uni.showToast({title:e.message || '附件加载失败',icon:'none'}) }
  finally { busy.value = false }
}
onBeforeUnmount(() => { disposed = true; closePreview() })
</script>
<style scoped>
.repair-files { min-width:0; margin-top:12px; }
.repair-files-items { display:flex; flex-wrap:wrap; gap:8px; }
.repair-files--inline { margin-top:0; }
.repair-files-scroll { width:100%; min-width:0; }
.repair-files-items--inline { flex-wrap:nowrap; }
.repair-files-items--inline .repair-file { flex:none; max-width:180px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.repair-file { margin:0; padding:8px 12px; max-width:100%; line-height:1.5; font-size:14px; color:#1769c2; overflow-wrap:anywhere; }
.repair-video { width:85vw; padding:12px; background:#fff; }
.repair-video video { width:100%; }
</style>
