<template>
  <view class="log-player">
    <!-- #ifdef H5 -->
    <view ref="host" class="log-player__screen" />
    <!-- #endif -->
    <!-- #ifndef H5 -->
    <video :key="nativeAttempt" :src="originalUrl" controls :autoplay="false" object-fit="contain" @error="nativeError" />
    <!-- #endif -->
    <text class="log-player__message" role="status" aria-live="polite">{{ state.message }}</text>
    <view v-if="state.failed" class="log-player__actions">
      <button class="log-player__retry" @click="start">重新尝试</button>
      <!-- #ifdef H5 -->
      <a v-if="!state.denied && safeOriginalUrl" :href="safeOriginalUrl" target="_blank" rel="noopener noreferrer" class="log-player__original">打开原视频</a>
      <!-- #endif -->
    </view>
  </view>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { http } from '@/utils/http'
import { getEnvBaseUrl } from '@/utils'
import { videoPosterQueue } from '@/utils/videoPoster'
import { isVideoAccessDenied, startVideoPlayback, videoFilePath, videoPlaylistUrl, type VideoPlaybackState } from '@/utils/videoPlayback'

const props = defineProps<{ filePath: string; originalUrl: string }>()
const host = ref<any>(null)
const safeOriginalUrl = ref('')
const nativeAttempt = ref(0)
const state = ref<VideoPlaybackState>({ message: '正在准备视频…', failed: false })
let dispose = () => {}
let mounted = false
let resumePosters = () => {}
const nativeError = () => { state.value = { message: '视频无法播放，请检查网络或视频编码。', failed: true } }

function start() {
  dispose()
  // #ifdef H5
  const container = host.value?.$el || host.value
  if (!container) return
  container.replaceChildren()
  safeOriginalUrl.value = ''
  try {
    const url = new URL(props.originalUrl, window.location.href)
    if (!props.originalUrl || !['http:', 'https:', 'blob:'].includes(url.protocol) || url.username || url.password) throw new Error('invalid url')
    safeOriginalUrl.value = url.href
  } catch {
    state.value = { message: '视频地址无效，请返回后重新打开。', failed: true }
    return
  }
  const video = document.createElement('video')
  video.controls = true
  video.playsInline = true
  video.preload = 'metadata'
  video.setAttribute('aria-label', '实施日志视频')
  video.style.cssText = 'display:block;width:100%;height:100%;object-fit:contain;background:#000'
  container.appendChild(video)
  const base = getEnvBaseUrl().replace(/\/$/, '')
  const proxy = import.meta.env.DEV && import.meta.env.VITE_APP_PROXY === 'true'
    ? import.meta.env.VITE_APP_PROXY_PREFIX.replace(/\/$/, '') : ''
  const path = videoFilePath(props.filePath, base, window.location.origin, proxy)
  let requestTask: UniApp.RequestTask | null = null
  const stopPlayback = startVideoPlayback(video, {
    originalUrl: safeOriginalUrl.value,
    loadStatus: async () => {
      if (!path) return null
      const response: any = await http({
        url: '/sys/common/video/hls/status', method: 'GET', query: { filePath: path },
        timeout: 5000, hideErrorToast: true,
        onRequestTask: task => { requestTask = task },
      })
      if (isVideoAccessDenied(response)) throw response
      if (response?.success === false) return null
      return response?.result ?? response
    },
    playlistUrl: path => videoPlaylistUrl(path, proxy || base),
    loadHls: async () => (await import('hls.js')).default,
    onState: next => { state.value = next },
  })
  dispose = () => {
    stopPlayback()
    requestTask?.abort()
    requestTask = null
  }
  // #endif
  // #ifndef H5
  nativeAttempt.value++
  state.value = { message: '点击播放视频', failed: false }
  // #endif
}
onMounted(() => { mounted = true; resumePosters = videoPosterQueue.pause(); start() })
watch(() => [props.filePath, props.originalUrl], () => { if (mounted) start() }, { flush: 'post' })
onBeforeUnmount(() => { mounted = false; dispose(); resumePosters() })
</script>

<style scoped>
.log-player__screen, .log-player video { display: block; width: 100%; height: min(52vh, 420px); background: #000; }
.log-player__message { display: block; margin-top: 12px; color: #536176; font-size: 14px; line-height: 1.6; overflow-wrap: anywhere; }
.log-player__actions { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; margin-top: 12px; }
.log-player__retry { margin: 0; padding: 0 16px; min-height: 44px; font-size: 16px; color: #176ac7; background: #edf5ff; }
.log-player__original { display: inline-flex; align-items: center; min-height: 44px; color: #176ac7; font-size: 16px; text-decoration: underline; text-underline-offset: 3px; }
.log-player__original:focus-visible, .log-player__retry:focus-visible { outline: 2px solid #176ac7; outline-offset: 2px; }
</style>
