const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript'), assert = require('node:assert/strict')
const vue = require('vue')
function evaluate(source, globals = {}) {
  const module = { exports: {} }
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText,
    { module, exports: module.exports, ...globals })
  return module.exports
}
const { canReturnAtStage } = evaluate(fs.readFileSync('src/service/materialReturnAccess.ts', 'utf8'))
for (const stage of ['PREPARING', 'PENDING_APPROVAL', 'IMPLEMENTING', 'REWORKING', 'COMPLETED', 'CLOSED']) assert.equal(canReturnAtStage(stage), true)
for (const stage of ['NOT_STARTED', '', undefined, 'UNKNOWN']) assert.equal(canReturnAtStage(stage), false)
const source = fs.readFileSync('src/pages/ops/projectDetail.vue', 'utf8')
const manager = vue.ref(false), payment = vue.ref(true)
const permissionStore = { fullAccess: true, hasPermission: () => true }
const start = source.indexOf('const canConfirmArrival = computed(')
const end = source.indexOf('const arrivalRollbackDays', start)
const { canConfirmArrival } = evaluate(source.slice(start, end) + '\nmodule.exports = { canConfirmArrival }', {
  computed: vue.computed, isProjectManager: manager, hasArrivalPayment: payment, permissionStore,
  detail: vue.ref({ rawStatus: 'IMPLEMENTING', arrivalStatus: 0 }), isArrivalStage: () => true,
})
assert.equal(canConfirmArrival.value, false, '管理员也不能跳过项目经理身份')
manager.value = true
assert.equal(canConfirmArrival.value, true)
payment.value = false
assert.equal(canConfirmArrival.value, false)
assert.ok(source.includes('!membership.manager || !record'))
assert.ok(source.includes('op.text === "申请还料" ||'))
assert.ok(source.includes('canReturnAtStage(detail.value.rawStatus)'))
console.log('到货经理门禁、还料阶段及直接入口回归通过')

const { canPickProjectMaterial, PROJECT_PICK_STAGES } = evaluate(fs.readFileSync('src/service/projectMaterialAccess.ts', 'utf8'))
for (const stage of PROJECT_PICK_STAGES) {
  for (const plan of [1, '1']) assert.equal(canPickProjectMaterial(stage, plan), true)
  for (const plan of [-1, 0, 2, 3, undefined, null, '', 'unknown']) assert.equal(canPickProjectMaterial(stage, plan), false)
}
for (const stage of ['NOT_STARTED', 'PENDING_APPROVAL', 'WARRANTY', 'COMPLETED', 'CLOSED', undefined]) assert.equal(canPickProjectMaterial(stage, 1), false)
const detail = vue.ref({ rawStatus: 'PREPARING', planStatus: '1' })
const participant = vue.ref(true), arrival = vue.ref(false), pages = vue.ref(['/pages/ops/materialApply', '/pages/ops/materialReturn'])
const navigation = []
const opsStart = source.indexOf('const ops = computed(')
const opsEnd = source.indexOf('const showMore', opsStart)
const primaryStart = source.indexOf('const primaryOps = computed(')
const primaryEnd = source.indexOf('const moreGroups', primaryStart)
const result = evaluate(source.slice(opsStart, opsEnd) + source.slice(primaryStart, primaryEnd) + '\nmodule.exports = { ops, primaryOps }', {
  computed: vue.computed, detail, id: vue.ref('p'), isProjectParticipant: participant,
  hasUnfinishedParticipation: vue.ref(false), canStartAcceptance: vue.ref(false),
  canConfirmArrival: arrival, canReturnAtStage, canPickProjectMaterial,
  delayIsProjectManager: vue.ref(false), delayProcesses: vue.ref([]),
  permissionStore: { hasPageAccess: path => pages.value.includes(path), hasPermission: () => false },
  openArrivalConfirm: () => {}, uni: { navigateTo: arg => navigation.push(arg.url) },
})
const labels = () => Array.from(result.primaryOps.value, op => op.text)
assert.deepEqual(labels(), ['领料申请', '申请还料'])
arrival.value = true
assert.deepEqual(labels(), ['领料申请', '申请还料', '确认到货'])
participant.value = false
assert.deepEqual(labels(), ['确认到货'])
participant.value = true
arrival.value = false
pages.value = ['/pages/ops/materialApply']
assert.deepEqual(labels(), ['领料申请'])
pages.value = ['/pages/ops/materialReturn']
assert.deepEqual(labels(), ['申请还料'])
pages.value = ['/pages/ops/materialApply', '/pages/ops/materialReturn']
detail.value = { rawStatus: 'REWORKING', planStatus: 1, currentReworkId: 'r' }
result.ops.value.find(op => op.text === '领料申请').action()
assert.equal(navigation.pop(), '/pages/ops/materialApply?periodId=p&reworkId=r')
for (const stage of ['PREPARING', 'IMPLEMENTING', 'REWORKING', 'WARRANTY', 'COMPLETED', 'CLOSED']) {
  for (const plan of ['-1', '0', '2', '3', undefined, null, '', 'unknown']) {
    detail.value = { rawStatus: stage, planStatus: plan, approvalStatus: '1' }
    assert.deepEqual(labels(), [])
  }
}
detail.value = { rawStatus: 'CLOSED', planStatus: 1 }
assert.deepEqual(labels(), ['申请还料'])
assert.ok(fs.readFileSync('src/pages/ops/materialApply.vue', 'utf8').includes('PROJECT_PICK_STAGES.join'))
assert.ok(!fs.readFileSync('src/store/permission.ts', 'utf8').includes("'/pages/ops/materialReturn': ["))
const sfc = require('vue/compiler-sfc')
for (const file of ['projectDetail', 'materialApply', 'materialReturn']) {
  const filename = `src/pages/ops/${file}.vue`
  const { descriptor, errors } = sfc.parse(fs.readFileSync(filename, 'utf8'))
  assert.deepEqual(errors, [])
  const script = sfc.compileScript(descriptor, { id: file })
  assert.deepEqual(sfc.compileTemplate({ source: descriptor.template.content, filename, id: file, compilerOptions: { bindingMetadata: script.bindings } }).errors, [])
}
console.log('领还料状态/身份/授权矩阵、底部快捷区、返工导航及SFC编译通过')
