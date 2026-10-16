const fs = require('node:fs')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const ts = require('typescript')
const permissionModule = { exports: {} }
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/store/permission.ts', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText, {
  module: permissionModule, exports: permissionModule.exports,
  require: name => name === 'vue' ? require('vue') : name === 'pinia' ? { defineStore: (_id, setup) => setup } : { HOME_PAGE: '/pages/home/index' },
})
const permissions = permissionModule.exports.usePermissionStore()
permissions.setAuthorization([], [], 'normal-user', false)
for (const path of ['/pages/home/todoList', '/pages/home/todoList?from=home', 'pages/home/todoList']) {
  assert.equal(permissions.hasPageAccess(path), true)
}
assert.equal(permissions.hasPageAccess('/pages/admin/approval'), false)
assert.equal(permissions.hasPageAccess('/pages/stock/materialApply'), false)
assert.equal(permissions.hasPermission('project:contract:approve'), false)
const source = fs.readFileSync('src/components/HomeWorkspace.vue', 'utf8')
const backSource = source.slice(source.indexOf('const backToHome ='), source.indexOf('\nimport OpsPreview'))
const backCalls = []
vm.runInNewContext(backSource + '\nbackToHome()', {
  props: { todoOnly: true }, uni: {
    switchTab: options => { backCalls.push(options.url); options.fail() },
    reLaunch: options => backCalls.push(options.url),
  },
})
assert.deepEqual(backCalls, ['/pages/home/index', '/pages/home/index'])
assert.ok(source.includes(':type="todoOnly ? \'popup\' : \'page\'"'))
// 未支持类型必须触发原生确认弹窗，不依赖页面Toast挂载。
const action = source.slice(source.indexOf('const openTodo = ('), source.indexOf('\nconst refreshAfterContractApproval'))
let notice
vm.runInNewContext(ts.transpileModule(action + '\nopenTodo({ todoType: "UNSUPPORTED_TODO" })', {
  compilerOptions: { target: ts.ScriptTarget.ES2020 },
}).outputText, {
  isMaterialApprovalTodo: () => false, isStockOutExecuteTodo: () => false, isPlanApprovalTodo: () => false,
  uni: { showModal: options => { notice = options } },
})
assert.equal(notice.title, '请到 PC 端办理')
assert.equal(notice.showCancel, false)
const loader = source.slice(source.indexOf('const loadTodos = async'), source.indexOf('\nconst memberRoleFallback'))
assert.ok(loader.startsWith('const loadTodos'))
async function run(todoOnly) {
  const requests = []
  const state = { props: { todoOnly }, todoRequest: 0, todoList: { value: [] }, todoPage: { value: 0 }, todoHasMore: { value: true }, todoLoading: { value: false }, todoError: { value: '' }, todoTotal: { value: 0 },
    loadTodoTypeDictionary: async () => {}, unwrapTodoPage: r => r, todoTypeText: t => t, parseTodoActionParams: p => p,
    todoApi: { page: async args => { requests.push(args); return { total: 23, records: Array.from({ length: Math.min(args.pageSize, 23 - (args.pageNo - 1) * args.pageSize) }, (_, i) => ({ id: (args.pageNo - 1) * args.pageSize + i, todoType: '合同' })) } } },
  }
  vm.createContext(state)
  vm.runInContext(ts.transpileModule(loader + '\nglobalThis.load = loadTodos', { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, state)
  await state.load()
  assert.equal(requests[0].pageSize, todoOnly ? 20 : 5)
  assert.equal(state.todoList.value.length, todoOnly ? 20 : 5)
  if (todoOnly) {
    await state.load(false)
    assert.equal(state.todoList.value.length, 23)
    assert.equal(state.todoHasMore.value, false)
    await state.load(false)
    assert.equal(requests.length, 2)
    await state.load()
    assert.equal(state.todoList.value.length, 20)
  }
}
Promise.all([run(false), run(true)]).then(() => {
  assert.ok(source.includes("todoList.value.slice(0, 5)"))
  assert.ok(source.includes("todoOnly ? '刷新' : '查看详情'"))
  assert.ok(!source.includes('showAllTodos'))
  console.log('首页5条、独立列表分页、刷新和无更多请求回归通过')
}).catch(error => { console.error(error); process.exitCode = 1 })
