<template>
  <view class="location-panel">
    <view class="location-panel__toolbar">
      <view class="location-panel__heading">
        <view
          class="location-panel__pulse"
          :class="`location-panel__pulse--${location.status.toLowerCase()}`"
        ></view>
        <text>{{ location.status === 'PENDING' ? '正在确认当前位置' : '当前位置' }}</text>
      </view>
      <text class="location-panel__refresh" :class="{ disabled: locating }" @click="refresh">
        {{ locating ? '定位中…' : '重新定位' }}
      </text>
    </view>

    <map
      v-if="hasMapCenter && !suspended"
      class="location-panel__map"
      :latitude="mapCenter.latitude"
      :longitude="mapCenter.longitude"
      :markers="markers"
      :circles="circles"
      :scale="16"
    ></map>
    <view
      v-else-if="suspended"
      class="location-panel__map location-panel__map--suspended"
    ></view>
    <view v-else class="location-panel__map location-panel__map--empty">
      <view class="location-panel__radar">
        <view class="location-panel__radar-dot"></view>
      </view>
      <text class="location-panel__empty-title">{{ emptyTitle }}</text>
      <text class="location-panel__empty-copy">{{ emptyCopy }}</text>
    </view>

    <view class="location-box" :class="`location-box--${location.status.toLowerCase()}`">
      <view class="location-mark"><text></text></view>
      <view class="location-copy">
        <view class="location-name">{{ location.name || '尚未获取当前位置' }}</view>
        <view class="location-address">{{ location.address || '打卡前请先完成定位' }}</view>
      </view>
      <text class="location-status">{{ statusText }}</text>
    </view>
  </view>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { IMPLEMENTATION_RADIUS_METERS } from '@/utils/implementationLocation'

type LocationStatus = 'PENDING' | 'NORMAL' | 'OUT_OF_RANGE' | 'FAILED' | 'NO_SITE'
type ImplementationSite = {
  id?: string
  locationName: string
  description?: string
  latitude: number
  longitude: number
}
type SiteLocation = {
  name: string
  address: string
  latitude?: number
  longitude?: number
  status: LocationStatus
}

const props = defineProps<{
  location: SiteLocation
  locating?: boolean
  sites?: ImplementationSite[]
  suspended?: boolean
}>()

const emit = defineEmits<{
  refresh: []
}>()

const isFiniteCoordinate = (value: unknown) =>
  value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
const hasCoordinates = computed(
  () => isFiniteCoordinate(props.location.latitude) && isFiniteCoordinate(props.location.longitude),
)
const firstSite = computed(() =>
  (props.sites || []).find(
    (site) => isFiniteCoordinate(site.latitude) && isFiniteCoordinate(site.longitude),
  ),
)
const mapCenter = computed(() =>
  hasCoordinates.value
    ? {
        latitude: Number(props.location.latitude),
        longitude: Number(props.location.longitude),
      }
    : {
        latitude: Number(firstSite.value?.latitude),
        longitude: Number(firstSite.value?.longitude),
      },
)
const hasMapCenter = computed(
  () =>
    isFiniteCoordinate(mapCenter.value.latitude) && isFiniteCoordinate(mapCenter.value.longitude),
)
const statusText = computed(
  () =>
    ({
      PENDING: '待定位',
      NORMAL: '位置正常',
      OUT_OF_RANGE: '超出范围',
      FAILED: '定位异常',
      NO_SITE: '未配置地点',
    })[props.location.status],
)
const emptyTitle = computed(() =>
  props.location.status === 'NO_SITE'
    ? '项目尚未配置实施地点'
    : props.location.status === 'FAILED'
      ? '暂时无法显示地图'
      : '地图将在定位后显示',
)
const emptyCopy = computed(() =>
  props.location.status === 'NO_SITE'
    ? '请先在项目实施计划中配置地点'
    : props.location.status === 'FAILED'
      ? '检查系统定位权限后重新定位'
      : '请保持定位权限开启',
)
const markers = computed(() => {
  const currentMarkers = hasCoordinates.value
    ? [
        {
          id: 1,
          latitude: Number(props.location.latitude),
          longitude: Number(props.location.longitude),
          iconPath: '/static/location.png',
          width: 28,
          height: 28,
          anchor: { x: 0.5, y: 1 },
        },
      ]
    : []
  const siteMarkers = (props.sites || []).map((site, index) => ({
    id: 100 + index,
    latitude: site.latitude,
    longitude: site.longitude,
    iconPath: '/static/location.png',
    width: 22,
    height: 22,
    anchor: { x: 0.5, y: 1 },
    title: site.locationName,
  }))
  return [...currentMarkers, ...siteMarkers]
})
const circles = computed(() =>
  (props.sites || []).map((site) => ({
    latitude: site.latitude,
    longitude: site.longitude,
    radius: IMPLEMENTATION_RADIUS_METERS,
    color: '#2f86ff99',
    fillColor: '#2f86ff1f',
    strokeWidth: 2,
  })),
)

