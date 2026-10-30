const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const source=fs.readFileSync('src/pages/ops/components/preview/OpsWorkflow.vue','utf8');
const fn=source.slice(source.indexOf('async function saveLog('),source.indexOf('async function endWork('));
function setup(){
 const r=value=>({value}),sent=[];
 const s={resourceBusy:r(false),isAssistantWork:r(true),logPage:r(0),scrollToTop(){},currentLog:r({id:'r',description:'本次维修',fault:'',photos:['photo'],videos:[],fileIds:[],persons:[{invalid:true}],materialItems:[{invalid:true}],vehicleValue:'旧车'}),workDetail:r({recordId:'r',formStatus:'DRAFT',actions:{canSubmit:true,canSaveDraft:true,canUpdate:true}}),recordFiles:()=>[],files:async paths=>paths.map(p=>'uploaded/'+p),selectedId:r('o'),repairOrderApi:{submitWork:async p=>sent.push({type:'submit',p}),saveDraft:async p=>sent.push({type:'draft',p}),updateWork:async p=>sent.push({type:'update',p})},sent};
 vm.createContext(s);vm.runInContext(ts.transpileModule(fn,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,s);return s;
}
(async()=>{
 const s=setup();await s.saveLog();assert.deepEqual(Object.keys(s.sent[0].p).sort(),['fileIds','orderId','recordId','repairDescription']);assert.equal(s.sent[0].p.fileIds[0],'uploaded/photo');
 s.currentLog.value.photos=[];await assert.rejects(s.saveLog(),/照片/);await s.saveLog(true);assert.equal(s.sent[1].type,'draft');
 s.currentLog.value.videos=['video'];s.workDetail.value.formStatus='SUBMITTED';await assert.rejects(s.saveLog(),/已提交，不可修改/);await assert.rejects(s.saveLog(true),/已提交，不可修改/);assert.equal(s.sent.length,2);s.workDetail.value.formStatus='DRAFT';
 s.currentLog.value.description=' ';await assert.rejects(s.saveLog(),/维修内容/);
 s.currentLog.value.description='修理';s.currentLog.value.photos=Array(7).fill('photo');await assert.rejects(s.saveLog(),/最多/);
 s.workDetail.value.actions.canSubmit=false;await assert.rejects(s.saveLog(),/不可执行/);
 console.log('PASS assistant log: content/media only, no hidden resources validation/payload, draft/submit and submitted read-only, media limits and permissions');
})().catch(e=>{console.error(e);process.exitCode=1});
