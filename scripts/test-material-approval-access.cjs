const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const mod = { exports: {} }
let manager = false
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/service/materialApproval.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports: mod.exports, require: name => {
  if (name.includes('projectMembership')) return { readProjectMembership: async () => ({ manager }) }
  if (name.includes('/todo')) return { parseTodoActionParams: () => ({}) }
  return { http: {} }
} })
async function run() {
  const check = mod.exports.canApproveMaterial
  const user = { userIdentity: '2', departIds: 'other, ops' }
  const record = { status: '2', applyType: 'OUT', usageType: 'MAINTENANCE', deptId: 'ops' }
  const none = () => false
  assert.equal(await check(record, user, none), true)
  assert.equal(await check(record, { ...user, departIds: ['ops'] }, none), true)
  for (const changes of [{ status: '1' }, { deptId: '' }, { deptId: 'op' }, { usageType: 'UNKNOWN' }, { applyType: 'IN' }]) {
    assert.equal(await check({ ...record, ...changes }, user, none), false)
  }
  assert.equal(await check(record, { ...user, userIdentity: '1' }, () => true), false)
  assert.equal(await check({ ...record, usageType: 'LABOR_PROTECTION' }, user, none), false)
  assert.equal(await check({ ...record, usageType: 'LABOR_PROTECTION' }, user, code => code === 'mtl:apply:approve'), true)
  assert.equal(await check({ ...record, applyType: 'IN' }, user, code => code === 'mtl:goods:io'), true)
  assert.equal(await check({ ...record, usageType: 'PROJECT', periodId: 'p' }, user, () => true), false)
  manager = true
  assert.equal(await check({ ...record, usageType: 'PROJECT', periodId: 'p' }, user, none), true)
  console.log('PASS mobile material approval: maintenance department-head gate; labor, project, inbound and status guards unchanged')
}
run().catch(error => { console.error(error); process.exitCode = 1 })
