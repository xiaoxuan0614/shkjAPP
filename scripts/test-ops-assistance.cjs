const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript'),vue=require('vue'),sfc=require('vue/compiler-sfc')
const filename='src/pages/ops/components/preview/RepairAssistanceForm.vue'
const {descriptor}=sfc.parse(fs.readFileSync(filename,'utf8'),{filename})
const script=sfc.compileScript(descriptor,{id:'assistance-test'})
const calls=[],events=[]
let fail=false,exposed
const box={exports:{},uni:{showToast:()=>{}},require:name=>{
  if(name==='vue')return {...vue,onMounted:()=>{}}
  if(name==='@/service/repairOrder')return {repairOrderApi:{options:async(type,id)=>{
    calls.push([type,id]);if(fail)throw Error('failed')
    return type==='roles'?[{value:'role',label:'工程师'}]:Array.from({length:15},(_,i)=>({value:`u${i}`,label:`人员${i}`}))
  }}}
  if(name.endsWith('.vue'))return {}
  throw Error(name)
}}
vm.runInNewContext(ts.transpileModule(script.content,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,box)
async function main(){
  const page=box.exports.default.setup({excluded:[]},{expose:v=>exposed=v,emit:(...args)=>events.push(args)})
  await page.load(1);await page.toggle(page.users.value[0])
  assert.equal(calls[0][0],'internal');assert.equal(calls.length,1,'selection does not fetch participation roles')
  await page.load(2);await page.toggle(page.users.value[0])
  assert.equal(page.chosen.value.length,2);assert.equal(page.hasMore.value,false)
  const count=calls.length
  page.keyword.value='人员14';page.search()
  assert.equal(calls.length,count,'local filtering must not request full options again')
  assert.equal(page.users.value.length,1)
  page.reason.value='现场协助';exposed.submit()
  assert.equal(events[0][1][0].personType,'INTERNAL')
  assert.equal('roleId' in events[0][1][0],false)
  exposed.remove('u0');assert.equal(page.chosen.value.length,1)
  fail=true;await page.load();assert.equal(page.failed.value,true)
  fail=false;await page.load();assert.equal(page.failed.value,false)
  assert.equal(page.showPicker.value,false)
  await page.openPicker()
  const original=page.chosen.value.map(u=>u.id).join(',')
  page.toggleDraft(page.users.value[0])
  assert.equal(page.chosen.value.map(u=>u.id).join(','),original,'draft must not change confirmed selection')
  page.cancelPicker()
  assert.equal(page.chosen.value.map(u=>u.id).join(','),original,'cancel preserves selection')
  await page.openPicker();page.toggleDraft(page.users.value[0]);await page.confirmPicker()
  assert.equal(page.showPicker.value,false)
  assert.ok(page.chosen.value.some(u=>u.id==='u0'))
  page.changeType('INTERNAL')
  assert.ok(page.chosen.value.some(u=>u.id==='u0'),'same type must preserve choices')
  assert.ok(calls.every(([type])=>type!=='roles'),'no role option requests')
  assert.ok(!descriptor.template.content.includes('参与角色'))
  console.log('PASS collaboration without participation roles, multi-selection, filtering, partial-success removal, error retry')
}
main().catch(e=>{console.error(e);process.exitCode=1})
