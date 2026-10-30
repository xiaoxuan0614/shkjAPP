<route lang="json5">
{
  style: {
    navigationBarTitleText: '工单详情',
  },
}
</route>
<template><RepairRoute entry="records" :order-id="orderId" :todo-target="todoTarget" :quotation="quotation" /></template>
<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import RepairRoute from './components/preview/RepairRoute.vue'
import type { RepairTodoTarget } from '@/service/repairCollaboration'
const orderId = ref('')
const quotation = ref(false)
const todoTarget = ref<RepairTodoTarget>()
onLoad(options => {
  orderId.value = String(options?.id || '')
  quotation.value = options?.view === 'quote'
  if(options?.view==='approval' || options?.view==='collaboration')todoTarget.value={orderId:orderId.value,view:options.view,taskId:String(options.taskId || ''),instanceId:String(options.instanceId || ''),applicationId:String(options.applicationId || ''),departmentId:String(options.departmentId || '')}
})
</script>
