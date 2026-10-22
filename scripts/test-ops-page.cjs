// Execute real component setup against an in-memory backend; no business HTTP requests.
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict')
const ts = require('typescript'), vue = require('vue'), sfc = require('vue/compiler-sfc')
const transpile = source => ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText
const domain = {exports:{}}
const additional={exports:{},require}
vm.runInNewContext(transpile(fs.readFileSync('src/service/repairAdditional.ts','utf8')),additional)
vm.runInNewContext(transpile(fs.readFileSync('src/pages/ops/components/preview/repairWorkflow.ts','utf8')),domain)
const apiModule = {exports:{},require:name => name === '@/utils/http' ? {http:{}} : name === '@/store/user' ? {} : name === '@/utils/platform' ? {isH5:false} : {getEnvBaseUrl:()=>'/api'}}
vm.runInNewContext(transpile(fs.readFileSync('src/service/repairOrder.ts','utf8').replaceAll('import.meta.env','({MODE:"test"})')),apiModule)
const calls = []
const detail = {
  canChangeQuotationDecision:true,
  order:{id:'o1',orderNo:'R001',version:1,workStatus:'PENDING',quotationStatus:'UNDETERMINED',responsibleUserId:'me',projectName:'主项目-分期',periodId:'p',faultDescription:'故障'},
  actions:{canViewRepairDetail:true,canStartWork:true,canOwnerApply:true},workRecords:[],products:[{sourceItemKey:'p1',productNameSnapshot:'产品'}],attachments:[],workflows:[],applications:[],
}
let work
function newWork() { return {orderId:'o1',recordId:'r1',workRole:detail.order.responsibleUserId === 'me' ? 'OWNER' : 'COLLABORATOR',formStatus:'DRAFT',recordStatus:'ACTIVE',fileIds:[],files:[],persons:[],materialUseIds:[],vehicleValue:null,actions:{canSaveDraft:true,canSubmit:true,canUpdate:false,canEnd:false},rawStartedAt:'2026-10-20T09:00:00'} }
async function saveWork(data,kind) { calls.push([kind,data]);work={...work,...data,formStatus:kind==='saveDraft'?'DRAFT':'SUBMITTED',actions:{canSaveDraft:kind==='saveDraft',canSubmit:kind==='saveDraft',canUpdate:kind!=='saveDraft',canEnd:kind!=='saveDraft'}};return work }
const api = {
  list:async query => {calls.push(['list',query]);return {records:[detail.order],total:1}},
  detail:async id => {calls.push(['detail',id]);return detail},
  options:async type => {calls.push(['options',type]);return []},
  begin:async data => {calls.push(['begin',data]);detail.order.version++;detail.workRecords=[{id:'r1',version:1,operatorUserId:'me',recordStatus:'ACTIVE',repairMethod:'OFFLINE',rawStartedAt:'2026-10-20T09:00:00'}];work=newWork();return {...detail,recordId:'r1'}},
  workDetail:async (orderId,recordId)=>{calls.push(['workDetail',{orderId,recordId}]);return work},
  saveDraft:async data=>saveWork(data,'saveDraft'),
  submitWork:async data=>saveWork(data,'submitWork'),
  updateWork:async data=>saveWork(data,'updateWork'),
  end:async data => {calls.push(['end',data]);detail.workRecords[0].recordStatus='ENDED';detail.workRecords[0].rawEndedAt='2026-10-20T10:00:00';return detail},
}
const filename='src/pages/ops/components/preview/OpsWorkflow.vue'
const {descriptor}=sfc.parse(fs.readFileSync(filename,'utf8'),{filename})
const logTemplate=descriptor.template.content.split(`screen === 'log' && selected && currentLog`)[1].split(`screen === 'quote'`)[0]
assert.ok(!logTemplate.includes('canFillQuotation') && !logTemplate.includes('报价状态'),'quotation belongs to order detail, not log form')
assert.ok(descriptor.template.content.includes('title="报价管理"'))
const script=sfc.compileScript(descriptor,{id:'repair-test'})
const box={exports:{},setTimeout,clearTimeout,setInterval:()=>0,clearInterval:()=>{},uni:{getStorageSync:()=>false,showToast:()=>{},getLocation:p=>p.success({longitude:117.2,latitude:39.1})},require:name=>{
  if(name==='vue')return {...vue,onBeforeUnmount:()=>{}}
  if(name==='./repairWorkflow')return domain.exports
  if(name==='@/store/user')return {useUserStore:()=>({identity:{userId:'me'},userInfo:{realname:'当前人员',username:'me'}})}
  if(name==='@/service/repairOrder')return {...apiModule.exports,repairOrderApi:api,uploadRepairAttachment:async()=> 'file-id'}
  if(name==='@/service/repairAdditional')return additional.exports
  if(name.endsWith('.vue'))return {}
  return require(name)
}}
vm.runInNewContext(transpile(script.content),box)
const tick=async()=>{await vue.nextTick();await new Promise(setImmediate);await vue.nextTick()}
async function main(){
  const scope=vue.effectScope()
  const page=scope.run(()=>box.exports.default.setup({canManage:false},{expose:()=>{},emit:()=>{}}))
  assert.equal(page.formatReportedAt('2026-10-22T09:30:12'),'2026-10-22 09:30:12')
  assert.equal(page.formatReportedAt(''),'—')
  const card=descriptor.template.content.split('class="case-card"')[1].split('</view>\n            </view>')[0]
  assert.ok(card.includes('<text>维修人</text>'))
  assert.ok(!card.includes('detailStatus(c)'),'status is only in top-right badge')
  assert.equal(page.reporterName.value, '当前人员')
  assert.ok(vue.isReadonly(page.reporterName), 'reporter must follow authenticated user and be readonly')
  const optionCalls=[]
  const options={customers:[{customerId:'c1',customerName:'客户一'},{customerId:'c2',customerName:'客户二'}],projects:[{customerId:'c1',periodId:'p1',projectName:'项目一'},{customerId:'c2',periodId:'p2',projectName:'项目二'}],products:[{periodId:'p1',productName:'门禁'},{periodId:'p1',productName:'堆场系统'},{periodId:'p2',productName:'监控'}]}
  api.reportOptions=async q=>{optionCalls.push(q);return options}
  await page.loadOptions()
  await page.chooseCustomer(0)
  assert.equal(optionCalls.at(-1).customerId,'c1')
  assert.equal(page.projects.value.length,1)
  await page.chooseProject(0)
  assert.equal(optionCalls.at(-1).periodId,'p1')
  assert.equal(page.productOptions.value.join(','),'门禁,堆场系统')
  page.selectedProducts.value=['门禁','堆场系统']
  api.reportOptions=async()=>({customers:[],projects:[],products:[]})
  await page.loadOptions('customers')
  assert.equal(page.draft.customerId,'c1','search must preserve parent selection')
  assert.equal(page.selectedProducts.value.join(','),'门禁,堆场系统')
  api.reportOptions=async q=>{optionCalls.push(q);return options}
  await page.loadOptions()
  let resolveOld
  api.reportOptions=()=>new Promise(resolve=>{resolveOld=resolve})
  const pending=page.loadOptions('products')
  api.reportOptions=async q=>{optionCalls.push(q);return options}
  await page.chooseCustomer(1)
  resolveOld(options);await pending
  assert.equal(page.draft.projectId,'')
  assert.equal(page.selectedProducts.value.length,0)
  assert.equal(page.productOptions.value.length,0,'stale product response must not repopulate another customer')
  assert.equal(page.projects.value[0].id,'p2')
  assert.ok(descriptor.template.content.includes('type="datetime" use-second'))
  assert.ok(!descriptor.template.content.includes('v-model="reporterName"'))
  const reportForm = descriptor.template.content.split('<SectionCard title="关联信息">')[1].split('<SectionCard title="报修信息">')[0]
  assert.equal((reportForm.match(/filterable/g)||[]).length,3)
  assert.ok(!reportForm.includes('<input'), 'search belongs inside each selection popup')
  assert.ok(reportForm.includes('item.id === $event.value'), 'filtered selections must resolve by ID, not visible index')
  assert.ok(reportForm.includes('type="checkbox"'), 'products must support multiple selections')
  await page.chooseCustomer(0); await page.chooseProject(0)
  page.selectedProducts.value=['门禁','堆场系统']; page.draft.fault='测试故障'
  let submitted
  api.submit=async input=>{submitted=apiModule.exports.repairReportPayload(input);return detail}
  await page.createReport()
  assert.equal(submitted.productNames,'门禁,堆场系统','submit dictionary names, comma separated')
  assert.equal(page.selectedProducts.value.length,0,'successful submit clears all selected products')
  page.openHomeEntry('records');await tick()
  assert.equal(calls.filter(c=>c[0]==='list').length,1,'entry must not duplicate list requests')
  assert.equal(calls[0][1].scope,'RESPONSIBLE')
  assert.equal(page.paged.value.length,1)
  await page.openCase(page.paged.value[0])
  assert.equal(page.footerActions.value[0].text,'开始维修')
  assert.equal(calls.filter(c=>c[0]==='detail').length,1)
  await page.startWork()
  await tick()
  assert.equal(page.screen.value,'begin')
  box.uni.getLocation = p => p.fail({})
  await page.refreshClockLocation()
  assert.equal(page.clockLocation.value.status,'FAILED')
  assert.equal(page.footerActions.value[0].disabled,true)
  page.beginWork();await tick()
  assert.equal(calls.filter(c=>c[0]==='begin').length,0,'failed location must not submit attendance')
  box.uni.getLocation = p => p.success({longitude:117.2,latitude:39.1})
  await page.refreshClockLocation()
  page.beginWork();await tick()
  assert.equal(page.screen.value,'log')
  const ownerBegin=calls.find(c=>c[0]==='begin')[1]
  assert.equal(Object.keys(ownerBegin).sort().join(','),'latitude,longitude,orderId,repairMethod')
  assert.equal(ownerBegin.longitude,117.2)
  assert.equal(ownerBegin.latitude,39.1)
  assert.equal(ownerBegin.repairMethod,'OFFLINE')
  assert.equal(calls.filter(c=>c[0]==='options' && c[1]==='vehicles').length,0)
  assert.equal(calls.filter(c=>c[0]==='detail').length,1,'mutation detail should be reused')
  await page.transact(()=>page.saveLog(true),'log')
  assert.equal(calls.filter(c=>c[0]==='saveDraft').length,1,'empty business content may be saved as draft')
  assert.equal(calls.find(c=>c[0]==='saveDraft')[1].recordId,'r1')
  page.currentLog.value.position='';page.currentLog.value.fault='无法启动';page.currentLog.value.description='检查线路'
  assert.equal(page.logPage.value,0)
  assert.equal(page.footerActions.value.at(-1).text,'下一步')
  page.changeLogPage(1);page.changeLogPage(2)
  assert.equal(page.footerActions.value.at(-1).text,'提交日志，去签退')
  assert.equal(page.currentLog.value.description,'检查线路','pagination preserves draft')
  page.resourceBusy.value=true;page.changeLogPage(0)
  assert.equal(page.logPage.value,2,'cannot navigate during material submission')
  page.resourceBusy.value=false
  page.currentLog.value.result='需要复修';page.currentLog.value.reason='等待备件'
  await assert.rejects(page.saveLog(), /至少 1 张维修照片或 1 段视频/)
  assert.equal(page.logPage.value,1,'validation reveals repair information page')
  page.currentLog.value.videos=['local-video.mp4']
  assert.equal(page.canFillQuotation.value,true)
  page.openForm('quote')
  page.installDetail(detail)
  assert.equal(page.currentLog.value.description,'检查线路','quotation refresh preserves log draft')
  assert.equal(page.currentLog.value.videos[0],'local-video.mp4')
  page.go('log')
  page.currentLog.value.result='维修完成'
  page.submitLogForCheckout();await tick()
  assert.equal(page.screen.value,'checkout')
  const preserved={personType:'INTERNAL',sourcePersonId:'no-longer-in-options'}
  page.workDraft.value.persons=[preserved];page.workDraft.value.vehicleValue='historical-car';page.workDraft.value.materialUseIds=['historical-use']
  await page.transact(()=>page.saveLog(),'checkout')
  const updated=calls.find(c=>c[0]==='updateWork')[1]
  assert.equal(updated.persons[0].sourcePersonId,'no-longer-in-options')
  assert.equal(updated.vehicleValue,'historical-car');assert.equal(updated.materialUseIds[0],'historical-use')
  assert.equal(updated.fileIds[0],'file-id','full replacement must preserve uploaded file IDs')
  assert.equal(calls.filter(c=>c[0]==='end').length,0,'saving log must not sign out')
  assert.equal(page.clockLocation.value.status,'NORMAL')
  await page.endWork();assert.equal(page.screen.value,'checkout','owner must choose next action')
  page.checkoutNext.value='detail'
  page.endWork();await tick()
  assert.equal(page.screen.value,'detail')
  assert.equal(calls.find(c=>c[0]==='submitWork')[1].version,undefined)
  assert.equal('faultLocation' in calls.find(c=>c[0]==='submitWork')[1],false,'removed fault location must not be submitted')
  assert.equal(calls.find(c=>c[0]==='submitWork')[1].fileIds.length,1)
  assert.equal(Object.keys(calls.find(c=>c[0]==='end')[1]).sort().join(','),'location,orderId,recordId')
  assert.equal('repairResult' in calls.find(c=>c[0]==='submitWork')[1],false)
  assert.equal(calls.find(c=>c[0]==='end')[1].location.coordinateSystem,'GCJ02')
  detail.workRecords[0].recordStatus='ACTIVE';page.installDetail(detail);await page.openWork('r1');page.go('checkout');await tick()
  page.checkoutNext.value='completion'
  const realEnd=api.end;api.end=async()=>{throw Error('签退失败')}
  await page.endWork();assert.equal(page.screen.value,'checkout');assert.equal(page.checkoutNext.value,'completion')
  api.end=realEnd;await page.endWork();await tick()
  assert.equal(page.screen.value,'completion','successful owner checkout opens application without submitting it')
  assert.equal(calls.filter(c=>c[0]==='completion').length,0)
  page.priceInput.value='101';page.selected.value.confirmedPrice=100
  assert.equal(page.completionPriceChanged.value,true)
  page.selected.value.quoteState='无需报价'
  assert.equal(page.completionNeedsPrice.value,false)
  assert.equal(page.completionPriceChanged.value,false)
  page.go('detail')
  api.quotation=async data=>{calls.push(['quotation',data]);return detail}
  api.completion=async data=>{calls.push(['completion',data]);return detail}
  page.quoteRequired.value=false;page.noQuoteReason.value='维保范围内';page.faultScope.value=''
  page.sendQuotation();await tick()
  assert.equal(Object.keys(calls.filter(c=>c[0]==='quotation').at(-1)[1]).sort().join(','),'orderId,quotationRequired,reason')
  page.quoteRequired.value=true;page.faultScope.value='更换电源';page.quoteDraft.value=[{name:'电源',qty:1,price:100}]
  page.sendQuotation();await tick()
  assert.equal(Object.keys(calls.filter(c=>c[0]==='quotation').at(-1)[1]).sort().join(','),'faultScope,items,orderId,quotationRequired')
  detail.order.quotationRequired=false;page.installDetail(detail);page.completionDescription.value='维修结束';page.priceInput.value='999';page.amountChangeReason.value='旧原因'
  page.complete();await tick()
  assert.equal(Object.keys(calls.filter(c=>c[0]==='completion').at(-1)[1]).sort().join(','),'description,orderId')
  detail.order.quotationRequired=true;detail.order.latestQuotationId='q';detail.quotations=[{id:'q',customerConfirmedAmount:100}]
  page.installDetail(detail);page.priceInput.value='101';page.amountChangeReason.value=''
  const completionCount=calls.filter(c=>c[0]==='completion').length
  page.complete();await tick();assert.equal(calls.filter(c=>c[0]==='completion').length,completionCount,'changed final price requires reason')
  page.amountChangeReason.value='增加配件';page.complete();await tick()
  assert.equal(calls.filter(c=>c[0]==='completion').at(-1)[1].amountChangeReason,'增加配件')
  page.priceInput.value='100.00';page.amountChangeReason.value='';page.complete();await tick()
  assert.equal(calls.filter(c=>c[0]==='completion').at(-1)[1].amountChangeReason,undefined,'unchanged price sends no stale reason')
  detail.actions.canOwnerApply=false;detail.canChangeQuotationDecision=true;page.installDetail(detail)
  assert.equal(page.canFillQuotation.value,true,'quotation permission independent from generic owner-apply')
  page.openForm('quote');assert.equal(page.footerActions.value.length,1)
  page.go('detail')
  detail.actions={canViewRepairDetail:true,canStartWork:false,canOwnerApply:false}
  detail.canChangeQuotationDecision=false
  await page.refreshSelected()
  assert.equal(page.canFillQuotation.value,false)
  assert.equal(page.footerActions.value.length,0)
  assert.equal(page.canShowMore.value,false)
  detail.workflows=[{id:'instance',businessId:'application',tasks:[{id:'task',canHandle:true}]}]
  detail.applications=[{id:'application',applicationType:'QUOTATION'}]
  await page.refreshSelected()
  assert.equal(page.footerActions.value[0].text,'办理审批','server task permission grants approval')
  detail.workflows=[];detail.applications=[]
  detail.order.responsibleUserId='actual-owner'
  detail.actions={canViewRepairDetail:true,canStartWork:true,canOwnerApply:false}
  detail.workRecords=[]
  await page.refreshSelected()
  assert.equal(page.isAssistantWork.value,true)
  assert.equal(page.footerActions.value[0].text,'填写维修日志')
  const vehicleRequests=calls.filter(c=>c[0]==='options' && c[1]==='vehicles').length
  await page.startWork();await tick()
  assert.equal(calls.filter(c=>c[0]==='options' && c[1]==='vehicles').length,vehicleRequests,'assistant does not load owner vehicle options')
  page.beginWork();await tick()
  const begin=calls.filter(c=>c[0]==='begin').at(-1)[1]
  assert.equal(Object.keys(begin).sort().join(','),'latitude,longitude,orderId,repairMethod')
  await assert.rejects(page.saveLog(),/维修内容/)
  page.currentLog.value.description='协助检查线路'
  page.submitLogForCheckout();await tick()
  assert.equal(page.screen.value,'checkout')
  const assistantPayload=calls.filter(c=>c[0]==='submitWork').at(-1)[1]
  assert.equal(Object.keys(assistantPayload).sort().join(','),'faultDescription,fileIds,materialUseIds,orderId,persons,recordId,repairDescription,vehicleValue','full replacement preserves optional collaborator fields without result or quotation')
  assert.equal(assistantPayload.repairDescription,'协助检查线路')
  assert.equal(detail.order.responsibleUserId,'actual-owner')
  page.endWork();await tick()
  assert.equal(page.screen.value,'detail')
  assert.equal(detail.order.workStatus,'PENDING','assistant does not mutate whole-order status on client')
  page.relation.value='我协助的';page.go('records');await tick()
  assert.equal(calls.filter(c=>c[0]==='list').at(-1)[1].scope,'HELPING')
  page.resetFilters();await tick()
  assert.equal(calls.filter(c=>c[0]==='list').at(-1)[1].scope,'RESPONSIBLE')
  page.cases.value=[{id:'log-test',raw:{workRecords:[],order:{}},actions:{},logs:[{id:'a',startedAt:100},{id:'c',startedAt:300},{id:'b',startedAt:200},{id:'d',startedAt:400}]}]
  page.selectedId.value='log-test';page.showAllLogs.value=false
  assert.equal(page.visibleLogs.value.map(l=>l.id).join(','),'d,c,b','detail defaults to latest three logs regardless of response ordering')
  page.showAllLogs.value=true
  assert.equal(page.visibleLogs.value.length,4)
  detail.actions={canViewRepairDetail:true,canEditContact:true,canStartWork:true}
  page.selectedId.value='o1';page.cases.value=[apiModule.exports.repairCaseView(detail)];await tick()
  api.contact=async data=>{calls.push(['contact',data]);return detail}
  page.openAdditional('contact');assert.equal(page.screen.value,'additional');assert.equal(page.title.value,'修改联系资料')
  page.submitAdditional({orderId:'o1',serviceAddress:'地址',contactPerson:'联系人',contactPhone:'123',reason:'变更'},[]);await tick()
  assert.equal(calls.at(-1)[0],'contact');assert.equal(page.screen.value,'detail')
  api.missingClock=async data=>{calls.push(['missingClock',data]);return detail}
  page.openAdditional('missingClock');page.submitAdditional({orderId:'o1',afterFileIds:['pending-upload-0']},['local-photo']);await tick()
  assert.equal(calls.at(-1)[1].afterFileIds[0],'file-id','upload placeholders must never reach backend')
  Object.assign(detail.order,{customerId:'c1',periodId:'p1',productNames:'门禁',reporterName:'原始报修姓名',reportTime:'2026-10-22T09:30:12',reportRemark:'原备注'})
  detail.actions={canEditReport:true,canCancelReport:true,canViewRepairDetail:false}
  detail.reportAttachments=[{fileId:'old-image',mediaType:'IMAGE',fileName:'原图'}]
  page.installDetail(detail);page.source.value='reports';page.go('detail')
  assert.equal(page.footerActions.value.map(x=>x.text).join(','),'取消报修,修改报修','reporter does not need repair-detail permission')
  api.reportEdit=async (id,input,reason)=>{calls.push(['reportEdit',{id,input,reason}]);return detail}
  await page.editReport()
  assert.equal(page.title.value,'修改报修');assert.equal(page.selectedProducts.value[0],'门禁');assert.equal(page.retainedReportFiles.value[0].fileId,'old-image')
  page.saveReportEdit();await tick();assert.ok(page.error.value.includes('修改原因'))
  page.reportChangeReason.value='补充描述';page.draft.fault='修正故障';page.saveReportEdit();await tick()
  const edit=calls.filter(c=>c[0]==='reportEdit').at(-1)[1]
  assert.equal(edit.input.fileIds[0],'old-image');assert.equal(edit.input.reporterName,'原始报修姓名');assert.equal(edit.input.reportTime,'2026-10-22 09:30:12');assert.equal(edit.reason,'补充描述')
  api.reportCancel=async(id,reason)=>{if(!reason.trim())throw Error('请填写取消原因');calls.push(['reportCancel',{id,reason}]);detail.actions={};detail.order.workStatus='CLOSED';return detail}
  page.openReportCancel();page.cancelReport();await tick();assert.ok(page.error.value.includes('取消原因'))
  page.reportCancelReason.value='重复报修';page.cancelReport();await tick();assert.equal(calls.at(-1)[0],'reportCancel');assert.equal(page.footerActions.value.length,0)
  page.go('create');assert.equal(page.editingReport.value,'');assert.equal(page.retainedReportFiles.value.length,0);assert.equal(page.draft.fault,'')
  detail.actions={canViewRepairDetail:true};page.installDetail(detail);page.source.value='records'
  work={...newWork(),recordId:'history-1',recordStatus:'ENDED',formStatus:'SUBMITTED',actions:{canUpdate:true}}
  await page.toggleLog('history-1')
  assert.equal(page.screen.value,'logDetail');assert.equal(page.title.value,'维修日志详情')
  assert.equal(page.viewedWork.value.recordId,'history-1');assert.equal(page.logState('history-1'),'已签退')
  assert.equal(page.footerActions.value.map(x=>x.text).join(','),'编辑本次日志')
  assert.equal(calls.filter(c=>c[0]==='workDetail').at(-1)[1].recordId,'history-1')
  page.back();assert.equal(page.screen.value,'detail')
  const originalWorkDetail=api.workDetail
  api.workDetail=async()=>{throw Error('测试加载失败')}
  await page.toggleLog('history-1');assert.equal(page.viewedWork.value,undefined);assert.equal(page.footerActions.value.length,0);assert.match(page.error.value,/加载失败/)
  let resolveLog
  api.workDetail=()=>new Promise(resolve=>{resolveLog=resolve})
  const pendingLog=page.toggleLog('history-1');page.back();resolveLog(work);await pendingLog
  assert.equal(page.screen.value,'detail');assert.equal(page.viewedWork.value,undefined,'late response after back is ignored')
  api.workDetail=originalWorkDetail
  page.go('detail');await tick();page.showContact.value=true;page.back()
  assert.equal(page.showContact.value,false);assert.equal(page.screen.value,'detail','back closes contact sheet first')
  page.showReportDetails.value=true;page.selectedId.value='another-order';await tick()
  assert.equal(page.showReportDetails.value,false,'new order starts collapsed')
  detail.order.quotationStatus='HEAD_REVIEW';detail.order.latestQuotationId='q-test'
  detail.quotations=[{id:'q-test',applicationId:'qa-test',totalAmount:20}]
  detail.applications=[{id:'qa-test',applicationType:'QUOTATION',applicationStatus:'PENDING',applicantUserId:'me'}]
  detail.canChangeQuotationDecision=false
  page.selectedId.value='o1';page.installDetail(detail);await tick()
  assert.equal(page.canWithdrawQuotation.value,true)
  detail.canChangeQuotationDecision=true;page.installDetail(detail)
  assert.equal(page.quotationEntryText.value,'查看详情','submitted quotation never shows handling even if modification flag is true')
  assert.equal(page.canEditQuotationDetails.value,false,'pending quotation must withdraw before editing')
  page.openQuotationEntry();assert.equal(page.showQuoteDetails.value,true)
  detail.canChangeQuotationDecision=false;page.installDetail(detail)
  assert.ok(!descriptor.template.content.includes('quotationWithdrawReason'),'quotation withdrawal needs no reason input')
  detail.order.quotationStatus='GM_REVIEW';page.installDetail(detail);assert.equal(page.canWithdrawQuotation.value,false)
  detail.order.quotationStatus='HEAD_REVIEW';page.installDetail(detail)
  api.withdraw=async payload=>{calls.push(['withdraw',payload]);detail.order.quotationStatus='PENDING_QUOTATION';detail.canChangeQuotationDecision=true;detail.applications[0].applicationStatus='WITHDRAWN';return detail}
  await page.withdrawQuotation()
  assert.equal(calls.filter(c=>c[0]==='withdraw').at(-1)[1].reason,'撤回修改报价')
  assert.equal(calls.filter(c=>c[0]==='withdraw').at(-1)[1].applicationId,'qa-test')
  assert.equal(page.screen.value,'quote');assert.equal(page.canWithdrawQuotation.value,false)
  assert.equal(page.canEditQuotationDetails.value,true)
  page.openQuotationEntry();page.editQuotationDetails();assert.equal(page.showQuoteDetails.value,false)
  detail.quotations=[];detail.order.latestQuotationId=null;page.installDetail(detail)
  assert.equal(page.quotationEntryText.value,'办理报价')
  api.materialApply=async payload=>{calls.push(['materialApply',payload]);return detail}
  page.materialType.value='领料';page.submitMaterials([{id:'m1',qty:2}],'维修使用');await tick()
  let materialPayload=calls.filter(c=>c[0]==='materialApply').at(-1)[1]
  assert.equal('bizType' in materialPayload,false);assert.equal(materialPayload.applyType,'OUT');assert.equal(materialPayload.usageType,'MAINTENANCE');assert.equal(materialPayload.repairOrderId,'o1')
  detail.materialLinks=[{linkType:'PICK',stockApplyItemId:'source1',materialId:'m1'}];page.installDetail(detail)
  page.materialType.value='还料';page.submitMaterials([{id:'source1',qty:1}],'剩余退回');await tick()
  materialPayload=calls.filter(c=>c[0]==='materialApply').at(-1)[1]
  assert.equal('bizType' in materialPayload,false);assert.equal(materialPayload.applyType,'IN');assert.equal(materialPayload.usageType,'MAINTENANCE')
  scope.stop()
  console.log('PASS page list, server permissions, recordId, new work endpoints, checkout routing and quotation/completion payloads')
}
main().catch(e=>{console.error(e);process.exitCode=1})
