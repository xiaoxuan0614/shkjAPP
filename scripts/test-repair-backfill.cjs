const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript'),dayjs=require('dayjs');
const source=fs.readFileSync('src/pages/ops/components/preview/OpsWorkflow.vue','utf8');
const fn=source.slice(source.indexOf('async function submitBackfillCheckout()'),source.indexOf('watch(() => [screen.value',source.indexOf('async function submitBackfillCheckout()')));
function setup(mode='success') {
 const r=value=>({value}),now=Date.now(),calls=[];
 const s={completionSubmitted:r(false),repairCompletionSubmitted:d=>d.completions?.length>0,dayjs,Date,String,Number,Error,submittedCount:0,reads:0,calls,showBackfillCheckout:r(true),submitting:r(false),mutationBlocked:r(false),screen:r('checkout'),currentLog:r({id:'r'}),workDetail:r({actions:{canEnd:true}}),workDraft:r({}),backfillCheckoutTime:r(now-10000),backfillCheckoutMin:r(now-60000),backfillCheckoutReason:r(' 忘记签退 '),backfillCheckoutError:r(''),isAssistantWork:r(false),checkoutNext:r('completion'),selectedId:r('o'),owner:r(true),terminal:r(false),selected:r({actions:{canOwnerApply:true,canViewRepairDetail:true}}),events:r([]),eventPage:1,eventTotal:r(1),showEvents:r(true),message:r(''),uni:{showToast:o=>calls.push(o.title)},go:v=>calls.push(v),openForm:v=>calls.push(v),refreshSelected:async()=>{}};
 s.repairOrderApi={detail:async()=>({completions:mode==='completed'?[{}]:[]}),clockCorrection:async data=>{s.submittedCount++;s.payload=data;if(mode==='uncertain')throw Object.assign(new Error('network'),{uncertain:true})},workDetail:async()=>{s.reads++;if(mode==='readFail'&&s.reads>1)throw new Error('network');return {recordId:'r',actions:{canEnd:true},recordStatus:mode==='already'||s.reads>1&&mode!=='pending'?'ENDED':'ACTIVE'}}};
 vm.createContext(s);vm.runInContext(ts.transpileModule(fn,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,s);return s;
}
(async()=>{
 const s=setup();await s.submitBackfillCheckout();assert.equal(s.payload.recordId,'r');assert.equal(s.payload.reason,'忘记签退');assert.match(s.payload.effectiveEndedAt,/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);assert.equal(s.payload.effectiveStartedAt,undefined);assert.equal(s.payload.location,undefined);assert.deepEqual(s.calls,['detail','补签退成功','completion']);assert.equal(s.submitting.value,false);
 for(const mode of ['pending','readFail','uncertain']){const x=setup(mode);await x.submitBackfillCheckout();assert.equal(x.mutationBlocked.value,true);assert.equal(x.calls.length,0);await x.submitBackfillCheckout();assert.equal(x.submittedCount,1);}
 const already=setup('already');await already.submitBackfillCheckout();assert.equal(already.submittedCount,0);
 for(const kind of ['reason','future','before','choice']){const x=setup();if(kind==='reason')x.backfillCheckoutReason.value=' ';if(kind==='future')x.backfillCheckoutTime.value=Date.now()+100000;if(kind==='before')x.backfillCheckoutTime.value=0;if(kind==='choice')x.checkoutNext.value='';await x.submitBackfillCheckout();assert.equal(x.submittedCount,0);assert.ok(x.backfillCheckoutError.value);}
 const assistant=setup();assistant.isAssistantWork.value=true;assistant.checkoutNext.value='';await assistant.submitBackfillCheckout();assert.equal(assistant.calls.includes('completion'),false);assert.equal(assistant.submittedCount,1);
 const completed=setup('completed');await completed.submitBackfillCheckout();assert.equal(completed.submittedCount,0);assert.match(completed.backfillCheckoutError.value,/已提交完工/);
 const local=setup();local.completionSubmitted.value=true;await local.submitBackfillCheckout();assert.equal(local.submittedCount,0);
 const duplicate=setup();await Promise.all([duplicate.submitBackfillCheckout(),duplicate.submitBackfillCheckout()]);assert.equal(duplicate.submittedCount,1);
 console.log('PASS repair backfill: payload, time/reason validation, no approval, ENDED readback, pending/network guard, duplicate guard, assistant and completion navigation');
})().catch(e=>{console.error(e);process.exitCode=1});
