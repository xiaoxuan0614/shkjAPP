const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict'), ts = require('typescript'), vue = require('vue')
const sfc = require('../node_modules/.pnpm/@vue+compiler-sfc@3.4.21/node_modules/@vue/compiler-sfc')
const calls = []
let fail = false
const box = { exports: {}, require: name => {
  if (name === 'vue') return { ...vue, onMounted: () => {}, onBeforeUnmount: () => {} }
  if (name === '@/service/shkj') return { stockApi: { materials: async p => {
    calls.push(p); if (fail) throw Error('offline')
    return { result: { records: Array.from({ length: p.pageNo === 1 ? 1000 : 1 }, (_, i) => ({ id: String((p.pageNo - 1) * 1000 + i), name: `物料${(p.pageNo - 1) * 1000 + i}`, spec: '型号', unit: '件', stock: 0 })), total: 1001 } }
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
}
async function main() {
  const scope = vue.effectScope()
  const p = scope.run(() => box.exports.default.setup({ selected: [] }, { expose: () => {}, emit: () => {} }))
  await p.load()
  assert.equal(p.materials.value.length, 1001)
  assert.equal(calls.length, 2)
  assert.equal(Object.keys(calls[0]).sort().join(','), 'pageNo,pageSize')
  p.toggle(p.paged.value[0]); p.page.value = 2; p.togglePage()
  assert.equal(p.chosen.value.length, 11)
  p.togglePage(); assert.equal(p.chosen.value.length, 1)
  p.keyword.value = '物料1000'; await vue.nextTick()
  assert.equal(p.page.value, 1); assert.equal(p.filtered.value.length, 1)
  p.toggle(p.paged.value[0]); assert.equal(p.chosen.value.length, 2)
  fail = true; await p.load(); assert(p.failed.value); assert.equal(p.materials.value.length, 0)
  fail = false; await p.load(); assert(!p.failed.value); assert.equal(p.materials.value.length, 1001)
  scope.stop()
  console.log('PASS full directory beyond 1000 rows, no project filter, local search, pagination, cross-page selection, page select-all and retry')
}
main().catch(e => { console.error(e); process.exitCode = 1 })