const refresh = () => {
  if (!props.locating) emit('refresh')
}
</script>

<style lang="scss" scoped>
.location-panel {
  overflow: hidden;
  border: 1px solid #e3e9f0;
  border-radius: 12px;
}

.location-panel__toolbar {
  display: flex;
  min-height: 44px;
  padding: 0 12px;
  background: #fff;
  align-items: center;
  justify-content: space-between;
}

.location-panel__heading {
  display: flex;
  font-size: 13px;
  font-weight: 600;
  color: #27364a;
  align-items: center;
  gap: 7px;
}

.location-panel__pulse {
  width: 8px;
  height: 8px;
  background: #94a0ad;
  border-radius: 50%;
}

.location-panel__pulse--normal {
  background: #2d9867;
}
.location-panel__pulse--out_of_range,
.location-panel__pulse--failed,
.location-panel__pulse--no_site {
  background: #c84b4b;
}

.location-panel__refresh {
  display: flex;
  min-width: 72px;
  min-height: 44px;
  font-size: 13px;
  font-weight: 600;
  color: #176ac7;
  align-items: center;
  justify-content: flex-end;
}

.location-panel__refresh.disabled {
  color: #718096;
}

.location-panel__map {
  display: block;
  width: 100%;
  height: 176px;
  background: #eaf1f7;
}

.location-panel__map--empty {
  display: flex;
  color: #65758a;
  background: #eef3f7;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.location-panel__map--suspended {
  background: #eaf1f7;
}

.location-panel__radar {
  position: relative;
  display: flex;
  width: 46px;
  height: 46px;
  margin-bottom: 10px;
  background: #d8e8f8;
  border: 1px solid #a9caed;
  border-radius: 50%;
  align-items: center;
  justify-content: center;
}

.location-panel__radar::before {
  position: absolute;
  width: 24px;
  height: 24px;
  content: '';
  border: 1px solid #8db8e5;
  border-radius: 50%;
}

.location-panel__radar-dot {
  position: relative;
  z-index: 1;
  width: 8px;
  height: 8px;
  background: #2f86ff;
  border: 3px solid #fff;
  border-radius: 50%;
  box-shadow: 0 3px 10px rgb(29 91 157 / 24%);
}

.location-panel__empty-title {
  font-size: 14px;
  font-weight: 600;
  color: #3d4f63;
}

.location-panel__empty-copy {
  margin-top: 4px;
  font-size: 12px;
  color: #65758a;
}

.location-box {
  display: flex;
  min-height: 68px;
  padding: 12px;
  background: #f7f9fb;
  align-items: center;
}

.location-box--normal {
  background: #edf8f2;
}
.location-box--out_of_range,
.location-box--failed,
.location-box--no_site {
  background: #fff0ef;
}

.location-mark {
  position: relative;
  width: 30px;
  height: 30px;
  margin-right: 10px;
  background: #2f86ff;
  border-radius: 50% 50% 50% 10px;
  transform: rotate(-45deg);
  flex: none;
}

.location-mark text {
  position: absolute;
  top: 10px;
  left: 10px;
  width: 10px;
  height: 10px;
  background: #fff;
  border-radius: 50%;
}

.location-copy {
  min-width: 0;
  flex: 1;
}
.location-name {
  font-size: 14px;
  font-weight: 600;
  color: #202d3d;
}
.location-address {
  margin-top: 3px;
  font-size: 12px;
  line-height: 1.45;
  color: #566579;
  word-break: break-all;
}
.location-status {
  margin-left: 8px;
  font-size: 12px;
  font-weight: 600;
  color: #566579;
  flex: none;
}
.location-box--normal .location-status {
  color: #267b54;
}
.location-box--out_of_range .location-status,
.location-box--failed .location-status {
  color: #a93939;
}
</style>
