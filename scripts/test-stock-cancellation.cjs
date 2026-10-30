const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const context={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/service/stockCancellation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,context);
const mode=context.exports.stockCancelMode,own={userid:'u'},other={userid:'other'},head={id:'a',applyUserId:'u',status:1,executeStatus:'PENDING'};
for(const applyType of ['OUT','IN'])for(const usageType of ['PROJECT','REPAIR','OTHER']){
 const row={...head,applyType,usageType};assert.equal(mode(row,own),applyType === 'OUT' ? 'cancel' : '');assert.equal(mode(row,other,true),'');assert.equal(mode(row,other,false),'');
 for(const executeStatus of ['EXECUTED','COMPLETED','CLOSED','DONE',''])assert.equal(mode({...row,executeStatus},own,true),'');
 for(const status of [-1,0,3])assert.equal(mode({...row,status},own,true),'');
 assert.equal(mode({...row,status:2},own,false),'withdraw');assert.equal(mode({...row,status:2},other,true),'');
}
assert.equal(mode({...head,applyType:'OUT',usageType:'PROJECT',executeStatus:'PARTIAL_EXECUTED'},own,false),'');
assert.equal(mode({...head,applyType:'IN',usageType:'PROJECT',executeStatus:'PARTIAL_EXECUTED'},own,false),'');
assert.equal(mode({...head,applyType:'OUT',applyUserName:'same'},{userid:'different',realname:'same'},false),'');
assert.equal(mode({...head,applyType:'OUT',applyUserId:null,applyUserName:'same'},{realname:'same'}),'');
assert.equal(mode({...head,applyType:'OUT'},{userid:'admin',username:'admin',roles:['admin']},true),'');
const source=fs.readFileSync('src/pages/stock/materialDetail.vue','utf8');assert.ok(source.includes('cancellationMode(latest) !== mode'));assert.ok(source.includes("await ensureCurrentAuthorization(userStore.userInfo, true)"));assert.ok(source.includes('!withdrawing.value'));assert.ok(source.includes('await stockApi.cancelApply(id.value)'));
const {parse,compileScript,compileTemplate}=require('vue/compiler-sfc');const {descriptor}=parse(source);compileScript(descriptor,{id:'stock'});assert.deepEqual(compileTemplate({source:descriptor.template.content,filename:'materialDetail.vue',id:'stock'}).errors,[]);
console.log('PASS stock cancellation: owner-only OUT cancellation, no role bypass, no partial execution, latest-state guard and Vue compilation');
