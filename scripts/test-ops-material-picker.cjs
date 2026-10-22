const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict'), ts = require('typescript'), vue = require('vue')
const sfc = require('../node_modules/.pnpm/@vue+compiler-sfc@3.4.21/node_modules/@vue/compiler-sfc')
const calls = []
let formSetup
let fail = false
const box = { exports: {}, require: name => {
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
  const f=scope.run(()=>formSetup({repair:{raw:{materialLinks:[]}},type:'领料'},{expose:()=>{},emit:(...args)=>events.push(args)}))
  const items=Array.from({length:12},(_,i)=>({id:String(i),name:`物料${i}`,unit:'件',stock:10,brand:'品牌',spec:'规格'}))
  f.confirmMaterials(items);assert.equal(f.visibleLines.value.length,5);assert.equal(f.pageCount.value,3)
  f.lines.value[0].qty='2.5';f.page.value=3;assert.equal(f.visibleLines.value.length,2)
  f.lines.value[6].qty='0';f.submit();assert.equal(events.length,0);assert.equal(f.page.value,2);assert.equal(f.invalidId.value,'6')
  f.lines.value[6].qty='3';f.submit();assert.equal(events[0][1].length,12);assert.equal(events[0][1][0].qty,2.5)
  f.page.value=3;f.toggle('11');f.toggle('10');assert.equal(f.page.value,2)
  f.confirmMaterials(items);assert.equal(f.lines.value[0].qty,'2.5')
  scope.stop()
  console.log('PASS compact picked lines: 5 per page, all-page validation/submission, quantity retention, deletion page clamp')
  console.log('PASS 10-row server pagination, name query reset, cross-page selection, page select-all, last page and retry')
}
main().catch(e => { console.error(e); process.exitCode = 1 })
