<template>
  <wd-popup v-model="visible" position="center" :root-portal="true" :z-index="2400" @after-enter="mapReady = true" custom-style="width: min(92vw, 640px); border-radius: 12px; overflow: hidden;">
    <view class="site-preview">
      <view class="site-preview__header">
        <text class="site-preview__title">实施位置</text>
        <button class="site-preview__close" aria-label="关闭位置地图" @click="close"><wd-icon name="close" size="20px" /></button>
      </view>
      <scroll-view scroll-y class="site-preview__body">
        <text class="site-preview__name">{{ site?.locationName || '未命名位置' }}</text>
        <text v-if="site?.description" class="site-preview__description">{{ site.description }}</text>
        <map v-if="visible && mapReady && coordinates && !failed" :key="mapVersion" class="site-preview__map" :latitude="coordinates.latitude" :longitude="coordinates.longitude" :markers="markers" :scale="16" :show-location="false" @error="failed = true" />
        <view v-else class="site-preview__empty">
          <text>{{ !coordinates ? '此实施位置未配置有效经纬度，暂无法显示地图' : failed ? '地图加载失败，请检查网络后重试' : '正在加载地图…' }}</text>
          <button v-if="failed && coordinates" class="site-preview__retry" @click="retry">重新加载</button>
        </view>
        <text v-if="coordinates" class="site-preview__coordinates">经度 {{ coordinates.longitude.toFixed(6) }} · 纬度 {{ coordinates.latitude.toFixed(6) }}</text>
      </scroll-view>
      <view class="site-preview__footer"><wd-button block @click="close">关闭</wd-button></view>
    </view>
  </wd-popup>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onHide } from '@dcloudio/uni-app'
type Site = { locationName?: string; description?: string; longitude?: unknown; latitude?: unknown }
const site = ref<Site | null>(null)
const visible = ref(false), mapReady = ref(false), failed = ref(false), mapVersion = ref(0)
const coordinates = computed(() => {
  const valid = (value: unknown, limit: number) => value !== null && value !== undefined && String(value).trim() !== '' && Number.isFinite(Number(value)) && Math.abs(Number(value)) <= limit
  if (!site.value || !valid(site.value.longitude, 180) || !valid(site.value.latitude, 90)) return null
  return { longitude: Number(site.value.longitude), latitude: Number(site.value.latitude) }
})
const markers = computed(() => coordinates.value ? [{
  id: 1, ...coordinates.value, title: site.value?.locationName || '实施位置',
  iconPath: '/static/location.png', width: 28, height: 28, anchor: { x: 0.5, y: 1 },
}] : [])
function close() { visible.value = false; mapReady.value = false }
function retry() { failed.value = false; mapVersion.value++ }
function open(value: Site) {
  site.value = { ...value }; failed.value = false; mapReady.value = false; mapVersion.value++; visible.value = true
}
watch(visible, value => { if (!value) mapReady.value = false })
onHide(close)
defineExpose({ open, close })
</script>

<style scoped>
.site-preview { display: flex; flex-direction: column; max-height: 86vh; max-height: 86dvh; color: #253247; background: #fff; }
.site-preview__header { display: flex; align-items: center; justify-content: space-between; padding: 8px 8px 8px 16px; border-bottom: 1px solid #e7edf3; flex-shrink: 0; }
.site-preview__title { font-size: 18px; font-weight: 600; }
.site-preview__close { display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; margin: 0; padding: 0; background: transparent; }
.site-preview__close::after { border: 0; }
.site-preview__body { min-height: 0; max-height: 62vh; }
.site-preview__name { display: block; padding: 16px 16px 0; font-size: 16px; font-weight: 600; line-height: 1.5; overflow-wrap: anywhere; }
.site-preview__description { display: block; margin: 8px 16px 0; font-size: 14px; line-height: 1.6; color: #536176; overflow-wrap: anywhere; }
.site-preview__map { display: block; width: 100%; height: 32vh; min-height: 180px; max-height: 320px; margin-top: 16px; background: #edf2f7; }
.site-preview__empty { display: flex; min-height: 180px; margin-top: 16px; padding: 16px; box-sizing: border-box; flex-direction: column; justify-content: center; align-items: center; gap: 12px; background: #f5f7fa; color: #536176; font-size: 14px; line-height: 1.6; text-align: center; }
.site-preview__retry { font-size: 16px; color: #176ac7; }
.site-preview__coordinates { display: block; margin: 12px 16px; color: #536176; font-size: 14px; line-height: 1.6; }
.site-preview__footer { padding: 12px 16px; border-top: 1px solid #e7edf3; flex-shrink: 0; }
</style>
