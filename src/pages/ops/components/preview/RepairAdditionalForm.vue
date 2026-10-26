<template>
  <view class="additional-form">
    <SectionCard :title="repairActionTitles[kind]">
      <text class="context">{{ detail.order.projectName || detail.order.projectNameSnapshot }} · {{ detail.order.orderNo }}</text>
      <text class="hint">{{ notices[kind] }}</text>
      <wd-select-picker v-if="targetChoices.length || targetKinds.includes(kind)" v-model="form.targetId" :columns="targetChoices" type="radio" filterable :z-index="999" label="办理记录" placeholder="点击选择记录" :disabled="disabled" />
      <text v-if="targetKinds.includes(kind) && !targetChoices.length" class="hint">暂无可办理记录，请返回刷新。</text>
      <template v-if="kind === 'clockCorrection'">
        <view class="field"><label>实际开始时间<text class="required"> *</text></label><wd-datetime-picker v-model="form.startedAt" type="datetime" use-second :max-date="now" :z-index="999" :disabled="disabled" /></view>
        <view class="field"><label>实际结束时间<text class="required"> *</text></label><wd-datetime-picker v-model="form.endedAt" type="datetime" use-second :max-date="now" :z-index="999" :disabled="disabled" /></view>
      </template>
      <template v-if="kind === 'missingClock'">
        <view v-for="field in missingSelects" :key="field.key" class="field"><label>{{ field.label }}<text class="required"> *</text></label><wd-select-picker v-model="form[field.key]" :columns="field.options" type="radio" :z-index="999" :disabled="disabled" :placeholder="`请选择${field.label}`" /></view>
        <view v-for="field in missingTexts" :key="field.key" class="field"><label :for="field.key">{{ field.label }}<text class="required"> *</text></label><textarea :id="field.key" v-model="form[field.key]" :maxlength="field.key==='faultLocation'?500:10000" :disabled="disabled" class="textarea" :placeholder="`请填写${field.label}`" /></view>
      </template>
      <template v-if="kind === 'evaluation'">
        <view v-for="field in scoreFields" :key="field.key" class="field"><label>{{ field.label }}<text class="required"> *</text></label><wd-select-picker v-model="form[field.key]" :columns="scoreOptions" type="radio" :z-index="999" :disabled="disabled" placeholder="请选择评分，不默认满分" /></view>
        <view class="field"><label for="evaluation-opinion">客户反馈（选填）</label><textarea id="evaluation-opinion" v-model="form.opinion" class="textarea" maxlength="10000" :disabled="disabled" placeholder="记录实际回访意见" /></view>
      </template>
      <view v-if="kind!=='evaluation'" class="field"><label for="additional-reason">原因说明<text class="required"> *</text></label><textarea id="additional-reason" v-model="form.reason" class="textarea" maxlength="10000" :disabled="disabled" placeholder="请说明本次操作的原因" /></view>
    </SectionCard>
    <SectionCard v-if="attachmentKinds.includes(kind)" :title="kind==='missingClock'?'维修照片 / 视频':'证明附件（选填）'"><ReportAttachments v-model:photos="photos" v-model:videos="videos" compact @busy="$emit('busy',$event)" /></SectionCard>
    <text v-if="error" class="error" role="alert">{{ error }}</text>
  </view>
