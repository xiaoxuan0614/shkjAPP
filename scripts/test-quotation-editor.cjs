const fs = require('node:fs')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const ts = require('typescript')
const vue = require('vue')
const sfc = require('vue/compiler-sfc')
const plain = value => JSON.parse(JSON.stringify(value))
function evaluate(source, deps, globals = {}) {
  const module = { exports: {} }
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText,
    { module, exports: module.exports, require: name => deps[name], ...globals })
  return module.exports
}
const approval = evaluate(fs.readFileSync('src/service/quotationApproval.ts', 'utf8'), { '@/utils/http': { http: {} } })
const editor = evaluate(fs.readFileSync('src/service/quotationEditor.ts', 'utf8'), { '@/utils/http': { http: {} }, './quotationApproval': approval })
const table = evaluate(fs.readFileSync('src/utils/quotationTable.ts', 'utf8'), { '@/service/quotationApproval': approval })
assert.equal(editor.guidancePrice(20, 25), '25.00')
assert.equal(table.quotationPercent(20, 25), '25.00%')
assert.equal(editor.guidancePrice(2, 150), '5.00')
assert.equal(table.quotationPercent(2, 5), '150.00%')
const document = evaluate(fs.readFileSync('src/utils/quotationDocument.ts', 'utf8'), { '@/service/quotationApproval': approval })
const rec = { id: 'q', periodId: 'p', createBy: 'author', status: '-1', adopted: 0, priced: 0, version: 3, approvalRoute: 'TECHNICAL' }
function caps(record = rec, access = {}, user = { username: 'author' }, has = () => true) { return editor.quotationCapabilities(record, access, user, has) }
assert.equal(caps().edit, true)
assert.equal(caps(rec, { canEditPrice: true, canRevise: true }, { username: 'other' }).edit, false)
assert.equal(caps({ ...rec, status: '2' }).edit, false)
assert.equal(caps({ ...rec, adopted: 1 }).structure, false)
assert.equal(caps({ ...rec, adopted: 1 }).cost, false)
assert.equal(caps({ ...rec, status: '1' }, { canManage: true }).price, true)
assert.equal(caps({ ...rec, status: '1', approvalRoute: 'MARKET' }, { canManage: true }).price, false)
assert.equal(caps(rec, { canManage: true }, {}, () => false).edit, false)
assert.equal(caps({ ...rec, status: '2' }, {}, { username: 'other' }).withdraw, false)
assert.equal(editor.guidancePrice('0.05', '10'), '0.06')
assert.equal(editor.guidancePrice('100', '20'), '120.00')
assert.equal(editor.guidancePrice('10', '0'), '10.00')
for (const value of ['', null, '-1', 'NaN', '1.001', '10000000000']) assert.throws(() => editor.decimalInput(value, '价格'))
assert.equal(editor.decimalInput('0', '价格'), 0)
assert.throws(() => editor.decimalInput('0', '数量', 4, true))
const material = { id: 'm1', materialId: 'material', unitId: 'unit', quantity: 2, basePrice: '100', finalPrice: '120', markupRate: '20', remark: '' }
const masked = editor.materialPayload(material, { cost: false, price: false, direct: false })
assert.equal(masked.basePrice, undefined); assert.equal(masked.finalPrice, undefined); assert.equal(masked.markupRate, undefined)
assert.deepEqual(plain(editor.pricingPayload([material], [])), { records: [{ id: 'm1', finalPrice: 120 }], serviceFees: [] })
assert.equal(editor.guidancePrice('100', '-20'), '80.00')
assert.equal(editor.guidancePrice('100', '-100'), '0.00')
assert.equal('markupRate' in editor.materialPayload({ ...material, markupRate: -20, finalPrice: 80 }, { cost: true, price: true, direct: false }), false)
assert.throws(() => editor.pricingPayload([material, material], []), /重复/)
assert.throws(() => editor.materialPayload({ ...material, unitId: '' }, { cost: true, price: false, direct: false }), /单位/)
const fee = { serviceFeeId: 's', name: '安装', unit: '项', quantity: 1, costPrice: 100, markupRate: 20, guidePrice: 999 }
assert.equal(editor.feePayload(fee, { cost: true, price: false, structure: true, direct: false }).guidePrice, 999)
assert.equal('markupRate' in editor.feePayload(fee, { cost: true, price: true, structure: true, direct: false }), false)
assert.deepEqual(plain(editor.pricingPayload([], [{ ...fee, id: 'f', markupRate: null, costPrice: 0, guidePrice: 80 }])), { records: [], serviceFees: [{ id: 'f', guidePrice: 80 }] })
assert.equal(editor.feePayload({ ...fee, id: 'f' }, { cost: false, price: false, structure: false, direct: false }).guidePrice, undefined)

for (const filename of ['src/pages/home/quotationEdit.vue', 'src/pages/home/quotationDetail.vue', 'src/pages/home/components/QuotationPicker.vue', 'src/pages/home/components/QuotationHistory.vue']) {
  const { descriptor, errors } = sfc.parse(fs.readFileSync(filename, 'utf8'))
  assert.deepEqual(errors, []); sfc.compileScript(descriptor, { id: filename })
  assert.deepEqual(sfc.compileTemplate({ source: descriptor.template.content, filename, id: filename }).errors, [])
}

