const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const { parse, compileScript, compileTemplate } = require('vue/compiler-sfc')
const calls = []
let response = {success:true,code:200,result:{order:{id:'order-1',version:3}}}
const http = {
  get: async (...args) => {calls.push(['GET',...args]);return response},
  post: async (...args) => {calls.push(['POST',...args]);return response},
}
const source = fs.readFileSync('src/service/repairOrder.ts','utf8').replaceAll('import.meta.env','({MODE:"test"})')
const code = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const exportsObject = {}
let uploadResponse={success:true,code:200,message:'repair/photo.jpg'},uploadOptions
vm.runInNewContext(code, {exports:exportsObject,uni:{uploadFile:options=>{uploadOptions=options;options.success({statusCode:200,data:JSON.stringify(uploadResponse)})}},require: name => {
  if (name === '@/utils/http') return {http}
  if (name === '@/store/user') return {useUserStore:() => ({userInfo:{token:'test-only'}})}
  if (name === '@/utils/platform') return {isH5:false}
  if (name === '@/utils/index') return {getEnvBaseUrl:() => '/api'}
  throw Error(name)
}})
const {repairReportPayload,repairCaseView,repairOrderApi} = exportsObject
const plain = value => JSON.parse(JSON.stringify(value))
async function main() {
  await repairOrderApi.materialStatistics('order-1',2,5)
  assert.deepEqual(plain(calls.pop()),['GET','/repair/materialAccount/page',{orderId:'order-1',pageNo:2,pageSize:5}])
  await assert.rejects(repairOrderApi.materialStatistics(''),/缺少维修单/)
  assert.equal(await exportsObject.uploadRepairAttachment('local-photo'),'repair/photo.jpg')
  assert.equal(uploadOptions.url,'/api/sys/common/upload')
  assert.equal(uploadOptions.name,'file');assert.equal(uploadOptions.formData.biz,'repair')
  for(const bad of [{success:false,code:500,message:'上传失败'},{success:true,code:200,result:{id:'legacy'}},{success:true,code:200,message:'https://oss.example/photo.jpg'},{success:true,code:200,message:'../photo.jpg'}]) {
    uploadResponse=bad;await assert.rejects(exportsObject.uploadRepairAttachment('local-photo'))
  }
  uploadResponse={success:true,code:200,message:'repair/video.mp4'}
  assert.equal(await exportsObject.uploadRepairAttachment('local-video'),'repair/video.mp4')
  assert.equal(repairCaseView({id:'q',quotationStatus:'WITHDRAWN'}).quotationStatus,'WITHDRAWN')
  const input = {customerId:'c',periodId:'p',productNames:['产品一','产品二'],faultDescription:'故障',reportTime:'2026-10-20 09:30:00',reporterName:'报修人'}
  assert.deepEqual(plain(repairReportPayload({...input,orderId:'must-not-send',version:10,requestId:'must-not-send'})),{
    customerId:'c',periodId:'p',productNames:'产品一,产品二',faultDescription:'故障',reportTime:'2026-10-20 09:30:00',reporterName:'报修人',
  })
  for (const change of [{productNames:[]},{productNames:['同名','同名']},{productNames:['带,逗号']},{reportTime:'2026-02-30 12:00:00'},{faultDescription:' '},{reporterName:''},{fileIds:Array(9).fill('f')}])
    assert.throws(() => repairReportPayload({...input,...change}))
  const row = repairCaseView({order:{id:'o',projectName:'主项目-分期',responsibleUserName:'负责人',productNames:'产品一',workStatus:'PROCESSING',quotationStatus:'WAIT_CUSTOMER',latestQuotationId:'q'},actions:{canViewRepairDetail:true,canStartWork:false},workRecords:[{id:'r',operatorUserId:'u',recordStatus:'ACTIVE',effectiveStartedAt:'2026-10-20T09:00:00',repairMethod:'OFFLINE'}],quotations:[{id:'q',customerConfirmedAmount:0}],quotationItems:[{quotationId:'q',itemName:'服务费',quantity:2,unitPrice:10},{quotationId:'old',itemName:'历史',quantity:1,unitPrice:999}]})
  assert.equal(row.project,'主项目-分期')
  assert.equal(row.owner,'负责人')
  const listRecord = {id:'list-order', responsibleUserId:'new-user', responsibleUserName:'最新维修负责人', responsibleUserNameSnapshot:'原负责人'}
  assert.equal(repairCaseView(listRecord).owner,'最新维修负责人','list uses current responsibleUserName, not historical snapshot')
  assert.equal(repairCaseView({...listRecord,responsibleUserName:'转单后负责人'}).owner,'转单后负责人')
  assert.equal(repairCaseView({...listRecord,responsibleUserName:''}).owner,'—','missing current name must not fall back to old owner')
  assert.equal(row.confirmedPrice,0)
  assert.equal(row.logs[0].endedAt,undefined)
  assert.equal(row.quoteItems.length,1)
  assert.equal(row.actions.canStartWork,false)
  await repairOrderApi.submit(input)
  assert.equal(calls.at(-1)[1],'/repair/order/submit')
  assert.equal(calls.filter(c=>c[1]==='/repair/order/submit').length,1)
  await repairOrderApi.reportEdit('o',{...input,fileIds:['old-file']},'修正信息')
  assert.equal(calls.at(-1)[1],'/repair/order/reportEdit')
  assert.equal(calls.at(-1)[2].orderId,'o');assert.equal(calls.at(-1)[2].reason,'修正信息');assert.equal(calls.at(-1)[2].fileIds[0],'old-file')
  assert.equal(calls.at(-1)[2].productNames,'产品一,产品二');assert.equal(calls.at(-1)[2].version,undefined)
  await assert.rejects(repairOrderApi.reportEdit('o',input,' '))
  await assert.rejects(repairOrderApi.reportCancel('o',''))
  await assert.rejects(repairOrderApi.reportCancel('o','x'.repeat(1001)))
  await repairOrderApi.reportCancel('o','重复报修')
  assert.deepEqual(plain(calls.at(-1)),['POST','/repair/order/reportCancel',{orderId:'o',reason:'重复报修'}])
  await repairOrderApi.list({scope:'HELPING',pageNo:2,pageSize:5})
  assert.deepEqual(plain(calls.at(-1)),['GET','/repair/order/list',{scope:'HELPING',pageNo:2,pageSize:5}])
  for (const [method,path] of Object.entries({begin:'/repair/work/begin',saveDraft:'/repair/work/saveDraft',submitWork:'/repair/work/submit',updateWork:'/repair/work/update',end:'/repair/work/end',quotation:'/repair/quotation/decision',customerPrice:'/repair/quotation/customerPrice',completion:'/repair/completion/submit',transfer:'/repair/transfer/submit',close:'/repair/close/submit',collaboration:'/repair/collaboration/submit',review:'/repair/application/review',materialApply:'/stock/apply/add'})) {
    await repairOrderApi[method]({orderId:'o',version:4})
    assert.equal(calls.at(-1)[1],path)
  }
  await repairOrderApi.workDetail('o','r')
  for(const [method,path] of Object.entries({withdraw:'/repair/application/withdraw',memberExit:'/repair/member/exit',clockCorrection:'/repair/clockCorrection/submit',missingClock:'/repair/work/missingClock',evaluation:'/repair/evaluation/submit'})) {
    await repairOrderApi[method]({orderId:'o'})
    assert.equal(calls.at(-1)[1],path)
    assert.equal(calls.at(-1)[0],'POST')
  }
  await repairOrderApi.workDetail('o','r')
  assert.deepEqual(plain(calls.at(-1)),['GET','/repair/work/detail',{orderId:'o',recordId:'r'}])
  for(const kind of ['confirmUse','writeoff','closeRemainder','contact']) assert.equal(repairOrderApi[kind],undefined)
  await repairOrderApi.personOptions('o')
  assert.deepEqual(plain(calls.at(-1)),['GET','/repair/work/personOptions',{orderId:'o'}])
  await repairOrderApi.materialAccounts('order','me',2,10,'电缆')
  assert.deepEqual(plain(calls.at(-1)),['GET','/repair/materialAccount/page',{orderId:'order',handlerUserId:'me',pageNo:2,pageSize:10,keyword:'电缆'}])
  await assert.rejects(()=>repairOrderApi.materialAccounts('','me'))
  await assert.rejects(()=>repairOrderApi.materialAccounts('order',''))
  response={success:false,code:200,message:'业务拒绝'}
  await assert.rejects(repairOrderApi.detail('o'),error => error.success === false && error.message === '业务拒绝')
  response={success:true,code:403,message:'无权'}
  await assert.rejects(repairOrderApi.detail('o'))
  for (const name of ['OpsWorkflow','RepairAssistanceForm','RepairMaterialForm','ReportAttachments','RepairServerAttachments']) {
    const filename=`src/pages/ops/components/preview/${name}.vue`
    const text=fs.readFileSync(filename,'utf8')
    const {descriptor,errors}=parse(text,{filename})
    assert.deepEqual(errors,[])
    compileScript(descriptor,{id:name})
    const template=compileTemplate({source:descriptor.template.content,filename,id:name})
    assert.deepEqual(template.errors,[],filename)
  }
  const workflow=fs.readFileSync('src/pages/ops/components/preview/OpsWorkflow.vue','utf8')
  assert.doesNotMatch(workflow,/\b(startLog|finishLog|requestAssistance|requestRepairMaterials|approveQuote|approveCompletion|requestException)\(/)
  assert.match(workflow,/actions\.canViewRepairDetail/)
  assert.match(workflow,/repairReviewTasks/)
  console.log('PASS: report payload, response mapping, migrated work API routes, business errors, Vue compilation, no mock mutations')
}
main().catch(e=>{console.error(e);process.exitCode=1})
