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
assert.match(source, /import\s*\{\s*repairTodoTarget, repairTodoUrl\s*\}\s*from\s*["']@\/service\/repairCollaboration["']/)
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
const action = source.slice(source.indexOf('const todoOpening = ref(false)'), source.indexOf('\nconst refreshAfterContractApproval'))
let notice
const unsupported = vm.runInNewContext(ts.transpileModule(action + '\nopenTodo({ todoType: "UNSUPPORTED_TODO" })', {
  compilerOptions: { target: ts.ScriptTarget.ES2020 },
}).outputText, {
  ref: require('vue').ref,
  repairTodoTarget: async () => undefined, parseTodoActionParams: () => ({}),
  isMaterialApprovalTodo: () => false, isStockOutExecuteTodo: () => false, isPlanApprovalTodo: () => false,
  uni: { showModal: options => { notice = options } },
})
const checkUnsupported = unsupported.then(() => { assert.equal(notice.title, '请到 PC 端办理'); assert.equal(notice.showCancel, false) })
async function checkDuplicateOpen() {
  let release,requests=0,navigations=0,now=1000,popups=0;
  const state={ref:require('vue').ref,Date:{now:()=>now},repairTodoTarget:()=>{requests++;return new Promise(resolve=>{release=resolve})},repairTodoUrl:target=>{assert.equal(target.taskId,'task2');return '/pages/ops/repairDetail?id=order&view=approval&taskId=task2'},parseTodoActionParams:()=>({}),uni:{navigateTo:async({url})=>{assert.match(url,/taskId=task2/);navigations++}},toast:{warning:()=>{}}};
  state.repairApproval={value:{open:async(id,params,initial)=>{assert.equal(id,'instance');assert.equal(params.taskId,'task2');popups++}}};
  vm.createContext(state);vm.runInContext(ts.transpileModule(action+'\nglobalThis.open = openTodo',{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,state);
  const first=state.open({});await state.open({});assert.equal(requests,1,'one pending resolution for rapid clicks');release({orderId:'order',view:'approval',taskId:'task2',instanceId:'instance'});await first;
  await state.open({});assert.equal(popups,1,'cooldown prevents duplicate popup after fast response');assert.equal(navigations,0,'approval no longer navigates to order');
  now+=601;state.parseTodoActionParams=()=>({instanceId:'instance',taskId:'task2'});await state.open({actionKey:'WORKFLOW_APPROVAL',bizModule:'REPAIR'});assert.equal(popups,2);assert.equal(requests,1,'known repair opens popup without preliminary duplicate detail');
}
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
Promise.all([run(false), run(true), checkUnsupported, checkDuplicateOpen()]).then(() => {
  assert.ok(source.includes("todoList.value.slice(0, 5)"))
  assert.ok(source.includes("todoOnly ? '刷新' : '查看详情'"))
  assert.ok(!source.includes('showAllTodos'))
  assert.ok(source.includes('ref="repairAssignment" standalone'))
  assert.ok(source.includes("target?.view === 'assignment'"))
  assert.ok(source.indexOf("target?.view === 'assignment'") < source.indexOf('repairTodoUrl(target)'))
  assert.ok(source.includes("displayTitle: item.title?.trim() || '未命名待办'"))
  assert.ok(source.includes('{{ item.summary }}'))
  console.log('首页5条、独立列表分页、刷新和无更多请求回归通过')
}).catch(error => { console.error(error); process.exitCode = 1 })
