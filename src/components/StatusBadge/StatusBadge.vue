<!-- 状态徽标：传入字典与状态值，渲染 wd-tag -->
<template>
  <text class="status-badge" :style="{ color: color, backgroundColor: bg }">{{ label }}</text>
</template>

<script lang="ts" setup>
import { computed } from 'vue'

const props = defineProps<{
  value: string
  dict: { value: string; label: string; color: string }[]
}>()

const item = computed(() => props.dict.find((d) => d.value === props.value))
const label = computed(() => item.value?.label ?? props.value)
const color = computed(() => item.value?.color ?? '#909399')
const bg = computed(() => color.value + '1a')
</script>

<style lang="scss" scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 18px;
  flex: none;
}
</style>
