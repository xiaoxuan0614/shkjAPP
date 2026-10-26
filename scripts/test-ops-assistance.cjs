const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript'),vue=require('vue'),sfc=require('vue/compiler-sfc')
const compile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const calls=[],events=[];let fail=false,exposed
const service={exports:{},require:()=>({http:{get:async (path,params)=>{
  calls.push(path);assert.equal(params.type,'collaborationDepartments');if(fail)throw Error('failed')
  return {success:true,code:200,result:[{value:'root',label:'公司'},...Array.from({length:15},(_,i)=>({value:`d${i}`,label:`部门${i}`}))]}
}}})}
vm.runInNewContext(compile(fs.readFileSync('src/service/repairCollaboration.ts','utf8')),service)
const filename='src/pages/ops/components/preview/RepairAssistanceForm.vue'
const {descriptor}=sfc.parse(fs.readFileSync(filename,'utf8'),{filename})
const script=sfc.compileScript(descriptor,{id:'assistance-test'})
assert.equal(sfc.compileTemplate({source:descriptor.template.content,filename,id:'assistance-test'}).errors.length,0)
const box={exports:{},uni:{showToast:()=>{}},require:name=>{
  if(name==='vue')return {...vue,onBeforeUnmount:()=>{}}
  if(name==='@/service/repairCollaboration')return service.exports
  if(name==='@/service/repairOrder')return {repairOrderApi:{options:async type=>{calls.push(type);return [{value:'vendor',label:'外协单位'}]}}}
  if(name.endsWith('.vue'))return {}
  throw Error(name)
}}
vm.runInNewContext(compile(script.content),box)
async function main(){
  const initial={personType:'INTERNAL',departments:[{departmentId:'d0',reason:'原协助原因'}],departmentNames:{d0:'技术部'}}
  const editing=box.exports.default.setup({initial},{expose:()=>{},emit:()=>{}})
  assert.equal(editing.chosen.value[0].name,'技术部');assert.equal(editing.departmentReasons.value.d0,'原协助原因')
  editing.departmentReasons.value.d0='新原因';assert.equal(initial.departments[0].reason,'原协助原因','prefill is editable without mutating history')
  const page=box.exports.default.setup({},{expose:v=>exposed=v,emit:(...args)=>events.push(args)})
  await page.openPicker();assert.equal(calls[0],'/repair/options')
  page.toggleDraft(page.users.value[0]);page.toggleDraft(page.users.value[1]);page.confirmPicker()
  assert.equal(page.chosen.value.length,2);assert.equal(page.chosen.value[1].id,'d0')
  await page.openPicker();await page.load(2);page.toggleDraft(page.users.value[0]);page.cancelPicker()
  assert.equal(page.chosen.value[1].id,'d0','cancel preserves departments')
  page.keyword.value='部门14';page.search();assert.equal(page.users.value.length,1)
  exposed.submit();assert.equal(events.length,0,'each department requires a reason')
  page.departmentReasons.value={root:'协调支持',d0:'现场协助'};exposed.submit()
  assert.equal(events[0][1].departments.length,2);assert.equal(events[0][1].departments[1].departmentId,'d0');assert.equal('userIds' in events[0][1],false)
  await page.openPicker();page.toggleDraft({id:'d1',name:'部门1'});page.confirmPicker()
  assert.equal(page.departmentReasons.value.d0,'现场协助','reselection retains reasons')
  page.removeDepartment('d1');exposed.submit();assert.equal(events.length,2)
  fail=true;await page.load();assert.equal(page.failed.value,true)
  fail=false;await page.load();assert.equal(page.failed.value,false)
  page.changeType('EXTERNAL');assert.equal(page.chosen.value.length,0)
  await page.openPicker();page.toggleDraft(page.users.value[0]);page.confirmPicker()
  page.reason.value='外协支持';exposed.submit();assert.equal(events.length,2)
  page.headcount.value='1.5';page.hoursPerPerson.value='8';exposed.submit();assert.equal(events.length,2)
  page.headcount.value='2';exposed.submit();assert.equal(events.length,3);assert.equal(page.totalHours.value,16)
  assert.equal(events[2][1].headcount,2);assert.equal(events[2][1].hoursPerPerson,8)
  page.changeType('INTERNAL');assert.equal(page.chosen.value.length,2);assert.equal(page.departmentReasons.value.d0,'现场协助')
  assert.match(service.exports.validateCollaborationDraft({personType:'INTERNAL',departments:[{departmentId:'a',reason:'x'},{departmentId:'a',reason:'y'}]}),/重复/)
  assert.ok(!calls.includes('collaborationMembers'))
  console.log('PASS multiple departments with separate reasons, single company, cancel, validation, type switching and Vue compilation')
}
main().catch(e=>{console.error(e);process.exitCode=1})
