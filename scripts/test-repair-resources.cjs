const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),vue=require('vue'),sfc=require('vue/compiler-sfc'),ts=require('typescript')
const transpile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const helper={exports:{}};vm.runInNewContext(transpile(fs.readFileSync('src/service/repairWorkMaterials.ts','utf8')),helper)
const {materialItemsPayload,workMaterialItems}=helper.exports
const filename='src/pages/ops/components/preview/RepairWorkResources.vue'
const {descriptor}=sfc.parse(fs.readFileSync(filename,'utf8'),{filename})
assert.equal(sfc.compileTemplate({source:descriptor.template.content,filename,id:'resources'}).errors.length,0)
for(const forbidden of ['登记本次用料','用料说明','materialUse(','issuedItems('])assert.ok(!descriptor.template.content.includes(forbidden))
assert.ok(descriptor.template.content.includes('class="material-row"'))
assert.ok(descriptor.template.content.includes('class="material-popup"'))
const detail=vue.reactive({order:{id:'o'},materialLinks:[
{id:'pick',handlerUserId:'me',linkType:'PICK',outboundQty:5,availableUseQty:3,materialName:'电缆'},
{id:'zero',handlerUserId:'me',linkType:'PICK',outboundQty:5,availableUseQty:0},
{id:'not-issued',handlerUserId:'me',linkType:'PICK',outboundQty:0,availableUseQty:5},
{id:'other',handlerUserId:'other',linkType:'PICK',outboundQty:5,availableUseQty:5}],materialUses:[]})
const form=vue.reactive({persons:[],materialItems:[]})
const peopleHelper={exports:{}};vm.runInNewContext(transpile(fs.readFileSync('src/service/repairWorkPeople.ts','utf8')),peopleHelper)
const box={exports:{},require:n=>n==='vue'?{...vue,onBeforeUnmount:()=>{}}:n==='@/service/repairWorkPeople'?peopleHelper.exports:n==='@/service/repairWorkMaterials'?helper.exports:n==='@/service/repairOrder'?{repairOrderApi:{personOptions:async()=>[],options:async()=>[]}}:{}}
vm.runInNewContext(transpile(sfc.compileScript(descriptor,{id:'resources'}).content),box)
const page=box.exports.default.setup({detail,recordId:'r',actorId:'me',disabled:false,form},{expose:()=>{}})
assert.equal(form.hasInternalParticipants,false)
assert.equal(form.hasExternalParticipants,false)
page.setParticipation('INTERNAL','hasInternalParticipants',true)
assert.equal(form.hasInternalParticipants,true)
form.persons=[{personType:'INTERNAL',sourcePersonId:'p'},{personType:'EXTERNAL',sourcePersonId:'x'}]
page.setParticipation('INTERNAL','hasInternalParticipants',false)
assert.equal(form.persons.length,1)
assert.equal(form.persons[0].personType,'EXTERNAL')
assert.equal(page.personChoices.value.length,0,'saved history never creates an eligible option')
form.persons=[{personType:'INTERNAL',sourcePersonId:'next-owner'},{personType:'INTERNAL',sourcePersonId:'colleague'},{personType:'EXTERNAL',sourcePersonId:'next-owner'}]
detail.order.responsibleUserId='next-owner'
vue.nextTick().then(()=>{
  assert.equal(form.persons.some(p=>p.personType==='INTERNAL'&&p.sourcePersonId==='next-owner'),false,'owner changes remove saved owner selection');
  assert.equal(form.persons.some(p=>p.sourcePersonId==='colleague'),true);
  assert.equal(form.persons.some(p=>p.personType==='EXTERNAL'&&p.sourcePersonId==='next-owner'),true);
}).catch(e=>{console.error(e);process.exitCode=1})
assert.equal(page.sources.value.length,1)
page.selectedIds.value=['pick']
assert.equal(form.materialItems[0].quantity,1,'new material defaults to one')
form.materialItems[0].quantity='2'
page.selectedIds.value=['pick']
assert.equal(page.items.value[0].quantity,'2')
assert.equal(materialItemsPayload(form.materialItems,false,detail,'me','r',[])[0].quantity,2)
for(const quantity of ['',0,-1,'1.00001',4,Infinity])assert.throws(()=>materialItemsPayload([{pickLinkId:'pick',quantity}],false,detail,'me','r',[]))
assert.equal(materialItemsPayload([{pickLinkId:'pick',quantity:''}],true,detail,'me','r',[])[0].quantity,null)
assert.throws(()=>materialItemsPayload([{pickLinkId:'pick',quantity:1},{pickLinkId:'pick',quantity:1}],false,detail,'me','r',[]))
assert.throws(()=>workMaterialItems({materialUseIds:['unknown']},detail,'r'))
page.removeMaterial('pick');assert.equal(form.materialItems.length,0)
page.toggleAll();assert.equal(form.materialItems[0].quantity,1,'select all defaults new materials to one')
page.toggleAll();assert.equal(form.materialItems.length,0)
form.materialItems=[{pickLinkId:'pick',quantity:2}]
detail.materialUses=[{id:'u',pickLinkId:'pick',workRecordId:'r',useStatus:'CONFIRMED',usedQuantity:2}]
page.removeMaterial('pick');assert.equal(form.materialItems.length,1)
page.selectedIds.value=[];assert.equal(form.materialItems.length,1)
assert.throws(()=>materialItemsPayload([{pickLinkId:'pick',quantity:3}],false,detail,'me','r',[{pickLinkId:'pick',quantity:2}]))
assert.throws(()=>materialItemsPayload([],false,detail,'me','r',[{pickLinkId:'pick',quantity:2}]))
assert.equal(materialItemsPayload([{pickLinkId:'pick',quantity:2}],false,detail,'me','r',[{pickLinkId:'pick',quantity:2}])[0].quantity,2)
console.log('PASS authoritative candidates, inline materialItems, draft, quantity, duplicates, confirmed locks and legacy safety')
const dfile='src/pages/ops/components/preview/RepairLogResources.vue'
const d=sfc.parse(fs.readFileSync(dfile,'utf8')).descriptor
assert.equal(sfc.compileTemplate({source:d.template.content,filename:dfile,id:'detail'}).errors.length,0)
assert.ok(d.template.content.includes('role="table"'))
assert.ok(d.template.content.includes('物料名称'))
assert.ok(d.template.content.includes('使用数量'))
assert.ok(!d.template.content.includes('statuses[use.useStatus]'))
console.log('PASS log resource detail compilation')
