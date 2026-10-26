<route lang="json5">
{
  style: {
    navigationBarTitleText: '线下维修',
  },
}
</route>
<template><RepairRoute entry="records" :order-id="orderId" /></template>
<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import RepairRoute from './components/preview/RepairRoute.vue'
const orderId = ref('')
onLoad(options => { orderId.value = String(options?.id || '') })
</script>
