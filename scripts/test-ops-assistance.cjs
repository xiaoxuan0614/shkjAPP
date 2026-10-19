const fs = require('node:fs')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const ts = require('typescript')
const vue = require('vue')
const sfc = require('../node_modules/.pnpm/@vue+compiler-sfc@3.4.21/node_modules/@vue/compiler-sfc')
const path = 'src/pages/ops/components/preview/RepairAssistanceForm.vue'
const parsed = sfc.parse(fs.readFileSync(path, 'utf8'), { filename: path })
const script = sfc.compileScript(parsed.descriptor, { id: 'assistance-test' })
assert.equal(sfc.compileTemplate({ source: parsed.descriptor.template.content, filename: path, id: 'assistance-test', compilerOptions: { bindingMetadata: script.bindings } }).errors.length, 0)
const calls = [], events = []
let fail = false
const box = { exports: {}, require: name => {
  if (name === 'vue') return { ...vue, onMounted: () => {} }
  if (name === '@/utils/http') return { http: { get: async (url, params) => { calls.push({ url, params }); if (fail) throw Error('failed'); return { result: { records: [{ id: `u${params.pageNo}`, realname: `用户${params.pageNo}` }], total: 20 } } } } }
  if (name === '@/service/shkj') return { unwrapRecords: r => r.result.records }
  if (name.endsWith('.vue')) return {}
  throw Error(name)
} }
vm.runInNewContext(ts.transpileModule(script.content, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, box)
async function main() {
  let exposed
  const page = box.exports.default.setup({ excluded: [] }, { expose: v => exposed = v, emit: (...args) => events.push(args) })
  await page.load(1); page.toggle(page.users.value[0])
  await page.load(2); page.toggle(page.users.value[0])
  assert.equal(page.chosen.value.length, 2)
  assert.equal(page.hasMore.value, false)
  assert.equal(calls[0].url, '/sys/user/list')
  assert.equal(Object.keys(calls[0].params).sort().join(','), 'pageNo,pageSize')
  page.keyword.value = '测试'; page.search(); await Promise.resolve(); await Promise.resolve()
  assert.equal(calls.at(-1).params.realname, '*测试*')
  assert.equal(calls.at(-1).params.pageNo, 1)
  assert.equal(page.chosen.value.length, 2)
  page.reason.value = '现场协助'; exposed.submit()
  assert.equal(events[0][1].length, 2); assert.equal(events[0][2], '现场协助')
  page.toggle(page.chosen.value[0]); assert.equal(page.chosen.value.length, 1)
  fail = true; await page.load(1); assert.equal(page.failed.value, true); assert.equal(page.loading.value, false)
  fail = false; await page.load(1); assert.equal(page.failed.value, false)
  console.log('PASS company directory query, cross-page multi-select, search, remove, submit, failure and retry')
}
main().catch(e => { console.error(e); process.exitCode = 1 })
