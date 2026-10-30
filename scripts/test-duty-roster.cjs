const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict'), ts = require('typescript');
const requests = [];
const result = { date:'2026-10-28', weekday:'星期三', dayUsers:[{userId:'1',name:'测试人员'},{userId:'1',name:'测试人员'}], nightUsers:[], restUsers:[] };
const sandbox = { exports:{}, require: () => ({http:{get: async (...args) => {requests.push(args); return {success:true,result};}}}) };
vm.runInNewContext(ts.transpile(fs.readFileSync('src/service/dutyRoster.ts','utf8'),{module:ts.ModuleKind.CommonJS}),sandbox);
(async()=>{
  const api = sandbox.exports;
  assert.equal((await api.queryTodayDutyRoster()).dayUsers.length,2);
  assert.equal(requests[0].length,1); assert.equal(requests[0][0],'/operation/dutyRoster/queryByDate');
  assert.throws(()=>api.readDutyRosterResponse({success:false,result}));
  assert.throws(()=>api.readDutyRosterResponse({code:500,result}));
  assert.throws(()=>api.readDutyRosterResponse({success:true,result:{}}));
  assert.equal(api.readDutyRosterResponse({success:true,result:{...result,dayUsers:[]}}).dayUsers.length,0);
  const {parse,compileScript}=require('vue/compiler-sfc');
  const {descriptor,errors}=parse(fs.readFileSync('src/pages/ops/components/preview/ReportDutyRoster.vue','utf8'));
  assert.equal(errors.length,0);compileScript(descriptor,{id:'duty-test'});
  console.log('PASS duty roster: omitted date, names, duplicate preservation, empty roster, business errors, Vue compilation');
})().catch(e=>{console.error(e);process.exitCode=1});
