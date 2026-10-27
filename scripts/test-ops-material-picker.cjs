const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict'), ts = require('typescript'), vue = require('vue')
const sfc = require('../node_modules/.pnpm/@vue+compiler-sfc@3.4.21/node_modules/@vue/compiler-sfc')
const calls = []
let formSetup
let fail = false
const accountCalls=[]
let accountTotal=24
let accountRows=[{materialId:'m',baseUnitId:'u',materialName:'电缆',baseUnitName:'米',availableReturnQty:3,remainingReturnQty:9},{materialId:'m',baseUnitId:'u2',materialName:'电缆',baseUnitName:'卷',availableReturnQty:2},{materialId:'zero',availableReturnQty:0,remainingReturnQty:5},{materialId:'missing',remainingReturnQty:8}]
const box = { exports: {}, require: name => {
  if (name === '@/service/repairOrder') return {repairOrderApi:{materialAccounts:async (...args)=>{accountCalls.push(args);if(fail)throw Error('offline');return {records:accountTotal===12?accountRows.slice((args[2]-1)*10,args[2]*10):accountRows,total:accountTotal}}}}
  if (name === 'dayjs') return { default: require('dayjs') }
  if (name === 'vue') return { ...vue, onMounted: () => {}, onBeforeUnmount: () => {} }
  if (name === '@/service/shkj') return { stockApi: { materials: async p => {
    calls.push(p); if (fail) throw Error('offline')
    const all=Array.from({length:21},(_,i)=>({id:String(i),name:`物料${i}`,spec:'型号',unit:'件',stock:0})).filter(m=>!p.materialName || m.name===p.materialName)
    return { result: { records: all.slice((p.pageNo-1)*p.pageSize,p.pageNo*p.pageSize), total:all.length } }
  } }, normalizeMaterial: m => m, unwrapRecords: r => r.result.records }
  if (name.endsWith('.vue')) return {}
  throw Error(name)
} }
for (const file of ['RepairMaterialPicker', 'RepairMaterialForm']) {
  const path = `src/pages/ops/components/preview/${file}.vue`
  const parsed = sfc.parse(fs.readFileSync(path, 'utf8'), { filename: path })
  const script = sfc.compileScript(parsed.descriptor, { id: file })
  assert.equal(sfc.compileTemplate({ source: parsed.descriptor.template.content, filename: path, id: file, compilerOptions: { bindingMetadata: script.bindings } }).errors.length, 0)
  if (file === 'RepairMaterialPicker') vm.runInNewContext(ts.transpileModule(script.content, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, box)
  else {
    const formBox = {...box,exports:{},uni:{showToast:()=>{}}}
    vm.runInNewContext(ts.transpileModule(script.content,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,formBox)
    formSetup = formBox.exports.default.setup
  }
}
async function main() {
  const scope = vue.effectScope()
  const originalRows=accountRows
  accountTotal=12;accountRows=Array.from({length:12},(_,i)=>({materialId:`auto-${i}`,baseUnitName:'件',availableReturnQty:i?2:0}))
  const auto=scope.run(()=>formSetup({repair:{id:'repair1',raw:{}},actorId:'me',type:'还料'},{expose(){},emit(){}}))
  await auto.loadReturnMaterials()
  assert.equal(auto.lines.value.length,11);assert.equal(auto.lines.value[0].qty,'2')
  assert.equal(auto.visibleLines.value.length,5);assert.equal(auto.pageCount.value,3)
  auto.page.value=3;assert.equal(auto.visibleLines.value.length,1)
  auto.lines.value[6].qty='1';auto.submit();assert.equal(auto.page.value,2,'invalid return on another page is revealed')
  auto.fillReturn(auto.lines.value[6]);assert.equal(auto.lines.value[6].qty,'2')
  auto.page.value=3;auto.toggle(auto.lines.value[10].id);assert.equal(auto.page.value,2)
  assert.equal(accountCalls.length,2);assert.equal(accountCalls[0].slice(0,4).join(','),'repair1,me,1,10')
  fail=true;await auto.loadReturnMaterials();assert.equal(auto.lines.value.length,0);assert.ok(auto.returnError.value)
  fail=false;await auto.loadReturnMaterials();assert.equal(auto.lines.value.length,11);assert.equal(auto.returnError.value,'')
  accountRows=originalRows;accountTotal=24;accountCalls.length=0
  const p = scope.run(() => box.exports.default.setup({ selected: [] }, { expose: () => {}, emit: () => {} }))
  await p.load()
  assert.equal(p.materials.value.length, 10)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].pageSize,10)
  assert.equal(Object.keys(calls[0]).sort().join(','), 'pageNo,pageSize')
  p.toggle(p.paged.value[0]); await p.load(2); p.togglePage()
  assert.equal(p.chosen.value.length, 11)
  p.togglePage(); assert.equal(p.chosen.value.length, 1)
  p.keyword.value = '物料20'; p.search(); await new Promise(setImmediate)
  assert.equal(p.page.value, 1); assert.equal(p.filtered.value.length, 1)
  p.toggle(p.paged.value[0]); assert.equal(p.chosen.value.length, 2)
  assert.equal(calls.at(-1).materialName,'物料20');assert.equal(calls.at(-1).pageNo,1)
  assert.equal(p.hasMore.value,false)
  fail = true; await p.load(); assert(p.failed.value); assert.equal(p.materials.value.length, 0)
  fail = false; await p.load(); assert(!p.failed.value); assert.equal(p.materials.value.length, 1)
  p.keyword.value='';p.search();await new Promise(setImmediate);await p.load(3)
  assert.equal(p.materials.value.length,1);assert.equal(p.hasMore.value,false)
  assert.equal(p.chosen.value.length,2)
  const events=[]
  const returnEvents=[]
  const returnForm=scope.run(()=>formSetup({repair:{raw:{}},type:'还料'},{expose:()=>{},emit:(...args)=>returnEvents.push(args)}))
  returnForm.confirmMaterials([{id:'return-m',materialId:'m',name:'电缆',unit:'米',availableReturnQty:3,remainingReturnQty:9}])
  assert.equal(returnForm.lines.value[0].qty,'3');assert.equal(returnForm.maximum('return-m'),3)
  returnForm.lines.value[0].qty='4';returnForm.submit();assert.equal(returnEvents.length,0,'remaining quantity must not permit return above available quantity')
  returnForm.lines.value[0].qty='3';returnForm.submit();assert.equal(returnEvents.length,1)
  assert.equal('unitPrice' in returnEvents[0][1][0],false)
  const formSource=fs.readFileSync('src/pages/ops/components/preview/RepairMaterialForm.vue','utf8')
  assert.equal(formSource.includes('还料单价'),false)
  assert.ok(formSource.includes("type === '还料' ? visibleLines"))
  const f=scope.run(()=>formSetup({repair:{raw:{materialLinks:[]}},type:'领料'},{expose:()=>{},emit:(...args)=>events.push(args)}))
  const items=Array.from({length:12},(_,i)=>({id:String(i),name:`物料${i}`,unit:'件',stock:10,brand:'品牌',spec:'规格'}))
  f.confirmMaterials(items);assert.equal(f.visibleLines.value.length,5);assert.equal(f.pageCount.value,3)
  f.lines.value[0].qty='2.5';f.page.value=3;assert.equal(f.visibleLines.value.length,2)
  f.lines.value[6].qty='0';f.submit();assert.equal(events.length,0);assert.equal(f.page.value,2);assert.equal(f.invalidId.value,'6')
  f.lines.value[6].qty='3';f.submit();assert.equal(events[0][1].length,12);assert.equal(events[0][1][0].qty,2.5)
  assert.equal(events[0][3],require('dayjs')().format('YYYY-MM-DD'))
  f.useDate.value='';f.submit();assert.equal(events.length,1)
  f.useDate.value='2026-02-30';f.submit();assert.equal(events.length,1)
  f.useDate.value='2026-10-28';f.submit();assert.equal(events[1][3],'2026-10-28')
  f.page.value=3;f.toggle('11');f.toggle('10');assert.equal(f.page.value,2)
  f.confirmMaterials(items);assert.equal(f.lines.value[0].qty,'2.5')
  const r=scope.run(()=>box.exports.default.setup({selected:[],returnMode:true,orderId:'order',handlerUserId:'me'},{expose(){},emit(){}}))
  await r.load(2)
  assert.deepEqual(accountCalls[0],['order','me',2,10,''])
  assert.equal(r.paged.value.length,2);assert.notEqual(r.paged.value[0].id,r.paged.value[1].id)
  assert.equal(r.paged.value[0].availableReturnQty,3);assert.equal(r.hasMore.value,true)
  r.togglePage();assert.equal(r.chosen.value.length,2)
  r.keyword.value='电缆';r.search();await new Promise(setImmediate)
  assert.deepEqual(accountCalls.at(-1),['order','me',1,10,'电缆'])
  const returned=[]
  const rf=scope.run(()=>formSetup({repair:{id:'order'},actorId:'me',type:'还料'},{expose(){},emit:(...args)=>returned.push(args)}))
  rf.confirmMaterials(r.paged.value);assert.equal(rf.lines.value[0].qty,'3');assert.equal(rf.maximum(rf.lines.value[0].id),3)
  rf.lines.value[0].qty='4';rf.submit();assert.equal(returned.length,0)
  rf.lines.value[0].qty='1';rf.submit();assert.equal(returned.length,0)
  rf.lines.value[0].reason='部分退回';rf.submit();assert.equal(returned.length,1)
  assert.equal(returned[0][1][0].material.materialId,'m')
  accountRows=[{...accountRows[0],availableReturnQty:0}];await r.load();assert.equal(r.chosen.value.length,1,'refreshed exhausted item removed without losing other-page selections')
  fail=true;await r.load();assert.equal(r.failed.value,true);fail=false
  scope.stop()
  console.log('PASS compact picked lines: 5 per page, all-page validation/submission, quantity retention, deletion page clamp')
  console.log('PASS 10-row server pagination, name query reset, cross-page selection, page select-all, last page and retry')
}
main().catch(e => { console.error(e); process.exitCode = 1 })
