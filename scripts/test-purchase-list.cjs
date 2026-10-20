const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict'), ts = require('typescript'), vue = require('vue'), sfc = require('vue/compiler-sfc')
const filename = 'src/pages/stock/purchaseList.vue'
const { descriptor, errors } = sfc.parse(fs.readFileSync(filename, 'utf8'))
assert.deepEqual(errors, []); sfc.compileScript(descriptor, { id: filename }); assert.deepEqual(sfc.compileTemplate({ source: descriptor.template.content, filename, id: filename }).errors, [])
function setup(respond, allowed = true) {
  const calls = [], exports = {}, user = { userInfo: { token: 'fixture' } }
  const source = descriptor.scriptSetup.content + '\nObject.assign(exports,{load,search,reset,rows,more,error,keyword,searchIndex,type,status,openDetail,closeDetail,detail,detailOpen,detailLoading});'
  const deps = { vue, '@dcloudio/uni-app': { onShow() {}, onUnload() {}, onBackPress() {} }, '@/utils/http': { http: { get: async (url, params) => { calls.push({ url, params }); return respond(url, params) } } }, '@/service/quotationApproval': { unwrapQuotation: x => x, quotationLineTotal: x => x }, '@/service/permission': { ensureCurrentAuthorization: async () => {} }, '@/store/user': { useUserStore: () => user }, '@/store/permission': { usePermissionStore: () => ({ loaded: true, hasPageAccess: () => allowed }) } }
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports, require: name => deps[name] })
  return { page: exports, calls, user }
}
async function main() {
  let test = setup((url, params) => ({ records: [{ id: String(params.pageNo) }], total: 21 }))
  await test.page.load(true); await test.page.load(false); await test.page.load(false)
  assert.equal(test.calls.length, 2); assert.equal(test.page.rows.value.length, 2); assert.equal(test.page.more.value, false)
  assert.ok(test.calls.every(call => call.url === '/project/purchaseOrder/list'))
  test.page.keyword.value = '项目甲'; test.page.type.value = '1'; test.page.status.value = '0'; test.page.search()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(test.calls.at(-1).params.keyword, '项目甲'); assert.equal(test.calls.at(-1).params.status, '0'); assert.equal(test.calls.at(-1).params.purchaseType, '1'); assert.equal(test.calls.at(-1).params.pageNo, 1)
  test = setup(() => { throw Error('不应调用') }, false); await test.page.load(true); assert.equal(test.calls.length, 0)
  test = setup(() => ({ id: 'a', itemList: [], totalAmount: 0 })); await test.page.openDetail({ id: 'a', projectName: '主项目', periodName: '分期' }); assert.equal(test.calls[0].url, '/project/purchaseOrder/queryById'); assert.equal(test.page.detail.value.projectName, '主项目')
  let complete; test = setup(() => new Promise(resolve => { complete = resolve })); const pending = test.page.openDetail({ id: 'a' }); test.page.closeDetail(); complete({ id: 'a', itemList: [] }); await pending; assert.equal(test.page.detail.value, null)
  let resolves = []; test = setup(() => new Promise(resolve => resolves.push(resolve)))
  const first = test.page.load(true); await new Promise(resolve => setImmediate(resolve)); const second = test.page.load(true); await new Promise(resolve => setImmediate(resolve))
  resolves[1]({ records: [{ id: 'new' }], total: 1 }); await second; resolves[0]({ records: [{ id: 'old' }], total: 1 }); await first; assert.equal(test.page.rows.value[0].id, 'new')
  console.log('采购列表回归通过：滚动分页、筛选、权限、仅列表接口、按需详情、详情取消和过期响应保护')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
