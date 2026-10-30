<template>
  <view class="attachments" :class="{ 'attachments--compact': compact }">
    <text class="media-hint">照片 {{ photoCount }}/{{ maxPhotos }}<text v-if="maxVideos > 0">，视频 {{ videoCount }}/{{ maxVideos }}</text><text v-if="hint">；{{ hint }}</text></text>
    <view class="media-grid">
      <view v-for="(item, index) in items" :key="`${item.type}-${item.path}-${index}`" class="media-card">
        <image v-if="item.type === 'image'" class="media-card__preview" :src="resolveUrl(item.path)" mode="aspectFill" @click="emit('preview', item)" />
        <VideoCover v-else :height="compact ? 80 : 108" :src="resolveUrl(item.path)" @preview="emit('preview', item)" />
        <view class="media-card__footer">
          <text>{{ item.type === 'video' ? '视频' : '照片' }} {{ index + 1 }}</text>
          <button v-if="!readonly" class="media-card__remove" :disabled="busy || item.status === 'uploading'" :aria-label="`删除${item.type === 'video' ? '视频' : '照片'} ${index + 1}`" @click="remove(index)">删除</button>
        </view>
        <text v-if="item.status === 'uploading'" class="media-state">正在上传{{ item.progress == null ? '…' : ` ${item.progress}%` }}</text>
        <view v-if="item.status === 'error'" class="media-state media-state--error"><text>{{ item.error || '上传失败' }}</text><button v-if="!readonly" :disabled="busy" @click="emit('retry', index)">重试</button></view>
      </view>
      <button v-if="!readonly && (photoCount < maxPhotos || videoCount < maxVideos)" class="add-media" :disabled="busy" @click="emit('add')"><wd-icon name="video" size="22px" color="#176ac7" /><text>{{ busy ? busyText : maxVideos === 0 ? '添加照片' : '添加影像' }}</text></button>
    </view>
    <text v-if="error" class="media-state media-state--error" role="alert">{{ error }}</text>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import VideoCover from '@/pages/ops/components/VideoCover.vue'
export interface MediaAttachment {
  path: string
  type: 'image' | 'video'
  status?: 'uploading' | 'error' | 'ready'
  progress?: number
  error?: string
}
const props = withDefaults(defineProps<{
  items: MediaAttachment[]; readonly?: boolean; busy?: boolean; maxPhotos?: number; maxVideos?: number; compact?: boolean; existingPhotos?: number; existingVideos?: number
  hint?: string; error?: string; busyText?: string; resolveUrl?: (path: string) => string
}>(), { readonly: false, busy: false, maxPhotos: 6, maxVideos: 2, hint: '', error: '', busyText: '正在处理…', resolveUrl: (path: string) => path })
const emit = defineEmits<{ add: []; remove: [index: number]; preview: [item: MediaAttachment]; retry: [index: number] }>()
const photoCount = computed(() => props.items.filter(item => item.type === 'image').length + (props.existingPhotos || 0))
const videoCount = computed(() => props.items.filter(item => item.type === 'video').length + (props.existingVideos || 0))
function remove(index: number) { if (!props.readonly && !props.busy && props.items[index]?.status !== 'uploading') emit('remove', index) }
</script>

<style scoped>
.attachments { min-width: 0; }
.attachments--compact .media-grid { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; }
.attachments--compact .media-card__preview { height: 80px; }
.attachments--compact .add-media { min-height: 124px; padding: 8px; }
.attachments--compact .media-card__footer { padding: 0 6px; }
.media-hint { display: block; margin-bottom: 10px; font-size: 12px; line-height: 1.6; color: #68788a; }
.media-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.media-card { overflow: hidden; background: #f6f8fa; border: 1px solid #e3e8ee; border-radius: 10px; }
.media-card__preview { display: block; width: 100%; height: 108px; background: #111827; }
.media-card__footer { display: flex; min-height: 44px; padding: 0 10px; font-size: 13px; color: #475569; align-items: center; justify-content: space-between; }
.media-card__remove { min-width: 44px; min-height: 44px; margin: 0; padding: 0; line-height: 44px; color: #a13a3a; font-size: 13px; background: transparent; text-align: right; }
.add-media { display: flex; min-width: 0; width: 100%; min-height: 152px; margin: 0; padding: 12px; font-size: 13px; font-weight: 600; color: #176ac7; background: #f8fbff; border: 1px dashed #a8c9ed; border-radius: 10px; align-items: center; justify-content: center; flex-direction: column; gap: 7px; line-height: 1.6; }
button::after { border: none; }
button[disabled] { opacity: .55; }
button:focus-visible { outline: 2px solid #176ac7; outline-offset: 2px; }
.media-state { display: block; padding: 6px 10px; font-size: 12px; line-height: 1.6; color: #68788a; }
.media-state--error { color: #a13a3a; }
.media-state button { margin: 4px 0; font-size: 13px; line-height: 36px; color: #176ac7; background: #edf5ff; }
</style>
