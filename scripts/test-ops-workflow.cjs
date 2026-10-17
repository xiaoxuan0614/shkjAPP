const fs = require('node:fs')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const ts = require('typescript')
const source = fs.readFileSync('src/pages/ops/components/preview/repairWorkflow.ts', 'utf8')
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const sandbox = { exports: {} }
vm.runInNewContext(output, sandbox)
const w = sandbox.exports
const [reporter, techA, techB, supervisor, director] = w.demoActors
const now = Date.UTC(2026, 9, 17, 8)
let checks = 0
function test(name, fn) { fn(); checks++; console.log(`PASS ${name}`) }
function fresh(actor = reporter) {
  const c = w.createCase({ customerId: 'DEMO-C1', projectId: 'DEMO-P1', product: '铅封机', fault: '故障', reportedAt: '2026-10-17', remark: '', photos: [], videos: [] }, actor, checks, now)
  c.ownerId = techA.id; c.owner = techA.name
  return c
}
function finish(c, needsQuote = '是', result = '维修完成') {
  Object.assign(w.activeLog(c), { position: '机柜', fault: '断电', description: '检查电源', needsQuote, result })
  w.finishLog(c, techA, now + 3600000)
}
test('default demo identities can see repair records without relaxing reporter access', () => {
  const rows = w.createWorkflowFixtures(now)
  assert.equal(w.demoActors[w.defaultDemoActorIndex(false)].role, 'technician')
  assert.equal(w.demoActors[w.defaultDemoActorIndex(true)].role, 'supervisor')
  assert(rows.filter(c => c.ownerId === w.demoActors[w.defaultDemoActorIndex(false)].id).length >= 5)
  assert.equal(rows.filter(c => w.canSeeRepair(c, reporter)).length, 0)
})
test('fixtures cover thirty varied related report/repair records', () => {
  const rows = w.createWorkflowFixtures(now)
  assert.equal(rows.length, 30)
  assert.equal(new Set(rows.map(c => c.orderId)).size, 30)
  assert.equal(new Set(rows.map(c => c.customer)).size, 3)
  assert.equal(new Set(rows.map(c => c.projectId)).size, 5)
  assert(rows.some(c => c.quoteState === '审批驳回'))
  assert(rows.some(c => c.state === '已完成'))
  assert(rows.some(c => c.completion === '待审批'))
  assert(rows.some(c => c.completion === '已驳回'))
  assert(rows.some(c => w.activeLog(c)))
  assert(rows.some(c => c.logs.some(l => l.result === '需要复修')))
  assert(rows.some(c => c.pendingRequest?.type === '转单'))
  assert(rows.some(c => c.pendingRequest?.type === '关闭'))
  for (const actor of [techA, techB]) {
    assert(rows.filter(c => c.ownerId === actor.id).length > 5)
    assert(rows.some(c => c.assistants.includes(actor.id)))
    assert(rows.some(c => c.previousOwners.includes(actor.id)))
  }
  for (const c of rows) {
    assert(c.logs.every(l => l.startedAt >= c.createdAt && (!l.endedAt || l.endedAt <= now)))
    const p = w.demoCustomers.flatMap(x => x.projects).find(p => p.id === c.projectId)
    assert(p.products.includes(c.product))
  }
})
test('report/repair scopes and supervisor is not owner', () => {
  const c = fresh()
  assert(w.canSeeReport(c, reporter)); assert(w.canSeeReport(c, supervisor)); assert(w.canSeeReport(c, techA))
  assert(!w.canSeeReport(c, techB)); assert(!w.canSeeRepair(c, reporter)); assert(!w.isOwner(c, supervisor))
  assert.throws(() => w.startLog(c, supervisor), /负责人/)
  c.previousOwners.push(techB.id)
  assert(w.canSeeRepair(c, techB)); assert(!w.isOwner(c, techB))
  assert.throws(() => w.startLog(c, techB), /负责人/)
})
test('single active log; first inspection can end before quote approval', () => {
  const c = fresh(); w.startLog(c, techA, now)
  assert.throws(() => w.startLog(c, techA, now), /未结束/)
  assert.throws(() => w.finishLog(c, techA, now), /填写/)
  finish(c)
  assert.equal(c.quoteState, '待报价'); assert(!w.activeLog(c)); assert.equal(c.logs[0].result, '')
  assert.throws(() => w.startLog(c, techA), /报价尚未确认/)
})
test('two sequential approval identities, customer confirmation and duplicate guard', () => {
  const c = fresh(); w.startLog(c, techA, now); finish(c)
  assert.throws(() => w.submitQuote(c, techA, [{ name: 'x', qty: 0, price: 20 }]), /有效/)
  w.submitQuote(c, techA, [{ name: '维修', qty: 1, price: 100 }])
  assert.throws(() => w.approveQuote(c, director, true, ''), /不能审批/)
  assert.throws(() => w.confirmCustomer(c, techA, 100), /两级/)
  w.approveQuote(c, supervisor, true, '')
  assert.equal(c.quoteStep, '总经理')
  assert.throws(() => w.approveQuote(c, supervisor, true, ''), /不能审批/)
  w.approveQuote(c, director, true, '')
  assert.throws(() => w.startLog(c, techA), /报价尚未确认/)
  assert.throws(() => w.confirmCustomer(c, supervisor, 100), /负责人/)
  assert.throws(() => w.confirmCustomer(c, techA, NaN), /有效/)
  w.confirmCustomer(c, techA, 100)
  assert.throws(() => w.confirmCustomer(c, techA, 100), /两级/)
  w.startLog(c, techA, now); finish(c)
  w.submitCompletion(c, techA, 120)
  assert.equal(c.confirmedPrice, 100); assert.equal(c.finalPrice, 120)
  w.approveCompletion(c, supervisor, true, '')
  assert.equal(c.state, '已完成'); assert.equal(c.quoteState, '报价已确认')
  assert.throws(() => w.startLog(c, techA), /不可办理/)
})
test('quote rejection requires reason and resubmission restarts supervisor step', () => {
  const c = fresh(); w.startLog(c, techA, now); finish(c)
  const items = [{ name: '维修', qty: 1, price: 100 }]
  w.submitQuote(c, techA, items)
  assert.throws(() => w.approveQuote(c, supervisor, false, ''), /原因/)
  w.approveQuote(c, supervisor, false, '补充明细'); assert.equal(c.quoteState, '审批驳回')
  w.submitQuote(c, techA, items); assert.equal(c.quoteStep, '主管')
})
test('no-quote work, return-material gate and completion rejection/rework', () => {
  const c = fresh(); w.startLog(c, techA, now); finish(c, '否')
  c.materialOpen = true
  assert.throws(() => w.submitCompletion(c, techA), /未结清/)
  assert.throws(() => w.requestException(c, techA, '关闭', '其他', '原因'), /未结清/)
  c.materialOpen = false; w.submitCompletion(c, techA)
  assert.throws(() => w.startLog(c, techA), /不可办理/)
  assert.throws(() => w.approveCompletion(c, techA, true, ''), /不能审批/)
  assert.throws(() => w.approveCompletion(c, supervisor, false, ''), /原因/)
  w.approveCompletion(c, supervisor, false, '继续排查'); assert.equal(c.state, '进行中')
  w.startLog(c, techA, now); finish(c, '否')
  w.submitCompletion(c, techA); c.materialOpen = true
  assert.throws(() => w.approveCompletion(c, supervisor, true, ''), /未结清/)
  c.materialOpen = false; w.approveCompletion(c, supervisor, true, '')
  assert.equal(c.state, '已完成')
})
test('close/transfer are pending applications, never direct mutations', () => {
  for (const type of ['关闭', '转单']) {
    const c = fresh(), owner = c.ownerId
    assert.throws(() => w.requestException(c, techA, type, '无效原因', '备注'), /原因/)
    w.requestException(c, techA, type, type === '关闭' ? '不是问题' : '病假', '说明')
    assert.equal(c.state, '待处理'); assert.equal(c.ownerId, owner); assert.equal(c.pendingRequest.type, type)
    assert.throws(() => w.startLog(c, techA), /不可办理/)
  }
})
test('waiting stops at first start, time totals and project-product validation', () => {
  const c = fresh(); assert.equal(w.waitText(c, now + 600000), '10 分钟')
  w.startLog(c, techA, now + 600000); assert.equal(w.waitText(c, now + 7200000), '10 分钟')
  finish(c, '否'); assert.equal(w.totalHours(c), 50 / 60)
  assert.throws(() => w.createCase({ customerId: 'DEMO-C1', projectId: 'DEMO-P1', product: '不存在', fault: 'x', reportedAt: '2026-10-17', remark: '', photos: [], videos: [] }, reporter, 1, now), /项目产品/)
})
test('date validation rejects invalid dates with actionable errors', () => {
  for (const reportedAt of ['2026-02-30', '2026-99-99', 'invalid']) {
    assert.throws(() => w.createCase({ customerId: 'DEMO-C1', projectId: 'DEMO-P1', product: '铅封机', fault: 'x', reportedAt, remark: '', photos: [], videos: [] }, reporter, 1, now), /有效的报修日期/)
  }
})
test('rework requires reason; active clock blocks closure and completion', () => {
  const c = fresh(); w.startLog(c, techA, now)
  assert.throws(() => w.requestException(c, techA, '关闭', '其他', '说明'), /结束维修打卡/)
  assert.throws(() => w.submitCompletion(c, techA), /结束维修打卡/)
  Object.assign(w.activeLog(c), { position: '机柜', fault: '断电', description: '检查', needsQuote: '否', result: '需要复修' })
  assert.throws(() => w.finishLog(c, techA, now + 1000), /复修原因/)
  w.activeLog(c).reason = '等待配件'; w.finishLog(c, techA, now + 1000)
  assert.throws(() => w.submitCompletion(c, techA), /尚未完成/)
})
console.log(`${checks} workflow scenario groups passed`)
