<template>
  <view v-if="isApprovalReused(department)" class="reuse-info">
    <text class="reuse-title">已通过（复用一级审批结果）</text>
    <text>审批人：{{ actorName }}</text>
    <text>通过时间：{{ time(department.handledAt || department.sourceApprovedAt) }}</text>
    <text v-if="department.reuseReason">{{ department.reuseReason }}</text>
    <text v-if="department.sourceTaskId">来源一级任务：{{ department.sourceTaskId }}</text>
  </view>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { isApprovalReused } from '@/service/repairCollaboration'
const props=defineProps<{department:Record<string,any>;detail:Record<string,any>}>()
const actorName=computed(()=>{
  const id=props.department.handledBy
  if(!id)return '—'
  for(const workflow of props.detail.workflows || []) {
    const history=(workflow.history || []).find((item:any)=>item.actor_id===id && item.actor_name)
    if(history)return history.actor_name
    const person=(workflow.handledUsers || []).find((item:any)=>item.userId===id && item.userName)
    if(person)return person.userName
  }
  return id
})
const time=(value:unknown)=>value ? String(value).replace('T',' ') : '—'
</script>
<style scoped>
.reuse-info { margin-top:10px;padding:10px 12px;border-left:3px solid #16836b;background:#f0f8f4;border-radius:4px;color:#475467;font-size:13px;line-height:1.7;overflow-wrap:anywhere; }
.reuse-info text { display:block; }.reuse-title{font-weight:600;color:#116c57;}
</style>
