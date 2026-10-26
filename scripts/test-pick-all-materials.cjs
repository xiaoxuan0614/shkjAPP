const fs = require('node:fs')
const assert = require('node:assert/strict')
const ts = require('typescript')
const sfc = require('vue/compiler-sfc')
const helper = {}
new Function('exports', ts.transpile(fs.readFileSync('src/utils/pickAllMaterials.ts', 'utf8'), { module: ts.ModuleKind.CommonJS }))(helper)
const source = fs.readFileSync('src/pages/ops/materialApply.vue', 'utf8')
const { descriptor, errors } = sfc.parse(source)
assert.deepEqual(errors, [])
sfc.compileScript(descriptor, { id: 'pick' })
assert.deepEqual(sfc.compileTemplate({ source: descriptor.template.content, filename: 'pick.vue', id: 'pick' }).errors, [])
const ast = ts.createSourceFile('pick.ts', descriptor.scriptSetup.content, ts.ScriptTarget.Latest, true)
const declaration = name => ts.transpile(ast.statements.find(n => ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.name.getText(ast) === name)).getText(ast))
const ref = value => ({ value })
const row = (id, qty = 5) => ({ materialId: String(id), periodId: 'p', materialName: '测试物料', baseUnitName: '个', availableApplyQty: qty })
function harness(fetchPage) {
  const notices = []
  const env = { bulkLoading: ref(false), submitting: ref(false), projectSelecting: ref(false), isProjectUsage: ref(true), reworkId: ref(''), requestedReworkId: ref(''),
    orderInfo: ref({ id: 'p' }), selectedMaterials: ref([{ id: '1', qty: 2 }]), userStore: { userInfo: { token: 'fixture' } },
    toast: Object.fromEntries(['warning', 'info', 'success', 'error'].map(key => [key, msg => notices.push([key, msg])])),
    projectApi: { materialAccounts: fetchPage }, normalizeAvailableMaterial: r => ({ ...r, id: r.materialId }), ...helper }
  const api = new Function(...Object.keys(env), `let bulkVersion=0; ${declaration('invalidateBulk')} ${declaration('fillAllMaterials')} return {run:fillAllMaterials,cancel:invalidateBulk}`)(...Object.values(env))
  return { ...env, ...api, notices }
}
(async () => {
  const calls = []
  const h = harness(async (id, params) => { calls.push([id, params]); return { result: { records: params.pageNo === 1 ? [row(1), row(2, 0)] : [row(3, 2.5)], total: 3 } } })
  await h.run()
  assert.equal(calls.length, 2)
  assert.deepEqual(calls[0], ['p', { pageNo: 1, pageSize: 200 }])
  assert.deepEqual(h.selectedMaterials.value.map(r => [r.id, r.qty]), [['1', 2], ['3', 2.5]])
  assert.equal(h.selectedMaterials.value[1].unit, '个')
  await h.run(); assert.equal(h.selectedMaterials.value.length, 2)
  let done, requests = 0
  const stale = harness(() => { requests++; return new Promise(resolve => { done = resolve }) })
  const pending = stale.run(); await stale.run(); assert.equal(requests, 1)
  stale.cancel(); done({ result: { records: [row(2)], total: 1 } }); await pending
  assert.equal(stale.selectedMaterials.value.length, 1, '离页或切换后不回填')
  const failed = harness(async (_, params) => { if (params.pageNo === 2) throw Error('network'); return { records: [row(2)], total: 2 } })
  await failed.run(); assert.equal(failed.selectedMaterials.value.length, 1); assert.equal(failed.bulkLoading.value, false)
  await assert.rejects(helper.loadPickAllAccounts(async () => ({ records: [row(1)], total: 2 }), 'p', () => true), /重复/)
  await assert.rejects(helper.loadPickAllAccounts(async () => ({ records: [], total: 2 }), 'p', () => true), /不完整/)
  assert.throws(() => helper.missingPickAccounts([{ ...row(2), baseUnitName: '' }], []), /单位/)
  assert.equal(helper.missingPickAccounts([row(1, 0), row(2, -1)], []).length, 0)
  assert(source.includes('onHide(invalidateBulk)'))
  assert(source.includes('submitting.value || projectSelecting.value || bulkLoading.value'))
  console.log('PASS 移动端一键领料：完整分页、已选数量保留、零量过滤、防重、失效、失败原子性及SFC编译')
})().catch(error => { console.error(error); process.exitCode = 1 })
