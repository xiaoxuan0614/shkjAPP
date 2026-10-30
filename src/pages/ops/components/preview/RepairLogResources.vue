<template>
  <view v-if="!hideEmpty || persons.length || record.vehicleValue || uses.length || (workDetail?.materialItems?.length || workDetail?.materialUseIds?.length)" class="log-resources" :class="{ 'log-resources--detail': hideEmpty }">
    <template v-if="!hideEmpty || persons.length">
    <text class="log-resources__title">用人记录</text>
    <view v-if="!hideEmpty" class="log-resources__row"><text>操作人</text><text>{{ record.operatorNameSnapshot || '未记录' }}</text></view>
    <view v-for="person in persons" :key="person.id" class="log-resources__row"><text>{{ person.personType === 'EXTERNAL' ? '外协人员' : '内协人员' }}</text><text>{{ person.personNameSnapshot || '未记录姓名' }}</text></view>
    <text v-if="!persons.length" class="log-resources__empty">未记录其他参与人员</text>
    <view v-for="row in workDetail?.outsources || []" :key="row.outsourceMemberId" class="log-resources__row"><text>{{ row.unitName || detail.members?.find(m => m.id === row.outsourceMemberId)?.personNameSnapshot || '外协单位' }}</text><text>{{ row.headcount ?? '未返回' }} 人 · {{ row.workHours ?? '未返回' }} h<text v-if="row.remark"> · {{ row.remark }}</text></text></view>
    <view v-if="!hideEmpty" class="log-resources__row"><text>本次作业时长</text><text>{{ record.recordStatus === 'ACTIVE' ? '进行中' : record.durationSeconds != null ? `${(Number(record.durationSeconds) / 3600).toFixed(2)}h` : '未记录' }}</text></view>
    </template>
    <template v-if="!hideEmpty || record.vehicleValue">
    <text class="log-resources__title">用车记录</text>
    <view class="log-resources__row"><text>车辆</text><text>{{ Number(record.vehicleUsed) === 1 ? record.vehiclePlateSnapshot || record.vehicleValue || '未记录车牌' : '未使用车辆' }}</text></view>
    </template>
    <template v-if="!hideEmpty || uses.length || (workDetail?.materialItems?.length || workDetail?.materialUseIds?.length)">
    <text class="log-resources__title">用料记录</text>
    <text v-if="!uses.length" class="log-resources__empty">{{ workDetail?.materialUseIds?.length ? `已关联 ${workDetail.materialUseIds.length} 条用料，接口未返回明细` : '未记录用料' }}</text>
    <view v-if="uses.length" class="material-table" role="table" aria-label="用料记录">
      <view class="material-table__row material-table__head" role="row"><text role="columnheader">物料名称</text><text role="columnheader">使用数量</text></view>
      <view v-for="use in uses" :key="use.id" class="material-table__row" role="row"><text role="cell">{{ material(use).materialName || material(use).name || use.materialId || '物料' }}</text><text role="cell">{{ use.usedQuantity ?? '—' }} {{ material(use).baseUnitName || material(use).unitName || '' }}</text></view>
    </view>
    </template>
  </view>
</template>
<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{detail:Record<string,any>;recordId:string;workDetail?:Record<string,any>;hideEmpty?:boolean}>()
const record = computed(() => ({...(props.detail.workRecords || []).find((r:any) => r.id === props.recordId),...props.workDetail,...(props.workDetail ? {vehicleUsed:!!props.workDetail.vehicleValue} : {})}))
const persons = computed(() => props.workDetail ? (props.workDetail.persons || []).map((p:any) => ({...p,id:`${p.personType}:${p.sourcePersonId}`,personNameSnapshot:p.name || p.sourcePersonId})) : (props.detail.workPersons || []).filter((p:any) => p.workRecordId === props.recordId))
const uses = computed(() => props.workDetail?.materialItems ? props.workDetail.materialItems.map((i:any) => ({...(props.detail.materialUses || []).find((u:any)=>u.workRecordId === props.recordId && u.pickLinkId === i.pickLinkId && u.useStatus !== 'VOIDED'),...i,id:i.pickLinkId,usedQuantity:i.quantity,useDescription:i.description})) : props.workDetail?.materialUses || (props.detail.materialUses || []).filter((u:any) => u.workRecordId === props.recordId))
function material(use:any) { const link=props.detail.materialLinks?.find((l:any) => l.id === use.pickLinkId) || {}; return {...(link.material || {}),...link} }
</script>
<style scoped>
.log-resources { margin-top:16px; }
.log-resources--detail { margin-top:0; padding:16px; background:#fff; border-radius:12px; }
.log-resources--detail > .log-resources__title:first-child { margin-top:0; }
.log-resources__title { display:block; margin:18px 0 8px; font-size:16px; font-weight:600; color:#303133; }
.log-resources__row { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; padding:8px 0; font-size:15px; line-height:1.6; }
.log-resources__row > text:first-child { color:#606266; }
.log-resources__row > text:last-child { min-width:0; text-align:right; overflow-wrap:anywhere; }
.log-resources__empty { display:block; color:#606266; font-size:14px; line-height:1.6; }
.material-table { border:1px solid #e4e7ed; border-radius:8px; overflow:hidden; }
.material-table__row { display:grid; grid-template-columns:minmax(0, 1fr) minmax(88px, 34%); font-size:14px; line-height:1.6; color:#303133; }
.material-table__row + .material-table__row { border-top:1px solid #e4e7ed; }
.material-table__row > text { padding:12px; min-width:0; overflow-wrap:anywhere; }
.material-table__row > text:last-child { text-align:right; border-left:1px solid #e4e7ed; font-variant-numeric:tabular-nums; }
.material-table__head { background:#f5f7fa; color:#536176; font-weight:500; }
</style>
