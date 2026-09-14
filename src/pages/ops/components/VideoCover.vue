<template>
  <button class="video-cover" :style="{ height: `${height}px` }" aria-label="播放视频" @click="$emit('preview')">
    <image v-if="poster" class="video-cover__image" :src="poster" mode="aspectFill" />
    <view class="video-cover__play"><wd-icon name="play" size="24px" color="#fff" /></view>
    <view class="video-cover__caption"><text>视频</text><text>{{ durationText || '点击播放' }}</text></view>
  </button>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
const props = withDefaults(defineProps<{ src: string; height?: number }>(), { height: 140 })
defineEmits<{ preview: [] }>()
const poster = ref('')
const duration = ref(0)
const durationText = computed(() => {
  if (!duration.value) return ''
  const seconds = Math.floor(duration.value)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
})

// H5 从真实视频截取首段画面，仅用作本地展示，不新增上传或更改日志字段。
// 跨域、编码或网络失败时保留播放入口，不影响打开原视频。
// #ifdef H5
watch(() => props.src, (src, _, onCleanup) => {
  poster.value = ''
  duration.value = 0
  if (!src) return
  const video = document.createElement('video')
  let stopped = false
  video.crossOrigin = 'anonymous'
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  const stop = () => {
    if (stopped) return
    stopped = true
    clearTimeout(timer)
    video.onloadedmetadata = video.onseeked = video.onerror = null
    video.pause()
    video.removeAttribute('src')
    video.load()
  }
  const timer = setTimeout(stop, 10000)
  video.onloadedmetadata = () => {
    duration.value = Number.isFinite(video.duration) ? video.duration : 0
    video.currentTime = Math.min(0.1, duration.value / 2)
  }
  video.onseeked = () => {
    if (stopped) return
    try {
      if (!video.videoWidth || !video.videoHeight) return
      const canvas = document.createElement('canvas')
      const scale = Math.min(480 / video.videoWidth, 480 / video.videoHeight)
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
      const context = canvas.getContext('2d')
      if (!context) return
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      poster.value = canvas.toDataURL('image/jpeg', 0.8)
    } catch { /* 无法提取封面时仍可点击预览 */ }
    finally { stop() }
  }
  video.onerror = stop
  video.src = src
  onCleanup(stop)
}, { immediate: true })
// #endif
</script>

<style scoped>
.video-cover { position: relative; display: block; width: 100%; height: 140px; min-height: 108px; margin: 0; padding: 0; overflow: hidden; border-radius: 8px; background: #344454; color: #fff; line-height: 1; }
.video-cover::after { border: 0; }
.video-cover:focus-visible { outline: 3px solid #2f86ff; outline-offset: 2px; }
.video-cover:active { opacity: .85; }
.video-cover__image { position: absolute; inset: 0; width: 100%; height: 100%; }
.video-cover__play { position: absolute; top: 50%; left: 50%; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 50%; background: rgba(15, 23, 42, .65); border: 1px solid rgba(255, 255, 255, .8); transform: translate(-50%, -50%); }
.video-cover__caption { position: absolute; bottom: 0; left: 0; right: 0; display: flex; justify-content: space-between; padding: 8px 10px; background: rgba(15, 23, 42, .72); font-size: 12px; font-variant-numeric: tabular-nums; line-height: 1.4; }
</style>
