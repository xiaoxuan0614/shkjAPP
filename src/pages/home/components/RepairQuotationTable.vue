<template>
  <view class="quote-summary">
    <view class="table" role="table" aria-label="报价明细">
      <view class="row heading" role="row"><text role="columnheader">名称</text><text role="columnheader">数量</text><text role="columnheader">单价</text><text role="columnheader">金额</text></view>
      <view v-for="(item, index) in visible" :key="index" class="row" role="row">
        <text role="cell" class="name">{{ item.name }}</text><text role="cell">{{ item.qty }}</text><text role="cell">{{ money(item.price) }}</text><text role="cell">{{ quotationLineTotal(item.qty, item.price).replace('¥', '') }}</text>
      </view>
      <text v-if="!items.length" class="empty">暂无报价明细</text>
    </view>
    <view v-if="pages > 1" class="pager"><button :disabled="page <= 1" @click="page--">上一页</button><text>{{ page }} / {{ pages }} 页 · {{ items.length }} 项</text><button :disabled="page >= pages" @click="page++">下一页</button></view>
  </view>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { quotationLineTotal } from '@/service/quotationApproval'
const props = defineProps<{ items: { name: string; qty: number; price: number }[] }>()
const page = ref(1)
const pages = computed(() => Math.max(1, Math.ceil(props.items.length / 5)))
const visible = computed(() => props.items.slice((page.value - 1) * 5, page.value * 5))
watch(() => props.items, () => { page.value = 1 })
const money = (value: unknown) => value == null || value === '' || !Number.isFinite(Number(value)) ? '—' : Number(value).toFixed(2)
</script>
<style scoped>
.quote-summary{width:100%;min-width:0;margin:12px 0}.table{border:1px solid #e3e8ef;border-radius:8px;overflow:hidden}.row{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,.65fr) minmax(0,.9fr) minmax(0,1fr);gap:8px;padding:12px 8px;border-top:1px solid #eaecf0;font-size:12px;line-height:1.6;align-items:start;font-variant-numeric:tabular-nums}.row>text{min-width:0;overflow-wrap:anywhere;text-align:right}.row .name,.heading>text:first-child{text-align:left}.heading{border-top:0;background:#f2f6fc;color:#475467}.name{color:#27364a}.empty{display:block;padding:20px;text-align:center;font-size:13px;color:#667085}.pager{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;font-size:12px;color:#667085}.pager button{margin:0;min-height:44px;line-height:44px;padding:0 10px;background:#edf5ff;color:#176ac7;font-size:13px}.pager button::after{border:0}.pager button[disabled]{opacity:.45}.pager button:focus-visible{outline:2px solid #176ac7}
</style>
