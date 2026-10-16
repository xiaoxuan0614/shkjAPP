<template>
  <wd-popup v-model="visible" position="bottom" :root-portal="true" :safe-area-inset-bottom="false" :close-on-click-modal="true" :z-index="zIndex ?? 1800" custom-style="border-radius:16px 16px 0 0;overflow:hidden;" @after-enter="fitScreen">
    <view class="document-preview">
      <view class="document-preview__head">
        <view><text class="document-preview__heading">报价单预览</text><text class="document-preview__name">{{ title }}</text></view>
        <button aria-label="关闭报价单预览" @click="visible = false">关闭</button>
      </view>
      <view class="document-preview__zoom" aria-label="报价单缩放">
        <button :disabled="zoom <= 0.1" aria-label="缩小报价单" @click="setZoom(zoom - 0.1)">缩小</button>
        <text aria-live="polite">{{ Math.round(zoom * 100) }}%</text>
        <button :disabled="zoom >= 2" aria-label="放大报价单" @click="setZoom(zoom + 0.1)">放大</button>
        <button @click="fitWidth">适宽</button>
        <button @click="fitScreen">整页</button>
        <button @click="setZoom(1)">100%</button>
      </view>
      <view class="document-preview__hint">共 {{ rows.length }} 项 · 默认整页适应，放大后可滑动查看</view>
      <view v-if="!showPrice && !materialOnly" class="document-preview__hint">当前无报价查看权限，单价、小计和合计不显示。</view>
      <scroll-view ref="scrollElement" scroll-x scroll-y class="document-preview__scroll">
        <view ref="paperElement" class="document-preview__paper" :style="{ width: `${PAPER_WIDTH * zoom}px`, fontSize: `${14 * zoom}px` }">
          <view class="document-preview__title">{{ title || '项目报价清单' }}</view>
          <view class="document-preview__context">{{ projectLabel || '—' }} · {{ statusText }} · 仅供查看，非正式导出文件</view>
          <view class="document-table" role="table" aria-label="报价单预览">
            <view class="document-row document-row--head" role="row">
              <view v-for="column in columns" :key="column.key" class="document-cell" :class="'document-cell--' + column.key" role="columnheader">{{ column.title }}</view>
            </view>
            <view v-for="(row, index) in rows" :key="row.rowKey" class="document-row" role="row">
              <view v-for="column in columns" :key="column.key" class="document-cell" :class="'document-cell--' + column.key" role="cell">{{ cell(row, column.key, index) }}</view>
            </view>
          </view>
          <view v-if="!rows.length" class="document-preview__empty">{{ emptyText || '暂无报价明细' }}</view>
          <view v-if="showPrice && !materialOnly" class="document-preview__total">合计（元）：{{ total }}</view>
          <!-- <view class="document-preview__hint">{{ materialOnly ? '仅展示合同提交时的物料及服务费快照，不包含金额。' : '完整型号、规格参数和备注均保留换行；未返回的内容显示“—”。' }}</view> -->
        </view>
      </scroll-view>
    </view>
  </wd-popup>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, ref, watch } from 'vue'
import { quotationCell } from '@/utils/quotationTable'
import { quotationDocumentTotal, quotationDocumentAmount } from '@/utils/quotationDocument'

