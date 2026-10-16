<route lang="json5">
{ style: { navigationStyle: 'custom', navigationBarTitleText: '待办事项', disableScroll: true } }
</route>
<template><HomeWorkspace ref="workspace" todo-only /></template>
<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import HomeWorkspace from '@/components/HomeWorkspace.vue'
const workspace = ref<InstanceType<typeof HomeWorkspace>>()
onShow(async () => { await nextTick(); workspace.value?.refresh() })
</script>
