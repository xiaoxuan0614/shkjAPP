const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),vue=require('vue'),assert=require('node:assert/strict');
const source=fs.readFileSync('src/pages/ops/components/preview/OpsWorkflow.vue','utf8');
const snippet=source.slice(source.indexOf("const repairLogDate = ref('')"),source.indexOf('const repairSummaryRows'));
const requests=[];let reply=async()=>({records:[{id:'r',orderId:'o',repairDescription:'维修内容'}],total:21});
const state={exports:{},...vue,watch:()=>{},onBeforeUnmount:()=>{},selectedId:vue.ref('o'),screen:vue.ref('logList'),repairCaseView:d=>({logs:d.workRecords}),repairOrderApi:{workPage:async(...args)=>{requests.push(args);return reply()}}};
vm.createContext(state);vm.runInContext(ts.transpileModule(snippet+'\nObject.assign(exports,{loadRepairLogs,changeRepairLogDate,repairLogDate,repairLogsPage,repairLogsPages,repairLogsTotal,repairLogRecords,repairLogsError,repairLogsLoading});',{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,state);
const s=state.exports;
(async()=>{
 await s.loadRepairLogs();assert.deepEqual(requests[0],['o',1,10,'']);assert.equal(s.repairLogsPages.value,3);
 s.repairLogsPage.value=3;s.changeRepairLogDate('2026-10-29');assert.equal(s.repairLogsPage.value,1);await s.loadRepairLogs();assert.equal(requests[1][3],'2026-10-29');
 s.changeRepairLogDate('');await s.loadRepairLogs();assert.equal(requests[2][3],'');
 let release;reply=()=>new Promise(resolve=>{release=resolve});const old=s.loadRepairLogs();s.changeRepairLogDate('2026-10-28');reply=async()=>({records:[],total:0});await s.loadRepairLogs();release({records:[{id:'old'}],total:9});await old;assert.equal(s.repairLogRecords.value.length,0);assert.equal(s.repairLogsTotal.value,0);
 reply=async()=>{throw new Error('网络异常')};await s.loadRepairLogs();assert.equal(s.repairLogsError.value,'网络异常');assert.equal(s.repairLogsLoading.value,false);
 reply=async()=>({records:[{id:'bad',orderId:'other'}],total:1});await s.loadRepairLogs();assert.match(s.repairLogsError.value,/不匹配/);
 assert.ok(!source.includes('const summaryPending'));
 console.log('PASS repair work page: order/date/pageSize, reset, stale-response guard, error recovery and scope validation');
})().catch(e=>{console.error(e);process.exitCode=1});
