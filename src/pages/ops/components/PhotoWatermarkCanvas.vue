<template>
  <canvas
    :id="canvasId"
    :canvas-id="canvasId"
    class="photo-watermark-canvas"
    :style="`width:${canvasSize.width}px;height:${canvasSize.height}px;`"
  />
</template>

<script lang="ts" setup>
import { getCurrentInstance, nextTick, ref } from 'vue'

type WatermarkMeta = {
  locationText: string
  latitude?: number
  longitude?: number
  timestamp: string
}

const canvasId = 'implement-photo-watermark-canvas'
const canvasSize = ref({ width: 1, height: 1 })
const instance = getCurrentInstance()

const getImageInfo = (src: string) =>
  new Promise<UniNamespace.GetImageInfoSuccessData>((resolve, reject) => {
    uni.getImageInfo({ src, success: resolve, fail: reject })
  })

const fitText = (value: string, maxChars: number) => {
  const text = String(value || '').trim()
  if (text.length <= maxChars) return text
  return `${text.slice(0, Math.max(1, maxChars - 1))}…`
}

const watermarkLines = (meta: WatermarkMeta, width: number, fontSize: number) => {
  const maxChars = Math.max(12, Math.floor((width - Math.max(14, fontSize * 1.6)) / fontSize))
  const latitude = Number(meta.latitude)
  const longitude = Number(meta.longitude)
  const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude)
  return [
    `位置：${fitText(meta.locationText || '定位信息不可用', maxChars)}`,
    hasCoordinates
      ? `坐标：${longitude.toFixed(6)}, ${latitude.toFixed(6)}`
      : '坐标：未获取',
    `时间：${meta.timestamp}`,
  ]
}

const renderH5Watermark = async (filePath: string, meta: WatermarkMeta) => {
  // #ifdef H5
  const sourceImage = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('原始照片读取失败'))
    image.src = filePath
  })
  const sourceWidth = Math.max(1, sourceImage.naturalWidth || sourceImage.width)
  const sourceHeight = Math.max(1, sourceImage.naturalHeight || sourceImage.height)
  const scale = Math.min(1, 2048 / Math.max(sourceWidth, sourceHeight))
  const width = Math.max(1, Math.round(sourceWidth * scale))
  const height = Math.max(1, Math.round(sourceHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('照片水印画布创建失败')

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.drawImage(sourceImage, 0, 0, width, height)
  const fontSize = Math.max(15, Math.min(34, Math.round(width / 30)))
  const lineHeight = Math.round(fontSize * 1.55)
  const padding = Math.max(14, Math.round(fontSize * 0.8))
  const bandHeight = lineHeight * 3 + padding * 2
  context.fillStyle = 'rgba(0, 0, 0, 0.58)'
  context.fillRect(0, Math.max(0, height - bandHeight), width, bandHeight)
  context.fillStyle = '#ffffff'
  context.font = `${fontSize}px sans-serif`
  watermarkLines(meta, width, fontSize).forEach((line, index) => {
    context.fillText(line, padding, height - bandHeight + padding + lineHeight * (index + 0.8))
  })
  return canvas.toDataURL('image/jpeg', 0.9)
  // #endif
  return filePath
}

const exportCanvas = (width: number, height: number) =>
  new Promise<string>((resolve, reject) => {
    uni.canvasToTempFilePath(
      {
        canvasId,
        width,
        height,
        destWidth: width,
        destHeight: height,
        fileType: 'jpg',
        quality: 0.9,
        success: (result) => resolve(result.tempFilePath),
        fail: reject,
      },
      instance?.proxy,
    )
  })

const applyWatermark = async (filePath: string, meta: WatermarkMeta) => {
  // H5 使用原生离屏画布，避免旧版 Canvas 在尺寸变更尚未完成时导出空白或黑色图片。
  // #ifdef H5
  return renderH5Watermark(filePath, meta)
  // #endif

  const imageInfo = await getImageInfo(filePath)
  const sourceWidth = Math.max(1, Number(imageInfo.width) || 1)
  const sourceHeight = Math.max(1, Number(imageInfo.height) || 1)
  const scale = Math.min(1, 2048 / Math.max(sourceWidth, sourceHeight))
  const width = Math.max(1, Math.round(sourceWidth * scale))
  const height = Math.max(1, Math.round(sourceHeight * scale))
  canvasSize.value = { width, height }
  await nextTick()
  await new Promise<void>((resolve) => setTimeout(resolve, 50))

  const context = uni.createCanvasContext(canvasId, instance?.proxy)
  context.setFillStyle('#ffffff')
  context.fillRect(0, 0, width, height)
  context.drawImage(imageInfo.path || filePath, 0, 0, width, height)

  const fontSize = Math.max(15, Math.min(34, Math.round(width / 30)))
  const lineHeight = Math.round(fontSize * 1.55)
  const padding = Math.max(14, Math.round(fontSize * 0.8))
  const bandHeight = lineHeight * 3 + padding * 2
  const lines = watermarkLines(meta, width, fontSize)

  context.setFillStyle('rgba(0, 0, 0, 0.58)')
  context.fillRect(0, Math.max(0, height - bandHeight), width, bandHeight)
  context.setFillStyle('#ffffff')
  context.setFontSize(fontSize)
  lines.forEach((line, index) => {
    context.fillText(line, padding, height - bandHeight + padding + lineHeight * (index + 0.8))
  })

  await new Promise<void>((resolve) => context.draw(false, resolve))
  await new Promise<void>((resolve) => setTimeout(resolve, 30))
  return exportCanvas(width, height)
}

defineExpose({ applyWatermark })
</script>

<style lang="scss" scoped>
.photo-watermark-canvas {
  position: fixed;
  top: -99999px;
  left: -99999px;
  pointer-events: none;
  opacity: 0;
}
</style>
