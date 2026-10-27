const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript'),vue=require('vue'),sfc=require('vue/compiler-sfc')
const path='src/pages/ops/components/preview/RepairMaterialStatistics.vue'
const {descriptor}=sfc.parse(fs.readFileSync(path,'utf8'),{filename:path})
assert.ok(!descriptor.template.content.includes('scroll-x'),'statistics must fit mobile width without horizontal scrolling')
assert.ok(descriptor.styles[0].content.includes('minmax(0,2fr) repeat(4,minmax(0,1fr))'))
assert.ok(!descriptor.styles[0].content.includes('min-width:480px'))
assert.equal(sfc.compileTemplate({source:descriptor.template.content,filename:path,id:'stats'}).errors.length,0)
let fail=false,calls=[]
const box={exports:{},require:name=>name==='vue'?{...vue,onBeforeUnmount(){}}:name==='@/service/repairOrder'?{repairOrderApi:{materialStatistics:async(...args)=>{calls.push(args);if(fail)throw Error('offline');return {orderId:args[0],records:[{materialId:'m',outboundQty:10,consumedQty:3,actualReturnQty:1,availableReturnQty:6}],total:6}}}}:{}}
vm.runInNewContext(ts.transpileModule(sfc.compileScript(descriptor,{id:'stats'}).content,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,box)
;(async()=>{
 const scope=vue.effectScope(),props=vue.reactive({orderId:'order1'})
 const p=scope.run(()=>box.exports.default.setup(props,{expose(){}}))
 assert.equal(calls.length,0);p.toggle();await new Promise(setImmediate)
 assert.equal(calls[0].join(','),'order1,1,5');assert.equal(p.rows.value[0].availableReturnQty,6)
 assert.equal(p.quantity(0),0);assert.equal(p.quantity(null),'—')
 await p.load(2);assert.equal(calls.at(-1)[1],2)
 fail=true;await p.load(1);assert.equal(p.failed.value,true);assert.equal(p.rows.value.length,0)
 fail=false;await p.load(1);assert.equal(p.failed.value,false)
 props.orderId='order2';await vue.nextTick();await new Promise(setImmediate);assert.equal(calls.at(-1)[0],'order2');assert.equal(p.page.value,1)
 scope.stop();console.log('PASS repair statistics: lazy loading, pagination, zero/missing quantities, retry and order changes')
})().catch(e=>{console.error(e);process.exitCode=1})
