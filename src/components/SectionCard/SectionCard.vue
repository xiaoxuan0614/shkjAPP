<!-- 分组卡片：标题 + 右侧文字 + 内容插槽 -->
<template>
  <view class="section-card">
    <view class="section-card__header">
      <view class="section-card__title">
        <view class="dot"></view>
        <text>{{ title }}</text>
      </view>
      <view class="section-card__extra" @click="$emit('extraClick')">
        <text class="extra-text">{{ extra }}</text>
        <text v-if="extra" class="extra-arrow">›</text>
      </view>
    </view>
    <slot></slot>
  </view>
</template>

<script lang="ts" setup>
defineProps<{
  title: string
  extra?: string
}>()
defineEmits<{ extraClick: [] }>()
</script>

<style lang="scss" scoped>
.section-card {
  background: #fff;
  border-radius: 12px;
  margin: 12px;
  padding: 14px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  &__title {
    display: flex;
    align-items: center;
    font-size: 16px;
    font-weight: 600;
    color: #333;

    .dot {
      width: 8px;
      height: 16px;
      border-radius: 4px;
      background: #2f86ff;
      margin-right: 8px;
    }
  }

  &__extra {
    display: flex;
    align-items: center;
    color: #999;
    font-size: 13px;

    .extra-arrow {
      margin-left: 2px;
      color: #ccc;
    }
  }
}
</style>
