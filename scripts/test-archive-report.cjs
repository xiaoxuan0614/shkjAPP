// Runs production report handlers with in-memory transport; never creates real reports.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript'),{parse}=require('vue/compiler-sfc'),dayjs=require('dayjs')
const transpile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText
const src=parse(fs.readFileSync('src/pages/ops/components/preview/OpsWorkflow.vue','utf8')).descriptor.scriptSetup.content
const ast=ts.createSourceFile('workflow.ts',src,ts.ScriptTarget.Latest,true)
const names=['loadOptions','chooseCustomer','chooseProject','serviceChoices','reportProductRows','createReport','editReport','saveReportEdit']
const functions=ast.statements.filter(n=>ts.isFunctionDeclaration(n)&&names.includes(n.name.text)).map(n=>n.getText(ast)).join('\n')
const ref=value=>({value}),plain=v=>JSON.parse(JSON.stringify(v)),writes=[]
const b={dayjs,Set,Map,Date,console,repairOrderApi:{},repairReportPayload:i=>{assert.ok(i.archiveId);assert.ok(i.products.length)},repairCaseView:d=>({id:d.order.id}),uploadRepairAttachment:async()=> 'new-photo',files:async()=>['new-photo'],scrollToTop:()=>{},uni:{showToast:()=>{},setStorageSync:()=>{}},uncertainKey:'test',optionGeneration:{customers:0,projects:0,products:0},optionBusy:{customers:false,projects:false,products:false},draft:{customerId:'',projectId:'',fault:'故障',remark:'',photos:[],videos:[]},uploadedFiles:new Map(),emptyDraft:()=>({customerId:'',projectId:'',fault:'',remark:'',photos:[],videos:[]}),go:()=>{},transact:fn=>{b.transaction=fn()}}
for(const [k,v] of Object.entries({error:'',customerOptions:[],projects:[],productOptions:[],selectedProducts:[],customer:undefined,project:undefined,editingReport:'',submitting:false,mediaBusy:false,submitUncertain:false,reportTimestamp:new Date('2026-10-30T09:00:00+08:00').getTime(),reporterName:'测试人员',originalReporterName:'',originalReportProducts:[],archiveOptions:{products:[],assets:[]},reportServices:{},cases:[],selectedId:'order',source:'',message:'',reportFiles:[],retainedReportFiles:[],reportChangeReason:'',selected:undefined})) b[k]=ref(v)
vm.createContext(b);vm.runInContext(transpile(functions),b)
const options={customers:[{customerId:'c',customerName:'客户'},{customerId:'c2',customerName:'客户2'}],projects:[{customerId:'c',archiveId:'a',projectName:'历史档案'}],products:[{archiveId:'a',productId:'p1',productName:'同名产品'},{archiveId:'a',productId:'p2',productName:'同名产品'}]}
b.repairOrderApi.reportOptions=async q=>{assert.equal(q.periodId,undefined);return options}
b.repairOrderApi.archiveReportOptions=async(id,date)=>{assert.equal(id,'a');assert.equal(date,'2026-10-30');return {products:[{id:'p1',coverage:{applicableServices:[{id:'s1'},{id:'s2'}]}},{id:'p2',coverage:{applicableServices:[]}}],assets:[]}}
b.repairOrderApi.submit=async input=>{writes.push(plain(input));return {order:{id:'new'}}}
async function main(){
 await b.loadOptions();await b.chooseCustomer(0);await b.chooseProject(0)
 assert.equal(b.projects.value[0].id,'a');assert.equal(b.productOptions.value.length,2)
 b.selectedProducts.value=['p1','p2']
 await b.createReport();assert.equal(writes.length,0);assert.match(b.error.value,/选择适用保障/)
 b.reportServices.value={p1:'s2'};await b.createReport()
 assert.equal(writes.length,1);assert.equal(writes[0].archiveId,'a');assert.equal(writes[0].periodId,undefined);assert.equal(writes[0].productNames,undefined)
 assert.deepEqual(writes[0].products,[{productId:'p1',serviceId:'s2'},{productId:'p2'}])
 b.selectedId.value='order'
 b.selected.value={actions:{canEditReport:true},customer:'客户',project:'历史档案',raw:{order:{id:'order',archiveId:'a',customerId:'c',reporterName:'原报修人',reportTime:'2026-10-30 09:00:00'},products:[{productId:'p1',assetId:'device1',serviceId:'s2'},{productId:'p1',assetId:'device2',serviceId:'s1'}]}}
 b.reportFiles.value=[{fileId:'old-photo',mediaType:'IMAGE'}]
 await b.editReport();assert.equal(b.selectedProducts.value.length,1)
 await b.chooseCustomer(1);assert.equal(b.draft.customerId,'c','editing cannot change archive customer')
 assert.deepEqual(plain(b.reportProductRows()),b.selected.value.raw.products)
 b.draft.fault='修正';b.reportChangeReason.value='补充资料'
 b.repairOrderApi.reportEdit=async(id,input,reason)=>{writes.push({id,input:plain(input),reason});return {order:{id}}}
 b.saveReportEdit();await b.transaction
 assert.equal(writes[1].input.archiveId,'a');assert.equal(writes[1].input.reporterName,'原报修人');assert.deepEqual(writes[1].input.products,b.selected.value.raw.products)
 assert.ok(writes[1].input.fileIds.includes('old-photo'))
 b.draft.projectId='other';b.saveReportEdit();await assert.rejects(b.transaction,/不能变更所属档案/)
 // An old response must not replace product options after parent changed.
 b.editingReport.value='';b.draft.projectId='a';let resolve
 b.repairOrderApi.reportOptions=()=>new Promise(r=>resolve=r)
 const pending=b.loadOptions('products');b.draft.projectId='other';b.optionGeneration.products++;b.productOptions.value=[]
 resolve(options);await pending;assert.equal(b.productOptions.value.length,0)
 console.log('PASS: archive report create/edit, ID identity, multi-coverage selection, retained assets/files, immutable archive and stale response protection')
}
main().catch(e=>{console.error(e);process.exitCode=1})
