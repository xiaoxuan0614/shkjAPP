const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript'),sfc=require('vue/compiler-sfc');
const box={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/service/repairMaterialHistory.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,box);
const material={materialId:'m',baseUnitId:'u'}, detail={order:{id:'o',responsibleUserId:'owner',responsibleUserName:'负责人'},members:[],materialLinks:[
 {id:'pick',orderId:'o',materialId:'m',baseUnitId:'u',linkType:'PICK',handlerUserId:'owner',outboundQty:0},
 {id:'return',orderId:'o',materialId:'m',baseUnitId:'u',linkType:'RETURN'},
 {id:'other-unit',orderId:'o',materialId:'m',baseUnitId:'u2',linkType:'PICK'},
 {id:'other-order',orderId:'other',materialId:'m',baseUnitId:'u',linkType:'PICK'},
],materialUses:[{id:'use',orderId:'o',pickLinkId:'pick',usedQuantity:2,useStatus:'VOIDED'},{id:'other',orderId:'other',pickLinkId:'pick'},{id:'bad-unit',materialId:'m',baseUnitId:'u2',pickLinkId:'pick'}]};
const result=box.exports.repairMaterialHistory(detail,'o',material);
assert.deepEqual(Array.from(result.links,r=>r.id),['pick','return']);assert.equal(result.links[0].outboundQty,0);assert.equal(result.links[0].personName,'负责人');assert.equal(result.links[1].personName,'姓名未返回');
assert.deepEqual(Array.from(result.uses,r=>r.id),['use']);assert.equal(result.uses[0].useStatus,'VOIDED');
assert.throws(()=>box.exports.repairMaterialHistory(detail,'other',material));assert.throws(()=>box.exports.repairMaterialHistory(detail,'o',{materialId:'m'}));
for(const filename of ['src/pages/ops/components/preview/RepairMaterialHistory.vue','src/pages/ops/components/preview/RepairMaterialStatistics.vue','src/pages/ops/components/preview/OpsWorkflow.vue']){
 const {descriptor,errors}=sfc.parse(fs.readFileSync(filename,'utf8'));assert.equal(errors.length,0);sfc.compileScript(descriptor,{id:'test'});const result=sfc.compileTemplate({source:descriptor.template.content,filename,id:'test'});assert.deepEqual(result.errors,[]);
}
console.log('PASS: order/material/unit isolation, source-link join, missing names, zero quantities, voided history and Vue compilation');
