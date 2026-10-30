<template>
  <view class="rest-page">
    <view class="notice">页面预览 · 示例数据，不会保存真实休息或转单</view>
    <view class="section">
      <text class="heading">1. 设置休息时间</text>
      <view class="field"><text>日期</text><picker mode="date" :value="form.date" @change="form.date=$event.detail.value"><view class="value">{{ form.date }} ›</view></picker></view>
      <view class="field"><text>运维人员</text><picker :range="demoPeople" range-key="name" @change="form.userId=demoPeople[Number($event.detail.value)].id"><view class="value">{{ personName || '请选择人员' }} ›</view></picker></view>
      <view class="field"><text>开始时间</text><picker mode="time" :value="form.start" @change="form.start=$event.detail.value"><view class="value">{{ form.start }} ›</view></picker></view>
      <view class="field"><text>结束时间</text><picker mode="time" :value="form.end" @change="form.end=$event.detail.value"><view class="value">{{ form.end }} ›</view></picker></view>
      <view class="quick"><button @click="period('08:00','12:00')">上午</button><button @click="period('13:00','18:00')">下午</button><button @click="period('00:00','23:59')">全天</button></view>
      <view class="field"><text>休息备注</text><input v-model="form.reason" placeholder="选填，如调休" maxlength="200" /></view>
      <button class="primary" @click="query">查看受影响维修单</button>
    </view>
    <view v-if="error" class="error" role="alert">{{ error }}</view>
    <template v-if="checked">
      <view class="section">
        <text class="heading">2. 指定接收人</text><text class="muted">待转 {{ pending.length }} 单 · 已指定 {{ assigned }} 单</text>
        <view v-if="working.length" class="warning">有 {{ working.length }} 单正在执行，需主管另行处理后再确认休息。</view>
        <view class="batch"><button @click="toggleAll">{{ allSelected ? '取消全选' : '全选待转单' }}</button><picker :range="candidates" range-key="label" :disabled="!selected.length" @change="assignBatch(Number($event.detail.value))"><view class="value">选接收人（已选{{ selected.length }}单） ›</view></picker></view>
      </view>
      <view v-for="row in rows" :key="row.id" class="section order">
        <view class="order-title"><button v-if="row.state==='pending'" class="select" :aria-label="`${selected.includes(row.id)?'取消选择':'选择'}${row.id}`" @click="toggle(row.id)">{{ selected.includes(row.id)?'已选':'选择' }}</button><text class="heading">{{ row.title }}</text><text class="badge">{{ row.state==='working'?'执行中':'待执行' }}</text></view>
        <text class="muted">{{ row.id }} · 自动派单</text><text class="muted">{{ row.customer }}</text><view class="field"><text>预计执行</text><text>{{ form.date }} {{ row.time }}</text></view>
        <picker v-if="row.state==='pending'" :range="candidates" range-key="label" @change="row.targetId=candidates[Number($event.detail.value)].id"><view class="value target">{{ demoPeople.find(p=>p.id===row.targetId)?.name || '指定接收人' }} ›</view></picker><text v-else class="warning">执行中的维修单不参与批量转派</text>
      </view>
      <view v-if="!rows.length" class="section muted">该休息时段没有受影响的示例维修单</view>
      <view class="section"><button class="primary" @click="confirm">预览确认结果</button><text class="muted">实际提交时需后端重新检查工单和人员状态。</text></view>
    </template>
    <view v-if="showResult" class="section result"><text class="heading">预览完成</text><text>{{ personName }} · {{ form.date }} {{ form.start }}—{{ form.end }}</text><text v-for="row in rows" :key="row.id">{{ row.id }} → {{ demoPeople.find(p=>p.id===row.targetId)?.name }}</text><text class="muted">未保存休息，未执行转单。</text></view>
  </view>
</template>
<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { demoPeople, eligiblePeople, previewOrders, validateRest, assignmentError, type RestOrder } from './restAssignment'
const now=new Date(), date=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
const form=reactive({date,userId:'',start:'08:00',end:'12:00',reason:''})
const rows=ref<RestOrder[]>([]), selected=ref<string[]>([]), checked=ref(false),error=ref(''),showResult=ref(false)
const personName=computed(()=>demoPeople.find(p=>p.id===form.userId)?.name)
const candidates=computed(()=>eligiblePeople(form.userId).map(p=>({...p,label:`${p.name} · ${p.hint}`})))
const pending=computed(()=>rows.value.filter(r=>r.state==='pending')), working=computed(()=>rows.value.filter(r=>r.state==='working'))
const assigned=computed(()=>pending.value.filter(r=>r.targetId).length)
const allSelected=computed(()=>pending.value.length>0&&pending.value.every(r=>selected.value.includes(r.id)))
watch(()=>[form.date,form.userId,form.start,form.end],()=>{rows.value=[];selected.value=[];checked.value=false;error.value='';showResult.value=false})
function period(start:string,end:string){form.start=start;form.end=end}
function query(){error.value=validateRest(form);if(error.value)return;rows.value=previewOrders(form);selected.value=[];showResult.value=false;checked.value=true}
function toggle(id:string){selected.value=selected.value.includes(id)?selected.value.filter(v=>v!==id):[...selected.value,id]}
function toggleAll(){selected.value=allSelected.value?[]:pending.value.map(r=>r.id)}
function assignBatch(index:number){const target=candidates.value[index];if(!target)return;rows.value.forEach(r=>{if(r.state==='pending'&&selected.value.includes(r.id))r.targetId=target.id});selected.value=[];error.value='';showResult.value=false}
function confirm(){error.value=assignmentError(form,rows.value);showResult.value=!error.value}
watch(()=>rows.value.map(r=>r.targetId).join(','),()=>{showResult.value=false})
</script>
<style scoped>
.rest-page{padding:12px;background:#f5f7fa;color:#303640}.notice,.warning,.error{font-size:13px;line-height:1.6;padding:12px;border-radius:8px;margin-bottom:12px}.notice{background:#eaf3ff;color:#235b98}.warning{background:#fff7e8;color:#805300}.error{background:#fff0f0;color:#a32424}.section{padding:16px;background:#fff;border-radius:12px;margin-bottom:12px}.heading{font-size:16px;font-weight:600;display:block}.field{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:50px;border-bottom:1px solid #edf0f4;font-size:14px}.field picker{flex:1;text-align:right}.field input{flex:1;min-width:0;text-align:right}.value{min-height:44px;display:flex;align-items:center;justify-content:flex-end;font-size:14px;color:#176ac7}.quick,.batch{display:flex;gap:8px;margin:12px 0;align-items:center;flex-wrap:wrap}button{margin:0;min-height:44px;font-size:14px;line-height:44px;padding:0 12px;background:#edf3fa;color:#176ac7}button::after{border:0}.primary{background:#176ac7;color:white;width:100%;margin-top:12px}.muted{display:block;font-size:13px;line-height:1.6;color:#667085;margin-top:6px}.order-title{display:flex;gap:8px;align-items:center}.order-title .heading{flex:1}.badge{font-size:12px;color:#176ac7;background:#edf3fa;padding:4px 6px;border-radius:4px}.target{justify-content:space-between;margin-top:8px}.result text{display:block;margin-bottom:8px}.select{font-size:12px;padding:0 8px}
</style>
