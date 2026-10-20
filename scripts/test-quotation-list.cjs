const fs = require('node:fs')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const ts = require('typescript')
const vue = require('vue')
const { parse, compileScript, compileTemplate } = require('vue/compiler-sfc')
const filename = 'src/pages/home/quotationList.vue'
const source = fs.readFileSync(filename, 'utf8')
const { descriptor, errors } = parse(source)
assert.deepEqual(errors, [])
compileScript(descriptor, { id: filename })
assert.deepEqual(compileTemplate({ source: descriptor.template.content, filename, id: filename }).errors, [])
const calls = [], navigations = []
let responder
const deps = {
  vue,
  '@dcloudio/uni-app': { onShow() {}, onUnload() {} },
  '@/utils/http': { http: { get: async (url, params) => { calls.push({ url, params }); return responder(params) } } },
  '@/service/quotationApproval': { unwrapQuotation: value => value.result },
  '@/store/user': { useUserStore: () => ({ userInfo: { token: 'test-only' } }) },
  '@/store/permission': { usePermissionStore: () => ({ loaded: true, hasPermission: () => true }) },
  '@/components/StatusBadge/StatusBadge.vue': {},
}
const moduleObject = { exports: {} }
const code = descriptor.scriptSetup.content + '\nObject.assign(exports, { load, search, rows, keyword, appliedKeyword, status, hasMore, loading, error, openDetail });'
vm.runInNewContext(ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText,
  { exports: moduleObject.exports, module: moduleObject, require: name => deps[name], uni: { navigateTo: value => navigations.push(value), showToast() {} } })
const page = moduleObject.exports
async function main() {
  responder = async p => ({ result: { records: [{ id: `q${p.pageNo}`, periodId: 'p', candidateName: '报价' }], total: 21 } })
  await page.load(true)
  await page.load()
  assert.equal(page.rows.value.length, 2)
  assert.equal(page.hasMore.value, false)
  await page.load()
  assert.equal(calls.length, 2)
  assert.equal(calls[0].url, '/project/materialCandidate/list')
  assert.equal(calls[0].params.username, undefined)
  page.appliedKeyword.value = '项目'; page.status.value = '0'
  await page.load(true)
  assert.equal(calls.at(-1).params.keyword, '项目')
  assert.equal(calls.at(-1).params.status, '0')
  responder = async () => { throw Error('测试失败') }
  await page.load(true)
  assert.equal(page.error.value, '测试失败')
  assert.equal(page.loading.value, false)
  let release
  responder = () => new Promise(resolve => { release = resolve })
  const stale = page.load(true)
  responder = async () => ({ result: { records: [{ id: 'new', periodId: 'p' }], total: 1 } })
  await page.load(true)
  release({ result: { records: [{ id: 'old' }], total: 1 } }); await stale
  assert.equal(page.rows.value[0].id, 'new')
  page.openDetail({ id: 'q&1', periodId: 'p', projectName: '主', periodName: '分' })
  assert.ok(navigations[0].url.includes('candidateId=q%261'))
  console.log('报价列表：编译、分页、结束门禁、筛选、失败重试、过期响应与详情路由通过')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
