const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const vue = require('vue')
const root = require('node:path').resolve(__dirname, '..')
let get = async () => { throw new Error('Unexpected request') }
const http = { get: (...args) => get(...args), post: async () => ({ success: true }) }
function evaluate(source, dependencies, globals = {}) {
  const module = { exports: {} }
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  vm.runInNewContext(code, { exports: module.exports, module, require: name => dependencies[name], uni: {
    showModal: options => options.success({ confirm: true }), showToast() {}, navigateBack() {}, switchTab() {},
  }, ...globals })
  return module.exports
}
const api = evaluate(fs.readFileSync(root + '/src/service/quotationApproval.ts', 'utf8'), { '@/utils/http': { http } })
const table = evaluate(fs.readFileSync(root + '/src/utils/quotationTable.ts', 'utf8'), { '@/service/quotationApproval': api })
const documentPreview = evaluate(fs.readFileSync(root + '/src/utils/quotationDocument.ts', 'utf8'), { '@/service/quotationApproval': api })
const plain = value => JSON.parse(JSON.stringify(value))
async function main() {
  {
  const contractQuote = evaluate(fs.readFileSync(root + '/src/service/contractQuotation.ts', 'utf8'), {
    '@/utils/http': { http }, './quotationApproval': api,
  })
  get = async () => { throw new Error('预览不得补查接口') }
  const contractPreview = await contractQuote.loadContractQuotation({ materialSnapshot: { records: [
    { materialCategory: '设备', materialName: '提交时名称', brand: '品牌', model: '型号', quantity: 0, unit: '台', remark: '备注', finalPrice: 99 },
  ], serviceFees: [{ name: '安装服务', quantity: 2, unit: '项', remark: '服务备注', guidePrice: 99, costPrice: 80 }] } })
  assert.equal(contractPreview.statusText, '合同快照')
  assert.equal(contractPreview.rows.length, 2)
  assert.equal(contractPreview.rows[0].materialCategory, undefined)
  assert.equal(contractPreview.rows[1].materialName, '安装服务')
  assert.equal(contractPreview.rows[1].unit, '项')
  assert.equal(contractPreview.rows[1].quantity, 2)
  assert.equal(contractPreview.rows[1].remark, '服务备注')
  assert.equal(contractPreview.rows[1].guidePrice, undefined)
  assert.equal(contractPreview.rows[1].costPrice, undefined)
  assert.equal(contractPreview.rows[1].isFee, true)
  assert.equal((await contractQuote.loadContractQuotation({ materialSnapshot: { serviceFees: [{ name: '仅服务' }] } })).rows.length, 1)
  assert.equal((await contractQuote.loadContractQuotation({ materialSnapshot: { records: [{}] } })).rows.length, 1)
  assert.equal(contractPreview.rows[0].quantity, 0)
  assert.equal(contractPreview.rows[0].finalPrice, undefined)
  assert.equal(contractPreview.showPrice, false)
  assert.equal((await contractQuote.loadContractQuotation({ materialSnapshot: null })).emptyText, '暂无物料及服务费快照')
  assert.equal((await contractQuote.loadContractQuotation({ materialSnapshot: { records: [] } })).emptyText, '本轮未提交物料或服务费')
  assert.equal((await contractQuote.loadContractQuotation({ materialSnapshot: {} })).emptyText, '快照未提供物料及服务费明细')
  const contractSource = fs.readFileSync(root + '/src/pages/home/components/ContractApprovalPopup.vue', 'utf8')
  assert.ok(!contractSource.includes('合同货物清单'))
  assert.ok(contractSource.includes(':z-index="2300"'))
  assert.ok(contractSource.includes('materialSnapshot: result.contract ? result.materialSnapshot : value.materialSnapshot'))
  const contractApi = evaluate(fs.readFileSync(root + '/src/service/contractApproval.ts', 'utf8'), { '@/utils/http': { http } })
  for (const code of [0, 200]) {
    get = async (url, params) => {
      assert.equal(url, '/project/contract/queryById')
      assert.equal(params.periodId, 'period-1')
      return { success: true, code, result: { contract: { id: 'contract-1' }, materialSnapshot: { records: [] } } }
    }
    assert.equal((await contractApi.contractApprovalApi.detail('period-1')).code, code)
  }
  get = async () => ({ success: false, code: 200 })
  await assert.rejects(() => contractApi.contractApprovalApi.detail('period-1'), /读取失败/)
  }
  const zoomSource = fs.readFileSync(root + '/src/pages/home/components/QuotationDocumentPreview.vue', 'utf8').match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
  const measurements = []
  const snapshotPreview = evaluate(zoomSource + '\nmodule.exports = { columns, cell };', {
    vue, '@/utils/quotationTable': table, '@/utils/quotationDocument': documentPreview,
  }, { defineProps: () => ({ materialOnly: true, rows: [], showPrice: false, brands: {} }), defineEmits: () => () => {} })
  assert.deepEqual(plain(snapshotPreview.columns.value.map(column => column.key)), ['index', 'name', 'brand', 'model', 'quantity', 'unit', 'remark'])
  assert.equal(snapshotPreview.cell({ isFee: true, materialName: '安装' }, 'name', 0), '【服务费】安装')
  assert.equal(snapshotPreview.cell({ isFee: true }, 'brand', 0), '—')
  const moneyRows = [{ basePrice: '10.10', finalPrice: 20, quantity: 3 },
    { isFee: true, basePrice: '5.05', finalPrice: 8, quantity: 2, documentAmount: 999 }]
  const moneyProps = vue.reactive({ modelValue: false, rows: moneyRows, showPrice: false, showCost: true, materialOnly: false, brands: {} })
  const moneyPreview = evaluate(zoomSource + '\nmodule.exports = { columns, cell, total, amountBasis, requestedBasis };', {
    vue, '@/utils/quotationTable': table, '@/utils/quotationDocument': documentPreview,
  }, { defineProps: () => moneyProps, defineEmits: () => () => {} })
  assert.equal(moneyPreview.amountBasis.value, 'cost')
  assert.equal(moneyPreview.total.value, '40.40')
  assert.equal(moneyPreview.cell(moneyRows[1], 'guideTotal', 1), '10.10')
  assert.equal(moneyPreview.cell(moneyRows[0], 'finalPrice', 0), '10.10')
  assert(moneyPreview.columns.value.some(c => c.title === '成本小计（元）'))
  moneyProps.showPrice = true
  assert.equal(moneyPreview.amountBasis.value, 'quote')
  assert(moneyPreview.columns.value.some(c => c.title === '报价单价（元）'))
  moneyPreview.requestedBasis.value = 'cost'
  assert.equal(moneyPreview.total.value, '40.40')
  moneyProps.showCost = false
  assert.equal(moneyPreview.amountBasis.value, 'quote')
  moneyProps.showPrice = false
  assert.equal(moneyPreview.total.value, '—')
  assert.equal(moneyPreview.cell(moneyRows[0], 'finalPrice', 0), '—')
  assert(!moneyPreview.columns.value.some(c => c.key === 'guideTotal'))
  moneyProps.materialOnly = true; moneyProps.showCost = true; moneyProps.showPrice = true
  assert.equal(moneyPreview.amountBasis.value, null)
  assert.equal(moneyPreview.total.value, '—')
  assert.equal(documentPreview.quotationDocumentTotal([{ basePrice: null, finalPrice: 100, quantity: 1 }], 'cost'), '—')
  assert.equal(documentPreview.quotationDocumentTotal([{ basePrice: 0, quantity: 1 }], 'cost'), '0.00')
  assert(fs.readFileSync(root + '/src/pages/home/quotationDetail.vue', 'utf8').includes(':show-cost="showCost"'))
  const preview = evaluate(zoomSource + '\nmodule.exports = { zoom, setZoom, fitWidth, fitScreen, scrollElement, paperElement };', {
    vue: { ...vue, getCurrentInstance: () => ({ proxy: {} }) }, '@/utils/quotationTable': table, '@/utils/quotationDocument': documentPreview,
  }, {
    defineProps: () => ({ modelValue: true, rows: [], showPrice: true }), defineEmits: () => () => {},
    uni: { createSelectorQuery: () => { const q = { in: () => q, select: () => q, boundingClientRect: callback => { measurements.push(callback); return q }, exec() {} }; return q } },
  })
  preview.setZoom(0); assert.equal(preview.zoom.value, 0.1)
  preview.setZoom(3); assert.equal(preview.zoom.value, 2)
  preview.setZoom(1); assert.equal(preview.zoom.value, 1)
  await preview.fitWidth(); measurements.shift()({ width: 390 }); assert.equal(preview.zoom.value, 0.22)
  await preview.fitWidth(); preview.setZoom(1.5); measurements.shift()({ width: 320 }); assert.equal(preview.zoom.value, 1.5)
  await preview.fitScreen()
  await measurements.shift()({ width: 390, height: 500 })
  measurements.shift()({ width: 366, height: 1000 })
  assert.ok(preview.zoom.value * 1600 < 366)
  assert.ok(preview.zoom.value / (366 / 1600) * 1000 <= 476)
  await preview.fitScreen()
  await measurements.shift()({ width: 320, height: 400 })
  preview.setZoom(1)
  measurements.shift()({ width: 296, height: 2000 })
  assert.equal(preview.zoom.value, 1)
  // H5 portal路径：直接读真实节点，不依赖失效的组件选择器。
  preview.scrollElement.value = { $el: { getBoundingClientRect: () => ({ width: 390, height: 600 }) } }
  preview.paperElement.value = { getBoundingClientRect: () => ({ width: 366, height: 800 }) }
  const pendingMeasurements = measurements.length
  await preview.fitScreen()
  await vue.nextTick()
  assert.equal(measurements.length, pendingMeasurements)
  assert.ok(preview.zoom.value < 0.23)
  preview.scrollElement.value = undefined
  preview.paperElement.value = undefined
  assert.equal(documentPreview.quotationDocumentTotal([{ finalPrice: '0.1', quantity: 3 }, { finalPrice: '1.005', quantity: 1 }]), '1.31')
  assert.equal(documentPreview.quotationDocumentTotal([{ finalPrice: null, quantity: 1 }]), '—')
  assert.equal(documentPreview.quotationDocumentTotal([{ finalPrice: 0, quantity: 1 }]), '0.00')
  assert.equal(documentPreview.quotationDocumentTotal(Array.from({ length: 11 }, () => ({ finalPrice: 1, quantity: 1 }))), '11.00')
  const keys = (record, access, personnel) => table.quotationDisplayColumns(record, access, personnel).map(column => column.key).join(',')
  assert.equal(keys({ approvalRoute: 'MARKET', status: '2' }, { canManage: true }), 'unit,quantity,basePrice,costTotal,finalPrice,quotationPercent,guideTotal,remark,approvalOpinion')
  assert.equal(keys({ approvalRoute: 'TECHNICAL', status: '2' }, { canManage: true }), 'unit,quantity,basePrice,costTotal,markupRate,finalPrice,remark,approvalOpinion')
  assert.equal(keys({ approvalRoute: 'TECHNICAL', status: '1' }, { canViewQuote: true }), 'unit,quantity,finalPrice,guideTotal,remark,approvalOpinion')
  assert.equal(keys({ approvalRoute: 'MARKET', status: '2' }, { canViewCost: true, canViewRate: true }), 'unit,quantity,basePrice,costTotal,remark,approvalOpinion')
  assert.equal(keys({ approvalRoute: 'TECHNICAL', status: '-1' }, {}), 'unit,quantity,remark')
  assert.equal(keys({ approvalRoute: 'TECHNICAL', status: '2' }, { canManage: true }, 'MARKET'), keys({ approvalRoute: 'MARKET', status: '2' }, { canManage: true }))
  assert.equal(table.quotationIdentity({ materialName: '摄像头', brand: '1' }, { 1: '品牌甲' }), '摄像头（品牌甲）')
  assert.equal(table.quotationIdentity({ materialName: '摄像头（品牌甲）', brand: '品牌甲' }), '摄像头（品牌甲）')
  assert.equal(table.quotationIdentity({ materialName: '安装费', isFee: true, brand: '服务费' }), '安装费')
  assert.equal(table.quotationModelPreview('1234567890'), '1234567890')
  assert.equal(table.quotationModelPreview('1234567890中文'), '1234567890...')
  assert.equal(table.quotationModelPreview(''), '暂无型号')
  assert.equal(table.quotationPercent('100', '120'), '20.00%')
  assert.equal(table.quotationPercent('300', '400'), '33.33%')
  assert.equal(table.quotationPercent('100', '80'), '-20.00%')
  assert.equal(table.quotationCell({ basePrice: 100, finalPrice: 80, markupRate: 99 }, 'markupRate'), '-20.00%')
  assert.equal(table.quotationCell({ basePrice: 0, finalPrice: 80, markupRate: 99 }, 'markupRate'), '0.00%')
  assert.equal(table.quotationCell({ basePrice: null, finalPrice: 80, markupRate: 99 }, 'markupRate'), '—')
  assert.equal(table.quotationPercent('0', '100'), '0.00%')
  assert.equal(table.quotationPercent(null, '100'), '—')
  assert.equal(table.quotationCell({ basePrice: '123.45', quantity: '2.5' }, 'costTotal'), '¥308.63')
  assert.equal(table.quotationPersonnelRoute(['m'], [{ id: 'm', departName: '市场部' }]), 'MARKET')
  for (const version of [null, undefined, '', ' ', -1, 1.5, true]) assert.throws(() => api.quotationVersion(version))
  assert.equal(api.quotationVersion('0'), 0)
  assert.equal(api.quotationLineTotal('1.005', '1'), '¥1.01')
  assert.equal(api.quotationLineTotal('0.1', '3'), '¥0.30')
  assert.equal(api.quotationLineTotal('123.45', '2.5'), '¥308.63')
  assert.equal(api.quotationLineTotal('0', '3'), '¥0.00')
  assert.equal(api.quotationLineTotal(null, '3'), '—')
  assert.equal(api.quotationLineTotal('bad', '3'), '—')
  assert.equal(api.approvalItems([{ id: 1, approvalOpinion: '字'.repeat(100) }], 100)[0].approvalOpinion.length, 100)
  assert.throws(() => api.approvalItems([{ id: 1, approvalOpinion: '字'.repeat(101) }], 100), /100/)
  get = async (url, params) => { assert.equal(url, '/stock/material/queryById'); assert.equal(params.id, 'material-id'); return { result: { id: 'material-id', specificationParams: '参数一\n参数二', stockQty: 0 } } }
  assert.equal((await api.getQuotationMaterial('material-id')).specificationParams, '参数一\n参数二')
  await assert.rejects(api.getQuotationMaterial(''), /缺少物料 ID/)
  get = async () => ({ result: { id: 'wrong-id' } })
  await assert.rejects(api.getQuotationMaterial('material-id'), /不匹配/)
  assert.throws(() => api.approvalItems([{ id: 1 }, { id: 1 }]))
  assert.throws(() => api.approvalItems([{ id: 1, approvalOpinion: 'x'.repeat(501) }]))
  const record = { id: 'q', periodId: 'p', version: 3, status: '2', approvalRoute: 'TECHNICAL' }
  assert.equal(api.canApproveQuotation(record, { canApprove: true }, code => code === 'plan:quotation:technicalApprove'), true)
  assert.equal(api.canApproveQuotation(record, { canApprove: 'true' }, () => true), false)
  assert.equal(api.canApproveQuotation(record, { canApprove: true }, () => false), false)
  assert.equal(api.canApproveQuotation({ ...record, status: '1' }, { canApprove: true }, () => true), false)
  assert.equal(api.canApproveQuotation({ ...record, approvalRoute: 'UNKNOWN' }, { canApprove: true }, () => true), false)
  assert.throws(() => api.quotationApprovalPayload(record, [{ id: 1 }], [], '0', ' '))
  assert.throws(() => api.quotationApprovalPayload(record, [], [], '1', ''))
  assert.throws(() => api.quotationApprovalPayload(record, [{ id: 1, approvalOpinion: '字'.repeat(101) }], [], '1', ''), /100/)
  const payload = api.quotationApprovalPayload(record, [{ id: 'm', approvalOpinion: '物料意见' }], [{ id: 'f', approvalOpinion: '服务费意见' }], '0', ' 原因 ')
  assert.deepEqual(plain(payload), { candidateId: 'q', version: 3, result: '0', reason: '原因', approvalItems: [{ itemId: 'm', approvalOpinion: '物料意见' }], serviceFeeApprovalItems: [{ itemId: 'f', approvalOpinion: '服务费意见' }] })
  get = async (_, params) => ({ result: { records: [{ id: params.pageNo }], total: 2, size: 1, serviceFees: [{ id: 'fee' }] } })
  assert.equal((await api.quotationPages('/items', {}, true)).rows.length, 2)
  get = async () => ({ result: { records: [{ id: 1 }], total: 2, serviceFees: [] } })
  await assert.rejects(api.quotationPages('/items', {}, true), /重复/)
  get = async () => ({ result: { records: [], total: 0 } })
  await assert.rejects(api.quotationPages('/items', {}, true), /服务费数据缺失/)
  get = async () => ({ result: { records: [], total: 2, serviceFees: [] } })
  await assert.rejects(api.quotationPages('/items', {}, true), /未加载完整/)
  get = async () => ({ success: false, message: '拒绝访问' })
  await assert.rejects(api.quotationPages('/items', {}), /拒绝访问/)

  const source = fs.readFileSync(root + '/src/pages/home/quotationDetail.vue', 'utf8').match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
  let latest = { ...record }, access = { canApprove: true }, calls = [], postError = false, handleBack
  const page = evaluate(source + '\nmodule.exports = { record, access, loading, materials, fees, items, rows, page, canApprove, openItem, opinion, saveOpinion, review, actionError, processed, submitting, rejectReason, documentPreviewVisible, drawerVisible, summaryColumns, tableColumns, quotationTotal, showQuoteRatio };', {
    vue, '@dcloudio/uni-app': { onLoad() {}, onShow() {}, onUnload() {}, onBackPress(callback) { handleBack = callback } },
    '@/utils/http': { http: { post: async (url, body) => { if (postError) throw new Error('网络异常'); calls.push({ url, body }); return { success: true } } } },
    '@/store/permission': { usePermissionStore: () => ({ loaded: true, hasPermission: () => true }) },
    '@/store/user': { useUserStore: () => ({ userInfo: {}, identity: { departmentIds: [] } }) },
    '@/utils/quotationTable': table,
    '@/utils/quotationDocument': documentPreview,
    '@/service/quotationApproval': { ...api, getQuotationRecord: async () => latest, getQuotationAccess: async () => access },
  })
  page.record.value = record; page.access.value = access; page.loading.value = false
  page.materials.value = Array.from({ length: 11 }, (_, i) => ({ id: String(i), materialName: '物料' + i }))
  page.fees.value = [{ id: 'fee', name: '服务费' }]
  page.openItem(page.items.value[0]); page.opinion.value = '第一页意见'; page.saveOpinion()
  page.openItem(page.items.value[0]); page.opinion.value = '字'.repeat(101); page.saveOpinion()
  assert.equal(page.materials.value[0].approvalOpinion, '第一页意见')
  page.materials.value.forEach(row => { row.quantity = 1; row.finalPrice = 2 })
  page.fees.value[0].quantity = 1; page.fees.value[0].guidePrice = 3
  page.access.value = { canManage: true }
  assert.equal(page.quotationTotal.value, '25.00')
  assert.equal(page.showQuoteRatio.value, true)
  page.access.value = { canViewQuote: true, canViewCost: true }
  assert.equal(page.quotationTotal.value, '25.00'); assert.equal(page.showQuoteRatio.value, false)
  page.access.value = {}; assert.equal(page.quotationTotal.value, '—')
  page.access.value = access
  page.page.value = 2; page.openItem(page.items.value[0]); page.opinion.value = '第二页意见'; page.saveOpinion()
  page.openItem(page.items.value[1]); page.opinion.value = '费用意见'; page.saveOpinion()
  page.page.value = 1; assert.equal(page.items.value[0].approvalOpinion, '第一页意见')
  latest = { ...record, version: 4 }; await page.review('1'); assert.equal(calls.length, 0); assert.match(page.actionError.value, /已被修改/)
  latest = record; access = { canApprove: false }; await page.review('1'); assert.equal(calls.length, 0)
  access = { canApprove: true }; page.access.value = access
  postError = true; await page.review('1'); assert.equal(page.processed.value, false)
  assert.equal(page.materials.value[0].approvalOpinion, '第一页意见'); assert.equal(page.submitting.value, false)
  postError = false
  await Promise.all([page.review('1'), page.review('1')]); assert.equal(calls.length, 1)
  assert.equal(calls[0].url, '/project/materialCandidate/approve')
  assert.equal(calls[0].body.approvalItems.length, 11)
  assert.equal(calls[0].body.approvalItems[10].approvalOpinion, '第二页意见')
  assert.equal(calls[0].body.serviceFeeApprovalItems[0].approvalOpinion, '费用意见')
  assert.equal(page.processed.value, true); await page.review('1'); assert.equal(calls.length, 1)
  page.access.value = { canManage: true }
  page.record.value = { ...record, approvalRoute: 'MARKET' }
  assert.equal(page.summaryColumns.value.map(column => column.key).join(','), 'unit,quantity,costTotal,guideTotal')
  assert.ok(page.tableColumns.value.some(column => column.key === 'basePrice'))
  page.documentPreviewVisible.value = true; page.drawerVisible.value = true
  assert.equal(page.rows.value.length, 12)
  assert.equal(handleBack(), true); assert.equal(page.drawerVisible.value, false); assert.equal(page.documentPreviewVisible.value, true)
  assert.equal(handleBack(), true); assert.equal(page.documentPreviewVisible.value, false)
  assert.equal(page.materials.value[0].approvalOpinion, '第一页意见')
  const detailCalls = []
  get = async (url, params) => {
    detailCalls.push({ url, params })
    return { result: { candidate: record, records: [{ id: 'm1' }], serviceFees: [], total: 1 } }
  }
  const detail = await api.quotationPages('/project/materialCandidateItem/list', { candidateId: 'q' }, true, 'p')
  assert.equal(detail.candidate.id, 'q')
  assert.equal(detailCalls.length, 1)
  assert.equal(detailCalls[0].url, '/project/materialCandidateItem/list')
  await api.getQuotationRecord('p', 'q')
  assert.equal(detailCalls[1].params.pageSize, 1)
  assert.ok(detailCalls.every(call => call.url !== '/project/materialCandidate/list'))
  assert.throws(() => api.readQuotationCandidate({}, 'p', 'q'))
  assert.throws(() => api.readQuotationCandidate({ candidate: { ...record, periodId: 'other' } }, 'p', 'q'))
  assert.equal(api.readQuotationCandidate({ candidate: { ...record, approvalRoute: null } }, 'p', 'q').approvalRoute, 'TECHNICAL')
  get = async (_url, params) => ({ result: { candidate: { ...record, version: params.pageNo }, records: [{ id: `m${params.pageNo}` }], serviceFees: [], total: 2 } })
  await assert.rejects(api.quotationPages('/project/materialCandidateItem/list', { candidateId: 'q' }, true, 'p'), /已变更/)
  get = async () => ({ result: { candidate: record, records: [], serviceFees: [], total: 0 } })
  assert.equal((await api.quotationPages('/project/materialCandidateItem/list', { candidateId: 'q' }, true, 'p')).candidate.id, 'q')
  console.log('报价回归通过：列权限、金额、分页、candidate摘要、跨页版本、意见及重复提交保护')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
