<template>
  <view class="additional-form">
    <SectionCard :title="repairActionTitles[kind]">
      <text class="context">{{ detail.order.projectName || detail.order.projectNameSnapshot }} · {{ detail.order.orderNo }}</text>
      <text class="hint">{{ notices[kind] }}</text>
      <wd-select-picker v-if="targetChoices.length || targetKinds.includes(kind)" v-model="form.targetId" :columns="targetChoices" type="radio" filterable :z-index="999" label="办理记录" placeholder="点击选择记录" :disabled="disabled" />
      <text v-if="targetKinds.includes(kind) && !targetChoices.length" class="hint">暂无可办理记录，请返回刷新。</text>
      <template v-if="kind === 'contact'">
        <view v-for="field in contactFields" :key="field.key" class="field"><label :for="field.key">{{ field.label }}<text class="required"> *</text></label><input :id="field.key" v-model="form[field.key]" :maxlength="field.max" :disabled="disabled" class="input" :placeholder="`请输入${field.label}`" /></view>
      </template>
      <template v-if="kind === 'confirmUse'">
        <view class="choices"><button :class="{on:form.confirm===true}" :disabled="disabled" @click="form.confirm=true">确认使用</button><button :class="{on:form.confirm===false}" :disabled="disabled" @click="form.confirm=false">作废记录</button></view>
      </template>
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
      <view v-if="kind!=='evaluation' && !(kind==='confirmUse' && form.confirm===true)" class="field"><label for="additional-reason">{{ kind==='writeoff'?'核销申请说明':'原因说明' }}<text class="required"> *</text></label><textarea id="additional-reason" v-model="form.reason" class="textarea" :maxlength="kind==='contact'?1000:10000" :disabled="disabled" placeholder="请说明本次操作的原因" /></view>
    </SectionCard>
    <SectionCard v-if="kind==='writeoff'" title="核销明细">
      <view v-for="(item,index) in form.items" :key="item.key" class="writeoff-line">
        <view class="line-heading"><text>物料 {{ index+1 }}</text><button :disabled="disabled" @click="form.items.splice(index,1)">移除</button></view>
        <wd-select-picker v-model="item.pickLinkId" :columns="pickChoices" type="radio" filterable label="领料来源" :z-index="999" :disabled="disabled" placeholder="请选择本人原领料明细" />
        <wd-select-picker v-model="item.writeoffType" :columns="[{value:'DAMAGE',label:'损坏'},{value:'LOSS',label:'遗失'}]" type="radio" label="核销类型" :z-index="999" :disabled="disabled" placeholder="请选择类型" />
        <view class="field"><label :for="`qty-${index}`">数量<text class="required"> *</text></label><input :id="`qty-${index}`" v-model="item.quantity" type="digit" class="input" :disabled="disabled" placeholder="大于 0，最多 4 位小数" /></view>
        <view class="field"><label :for="`reason-${index}`">明细原因<text class="required"> *</text></label><textarea :id="`reason-${index}`" v-model="item.reason" class="textarea" maxlength="10000" :disabled="disabled" placeholder="说明损坏或遗失情况" /></view>
      </view>
      <button class="add-line" :disabled="disabled" @click="addLine">添加核销物料</button>
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
const now=Date.now(), form=reactive<Record<string,any>>({targetId:'',reason:'',serviceAddress:props.detail.order.serviceAddress||'',contactPerson:props.detail.order.contactPerson||'',contactPhone:props.detail.order.contactPhone||'',confirm:null,startedAt:null,endedAt:null,items:[],opinion:''})
const photos=ref<string[]>([]),videos=ref<string[]>([]),error=ref('')
const candidates=computed(()=>additionalCandidates(props.detail,props.actorId))
const targetKinds=['confirmUse','closeRemainder','withdraw','memberExit','clockCorrection']
const attachmentKinds=['writeoff','clockCorrection','missingClock']
const contactFields=[{key:'serviceAddress',label:'服务地址',max:500},{key:'contactPerson',label:'联系人',max:100},{key:'contactPhone',label:'联系电话',max:50}]
const scoreFields=[{key:'serviceAttitudeScore',label:'服务态度'},{key:'repairQualityScore',label:'维修质量'},{key:'responseEfficiencyScore',label:'响应效率'}]
const scoreOptions=[1,2,3,4,5].map(value=>({value,label:`${value} 分`}))
const missingSelects=[{key:'activityKind',label:'作业阶段',options:[{value:'INITIAL_INSPECTION',label:'首次检查'},{value:'REPAIR',label:'实际维修'},{value:'REWORK',label:'复修'}]},{key:'repairMethod',label:'维修方式',options:[{value:'ONLINE',label:'线上'},{value:'OFFLINE',label:'线下'},{value:'INSPECTION',label:'检修'}]},{key:'repairResult',label:'本次结果',options:[{value:'REPAIRED',label:'已修复'},{value:'NEEDS_REWORK',label:'需要复修'}]}]
const missingTexts=[{key:'faultLocation',label:'故障位置'},{key:'faultDescription',label:'故障描述'},{key:'repairDescription',label:'维修内容'}]
const notices:Record<RepairAdditionalKind,string>={contact:'只修改本维修单联系资料，不回写项目。',confirmUse:'核对实际用料后确认；作废必须说明原因。本操作不执行仓库出库。',writeoff:'仅申请本人原领料的损坏或遗失核销，审批生效后才计入结清；可用余额由后端核验。',closeRemainder:'终止所选库存申请尚未执行的余量，不代替已出库物料的实际退库。',withdraw:'仅撤回本人尚在审批中的申请，原审批历史保留。',memberExit:'移出后停止新增协作资格，历史记录保留；在途作业及物料结清由后端核验。',clockCorrection:'针对本人已有作业申请时间修正，审批生效后才更新有效工时。',missingClock:'仅用于定位失败的缺卡作业登记，不等同于正常签到。登记后需按返回作业记录申请补卡时间审批。',evaluation:'请按客户实际反馈评分。提交后只读，不能重复修改。'}
function materialName(link:any) { return link.material?.materialName || link.material?.name || link.materialId || link.id }
const pickChoices=computed(()=>candidates.value.picks.map((p:any,i:number)=>({value:p.id,label:`${materialName(p)} · 领料明细 ${i+1}`})))
const targetChoices=computed(()=>{
  const c=candidates.value
  if(props.kind==='withdraw') return c.applications.map((r:any)=>({value:r.id,label:`${r.applicationNo || r.id} · ${r.reason || '审批中申请'}`}))
  if(props.kind==='memberExit') return c.members.map((r:any)=>({value:r.id,label:`${r.userNameSnapshot || r.sourcePersonId || r.id} · ${r.roleNameSnapshot || (r.personType==='EXTERNAL'?'外协':'内协')}`}))
  if(props.kind==='clockCorrection') return c.records.map((r:any)=>({value:r.id,label:`${String(r.rawStartedAt || r.createTime || '').replace('T',' ').slice(0,19)} · ${r.recordStatus==='ACTIVE'?'未签退':r.recordStatus==='PENDING_CORRECTION'?'待补卡':'已签退'}`}))
  if(props.kind==='closeRemainder') return c.stockApplies.map((r:any)=>({value:r.stockApplyId,label:`${materialName(r)} · 库存申请 ${r.stockApplyId}`}))
  if(props.kind==='confirmUse') return c.uses.map((r:any)=>({value:r.id,label:`${materialName(props.detail.materialLinks?.find((l:any)=>l.id===r.pickLinkId)||r)} · ${r.usedQuantity} · ${r.useDescription || '待确认'}`}))
  return []
})
watch(()=>form.targetId,id=>{if(props.kind==='clockCorrection'){const r=candidates.value.records.find((r:any)=>r.id===id);const start=Date.parse(r?.effectiveStartedAt || r?.rawStartedAt || '');const end=Date.parse(r?.effectiveEndedAt || r?.rawEndedAt || '');form.startedAt=Number.isFinite(start)?start:null;form.endedAt=Number.isFinite(end)?end:null}})
let rowKey=0
function addLine(){form.items.push({key:++rowKey,pickLinkId:'',writeoffType:'',quantity:'',reason:''})}
if(props.kind==='writeoff') addLine()
function submit(){if(props.disabled)return;error.value='';try {const paths=[...photos.value,...videos.value];const payload=additionalPayload(props.kind,props.detail,props.actorId,form,paths.map((_,i)=>`pending-upload-${i}`));emit('submit',payload,paths)}catch(e:any){error.value=e.message}}
defineExpose({submit})
</script>
<style scoped>
.context { display:block; font-size:16px; line-height:1.6; color:#303133; overflow-wrap:anywhere; }
.hint { display:block; margin:10px 0 20px; font-size:14px; line-height:1.65; color:#536176; }
.field { margin-top:24px; }
.field label { display:block; margin-bottom:10px; font-size:16px; color:#344054; }
.input,.textarea { width:100%; box-sizing:border-box; border:1px solid #d5dce5; border-radius:8px; background:#f8fafc; padding:12px; font-size:16px; line-height:1.6; }
.input { min-height:48px; }.textarea { height:120px; }
.choices { display:flex; gap:12px; margin-top:20px; }.choices button { flex:1; font-size:16px; }.choices .on { color:#176ac7; background:#eaf4ff; }
.writeoff-line { padding:16px 0 24px; border-bottom:1px solid #edf0f3; }.line-heading { display:flex; align-items:center; justify-content:space-between; font-size:16px; }.line-heading button { margin:0; font-size:14px; color:#b42318; }
.add-line { margin-top:20px; color:#176ac7; font-size:16px; }.required,.error { color:#b42318; }.error { display:block; margin:16px; font-size:15px; line-height:1.6; }
</style>
