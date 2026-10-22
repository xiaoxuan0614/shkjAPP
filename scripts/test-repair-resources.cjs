const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),vue=require('vue'),sfc=require('vue/compiler-sfc'),ts=require('typescript')
const filename='src/pages/ops/components/preview/RepairWorkResources.vue'
const {descriptor}=sfc.parse(fs.readFileSync(filename,'utf8'),{filename})
const script=sfc.compileScript(descriptor,{id:'resources'})
assert.equal(sfc.compileTemplate({source:descriptor.template.content,filename,id:'resources'}).errors.length,0)
const calls=[],events=[]
let fail=true
const detail={order:{id:'o'},materialLinks:[{id:'pick-link',stockApplyItemId:'stock-item',handlerUserId:'me',linkType:'PICK'},{id:'other',handlerUserId:'other',linkType:'PICK'}],materialUses:[]}
const api={materialUse:async p=>{calls.push(p);if(fail)throw Error('网络失败')},detail:async()=>detail}
const box={exports:{},require:n=>n==='vue'?vue:n==='@/service/repairOrder'?{repairOrderApi:api}:{}}
vm.runInNewContext(ts.transpileModule(script.content,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,box)
const page=box.exports.default.setup({detail,recordId:'r',actorId:'me',disabled:false},{expose:()=>{},emit:(...e)=>events.push(e)})
;(async()=>{
assert.equal(page.sources.value.length,1)
page.pickId.value='pick-link';page.description.value='安装使用'
for(const q of ['0','-1','1.00001','Infinity','']) {page.quantity.value=q;await page.submit()}
assert.equal(calls.length,0)
page.quantity.value='1.25';await page.submit()
assert.equal(page.quantity.value,'1.25')
fail=false;await page.submit()
assert.equal(calls.length,1,'uncertain writes must not be retried')
assert.equal(calls[0].requestId,undefined)
assert.equal(calls[0].pickLinkId,'pick-link');assert.equal(calls[0].workRecordId,'r')
const fresh=box.exports.default.setup({detail,recordId:'r',actorId:'me',disabled:false},{expose:()=>{},emit:(...e)=>events.push(e)})
fresh.pickId.value='pick-link';fresh.quantity.value='1';fresh.description.value='使用'
api.detail=async()=>{throw Error('refresh failed')}
await fresh.submit();assert.equal(calls.length,2);assert.equal(fresh.refreshOnly.value,true)
api.detail=async()=>detail
await fresh.submit();assert.equal(calls.length,2,'refresh must not POST again')
assert.equal(fresh.quantity.value,'');assert.ok(events.some(e=>e[0]==='updated'))
console.log('PASS resource schema, actor scope, quantity validation, uncertain-write blocking and refresh-only retry')
const detailFile='src/pages/ops/components/preview/RepairLogResources.vue'
const d=sfc.parse(fs.readFileSync(detailFile,'utf8'),{filename:detailFile}).descriptor
assert.equal(sfc.compileTemplate({source:d.template.content,filename:detailFile,id:'detail'}).errors.length,0)
const b={exports:{},require:()=>vue}
vm.runInNewContext(ts.transpileModule(sfc.compileScript(d,{id:'detail'}).content,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,b)
const view=b.exports.default.setup({recordId:'r1',detail:{workRecords:[{id:'r1',vehicleValue:'car1'},{id:'r2',vehicleValue:'car2'}],workPersons:[{id:'p1',workRecordId:'r1'},{id:'p2',workRecordId:'r2'}],materialUses:[{id:'u1',workRecordId:'r1'},{id:'u2',workRecordId:'r2'}]}},{expose:()=>{}})
assert.equal(view.persons.value.length,1);assert.equal(view.persons.value[0].id,'p1')
assert.equal(view.uses.value.length,1);assert.equal(view.uses.value[0].id,'u1')
assert.equal(view.record.value.vehicleValue,'car1')
console.log('PASS log detail resources are isolated by workRecordId')
})().catch(e=>{console.error(e);process.exitCode=1})
