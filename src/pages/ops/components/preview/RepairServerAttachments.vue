<template>
  <view v-if="files.length" class="repair-files" :class="{ 'repair-files--inline': inline }">
    <view v-if="editable" class="repair-edit-grid">
      <view v-for="(file, index) in files" :key="file.fileId" class="repair-edit-card">
        <button class="repair-edit-preview" :disabled="busy || disabled" :aria-label="`预览附件 ${index + 1}`" @click="preview(file)">
          <image v-if="thumbnails[file.fileId]" :src="thumbnails[file.fileId]" mode="aspectFill" @error="thumbnailErrors[file.fileId] = true" v-show="!thumbnailErrors[file.fileId]" />
          <view v-if="!thumbnails[file.fileId] || thumbnailErrors[file.fileId]" class="repair-edit-placeholder"><wd-icon :name="file.mediaType === 'VIDEO' ? 'play-circle' : 'image'" size="28px" /><text>{{ file.mediaType === 'VIDEO' ? '点击播放视频' : thumbnailErrors[file.fileId] ? '加载失败，点击重试' : '正在加载…' }}</text></view>
        </button>
        <text class="repair-edit-caption">{{ file.mediaType === 'VIDEO' ? '视频' : '照片' }} {{ index + 1 }}</text>
        <button class="repair-edit-remove" :disabled="disabled || busy" :aria-label="`移除${file.mediaType === 'VIDEO' ? '视频' : '照片'} ${index + 1}`" @click.stop="emit('remove', file.fileId)"><wd-icon name="close" size="14px" /></button>
      </view>
    </view>
    <scroll-view v-else :scroll-x="inline" class="repair-files-scroll">
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
import { onBeforeUnmount, ref, watch } from 'vue'
import { downloadRepairAttachment } from '@/service/repairOrder'
const props = defineProps<{ files: {fileId:string; mediaType:string; fileName?:string; fileNameSnapshot?:string}[]; inline?:boolean; editable?:boolean; disabled?:boolean }>()
const emit = defineEmits<{ remove: [fileId: string] }>()
const thumbnails = ref<Record<string, string>>({})
const thumbnailErrors = ref<Record<string, boolean>>({})
const pending = new Set<string>()
const busy = ref(false), showVideo = ref(false), videoUrl = ref('')
const showImage = ref(false), imageUrl = ref('')
const mediaError = ref('')
let disposed = false
watch(() => props.editable ? props.files.map(file => file.fileId).join(',') : '', async () => {
  const ids = new Set(props.files.map(file => file.fileId))
  for (const id of Object.keys(thumbnails.value)) {
    if (!ids.has(id)) { release(thumbnails.value[id]); delete thumbnails.value[id]; delete thumbnailErrors.value[id] }
  }
  if (!props.editable) return
  // Only fetch image thumbnails; videos are downloaded on demand.
  for (const file of props.files.filter(file => file.mediaType === 'IMAGE')) {
    if (disposed) return
    if (thumbnails.value[file.fileId] || pending.has(file.fileId)) continue
    pending.add(file.fileId)
    try {
      const url = await downloadRepairAttachment(file.fileId)
      if (disposed || !props.files.some(item => item.fileId === file.fileId)) release(url)
      else thumbnails.value[file.fileId] = url
    } catch { thumbnailErrors.value[file.fileId] = true }
    finally { pending.delete(file.fileId) }
  }
}, { immediate: true })
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
onBeforeUnmount(() => { disposed = true; closePreview(); Object.values(thumbnails.value).forEach(release) })
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
.repair-edit-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(100px,1fr)); gap:8px; }
.repair-edit-card { position:relative; overflow:hidden; border:1px solid #e3e8ee; border-radius:10px; background:#f6f8fa; }
.repair-edit-preview { display:block; width:100%; height:96px; margin:0; padding:0; background:#f6f8fa; }
.repair-edit-preview image { width:100%; height:100%; }
.repair-edit-placeholder { display:flex; height:100%; flex-direction:column; align-items:center; justify-content:center; gap:8px; font-size:12px; color:#475569; }
.repair-edit-caption { display:block; padding:6px 8px; font-size:12px; color:#475569; line-height:18px; }
.repair-edit-remove { position:absolute; top:0; right:0; display:flex; align-items:center; justify-content:center; width:44px; height:44px; margin:0; padding:0; color:#fff; background:rgba(17,24,39,.7); border-radius:0 0 0 10px; line-height:1; }
.repair-edit-card button:focus-visible { outline:2px solid #176ac7; outline-offset:-2px; }
.repair-edit-card button::after { border:none; }
</style>
