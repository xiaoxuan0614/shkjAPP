const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict')
const ts = require('typescript'), vue = require('vue'), sfc = require('vue/compiler-sfc')
function evaluate(source, deps, globals = {}) {
  const module = { exports: {} }
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText,
    { module, exports: module.exports, require: name => deps[name], ...globals })
  return module.exports
}
const approval = evaluate(fs.readFileSync('src/service/quotationApproval.ts', 'utf8'), { '@/utils/http': { http: {} } })
const editor = evaluate(fs.readFileSync('src/service/quotationEditor.ts', 'utf8'), { '@/utils/http': { http: {} }, './quotationApproval': approval })
const document = evaluate(fs.readFileSync('src/utils/quotationDocument.ts', 'utf8'), { '@/service/quotationApproval': approval })
const service = evaluate(fs.readFileSync('src/service/purchaseApplication.ts', 'utf8'), { '@/service/quotationEditor': editor, '@/service/quotationApproval': approval, '@/utils/quotationDocument': document })
const form = { purchaseType: '1', supplierId: 's', supplierName: '测试供应商', projectId: 'p', periodId: 'q', projectName: '测试项目', remark: '' }
const types = [{ value: '1' }, { value: '2' }]
const row = { materialId: 'm', materialName: '测试物料', unit: '台', quantity: 3, unitPrice: 0.1, unitOptions: ['台'] }
const payload = service.purchasePayload(form, [row], types)
assert.equal(payload.totalAmount, 0.3); assert.equal(payload.itemList[0].amount, 0.3); assert.equal(payload.status, '1'); assert.equal(payload.periodId, 'q')
assert.equal(payload.itemList[0].unitOptions, undefined)
assert.equal(service.purchaseTotal([{ quantity: 1.01, unitPrice: 0.33 }, { quantity: 1.01, unitPrice: 0.33 }]), '0.67')
const other = service.purchasePayload({ ...form, purchaseType: '2' }, [row], types)
assert.equal(other.projectId, undefined); assert.equal(other.periodId, undefined); assert.equal(other.projectName, undefined)
assert.throws(() => service.purchasePayload({ ...form, periodId: '' }, [row], types), /项目/)
assert.throws(() => service.purchasePayload({ ...form, supplierId: '' }, [row], types), /供应商/)
assert.throws(() => service.purchasePayload(form, [], types), /物料/)
assert.throws(() => service.purchasePayload(form, [row, row], types), /重复/)
for (const quantity of [0, -1, '', 'NaN', '1.123']) assert.throws(() => service.purchaseItem({ ...row, quantity }))
for (const unitPrice of [-1, '', 'NaN', '1.123']) assert.throws(() => service.purchaseItem({ ...row, unitPrice }))
for (const filename of ['src/pages/stock/purchaseApply.vue', 'src/pages/stock/components/PurchasePicker.vue']) {
  const { descriptor, errors } = sfc.parse(fs.readFileSync(filename, 'utf8')); assert.deepEqual(errors, [])
  sfc.compileScript(descriptor, { id: filename }); assert.deepEqual(sfc.compileTemplate({ source: descriptor.template.content, filename, id: filename }).errors, [])
}
function setup({ denied = false, fail = false } = {}) {
  const calls = [], redirects = [], hooks = {}
  const source = sfc.parse(fs.readFileSync('src/pages/stock/purchaseApply.vue', 'utf8')).descriptor.scriptSetup.content
  const page = evaluate(source + '\nObject.assign(exports, { form, rows, types, submit, completed, uncertain, draft, editItem, confirmItem, closeItem, dirty, changeType, back });', {
    vue, '@dcloudio/uni-app': { onLoad() {}, onUnload(fn) { hooks.unload = fn }, onBackPress(fn) { hooks.back = fn } },
    '@/utils/http': { http: { post: async (url, payload) => { calls.push({ url, payload }); if (fail) throw Error('网络断开'); return { success: true, result: {} } } } },
    '@/store/user': { useUserStore: () => ({ userInfo: { token: 'test' } }) },
    '@/store/permission': { usePermissionStore: () => ({ loaded: true, hasPageAccess: () => !denied }) },
    '@/service/quotationApproval': approval, '@/utils/quotationDocument': document, '@/service/purchaseApplication': service,
  }, { getCurrentPages: () => [], uni: { showModal: opts => opts.success({ confirm: true }), showToast() {}, redirectTo: value => redirects.push(value) } })
  Object.assign(page.form.value, form); page.types.value = types; page.rows.value = [{ ...row }]
  return { page, calls, redirects, hooks }
}
async function main() {
  let test = setup(); await test.page.submit(); await test.page.submit(); assert.equal(test.calls.length, 1); assert.equal(test.calls[0].url, '/project/purchaseOrder/add'); assert.equal(test.page.completed.value, true)
  test = setup({ denied: true }); await test.page.submit(); assert.equal(test.calls.length, 0)
  test = setup({ fail: true }); await test.page.submit(); await test.page.submit(); assert.equal(test.calls.length, 1); assert.equal(test.page.uncertain.value, true)
  test = setup(); test.page.editItem(test.page.rows.value[0]); test.page.draft.value.quantity = 20; test.page.closeItem(); assert.equal(test.page.rows.value[0].quantity, 3); assert.equal(test.page.dirty.value, false)
  test.page.editItem(test.page.rows.value[0]); test.page.draft.value.quantity = 20; test.page.confirmItem(); assert.equal(test.page.rows.value[0].quantity, 20)
  test.page.changeType({ detail: { value: 1 } }); assert.equal(test.page.form.value.periodId, '')
  test.page.dirty.value = false; test.page.back(); assert.equal(test.redirects[0].url, '/pages/stock/purchaseList')
  console.log('采购申请回归通过：项目类型分支、字段白名单、金额精度、必填校验、权限、防重复提交、弹窗取消、返回及模板编译')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
