// Real repair quote dictionary regression. No HTTP or business writes.
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict'), ts = require('typescript')
const source = fs.readFileSync('src/service/repairQuotationDictionary.ts', 'utf8')
let response = { result: [{value:'CONFIRMED',text:'客户确认完成'}, {value:'WITHDRAWN',text:'主动撤回'}, {value:'RETURNED',text:'审批退回'}] }, url
const box = {exports:{},require:()=>({http:{get:async path=>{url=path;return response}}})}
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,box)
async function main() {
 const api=box.exports, rows=await api.loadRepairQuotationDictionary()
 assert.equal(url,'/sys/dict/getDictItems/repair_quotation_status')
 assert.equal(api.repairQuotationText('CONFIRMED',rows),'客户确认完成')
 assert.equal(api.repairQuotationText('WITHDRAWN',rows),'主动撤回')
 assert.equal(api.repairQuotationText('RETURNED',rows),'审批退回')
 assert.equal(api.repairQuotationText('NEW_STATUS',rows),'NEW_STATUS')
 assert.equal(api.repairQuotationText(null,rows),'—')
 assert.equal(api.repairQuotationText(0,[{value:'0',text:'零状态'}]),'零状态')
 response={success:false,result:rows};await assert.rejects(api.loadRepairQuotationDictionary())
 response={result:{}};await assert.rejects(api.loadRepairQuotationDictionary())
 const page=fs.readFileSync('src/pages/ops/components/preview/OpsWorkflow.vue','utf8')
 assert.ok(!page.includes('quoteState') && !page.includes('quoteStep'))
 assert.ok(page.includes("c.quotationStatus === 'WAIT_CUSTOMER'"))
 assert.ok(page.includes("selected.quotationStatus === 'CONFIRMED'"))
 assert.ok(page.includes("selected.quotationStatus === 'NOT_REQUIRED'"))
 const sfc=require('vue/compiler-sfc')
 for(const name of ['accept','acceptDetail','repairRecord','repairDetail','repairOffline','repairOnline','components/preview/RepairRoute']) {
  const path=`src/pages/ops/${name}.vue`,source=fs.readFileSync(path,'utf8')
  assert.ok(!source.includes("http.post") && !source.includes("'/ops/"))
  const {descriptor,errors}=sfc.parse(source,{filename:path});assert.equal(errors.length,0)
  const script=sfc.compileScript(descriptor,{id:name})
  const template=sfc.compileTemplate({source:descriptor.template.content,filename:path,id:name,compilerOptions:{bindingMetadata:script.bindings}})
  assert.equal(template.errors.length,0)
 }
 for(const name of ['OpsPreview.vue','OpsPreviewForm.vue','OpsIntake.vue','previewData.ts','intakeFlow.ts','intakeFixtures.ts','repairWorkflow.ts'])assert.equal(fs.existsSync('src/pages/ops/components/preview/'+name),false)
 console.log('PASS real quotation dictionary labels, unknown/empty/zero, failed responses and code-based guards')
}
main().catch(e=>{console.error(e);process.exitCode=1})
