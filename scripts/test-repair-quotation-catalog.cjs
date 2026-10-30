const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict')
const ts = require('typescript'), sfc = require('vue/compiler-sfc'), vue = require('vue')
function evaluate(source, deps, globals = {}) {
  const module = { exports: {} }
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { module, exports: module.exports, require: name => deps[name], ...globals })
  return module.exports
}
const approval = evaluate(fs.readFileSync('src/service/quotationApproval.ts', 'utf8'), {})
const editor = evaluate(fs.readFileSync('src/service/quotationEditor.ts', 'utf8'), { './quotationApproval': approval })
const filename = 'src/pages/home/components/RepairQuotationItems.vue'
const access = evaluate(fs.readFileSync('src/service/repairQuotationAccess.ts', 'utf8'), {})
for (const quotationStatus of ['HEAD_REVIEW', 'GM_REVIEW', 'WAIT_CUSTOMER', 'CONFIRMED']) {
  assert.equal(access.canChangeRepairQuotation({ canChangeQuotationDecision: true, order: { quotationStatus } }), false)
}
for (const quotationStatus of ['WITHDRAWN', 'RETURNED', 'NOT_REQUIRED']) {
  assert.equal(access.canChangeRepairQuotation({ canChangeQuotationDecision: true, order: { quotationStatus } }), true)
  assert.equal(access.canChangeRepairQuotation({ canChangeQuotationDecision: false, order: { quotationStatus } }), false)
}
const summaryFile = 'src/pages/home/components/RepairQuotationTable.vue'
const summary = sfc.parse(fs.readFileSync(summaryFile, 'utf8')).descriptor
sfc.compileScript(summary, { id: summaryFile })
assert.deepEqual(sfc.compileTemplate({ source: summary.template.content, filename: summaryFile, id: summaryFile }).errors, [])
for (const file of [filename, 'src/pages/home/components/RepairQuotationOrders.vue', 'src/pages/home/components/QuotationPicker.vue', 'src/pages/ops/components/preview/RepairRoute.vue', 'src/pages/ops/repairDetail.vue']) {
  const { descriptor, errors } = sfc.parse(fs.readFileSync(file, 'utf8'))
  assert.deepEqual(errors, []); sfc.compileScript(descriptor, { id: file })
  assert.deepEqual(sfc.compileTemplate({ source: descriptor.template.content, filename: file, id: file }).errors, [])
}
async function run() {
  const props = { modelValue: [] }, calls = []
  let result = { id: 'm', materialName: '测试电线', costPrice: '10.50', guideMarkupRate: 20, unitList: [{ isBaseUnit: true, unitName: '米' }] }
  const source = sfc.parse(fs.readFileSync(filename, 'utf8')).descriptor.scriptSetup.content
  const page = evaluate(source + '\nObject.assign(exports, {select, kind, error, edit, cancel, confirm, draft, editError, removeCurrent});', {
    vue: { ...vue, onBeforeUnmount() {} }, '@/utils/http': { http: { get: async (url, params) => { calls.push({ url, params }); return { success: true, result } } } },
    '@/service/quotationApproval': approval, '@/service/quotationEditor': editor, '@/store/user': { useUserStore: () => ({ userInfo: { token: 'test' } }) },
  }, { defineProps: () => props, defineEmits: () => (event, value) => { if (event === 'update:modelValue') props.modelValue = value } })
  await page.select({ id: 'm' })
  assert.equal(props.modelValue.length, 0); assert.equal(page.draft.value.price, '12.60'); page.confirm()
  assert.equal(props.modelValue[0].price, 12.6); assert.equal(props.modelValue[0].qty, 1)
  assert.equal(props.modelValue[0].name, '测试电线（米）'); assert.equal(calls[0].url, '/stock/material/queryById')
  await page.select({ id: 'm' }); assert.equal(props.modelValue.length, 1)
  page.kind.value = 'fee'; result = { id: 's', name: '维修服务', unit: '次', costPrice: 100, guideMarkupRate: 25 }
  await page.select({ id: 's' }); assert.equal(page.draft.value.price, '125.00'); page.confirm(); assert.equal(props.modelValue[1].price, 125)
  assert.equal(calls[1].url, '/project/serviceFee/queryById')
  result = { id: 'missing', name: '未维护服务', costPrice: null }
  await page.select({ id: 'missing' }); assert.equal(page.draft.value.price, ''); page.confirm(); assert.match(page.editError.value, /报价单价/); assert.equal(props.modelValue.length, 2); page.cancel()
  page.kind.value = 'material'; result = { id: 'bad', materialName: '缺单位', costPrice: 10 }
  await page.select({ id: 'bad' }); assert.match(page.error.value, /基准单位/); assert.equal(props.modelValue.length, 2)
  page.edit(0); page.draft.value.price = 999; page.cancel(); assert.equal(props.modelValue[0].price, 12.6)
  page.edit(0); page.draft.value.qty = 0; page.confirm(); assert.match(page.editError.value, /数量/)
  page.draft.value.qty = 2; page.draft.value.price = 15; page.confirm(); assert.equal(props.modelValue[0].price, 15); assert.equal(props.modelValue[0].qty, 2)
  page.edit(0); assert.equal(typeof page.draft.value.price,'string');
  page.draft.value.price='12.34'; page.confirm(); assert.equal(props.modelValue[0].price,12.34);
  page.edit(0); page.draft.value.price='12.345'; page.confirm(); assert.match(page.editError.value,/2 位小数/);
  page.draft.value.price='0.01'; page.confirm(); assert.equal(props.modelValue[0].price,0.01);
  page.edit(0); page.removeCurrent(); assert.equal(props.modelValue.length, 1)
  console.log('PASS: 目录指导价、弹窗确认添加、取消不写入、编辑取消保留原值、数量价格校验、删除及组件编译')
}
run().catch(error => { console.error(error); process.exitCode = 1 })