</template>
<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import SectionCard from '@/components/SectionCard/SectionCard.vue'
import ReportAttachments from './ReportAttachments.vue'
import { additionalCandidates, additionalPayload, repairActionTitles, type RepairAdditionalKind } from '@/service/repairAdditional'
const props=defineProps<{kind:RepairAdditionalKind;detail:Record<string,any>;actorId:string;disabled:boolean}>()
const emit=defineEmits<{submit:[payload:Record<string,any>,paths:string[]];busy:[value:boolean]}>()
const now=Date.now(), form=reactive<Record<string,any>>({targetId:'',reason:'',startedAt:null,endedAt:null,opinion:''})
const photos=ref<string[]>([]),videos=ref<string[]>([]),error=ref('')
const candidates=computed(()=>additionalCandidates(props.detail,props.actorId))
const targetKinds=['withdraw','memberExit','clockCorrection']
const attachmentKinds=['clockCorrection','missingClock']
const scoreFields=[{key:'serviceAttitudeScore',label:'服务态度'},{key:'repairQualityScore',label:'维修质量'},{key:'responseEfficiencyScore',label:'响应效率'}]
const scoreOptions=[1,2,3,4,5].map(value=>({value,label:`${value} 分`}))
const missingSelects=[{key:'activityKind',label:'作业阶段',options:[{value:'INITIAL_INSPECTION',label:'首次检查'},{value:'REPAIR',label:'实际维修'},{value:'REWORK',label:'复修'}]},{key:'repairMethod',label:'维修方式',options:[{value:'ONLINE',label:'线上'},{value:'OFFLINE',label:'线下'},{value:'INSPECTION',label:'检修'}]},{key:'repairResult',label:'本次结果',options:[{value:'REPAIRED',label:'已修复'},{value:'NEEDS_REWORK',label:'需要复修'}]}]
const missingTexts=[{key:'faultLocation',label:'故障位置'},{key:'faultDescription',label:'故障描述'},{key:'repairDescription',label:'维修内容'}]
const notices:Record<RepairAdditionalKind,string>={withdraw:'仅撤回本人尚在审批中的申请，原审批历史保留。',memberExit:'移出后停止新增协作资格，历史记录保留；在途作业及物料结清由后端核验。',clockCorrection:'针对本人已有作业申请时间修正，审批生效后才更新有效工时。',missingClock:'仅用于定位失败的缺卡作业登记，不等同于正常签到。登记后需按返回作业记录申请补卡时间审批。',evaluation:'请按客户实际反馈评分。提交后只读，不能重复修改。'}
const targetChoices=computed(()=>{
  const c=candidates.value
  if(props.kind==='withdraw') return c.applications.map((r:any)=>({value:r.id,label:`${r.applicationNo || r.id} · ${r.reason || '审批中申请'}`}))
  if(props.kind==='memberExit') return c.members.map((r:any)=>({value:r.id,label:`${r.userNameSnapshot || r.sourcePersonId || r.id} · ${r.roleNameSnapshot || (r.personType==='EXTERNAL'?'外协':'内协')}`}))
  if(props.kind==='clockCorrection') return c.records.map((r:any)=>({value:r.id,label:`${String(r.rawStartedAt || r.createTime || '').replace('T',' ').slice(0,19)} · ${r.recordStatus==='ACTIVE'?'未签退':r.recordStatus==='PENDING_CORRECTION'?'待补卡':'已签退'}`}))
  return []
})
watch(()=>form.targetId,id=>{if(props.kind==='clockCorrection'){const r=candidates.value.records.find((r:any)=>r.id===id);const start=Date.parse(r?.effectiveStartedAt || r?.rawStartedAt || '');const end=Date.parse(r?.effectiveEndedAt || r?.rawEndedAt || '');form.startedAt=Number.isFinite(start)?start:null;form.endedAt=Number.isFinite(end)?end:null}})
function submit(){if(props.disabled)return;error.value='';try {const paths=[...photos.value,...videos.value];const payload=additionalPayload(props.kind,props.detail,props.actorId,form,paths.map((_,i)=>`pending-upload-${i}`));emit('submit',payload,paths)}catch(e:any){error.value=e.message}}
defineExpose({submit})
</script>
<style scoped>
.context { display:block; font-size:16px; line-height:1.6; color:#303133; overflow-wrap:anywhere; }
.hint { display:block; margin:10px 0 20px; font-size:14px; line-height:1.65; color:#536176; }
.field { margin-top:24px; }
.field label { display:block; margin-bottom:10px; font-size:16px; color:#344054; }
.textarea { width:100%; box-sizing:border-box; border:1px solid #d5dce5; border-radius:8px; background:#f8fafc; padding:12px; font-size:16px; line-height:1.6; }
.textarea { height:120px; }
.required,.error { color:#b42318; }.error { display:block; margin:16px; font-size:15px; line-height:1.6; }
</style>
