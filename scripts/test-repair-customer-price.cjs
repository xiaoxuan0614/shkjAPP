const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript'),vue=require('vue');
const source=fs.readFileSync('src/pages/ops/components/preview/OpsWorkflow.vue','utf8');
const functions=source.slice(source.indexOf('function amount()'),source.indexOf('function complete()'));
const setup=source.slice(source.indexOf('const customerPriceRemark'),source.indexOf('function openForm('));
const state={...vue,priceInput:vue.ref('10.00'),customerQuoteAmount:vue.ref(10),selectedId:vue.ref('o'),selected:vue.ref({raw:{order:{latestQuotationId:'q'},quotations:[{id:'q',stage:'WAIT_CUSTOMER'}]}})};
let result,task;
state.transact=fn=>{task=fn()};state.repairOrderApi={customerPrice:async payload=>{result=payload}};
vm.createContext(state);vm.runInContext(ts.transpileModule(setup+functions+'\nglobalThis.reason=customerPriceRemark;',{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,state);
(async()=>{
 state.confirmPrice();await task;assert.equal(result.amount,10);assert.equal(result.remark,undefined);
 state.priceInput.value='12.34';state.confirmPrice();await assert.rejects(task,/变更原因/);
 state.reason.value=' 客户协商调整 ';state.confirmPrice();await task;assert.equal(result.amount,12.34);assert.equal(result.remark,'客户协商调整');
 state.priceInput.value='10';state.confirmPrice();await task;assert.equal(result.remark,undefined,'same price omits stale reason');
 state.priceInput.value='0';state.confirmPrice();await task;assert.equal(result.amount,0);assert.ok(result.remark);
 state.priceInput.value='1.234';state.confirmPrice();await assert.rejects(task,/两位小数/);
 state.priceInput.value='10';state.customerQuoteAmount.value=null;state.confirmPrice();await assert.rejects(task,/缺少审批通过/);
 console.log('PASS customer price: changed amount requires remark, cents comparison, zero, stale reason omission and missing baseline');
})().catch(e=>{console.error(e);process.exitCode=1});
