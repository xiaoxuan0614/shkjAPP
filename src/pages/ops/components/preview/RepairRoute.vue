<template><OpsWorkflow ref="page" :can-manage="canManage" :direct-detail="!!orderId" @close="close" /></template>
<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { useUserStore } from '@/store/user'
import OpsWorkflow from './OpsWorkflow.vue'
import type { RepairTodoTarget } from '@/service/repairCollaboration'
const props = defineProps<{ entry: 'reports' | 'records'; orderId?: string;todoTarget?:RepairTodoTarget; quotation?: boolean }>()
const user = useUserStore()
const canManage = computed(() => user.identity.roleCodes.some(role => ['admin', 'operations_manager'].includes(role)))
const page = ref<InstanceType<typeof OpsWorkflow>>()
let mounted = false
function open() {
  if (!mounted || !page.value) return
  page.value.openHomeEntry(props.entry)
  if (props.orderId) void page.value.openOrder(props.orderId,props.todoTarget,props.quotation)
}
onMounted(() => { mounted = true; open() })
watch([() => props.entry, () => props.orderId, () => props.todoTarget], open)
function close() { uni.navigateBack({ fail: () => uni.reLaunch({url:'/pages/home/index'}) }) }
</script>
