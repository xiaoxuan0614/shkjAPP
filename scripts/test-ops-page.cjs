// Execute real component setup against an in-memory backend; no business HTTP requests.
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict')
const ts = require('typescript'), vue = require('vue'), sfc = require('vue/compiler-sfc')
const transpile = source => ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText
const domain = {exports:{}}
const additional={exports:{},require}
const collaborationModule={exports:{},require:()=>({http:{}})}
vm.runInNewContext(transpile(fs.readFileSync('src/service/repairCollaboration.ts','utf8')),collaborationModule)
vm.runInNewContext(transpile(fs.readFileSync('src/service/repairAdditional.ts','utf8')),additional)
vm.runInNewContext(transpile(fs.readFileSync('src/pages/ops/components/preview/repairView.ts','utf8')),domain)
const apiModule = {exports:{},require:name => name === '@/utils/http' ? {http:{}} : name === '@/store/user' ? {} : name === '@/utils/platform' ? {isH5:false} : {getEnvBaseUrl:()=>'/api'}}
vm.runInNewContext(transpile(fs.readFileSync('src/service/repairOrder.ts','utf8').replaceAll('import.meta.env','({MODE:"test"})')),apiModule)
const calls = []
const detail = {
  canChangeQuotationDecision:true,
  order:{id:'o1',orderNo:'R001',version:1,workStatus:'PENDING',quotationStatus:'UNDETERMINED',responsibleUserId:'me',projectName:'主项目-分期',periodId:'p',faultDescription:'故障'},
  actions:{canViewRepairDetail:true,canStartWork:true,canOwnerApply:true},workRecords:[],products:[{productId:'prod1',productNameSnapshot:'产品'}],attachments:[],workflows:[],applications:[],
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
// Compile actual styles too: script/template checks do not catch misplaced Sass @use.
for(const style of descriptor.styles.filter(s=>s.lang==='scss')) {
  require('sass').compileString(fs.readFileSync('src/uni.scss','utf8')+'\n'+style.content,{loadPaths:[require('node:path').dirname(filename)]})
}
const logTemplate=descriptor.template.content.split(`screen === 'log' && selected && currentLog`)[1].split(`screen === 'quote'`)[0]
assert.ok(!logTemplate.includes('canFillQuotation') && !logTemplate.includes('报价状态'),'quotation belongs to order detail, not log form')
assert.ok(descriptor.template.content.includes('title="报价管理"'))
assert.ok(!descriptor.template.content.includes('title="物料申请记录"'))
assert.ok(!descriptor.template.content.includes('title="申请与审批记录"'))
assert.ok(descriptor.template.content.includes('<SectionCard title="处理日志" @header-click="toggleEvents">'))
assert.ok(descriptor.template.content.includes('@click.stop="toggleEvents"'))
const script=sfc.compileScript(descriptor,{id:'repair-test'})
const notifications=[]
const box={exports:{},setTimeout,clearTimeout,setInterval:()=>0,clearInterval:()=>{},uni:{getStorageSync:()=>false,showToast:payload=>notifications.push(payload),getLocation:p=>p.success({longitude:117.2,latitude:39.1})},require:name=>{
  if(name==='@/service/repairWorkMaterials'){const m={exports:{}};vm.runInNewContext(transpile(fs.readFileSync('src/service/repairWorkMaterials.ts','utf8')),m);return m.exports}
  if(name==='@/service/collaborationApproval'){const m={exports:{}};vm.runInNewContext(transpile(fs.readFileSync('src/service/collaborationApproval.ts','utf8')),m);return m.exports}
  if(name==='vue')return {...vue,onBeforeUnmount:()=>{}}
  if(name==='@/service/repairQuotationAccess'){const m={exports:{}};vm.runInNewContext(transpile(fs.readFileSync('src/service/repairQuotationAccess.ts','utf8')),m);return m.exports}
  if(name==='@/service/operationsMembership')return {readOperationsUsers:async()=>[{value:'me',label:'当前维修人'},{value:'receiver',label:'运维人员'}]}
  if(name==='./repairView')return domain.exports
  if(name==='@/service/repairQuotationDictionary')return {loadRepairQuotationDictionary:async()=>[],repairQuotationText:(value)=>value||'—'}
  if(name==='@/store/user')return {useUserStore:()=>({identity:{userId:'me'},userInfo:{realname:'当前人员',username:'me'}})}
  if(name==='@/service/repairOrder')return {...apiModule.exports,repairOrderApi:api,uploadRepairAttachment:async()=> 'file-id'}
  if(name==='@/service/repairAdditional')return additional.exports
  if(name==='@/service/repairCollaboration')return collaborationModule.exports
  if(name.endsWith('.vue'))return {}
  return require(name)
}}
vm.runInNewContext(transpile(script.content),box)
const tick=async()=>{await vue.nextTick();await new Promise(setImmediate);await vue.nextTick()}
async function main(){
  const scope=vue.effectScope()
  const page=scope.run(()=>box.exports.default.setup({canManage:false},{expose:()=>{},emit:()=>{}}))
  api.logs=async()=>({records:[{occurredAt:'2026-10-23T12:00:00',operatorName:'测试人员',eventName:'协助审批通过',content:'审批已完成'}],total:1})
  await page.loadEvents()
  assert.equal(page.events.value[0].time,'2026-10-23 12:00:00')
  assert.equal(page.events.value[0].action,'协助审批通过')
  api.logs=async()=>{throw Error('读取失败')}
  await page.loadEvents();assert.equal(page.eventError.value,'读取失败')
  assert.equal(page.formatReportedAt('2026-10-22T09:30:12'),'2026-10-22 09:30:12')
  assert.equal(page.formatReportedAt(''),'—')
  const card=descriptor.template.content.split('class="case-card"')[1].split('</view>\n            </view>')[0]
  assert.ok(card.includes('<text>维修人</text>'))
  assert.ok(!card.includes('detailStatus(c)'),'status is only in top-right badge')
  assert.equal(page.reporterName.value, '当前人员')
  assert.ok(vue.isReadonly(page.reporterName), 'reporter must follow authenticated user and be readonly')
  const optionCalls=[]
  const options={customers:[{customerId:'c1',customerName:'客户一'},{customerId:'c2',customerName:'客户二'}],projects:[{customerId:'c1',archiveId:'p1',projectName:'项目一'},{customerId:'c2',archiveId:'p2',projectName:'项目二'}],products:[{archiveId:'p1',productId:'prod1',productName:'门禁'},{archiveId:'p1',productId:'prod2',productName:'堆场系统'},{archiveId:'p2',productId:'prod3',productName:'监控'}]}
  api.archiveReportOptions=async()=>({products:[{id:'prod1',coverage:{applicableServices:[]}},{id:'prod2',coverage:{applicableServices:[]}}],assets:[]})
  api.reportOptions=async q=>{optionCalls.push(q);return options}
  await page.loadOptions()
  await page.chooseCustomer(0)
  assert.equal(optionCalls.at(-1).customerId,'c1')
  assert.equal(page.projects.value.length,1)
  await page.chooseProject(0)
  assert.equal(optionCalls.at(-1).archiveId,'p1')
  assert.equal(page.productOptions.value.map(p=>p.name).join(','),'门禁,堆场系统')
  page.selectedProducts.value=['prod1','prod2']
  api.reportOptions=async()=>({customers:[],projects:[],products:[]})
  await page.loadOptions('customers')
  assert.equal(page.draft.customerId,'c1','search must preserve parent selection')
  assert.equal(page.selectedProducts.value.join(','),'prod1,prod2')
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
  page.selectedProducts.value=['prod1','prod2']; page.draft.fault='测试故障'
  let submitted
  api.submit=async input=>{submitted=apiModule.exports.repairReportPayload(input);return detail}
  await page.createReport()
  assert.equal(submitted.products.map(p=>p.productId).join(','),'prod1,prod2');assert.equal(submitted.archiveId,'p1');assert.equal(submitted.periodId,undefined)
  assert.equal(page.selectedProducts.value.length,0,'successful submit clears all selected products')
  page.openHomeEntry('records');await tick()
  assert.equal(calls.filter(c=>c[0]==='list').length,1,'entry must not duplicate list requests')
  assert.equal(calls[0][1].scope,'RESPONSIBLE')
  assert.equal(page.paged.value.length,1)
  await page.openCase(page.paged.value[0])
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
  const beforeBackfillCalls=calls.length
  page.openBackfillCheckout();assert.equal(page.showBackfillCheckout.value,true)
  page.submitBackfillCheckout();assert.match(page.backfillCheckoutError.value,/原因/)
  page.backfillCheckoutReason.value='离开现场后忘记签退'
  page.backfillCheckoutTime.value=page.backfillCheckoutMin.value-1000
  page.submitBackfillCheckout();assert.match(page.backfillCheckoutError.value,/时间/)
  page.backfillCheckoutTime.value=Date.now()+60000
  page.submitBackfillCheckout();assert.match(page.backfillCheckoutError.value,/时间/)
  page.backfillCheckoutTime.value=Date.now()
  page.submitBackfillCheckout();assert.match(page.backfillCheckoutError.value,/尚未接通/)
  assert.equal(calls.length,beforeBackfillCalls,'backfill UI must not call normal checkout or approval APIs')
  assert.equal(page.screen.value,'checkout');assert.equal(page.workDetail.value.recordStatus,'ACTIVE')
  page.go('log');await tick();assert.equal(page.showBackfillCheckout.value,false)
  page.go('checkout');await tick()
  const preserved={personType:'INTERNAL',sourcePersonId:'no-longer-in-options'}
  page.workDraft.value.persons=[preserved];page.workDraft.value.vehicleValue='historical-car';page.workDraft.value.materialItems=[{pickLinkId:'pick',quantity:1}];detail.materialLinks=[{id:'pick',linkType:'PICK',handlerUserId:'me',outboundQty:3,availableUseQty:3}]
  await page.transact(()=>page.saveLog(),'checkout')
  const updated=calls.find(c=>c[0]==='updateWork')[1]
  assert.equal(updated.persons[0].sourcePersonId,'no-longer-in-options')
  assert.equal(updated.vehicleValue,'historical-car');assert.equal(updated.materialItems[0].pickLinkId,'pick');assert.equal(updated.materialUseIds,undefined)
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
  assert.equal(page.completionMissingQuotation.value,true);assert.equal(page.completionNeedsPrice.value,false)
  const unselectedCompletionCount=calls.filter(c=>c[0]==='completion').length
  page.complete();await tick();assert.equal(calls.filter(c=>c[0]==='completion').length,unselectedCompletionCount,'undecided quotation cannot submit completion')
  page.completionQuotationChoice.value=true
  assert.equal(page.footerActions.value[0].text,'去填写报价单')
  page.footerActions.value[0].action();assert.equal(page.screen.value,'quote');page.go('completion')
  page.selected.value.raw.order.quotationRequired=true
  page.priceInput.value='101';page.selected.value.confirmedPrice=100
  assert.equal(page.completionPriceChanged.value,true)
  page.selected.value.quotationStatus='NOT_REQUIRED';page.selected.value.raw.order.quotationRequired=false
  assert.equal(page.completionNeedsPrice.value,false)
  assert.equal(page.completionPriceChanged.value,false)
  page.go('detail')
  api.quotation=async data=>{calls.push(['quotation',data]);return detail}
  api.completion=async data=>{calls.push(['completion',data]);return detail}
  detail.order.quotationRequired=null;page.installDetail(detail);page.go('completion')
  page.completionQuotationChoice.value=false;page.completionDescription.value='维保范围内，维修完成'
  api.quotation=async data=>{calls.push(['quotation',data]);detail.order.quotationRequired=data.quotationRequired;return detail}
  const inlineStart=calls.length
  page.complete();await tick()
  const inlineCalls=calls.slice(inlineStart).filter(c=>['quotation','completion'].includes(c[0]))
  assert.equal(inlineCalls.map(c=>c[0]).join(','),'quotation,completion','save no-quotation decision before completion')
  assert.equal(inlineCalls[0][1].reason,'维保范围内，维修完成')
  assert.equal(inlineCalls[1][1].finalAmount,0)
  api.quotation=async data=>{calls.push(['quotation',data]);return detail}
  page.quoteRequired.value=false;page.noQuoteReason.value='维保范围内';page.faultScope.value=''
  page.sendQuotation();await tick()
  assert.equal(Object.keys(calls.filter(c=>c[0]==='quotation').at(-1)[1]).sort().join(','),'orderId,quotationRequired,reason')
  page.quoteRequired.value=true;page.faultScope.value='更换电源';page.quoteDraft.value=[{name:'电源',qty:1,price:100}]
  page.sendQuotation();await tick()
  assert.equal(Object.keys(calls.filter(c=>c[0]==='quotation').at(-1)[1]).sort().join(','),'faultScope,items,orderId,quotationRequired')
  detail.order.quotationRequired=false;page.installDetail(detail);page.completionDescription.value='维修结束';page.priceInput.value='999';page.amountChangeReason.value='旧原因'
  page.complete();await tick()
  assert.equal(Object.keys(calls.filter(c=>c[0]==='completion').at(-1)[1]).sort().join(','),'description,finalAmount,orderId')
  assert.equal(calls.filter(c=>c[0]==='completion').at(-1)[1].finalAmount,0,'no quotation ignores stale entered price and sends numeric zero')
  detail.order.quotationRequired=true;detail.order.latestQuotationId='q';detail.quotations=[{id:'q',customerConfirmedAmount:100}]
  page.installDetail(detail);page.priceInput.value='101';page.amountChangeReason.value=''
  const completionCount=calls.filter(c=>c[0]==='completion').length
  page.complete();await tick();assert.equal(calls.filter(c=>c[0]==='completion').length,completionCount,'changed final price requires reason')
  page.amountChangeReason.value='增加配件';page.complete();await tick()
  assert.equal(calls.filter(c=>c[0]==='completion').at(-1)[1].amountChangeReason,'增加配件')
  page.priceInput.value='100.00';page.amountChangeReason.value='';page.complete();await tick()
  assert.equal(calls.filter(c=>c[0]==='completion').at(-1)[1].amountChangeReason,undefined,'unchanged price sends no stale reason')
  detail.quotations=[];detail.order.latestQuotationId=null
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
  assert.equal(Object.keys(assistantPayload).sort().join(','),'faultDescription,fileIds,materialItems,orderId,persons,recordId,repairDescription,vehicleValue','full replacement preserves optional collaborator fields without result or quotation')
  assert.equal(assistantPayload.repairDescription,'协助检查线路')
  assert.equal(detail.order.responsibleUserId,'actual-owner')
  page.endWork();await tick()
  assert.equal(page.screen.value,'detail')
  assert.equal(detail.order.workStatus,'PENDING','assistant does not mutate whole-order status on client')
  page.relation.value='我协助的';page.go('records');await tick()
  assert.equal(calls.filter(c=>c[0]==='list').at(-1)[1].scope,'HELPING')
  page.resetFilters();await tick()
  assert.equal(calls.filter(c=>c[0]==='list').at(-1)[1].scope,'RESPONSIBLE')
  page.cases.value=[{id:'log-test',raw:{workRecords:[],order:{}},actions:{},logs:Array.from({length:7},(_,i)=>({id:String(i),startedAt:i*100,actorId:i%2?'p1':'p2',people:i%2?'人员一':'人员二'}))}]
  page.selectedId.value='log-test';await tick()
  assert.equal(page.repairLogDuration({id:'duration-test'}),'进行中')
  assert.equal(page.repairLogDuration({id:'duration-test',endedAt:1}),'未提供')
  page.cases.value[0].raw.workRecords=[{id:'duration-test',durationSeconds:5400}]
  assert.equal(page.repairLogDuration({id:'duration-test',endedAt:1}),'1.50h')
  page.cases.value[0].raw.workRecords[0].durationSeconds=0
  assert.equal(page.repairLogDuration({id:'duration-test',endedAt:1}),'0.00h')
  page.cases.value[0].raw.workRecords[0].durationSeconds='invalid'
  assert.equal(page.repairLogDuration({id:'duration-test',endedAt:1}),'未提供')
  assert.equal(page.pagedRepairLogs.value.map(l=>l.id).join(','),'6,5,4,3,2')
  assert.equal(page.repairLogsPages.value,2)
  page.repairLogsPage.value=2;assert.equal(page.pagedRepairLogs.value.length,2)
  page.repairLogPerson.value='p1';page.repairLogsPage.value=1
  assert.equal(page.filteredRepairLogs.value.length,3)
  assert.equal(page.repairLogPeople.value.length,3)
  assert.equal(page.repairSummaryRows.value.find(r=>r.label==='累计维修工时').value,'待接口提供')
  page.cases.value[0].raw.order.effectiveDurationSeconds=0
  assert.equal(page.repairSummaryRows.value.find(r=>r.label==='累计维修工时').value,'0.00h')
  page.go('logList');page.go('logDetail');page.back();assert.equal(page.screen.value,'logList')
  assert.equal(page.repairLogPerson.value,'p1','back preserves person filter')
  page.back();assert.equal(page.screen.value,'detail')
  detail.actions={canViewRepairDetail:true,canEditContact:true,canStartWork:true}
  page.selectedId.value='o1';page.cases.value=[apiModule.exports.repairCaseView(detail)];await tick()
  for(const kind of ['confirmUse','writeoff','closeRemainder','contact']) {
    page.openAdditional(kind);assert.equal(page.screen.value,'detail','removed action cannot open')
    assert.equal(page.additionalActions.value.includes(kind),false)
  }
  api.missingClock=async data=>{calls.push(['missingClock',data]);return detail}
  page.openAdditional('missingClock');await tick()
  assert.equal(page.screen.value,'detail','retired missing-clock entry cannot open')
  assert.equal(page.additionalActions.value.includes('clockCorrection'),false)
  assert.equal(page.additionalActions.value.includes('missingClock'),false)
  Object.assign(detail.order,{customerId:'c1',archiveId:'p1',productNames:'门禁',reporterName:'原始报修姓名',reportTime:'2026-10-22T09:30:12',reportRemark:'原备注'})
  detail.actions={canEditReport:true,canCancelReport:true,canViewRepairDetail:false}
  detail.reportAttachments=[{fileId:'old-image',mediaType:'IMAGE',fileName:'原图'}]
  page.installDetail(detail);page.source.value='reports';page.go('detail')
  assert.equal(page.footerActions.value.map(x=>x.text).join(','),'取消报修,修改报修','reporter does not need repair-detail permission')
  api.reportEdit=async (id,input,reason)=>{calls.push(['reportEdit',{id,input,reason}]);return detail}
  await page.editReport()
  assert.equal(page.title.value,'修改报修');assert.equal(page.selectedProducts.value[0],'prod1');assert.equal(page.retainedReportFiles.value[0].fileId,'old-image')
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
  const openedLogCalls=calls.filter(c=>c[0]==='workDetail').length;await page.toggleLog('history-1');assert.equal(calls.filter(c=>c[0]==='workDetail').length,openedLogCalls,'already displayed log does not reload on duplicate click');
  assert.equal(page.footerActions.value.map(x=>x.text).join(','),'编辑本次日志')
  assert.equal(calls.filter(c=>c[0]==='workDetail').at(-1)[1].recordId,'history-1')
  page.back();assert.equal(page.screen.value,'logList')
  const originalWorkDetail=api.workDetail
  api.workDetail=async()=>{throw Error('测试加载失败')}
  await page.toggleLog('history-1');assert.equal(page.viewedWork.value,undefined);assert.equal(page.footerActions.value.length,0);assert.match(page.error.value,/加载失败/)
  let resolveLog
  api.workDetail=()=>new Promise(resolve=>{resolveLog=resolve})
  const pendingLog=page.toggleLog('history-1');await page.toggleLog('history-1');page.back();resolveLog(work);await pendingLog
  assert.equal(page.screen.value,'logList');assert.equal(page.viewedWork.value,undefined,'late response after back is ignored')
  api.workDetail=originalWorkDetail
  page.go('detail');await tick();page.showContact.value=true;page.back()
  assert.equal(page.showContact.value,false);assert.equal(page.screen.value,'detail','back closes contact sheet first')
  page.showReportDetails.value=true;page.selectedId.value='another-order';await tick()
  assert.equal(page.showReportDetails.value,false,'new order starts collapsed')
  detail.order.workStatus='PROCESSING'
  detail.order.quotationStatus='HEAD_REVIEW';detail.order.latestQuotationId='q-test'
  detail.quotations=[{id:'q-test',applicationId:'qa-test',totalAmount:20}]
  detail.applications=[{id:'qa-test',applicationType:'QUOTATION',applicationStatus:'PENDING',applicantUserId:'me'}]
  detail.canChangeQuotationDecision=false
  page.selectedId.value='o1';page.installDetail(detail);await tick()
  assert.equal(page.canWithdrawQuotation.value,true)
  detail.canChangeQuotationDecision=true;page.installDetail(detail)
  assert.equal(page.quotationEntryText.value,'查看详情','submitted quotation never shows handling even if modification flag is true')
  assert.equal(page.canEditQuotationDetails.value,false,'pending quotation must withdraw before editing')
  assert.equal(page.canSwitchToNoQuotation.value,true,'decision permission still allows no-quotation branch')
  page.switchToNoQuotation();assert.equal(page.screen.value,'quote');assert.equal(page.quoteRequired.value,false)
  assert.equal(page.quotationDecisionOnly.value,true)
  page.openQuotationEntry();assert.equal(page.showQuoteDetails.value,true)
  detail.canChangeQuotationDecision=false;page.installDetail(detail)
  assert.equal(page.canSwitchToNoQuotation.value,false)
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
  detail.order.quotationRequired=false;detail.order.quotationStatus='NOT_REQUIRED';page.installDetail(detail)
  assert.equal(page.quotationEntryText.value,'修改报价信息')
  page.openQuotationEntry();assert.equal(page.screen.value,'quote');assert.equal(page.quoteRequired.value,false)
  detail.completions=[{id:'completion-submitted'}];page.installDetail(detail)
  assert.equal(page.canFillQuotation.value,false);assert.equal(page.quotationEntryText.value,'')
  assert.match(page.quotationLockedMessage.value,/已提交完工/)
  detail.completions=[];detail.order.quotationRequired=true;detail.order.quotationStatus='CONFIRMED';page.installDetail(detail)
  assert.equal(page.canFillQuotation.value,false);assert.match(page.quotationLockedMessage.value,/客户已确认/)
  detail.order.quotationStatus='PENDING_QUOTATION';detail.quotations=[{id:'old-confirmed',customerConfirmedAmount:0}];page.installDetail(detail)
  assert.equal(page.canFillQuotation.value,false,'historical customer confirmation, including zero amount, locks modification')
  detail.quotations=[];page.installDetail(detail)
  api.materialApply=async payload=>{calls.push(['materialApply',payload]);return detail}
  page.materialType.value='领料'
  const beforeUseDate=calls.filter(c=>c[0]==='materialApply').length
  for(const date of [undefined,'','2026-02-30','2026-10-26 09:00:00']) { page.submitMaterials([{id:'m1',qty:2}],'维修使用',date);await tick() }
  assert.equal(calls.filter(c=>c[0]==='materialApply').length,beforeUseDate)
  page.submitMaterials([{id:'m1',qty:2,material:{unit:'件'}}],'维修使用','2026-10-28');await tick()
  let materialPayload=calls.filter(c=>c[0]==='materialApply').at(-1)[1]
  assert.equal(materialPayload.useDate,'2026-10-28')
  assert.equal('bizType' in materialPayload,false);assert.equal(materialPayload.applyType,'OUT');assert.equal(materialPayload.usageType,'MAINTENANCE');assert.equal(materialPayload.repairOrderId,'o1')
  assert.equal(materialPayload.itemList[0].applyQty,2);assert.equal('unitQty' in materialPayload.itemList[0],false)
  detail.materialLinks=[{linkType:'PICK',stockApplyItemId:'source1',materialId:'m1',material:{baseUnitName:'件'}}];page.installDetail(detail)
  page.materialType.value='还料';page.submitMaterials([{id:'["m1","unit"]',qty:1,material:{materialId:'m1',unit:'件',availableReturnQty:1}}],'剩余退回');await tick()
  materialPayload=calls.filter(c=>c[0]==='materialApply').at(-1)[1]
  assert.equal('useDate' in materialPayload,false)
  assert.equal('bizType' in materialPayload,false);assert.equal(materialPayload.applyType,'IN');assert.equal(materialPayload.usageType,'MAINTENANCE')
  assert.equal('repairSourceItemId' in materialPayload.itemList[0],false)
  assert.deepEqual(JSON.parse(JSON.stringify(materialPayload.itemList)),[{materialId:'m1',unitName:'件',unitQty:1}])
  assert.equal(materialPayload.repairOrderId,'o1')
  const beforeInvalidMaterial=calls.filter(c=>c[0]==='materialApply').length
  page.submitMaterials([{id:'source1',qty:1.12345}],'');await tick()
  assert.equal(calls.filter(c=>c[0]==='materialApply').length,beforeInvalidMaterial)
  page.submitMaterials([{id:'m1',qty:1}],'');await tick()
  page.submitMaterials([{id:'m1',qty:1,unitPrice:-1}],'');await tick()
  assert.equal(calls.filter(c=>c[0]==='materialApply').length,beforeInvalidMaterial,'return requires complete material account information')
  api.collaboration=async payload=>{calls.push(['collaboration',payload]);return detail}
  page.submitAssistance({personType:'INTERNAL',departments:[{departmentId:'department1',reason:'现场协助'}]});await tick()
  assert.equal(calls.filter(c=>c[0]==='collaboration').length,0,'requires server owner action')
  detail.actions.canOwnerApply=true;page.installDetail(detail)
  page.submitAssistance({personType:'INTERNAL',departments:[{departmentId:'department1',reason:'支持'}]});await tick()
  assert.equal(calls.filter(c=>c[0]==='collaboration').length,0,'owner action cannot override wrong actor or closed order')
  detail.order.responsibleUserId='me';detail.order.workStatus='PROCESSING';page.installDetail(detail)
  assert.equal(page.moreGroups.value.flatMap(g=>g.items).filter(i=>i.text==='邀请协助').length,1,'single invitation entry in More');
  page.submitAssistance({personType:'INTERNAL',departments:[{departmentId:'department1',reason:'现场协助'},{departmentId:'department2',reason:'技术支持'}]});await tick()
  const invitation=calls.filter(c=>c[0]==='collaboration').at(-1)[1]
  assert.equal(invitation.orderId,'o1');assert.equal(invitation.departments.length,2);assert.equal('assignedUserIds' in invitation,false)
  page.submitAssistance({personType:'EXTERNAL',targetId:'company1',reason:'现场协助',personCount:2,estimatedTotalHours:4});await tick()
  const externalInvitation=calls.filter(c=>c[0]==='collaboration').at(-1)[1]
  assert.equal(externalInvitation.personCount,2);assert.equal(externalInvitation.estimatedTotalHours,4)
  assert.equal(externalInvitation.sourcePersonId,'company1');assert.equal('departments' in externalInvitation,false)
  api.transfer=async payload=>{calls.push(['transfer',payload]);return detail}
  await page.openException('转单')
  assert.equal(page.transferOptions.value.length,1);assert.equal(page.transferOptions.value[0].value,'receiver','transfer excludes current owner from operations department candidates')
  page.exceptionType.value='转单';await tick();page.exceptionReason.value='病假';page.exceptionRemark.value='交接检查';page.transferOptions.value=[{value:'receiver',label:'接单人'}]
  page.targetUserId.value='me';page.sendException();await tick();assert.equal(calls.filter(c=>c[0]==='transfer').length,0)
  page.targetUserId.value='receiver';page.sendException();await tick()
  assert.deepEqual(JSON.parse(JSON.stringify(calls.filter(c=>c[0]==='transfer').at(-1)[1])),{orderId:'o1',targetUserId:'receiver',reason:'病假：交接检查'})
  assert.equal(detail.order.responsibleUserId,'me','submission never switches owner before approval')
  detail.members=[{id:'member1',userId:'helper',personType:'INTERNAL',memberStatus:'ACTIVE',userNameSnapshot:'协助人员'}]
  detail.applications=[{id:'editable',applicationType:'COLLABORATION',applicationStatus:'PENDING',applicantUserId:'me',formData:{personType:'INTERNAL',departments:[{departmentId:'d1',departmentName:'工程部',reason:'原原因'}]}}];page.installDetail(detail)
  page.openAssistance('editable');assert.notEqual(page.screen.value,'assistance','pending invitation cannot be edited in place')
  api.withdraw=async payload=>{calls.push(['withdraw',payload]);detail.applications[0].applicationStatus='WITHDRAWN';return detail}
  assert.equal(await page.manageCollaboration({kind:'withdraw',targetId:'editable',reason:'补充内容'}),true)
  page.openAssistance('editable');assert.equal(page.screen.value,'assistance');assert.equal(page.assistanceInitial.value.departments[0].reason,'原原因')
  page.assistanceInitial.value.departments[0].reason='新原因';assert.equal(detail.applications[0].formData.departments[0].reason,'原原因')
  page.go('detail')
  api.memberExit=async payload=>{calls.push(['memberExit',payload]);detail.members[0].memberStatus='EXITED';detail.members[0].exitReason=payload.reason;return detail}
  assert.equal(await page.manageCollaboration({kind:'memberExit',targetId:'member1',reason:'任务结束'}),true)
  assert.equal(calls.filter(c=>c[0]==='memberExit').at(-1)[1].memberId,'member1')
  assert.equal(detail.members.length,1,'removed member history is retained')
  assert.equal(await page.manageCollaboration({kind:'memberExit',targetId:'member1',reason:'重复'}),false)
  detail.applications=[{id:'ca',applicationType:'COLLABORATION',applicationStatus:'PENDING',formData:{departments:[{departmentId:'d1',reason:'支持'}]}}]
  detail.workflows=[{id:'wi',businessId:'ca',tasks:[{id:'t1',canHandle:true,departmentName:'工程部'},{id:'t2',canHandle:true,departmentName:'技术部'},{id:'t3',canHandle:false}]}]
  page.installDetail(detail);page.go('detail');await tick()
  await page.openOrder('o1',{orderId:'o1',view:'approval',instanceId:'wi',applicationId:'ca',taskId:'t2'});
  assert.equal(page.screen.value,'approval');assert.equal(page.reviewTask.value.task.id,'t2','todo selects intended task, not first task');
  page.go('detail');await page.openOrder('o1',{orderId:'o1',view:'approval',instanceId:'wi',taskId:'t3'});
  assert.equal(page.screen.value,'detail');assert.equal(page.reviewTask.value,undefined,'unhandleable todo must not fall back to another task');assert.match(page.error.value,/待办/);
  page.chosenReviewTaskId.value='';
  detail.actions.canViewRepairDetail=false;page.installDetail(detail);page.source.value='reports'
  assert.equal(page.reviewTasks.value.length,2)
  page.go('approval');assert.equal(page.isCollaborationApproval.value,true);assert.equal(page.approvalFormRows.value.length,0,'collaboration does not render raw fields');assert.equal(page.collaborationApproval.value.entries[0].reason,'支持');page.go('detail')
  assert.equal(page.footerActions.value[0].text,'办理审批')
  page.selectReviewTask({detail:{value:1}});assert.equal(page.reviewTask.value.task.id,'t2')
  api.review=async payload=>{calls.push(['review',payload]);detail.workflows[0].tasks=detail.workflows[0].tasks.filter(t=>t.id!==payload.taskId);return detail}
  page.review(true);await tick()
  assert.equal(calls.filter(c=>c[0]==='review').at(-1)[1].taskId,'t2')
  assert.equal(page.reviewTasks.value.length,1)
  // Transfer follows the same server workflow, including exact todo routing and rejection.
  detail.applications=[{id:'transfer-a',applicationType:'TRANSFER',applicationStatus:'PENDING',formData:{targetUserId:'receiver',reason:'病假交接'}}]
  detail.workflows=[{id:'transfer-w',businessId:'transfer-a',processKey:'repair_ops_transfer',tasks:[{id:'transfer-t',canHandle:true,name:'运维主管审批'}]}]
  page.installDetail(detail)
  await page.openOrder('o1',{orderId:'o1',view:'approval',instanceId:'transfer-w',applicationId:'transfer-a',taskId:'transfer-t'})
  assert.equal(page.screen.value,'approval');assert.equal(page.reviewTask.value.application.applicationType,'TRANSFER')
  const beforeReview=calls.filter(c=>c[0]==='review').length
  page.approvalReason.value='';page.review(false);await tick()
  assert.equal(calls.filter(c=>c[0]==='review').length,beforeReview,'transfer rejection requires a reason')
  api.review=async payload=>{calls.push(['review',payload]);detail.applications[0].applicationStatus=payload.approve?'APPROVED':'REJECTED';detail.workflows[0].tasks=[];if(payload.approve)detail.order.responsibleUserId='receiver';return detail}
  page.approvalReason.value='请补充交接安排';page.review(false);await tick()
  assert.deepEqual(JSON.parse(JSON.stringify(calls.filter(c=>c[0]==='review').at(-1)[1])),{applicationId:'transfer-a',instanceId:'transfer-w',taskId:'transfer-t',approve:false,comment:'请补充交接安排'})
  assert.equal(page.selected.value.ownerId,'me','rejection preserves owner')
  detail.applications[0].applicationStatus='PENDING';detail.workflows[0].tasks=[{id:'transfer-t2',canHandle:true,name:'运维主管审批'}];page.installDetail(detail)
  await page.openOrder('o1',{orderId:'o1',view:'approval',instanceId:'transfer-w',applicationId:'transfer-a',taskId:'transfer-t2'})
  page.approvalReason.value='';page.review(true);await tick()
  assert.equal(calls.filter(c=>c[0]==='review').at(-1)[1].taskId,'transfer-t2')
  assert.equal(page.selected.value.ownerId,'receiver','approved response supplies the new owner')
  assert.equal(page.reviewTasks.value.length,0,'completed transfer task is no longer actionable')
  detail.order.responsibleUserId='me';page.installDetail(detail)
  const originalStatus=detail.order.workStatus
  detail.actions.canOwnerApply=true;page.installDetail(detail)
  api.close=async payload=>{calls.push(['close',payload]);return detail}
  await page.openException('关闭');page.exceptionReason.value='客户弃修';page.exceptionRemark.value=''
  page.sendException();await tick();assert.equal(calls.filter(c=>c[0]==='close').length,0,'close reason description is required')
  page.exceptionRemark.value='客户明确不再维修';page.sendException();await tick()
  assert.deepEqual(JSON.parse(JSON.stringify(calls.filter(c=>c[0]==='close').at(-1)[1])),{orderId:'o1',closeType:'CUSTOMER_ABANDONED',reason:'客户弃修：客户明确不再维修'})
  assert.equal(page.selected.value.raw.order.workStatus,originalStatus,'close submission does not close the order')
  detail.applications=[{id:'close-a',applicationType:'CLOSE',applicationStatus:'PENDING',formData:{closeType:'CUSTOMER_ABANDONED',reason:'客户明确不再维修'}}]
  detail.workflows=[{id:'close-w',businessId:'close-a',processKey:'repair_ops_close',tasks:[{id:'close-t',canHandle:true,name:'运维主管审批'}]}];page.installDetail(detail)
  await page.openOrder('o1',{orderId:'o1',view:'approval',instanceId:'close-w',applicationId:'close-a',taskId:'close-t'})
  assert.equal(page.reviewTask.value.application.applicationType,'CLOSE')
  api.review=async payload=>{calls.push(['review',payload]);detail.applications[0].applicationStatus=payload.approve?'APPROVED':'REJECTED';detail.workflows[0].tasks=[];if(payload.approve)detail.order.workStatus='CLOSED';return detail}
  const beforeCloseReview=calls.filter(c=>c[0]==='review').length
  page.approvalReason.value='';page.review(false);await tick();assert.equal(calls.filter(c=>c[0]==='review').length,beforeCloseReview)
  page.approvalReason.value='需核实客户意见';page.review(false);await tick();assert.equal(page.selected.value.raw.order.workStatus,originalStatus)
  detail.applications[0].applicationStatus='PENDING';detail.workflows[0].tasks=[{id:'close-t2',canHandle:true}];page.installDetail(detail)
  await page.openOrder('o1',{orderId:'o1',view:'approval',instanceId:'close-w',applicationId:'close-a',taskId:'close-t2'})
  page.approvalReason.value='';page.review(true);await tick()
  assert.deepEqual(JSON.parse(JSON.stringify(calls.filter(c=>c[0]==='review').at(-1)[1])),{applicationId:'close-a',instanceId:'close-w',taskId:'close-t2',approve:true,comment:''})
  assert.equal(page.selected.value.raw.order.workStatus,'CLOSED');assert.equal(page.reviewTasks.value.length,0)
  detail.order.workStatus=originalStatus;page.installDetail(detail)
  detail.members[0].memberStatus='ACTIVE';page.installDetail(detail)
  let uncertainWrites=0
  const successNotices=notifications.filter(n=>n.icon==='success').length
  assert.ok(successNotices>0,'successful submissions show toast feedback')
  api.memberExit=async()=>{uncertainWrites++;throw Object.assign(new Error('network'),{uncertain:true})}
  assert.equal(await page.manageCollaboration({kind:'memberExit',targetId:'member1',reason:'结束'}),false)
  assert.equal(page.mutationBlocked.value,true,'unknown mutation result requires re-open and readback')
  assert.equal(await page.manageCollaboration({kind:'memberExit',targetId:'member1',reason:'重复点击'}),false)
  assert.equal(uncertainWrites,1,'uncertain writes are not automatically retried')
  assert.equal(notifications.filter(n=>n.icon==='success').length,successNotices,'unknown result must not show success')
  page.mutationBlocked.value=false
  await page.transact(async()=>{throw new Error('审批模型未启用')})
  assert.equal(notifications.filter(n=>n.icon==='success').length,successNotices,'business failure must not show success')
  await page.transact(async()=>detail)
  assert.equal(notifications.filter(n=>n.icon==='success').length,successNotices+1,'one success notification per completed submission')
  // V4: server-selected reusable departments are submitted atomically with approval.
  const v4={id:'v4',applicationType:'COLLABORATION',applicationStatus:'PENDING',formData:{personType:'INTERNAL',assignmentMode:'WITH_APPROVAL',departments:[{departmentId:'d1',reason:'支持'},{departmentId:'d2',reason:'协助'}]}}
  detail.applications=[v4];detail.workflows=[{id:'v4w',businessId:'v4',processKey:'repair_ops_collaboration',tasks:[{id:'v4t',canHandle:true,nodeKey:'head'}]}]
  const candidateCalls=[],reviewCalls=[]
  api.approvalCandidates=async(applicationId,taskId)=>{candidateCalls.push({applicationId,taskId});return {assignmentMode:'WITH_APPROVAL',taskId,nodeKey:'head',departments:[{departmentId:'d1',departmentName:'部门一',members:[{value:'u1',label:'成员一'}]},{departmentId:'d2',departmentName:'部门二',members:[{value:'u2',label:'成员二'}]}]}}
  page.installDetail(detail);page.go('approval');await tick()
  assert.equal(candidateCalls.at(-1).taskId,'v4t')
  page.approvalDecision.value='approve'
  let failV4=true
  api.review=async p=>{reviewCalls.push(JSON.parse(JSON.stringify(p)));if(failV4)throw Object.assign(Error('network'),{uncertain:true});return detail}
  await page.review(true);assert.equal(reviewCalls.length,0,'all required departments must have members')
  page.reviewChosen.value={d1:['u1'],d2:['u2']};await page.review(true)
  assert.equal(page.mutationBlocked.value,false,'idempotent review can retry');assert.ok(page.mergedPending.value)
  assert.equal(reviewCalls[0].departmentAssignments.length,2);assert.equal('assignedUserIds' in reviewCalls[0],false)
  failV4=false;await page.review(true);assert.deepEqual(reviewCalls[0],reviewCalls[1],'atomic approval retry preserves original payload')
  page.go('approval');await tick();page.approvalDecision.value='reject';page.approvalReason.value=''
  const beforeReject=reviewCalls.length;await page.review(false);assert.equal(reviewCalls.length,beforeReject,'rejection requires reason')
  page.approvalReason.value='不予批准';await page.review(false)
  assert.equal(reviewCalls.at(-1).approve,false);assert.equal('departmentAssignments' in reviewCalls.at(-1),false);assert.equal('assignedUserIds' in reviewCalls.at(-1),false)
  scope.stop()
  console.log('PASS page list, server permissions, recordId, new work endpoints, checkout routing and quotation/completion payloads')
}
main().catch(e=>{console.error(e);process.exitCode=1})
