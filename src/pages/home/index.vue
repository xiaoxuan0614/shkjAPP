<route lang="json5" type="home">
{ style: { navigationStyle: 'custom', navigationBarTitleText: '运维工作台', disableScroll: true } }
</route>
<template><HomeWorkspace ref="workspace" /></template>
<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import HomeWorkspace from '@/components/HomeWorkspace.vue'
const workspace = ref<InstanceType<typeof HomeWorkspace>>()
onShow(async () => { await nextTick(); workspace.value?.refresh() })
</script>