const props = defineProps<{ modelValue: boolean; title: string; projectLabel: string; statusText: string; rows: any[]; showPrice: boolean; brands: Record<string, string>; zIndex?: number; materialOnly?: boolean; emptyText?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
const visible = computed({ get: () => props.modelValue, set: value => emit('update:modelValue', value) })
const PAPER_WIDTH = 1600
const zoom = ref(0.18)
const scrollElement = ref<any>()
const paperElement = ref<any>()
const instance = getCurrentInstance()
let zoomRequest = 0
// H5 root-portal 会将节点移出原组件，不能只依赖组件作用域 selectorQuery。
function measure(selector: string, callback: (rect: any) => void) {
  // #ifdef H5
  const target = selector === '.document-preview__scroll' ? scrollElement.value : paperElement.value
  const element = target?.$el || target
  if (element?.getBoundingClientRect) {
    callback(element.getBoundingClientRect())
    return
  }
  // #endif
  uni.createSelectorQuery().in(instance?.proxy).select(selector).boundingClientRect(callback).exec()
}
watch(() => props.modelValue, (open) => {
  zoomRequest++
  if (!open) return
  // 测量之前先按屏幕宽度初始化，避免查询为空时留在100%。
  const width = uni.getSystemInfoSync?.().windowWidth || 320
  zoom.value = Math.max(0.001, Math.min(1, (width - 24) / PAPER_WIDTH))
  void fitScreen()
})
function setZoom(value: number) {
  zoomRequest++
  zoom.value = Math.max(0.1, Math.min(2, Math.round(value * 100) / 100))
}
async function fitWidth() {
  const request = ++zoomRequest
  await nextTick()
  if (!visible.value) return
  measure('.document-preview__scroll', (rect: any) => {
    if (request !== zoomRequest || !visible.value || !rect?.width) return
    // 向下取整，保留纸张左右各12px留白，避免“适宽”仍出现横向溢出。
    zoom.value = Math.max(0.1, Math.min(2, Math.floor((rect.width - 24) / PAPER_WIDTH * 100) / 100))
  })
}
async function fitScreen() {
  const request = ++zoomRequest
  await nextTick()
  if (!visible.value) return
  // 先适宽，再按实际渲染高度缩小，长备注和服务费均计入整页尺寸。
  measure('.document-preview__scroll', async (rect: any) => {
    if (request !== zoomRequest || !visible.value || !rect?.width || !rect?.height) return
    zoom.value = Math.max(0.001, Math.min(2, (rect.width - 24) / PAPER_WIDTH))
    await nextTick()
    measure('.document-preview__paper', (paper: any) => {
      if (request !== zoomRequest || !visible.value || !paper?.height) return
      const ratio = Math.min(1, (rect.height - 24) / paper.height, (rect.width - 24) / (paper.width || rect.width))
      zoom.value = Math.max(0.001, zoom.value * Math.max(0.001, ratio) * 0.98)
    })
  })
}
const columns = computed(() => props.materialOnly ? [
  { key: 'index', title: '序号' },
  { key: 'name', title: '物料 / 服务费名称' }, { key: 'brand', title: '品牌' }, { key: 'model', title: '型号' },
  { key: 'quantity', title: '数量' }, { key: 'unit', title: '单位' }, { key: 'remark', title: '备注' },
] : [
  { key: 'index', title: '序号' }, { key: 'name', title: '名称' }, { key: 'brand', title: '品牌' },
  { key: 'model', title: '型号' }, { key: 'parameters', title: '规格参数' },
  { key: 'quantity', title: '数量' }, { key: 'unit', title: '单位' },
  ...(props.showPrice ? [{ key: 'finalPrice', title: '单价（元）' }, { key: 'guideTotal', title: '小计（元）' }] : []),
  { key: 'remark', title: '备注' },
])
function cell(row: any, key: string, index: number) {
  if (key === 'index') return index + 1
  if (key === 'name') return (row.isFee ? '【服务费】' : '') + (row.materialName || '—')
  if (key === 'brand') return row.isFee ? '—' : row.brand_dictText || props.brands[String(row.brand)] || row.brand || '—'
  if (key === 'model') return row.isFee ? '—' : row.model || '—'
  if (key === 'parameters') return (row.isFee ? row.description : row.specificationParams) || '—'
  if (key === 'guideTotal') return quotationDocumentAmount(row).replace(/^¥/, '')
  if (key === 'finalPrice') return quotationCell(row, key).replace(/^¥/, '')
  return row[key] == null || row[key] === '' ? '—' : String(row[key])
}
const total = computed(() => props.showPrice ? quotationDocumentTotal(props.rows) : '—')
</script>

<style scoped>
.document-preview { display:flex; flex-direction:column; height:90vh; height:90dvh; max-height:calc(100vh - var(--window-top, 0px)); box-sizing:border-box; padding-bottom:env(safe-area-inset-bottom, 0px); background:#f2f4f7; color:#27364a; }
.document-preview__head { display:flex; flex:none; justify-content:space-between; align-items:center; gap:12px; padding:12px 16px; background:#fff; border-bottom:1px solid #e4e7ec; }
.document-preview__head > view { flex:1; min-width:0; }
.document-preview__heading { display:block; font-size:18px; font-weight:600; }
.document-preview__name { display:block; margin-top:4px; font-size:13px; color:#667085; overflow-wrap:anywhere; max-height:42px; overflow:auto; }
.document-preview__head button { flex:none; min-height:44px; margin:0; padding:8px 12px; font-size:14px; color:#176ac7; background:#fff; }
.document-preview__hint { flex:none; padding:8px 16px; font-size:12px; color:#667085; }
.document-preview__zoom { display:flex; flex:none; flex-wrap:wrap; align-items:center; justify-content:center; gap:4px; padding:8px 12px; background:#fff; border-bottom:1px solid #e4e7ec; }
.document-preview__zoom button { margin:0; min-width:44px; min-height:44px; padding:10px 8px; line-height:24px; font-size:14px; color:#176ac7; background:#f2f6fc; }
.document-preview__zoom button[disabled] { color:#98a2b3; }
.document-preview__zoom text { min-width:44px; text-align:center; font-size:13px; font-variant-numeric:tabular-nums; }
.document-preview__scroll { flex:1; height:0; min-height:0; width:100%; }
.document-preview__paper { margin:12px; padding:1.714286em; background:#fff; color:#222; box-sizing:border-box; }
.document-preview__title { padding:0.727273em; background:#e7f1fc; font-size:1.571429em; font-weight:600; text-align:center; white-space:pre-wrap; overflow-wrap:anywhere; }
.document-preview__context { padding:0.923077em 0; font-size:0.928571em; }
.document-table { display:table; width:100%; table-layout:fixed; border-top:0.071429em solid #aab2bd; border-left:0.071429em solid #aab2bd; }
.document-row { display:table-row; }
.document-row--head { background:#f3f5f7; font-weight:600; }
.document-cell { display:table-cell; padding:0.714286em 0.571429em; border-right:0.071429em solid #aab2bd; border-bottom:0.071429em solid #aab2bd; vertical-align:middle; font-size:1em; line-height:1.6; white-space:pre-wrap; overflow-wrap:anywhere; }
.document-cell--index { width:2.857143em; text-align:center; }
.document-cell--name { width:10.714286em; }
.document-cell--brand { width:6.428571em; }
.document-cell--model { width:9.285714em; }
.document-cell--parameters { width:15.714286em; }
.document-cell--quantity { width:5.142857em; text-align:right; }
.document-cell--unit { width:3.428571em; text-align:center; }
.document-cell--finalPrice,.document-cell--guideTotal { width:9.142857em; text-align:right; white-space:nowrap; font-variant-numeric:tabular-nums; }
.document-cell--remark { width:10.714286em; }
.document-preview__total { padding:0.941176em; text-align:right; font-size:1.214286em; font-weight:600; border:1px solid #aab2bd; border-top:0; }
.document-preview__empty { padding:1.714286em; text-align:center; }
.document-preview__paper .document-preview__hint { padding:0.666667em 1.333333em; font-size:0.857143em; }
</style>
