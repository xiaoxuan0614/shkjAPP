// Runs actual Vue setup with isolated API doubles, without network or business writes.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict')
const ts=require('typescript'),vue=require('vue'),sfc=require('vue/compiler-sfc')
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText
const tick=async()=>{await vue.nextTick();await new Promise(setImmediate)}
function setup(file, overrides){
 const {descriptor}=sfc.parse(fs.readFileSync(file,'utf8'),{filename:file})
 const script=sfc.compileScript(descriptor,{id:'scroll-tests'})
 const box={exports:{},setInterval:()=>0,clearInterval:()=>{},uni:{getStorageSync:()=>false},require:n=>{
 if(n==='vue')return {...vue,onBeforeUnmount:()=>{}}
 if(n==='@dcloudio/uni-app')return {onLoad:()=>{}}
 if(n in overrides)return overrides[n]
 if(n.endsWith('.vue'))return {}
 if(n==='@/store/user')return {useUserStore:()=>({identity:{userId:'me'},userInfo:{realname:'测试'}})}
 if(n==='./repairWorkflow') { const m={exports:{}};vm.runInNewContext(compile(fs.readFileSync('src/pages/ops/components/preview/repairWorkflow.ts','utf8')),m);return m.exports }
 if(n==='@/service/repairAdditional') { const m={exports:{},require};vm.runInNewContext(compile(fs.readFileSync('src/service/repairAdditional.ts','utf8')),m);return m.exports }
 return require(n)
 }}
 vm.runInNewContext(compile(script.content),box)
 const scope=vue.effectScope();const page=scope.run(()=>box.exports.default.setup({canManage:false},{expose(){},emit(){}}))
 return {page,scope,descriptor}
}
async function main(){
 let requests=[], respond=async q=>({records:Array.from({length:20},(_,i)=>({id:`o${(q.pageNo-1)*20+i}`})),total:45})
 const api={list:q=>{requests.push(q);return respond(q)}}
 const {page:p,scope,descriptor}=setup('src/pages/ops/components/preview/OpsWorkflow.vue',{'@/service/repairOrder':{repairOrderApi:api,repairCaseView:r=>({...r,raw:{order:r},actions:{}})}})
 p.openHomeEntry('records');await tick()
 assert.equal(requests.length,1);assert.equal(p.cases.value.length,20)
 const top=p.scrollTop.value
 let finish;respond=()=>new Promise(r=>finish=r)
 const pending=p.loadMore();p.loadMore();assert.equal(requests.length,2,'duplicate bottom events issue one request')
 finish({records:[{id:'o19'},{id:'o20'}],total:45});await pending
 assert.equal(p.cases.value.length,21,'append deduplicates overlap');assert.equal(p.scrollTop.value,top,'append preserves scroll')
 respond=async()=>{throw Error('网络错误')};await p.loadMore()
 assert.equal(p.page.value,2);assert.equal(p.cases.value.length,21,'failure retains previous rows')
 respond=async()=>({records:[{id:'o44'}],total:45});await p.loadList(true)
 assert.equal(requests.at(-1).pageNo,3,'retry uses failed page');assert.equal(p.hasMore.value,false)
 const count=requests.length;await p.loadMore();assert.equal(requests.length,count,'end stops requests')
 respond=()=>new Promise(r=>finish=r);const old=p.loadList()
 respond=async()=>({records:[{id:'new'}],total:1});p.filter.value='已完成';await tick()
 finish({records:[{id:'stale'}],total:99});await old
 assert.equal(p.cases.value[0].id,'new','old filter response cannot overwrite new scope')
 assert.equal(requests.at(-1).workStatus,'COMPLETED')
 p.openHomeEntry('reports');await tick();assert.equal(requests.at(-1).scope,'REPORTED')
 assert.ok(descriptor.template.content.includes('@scrolltolower="loadMore"'))
 assert.ok(!descriptor.template.content.includes('上一页'))
 scope.stop()
 let logRequests=[],logRespond=async()=>({result:{records:[{id:'l1',periodId:'p'}],total:21}})
 const {page:l,scope:ls}=setup('src/pages/ops/implementRecords.vue',{'@/service/shkj':{projectApi:{},unwrapRecords:x=>x},'@/service/implementationRecords':{implementationRecordsApi:{list:(...q)=>{logRequests.push(q);return logRespond(...q)}}},'@/utils/http':{http:{}}})
 l.periodId.value='p';await l.loadRecords();assert.equal(l.records.value.length,1)
 let finishLogs;logRespond=()=>new Promise(r=>finishLogs=r);const load=l.loadMore();l.loadMore();assert.equal(logRequests.length,2)
 finishLogs({result:{records:[{id:'l1',periodId:'p'},{id:'l2',periodId:'p'}],total:21}});await load;assert.equal(l.records.value.length,2)
 logRespond=async()=>{throw Error('离线')};await l.loadMore();assert.equal(l.page.value,2);assert.equal(l.records.value.length,2)
 logRespond=async()=>({result:{records:[],total:21}});await l.loadRecords(l.page.value+1);assert.equal(l.hasMore.value,false)
 logRespond=()=>new Promise(r=>finishLogs=r);const stale=l.loadRecords();await tick()
 logRespond=async()=>({result:{records:[{id:'fresh',periodId:'p',processId:'process'}],total:1}});l.chooseProcess('process');await tick()
 finishLogs({result:{records:[{id:'old',periodId:'p'}],total:1}});await stale
 assert.equal(l.records.value[0].id,'fresh');ls.stop()
 console.log('PASS scroll append, deduplication, duplicate events, retry page, end, scope reset, stale responses: repair and implementation lists')
}
main().catch(e=>{console.error(e);process.exitCode=1})
