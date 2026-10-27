const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript'),vue=require('vue'),sfc=require('vue/compiler-sfc')
const filename='src/pages/ops/materialReturn.vue'
const {descriptor}=sfc.parse(fs.readFileSync(filename,'utf8'),{filename})
const script=sfc.compileScript(descriptor,{id:'return-autofill'})
assert.equal(sfc.compileTemplate({source:descriptor.template.content,filename,id:'return-autofill'}).errors.length,0)
let fetch,calls=[]
const box={exports:{},require:name=>{
  if(name==='vue')return vue
  if(name==='@dcloudio/uni-app')return {onLoad(){}}
  if(name==='wot-design-uni')return {useToast:()=>({})}
  if(name==='@/service/materialReturnAccess')return {canReturnAtStage:()=>true}
  if(name==='@/service/shkj')return {projectApi:{materialAccounts:async(id,p)=>{calls.push([id,p]);return fetch(id,p)}},formatProjectName:()=>'',stockApi:{}}
  if(name.endsWith('.vue'))return {}
  throw Error(name)
}}
vm.runInNewContext(ts.transpileModule(script.content,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,box)
const page=box.exports.default.setup({},{expose(){}})
const row=(id,qty=2)=>({materialId:String(id),materialName:'物料'+id,baseUnitName:'件',remainingReturnQty:qty})
;(async()=>{
  fetch=async(_,p)=>({result:{records:p.pageNo===1?Array.from({length:100},(_,i)=>row(i,i===0?0:2)):[row(100,3.5)],total:101}})
  await page.selectProject({periodId:'p1'})
  assert.equal(calls.length,2);assert.equal(calls[0][0],'p1');assert.equal(page.items.value.length,100)
  assert.equal(page.visibleItems.value.length,10);assert.equal(page.items.value.at(-1).returnQty,'3.5')
  page.items.value[0].returnQty='1';page.materialPage.value=3
  fetch=async()=>({result:{records:[row('new',4)],total:1}})
  await page.selectProject({periodId:'p1'});assert.equal(page.items.value[0].materialId,'new');assert.equal(page.materialPage.value,1)
  let resolveOld
  fetch=(id)=>id==='old'?new Promise(r=>resolveOld=r):Promise.resolve({result:{records:[row('current')],total:1}})
  const pending=page.selectProject({periodId:'old'});await page.selectProject({periodId:'current'})
  resolveOld({result:{records:[row('stale')],total:1}});await pending
  assert.equal(page.items.value[0].materialId,'current','stale project must not overwrite selected project')
  fetch=async()=>{throw Error('offline')};await page.selectProject({periodId:'failed'})
  assert.equal(page.items.value.length,0);assert.equal(page.materialsError.value,true)
  console.log('PASS project return autofill: all pages, default quantities, reselect refresh, stale requests and failure')
})().catch(e=>{console.error(e);process.exitCode=1})
