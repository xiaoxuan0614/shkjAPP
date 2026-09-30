<template>
  <button ref="cover" class="video-cover" :style="{ height: `${height}px` }" aria-label="播放视频" @click="preview">
    <image v-if="poster" class="video-cover__image" :src="poster" mode="aspectFill" />
    <view class="video-cover__play"><wd-icon name="play" size="24px" color="#fff" /></view>
    <view class="video-cover__caption"><text>视频</text><text>{{ loading ? '正在生成封面' : '点击播放' }}</text></view>
  </button>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { videoPosterQueue } from '@/utils/videoPoster'
const props = withDefaults(defineProps<{ src: string; height?: number }>(), { height: 140 })
const emit = defineEmits<{ preview: [] }>()
const cover = ref<any>(null), poster = ref(''), loading = ref(false)
let cancel = () => {}
let observer: IntersectionObserver | null = null
let mounted = false
let visible = false
let version = 0
function stop() { version++; cancel(); cancel = () => {}; loading.value = false }
function load() {
  stop()
  if (!visible || !props.src || poster.value) return
  // #ifdef H5
  if (document.hidden) return
  loading.value = true
  const current = version
  cancel = videoPosterQueue.request(props.src, result => {
    if (current !== version) return
    poster.value = result || ''
    loading.value = false
  })
  // #endif
}
function preview() { emit('preview') }
function visibilityChanged() {
  // #ifdef H5
  if (document.hidden) stop()
  else load()
  // #endif
}
watch(() => props.src, () => { stop(); poster.value = ''; if (mounted) load() })
onMounted(() => {
  mounted = true
  // #ifdef H5
  document.addEventListener('visibilitychange', visibilityChanged)
  const target = cover.value?.$el || cover.value
  if (target && typeof IntersectionObserver !== 'undefined') {
    observer = new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting)
      if (visible) load()
      else stop()
    })
    observer.observe(target)
  } else { visible = true; load() }
  // #endif
})
onBeforeUnmount(() => {
  mounted = false; stop(); observer?.disconnect()
  // #ifdef H5
  document.removeEventListener('visibilitychange', visibilityChanged)
  // #endif
})
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