function setup({ failDetails = false, latestVersion = 3, deny = false, stack = [], backFails = false } = {}) {
  const calls = [], redirects = [], user = { userInfo: { username: 'author', token: 'fixture' }, identity: { departmentIds: ['technical'] } }
  const api = { ...approval,
    getQuotationAccess: async () => deny ? { canManage: false } : {},
    getQuotationRecord: async () => ({ ...rec, version: latestVersion }),
  }
  const http = { post: async (url, payload) => { calls.push({ url, payload }); if (failDetails && url.endsWith('editBatch')) throw Error('网络异常'); return { success: true, result: { ...rec, version: 1 } } } }
  const source = sfc.parse(fs.readFileSync('src/pages/home/quotationEdit.vue', 'utf8')).descriptor.scriptSetup.content
  const page = evaluate(source + '\nObject.assign(exports, { save, back, pickerOpen, record, access, materials, fees, name, periodId, candidateId, personnelRoute, loading, busy, fatal, actionError, pricing, openItem, closeItem, confirmItem, draftItem, itemOpen, itemError, dirty });', {
    vue, '@dcloudio/uni-app': { onLoad() {}, onUnload() {}, onBackPress() {} }, '@/utils/http': { http },
    '@/store/user': { useUserStore: () => user }, '@/store/permission': { usePermissionStore: () => ({ loaded: true, hasPermission: () => !deny }) },
    '@/service/quotationApproval': api, '@/service/quotationEditor': editor, '@/utils/quotationTable': table, '@/utils/quotationDocument': document,
  }, { getCurrentPages: () => stack, uni: { showModal: options => options.success({ confirm: true }), showToast() {}, navigateBack: options => { if (backFails) options.fail(); else redirects.push({ back: true }) }, redirectTo: value => redirects.push(value) } })
  page.loading.value = false; page.personnelRoute.value = 'TECHNICAL'; page.periodId.value = 'p'; page.name.value = '测试报价'; page.materials.value = [{ ...material, id: undefined }]
  return { page, calls, redirects }
}
async function main() {
  let navigation = setup(); navigation.page.back(); assert.equal(navigation.redirects[0].url, '/pages/home/quotationList')
  navigation = setup({ stack: [{}, {}] }); navigation.page.back(); assert.equal(navigation.redirects[0].back, true)
  navigation = setup({ stack: [{}, {}], backFails: true }); navigation.page.back(); assert.equal(navigation.redirects[0].url, '/pages/home/quotationList')
  navigation = setup(); navigation.page.dirty.value = true; navigation.page.back(); assert.equal(navigation.redirects[0].url, '/pages/home/quotationList')
  navigation = setup(); navigation.page.pickerOpen.value = true; navigation.page.back(); assert.equal(navigation.page.pickerOpen.value, false); assert.equal(navigation.redirects.length, 0)
  let test = setup(); await test.page.save()
  assert.equal(test.calls.length, 2)
  assert.equal(test.calls[0].url, '/project/materialCandidate/add')
  assert.deepEqual(plain(test.calls[0].payload), { periodId: 'p', candidateName: '测试报价' })
  assert.equal(test.calls[1].url, '/project/materialCandidateItem/editBatch')
  assert.equal(test.calls[1].payload.version, 1)
  assert.equal(test.calls[1].payload.records[0].finalPrice, undefined)
  assert.equal(test.redirects.length, 1)
  test = setup({ failDetails: true }); await test.page.save(); await test.page.save()
  assert.equal(test.page.candidateId.value, 'q'); assert.equal(test.calls.length, 2); assert.match(test.page.actionError.value, /不确定|核实/)
  test = setup({ latestVersion: 4 }); test.page.record.value = rec; test.page.candidateId.value = 'q'; await test.page.save()
  assert.equal(test.calls.length, 0); assert.match(test.page.actionError.value, /已被修改/)
  test = setup({ deny: true }); await test.page.save(); assert.equal(test.calls.length, 0)
  test = setup(); test.page.materials.value[0].quantity = 0; await test.page.save(); assert.equal(test.calls.length, 0)
  test = setup()
  const row = test.page.materials.value[0]
  row._unitsLoaded = true
  await test.page.openItem({ row, fee: false, key: 'm' })
  test.page.draftItem.value.row.quantity = 12
  assert.notEqual(row.quantity, 12)
  await test.page.save(); assert.equal(test.calls.length, 0)
  test.page.closeItem(); assert.notEqual(row.quantity, 12); assert.equal(test.page.dirty.value, false)
  await test.page.openItem({ row, fee: false, key: 'm' })
  test.page.draftItem.value.row.quantity = 0
  test.page.confirmItem(); assert.equal(test.page.itemOpen.value, true); assert.ok(test.page.itemError.value)
  test.page.draftItem.value.row.quantity = 12
  test.page.confirmItem(); assert.equal(row.quantity, 12); assert.equal(test.page.itemOpen.value, false); assert.equal(test.page.dirty.value, true)
  console.log('报价编辑回归通过：PC权限矩阵、价格精度、字段白名单、版本冲突、新建两阶段、防重复主单与模板编译')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
