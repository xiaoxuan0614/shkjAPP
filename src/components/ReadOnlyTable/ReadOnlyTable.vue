<template>
  <view class="readonly-table">
    <text v-if="!rows.length" class="readonly-table__empty">{{ emptyText }}</text>
    <scroll-view v-else scroll-x class="readonly-table__scroll">
      <view class="readonly-table__body" role="table" :aria-label="label" :style="{ minWidth }">
        <view class="readonly-table__row readonly-table__head" role="row" :style="rowStyle">
          <text v-for="column in columns" :key="column.key" role="columnheader" class="readonly-table__cell" :style="{ textAlign: column.align || 'left' }">{{ column.label }}</text>
        </view>
        <view v-for="(row, index) in rows" :key="row.key ?? index" role="rowgroup" class="readonly-table__group">
          <view class="readonly-table__row" role="row" :style="rowStyle">
            <view v-for="column in columns" :key="column.key" role="cell" class="readonly-table__cell" :style="{ textAlign: column.align || 'left' }">
              <slot name="cell" :row="row" :column="column" :index="index">{{ displayValue(row[column.key]) }}</slot>
            </view>
          </view>
          <view v-if="row.remark" class="readonly-table__remark" role="row"><text role="cell">备注：{{ row.remark }}</text></view>
        </view>
      </view>
    </scroll-view>
    <slot name="footer" />
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ReadOnlyColumn, ReadOnlyRow } from './types'

const props = withDefaults(defineProps<{
  label: string
  columns: ReadOnlyColumn[]
  rows: ReadOnlyRow[]
  minWidth?: string
  emptyText?: string
}>(), { minWidth: '0px', emptyText: '暂无记录' })
const rowStyle = computed(() => ({ gridTemplateColumns: props.columns.map(column => column.width || 'minmax(0, 1fr)').join(' ') }))
const displayValue = (value: unknown) => value === null || value === undefined || value === '' ? '—' : value
</script>

<style scoped lang="scss">
.readonly-table { width: 100%; min-width: 0; }
.readonly-table__scroll { width: 100%; }
.readonly-table__body { box-sizing: border-box; width: 100%; border: 1px solid #e1e6ec; border-radius: 8px; overflow: hidden; }
.readonly-table__row { display: grid; }
.readonly-table__head { background: #f5f6f8; font-weight: 600; }
.readonly-table__group { border-top: 1px solid #e1e6ec; }
.readonly-table__cell { min-width: 0; padding: 10px 8px; color: #27364a; font-size: 13px; line-height: 1.6; overflow-wrap: anywhere; white-space: pre-line; font-variant-numeric: tabular-nums; border-right: 1px solid #e1e6ec; }
.readonly-table__cell:last-child { border-right: 0; }
.readonly-table__remark { padding: 8px; color: #596574; font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; border-top: 1px solid #e1e6ec; }
.readonly-table__empty { display: block; padding: 12px 0; color: #596574; font-size: 14px; }
</style>
