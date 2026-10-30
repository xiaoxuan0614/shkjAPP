const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const source=fs.readFileSync('src/pages/ops/components/preview/OpsWorkflow.vue','utf8');
const functions=source.slice(source.indexOf('function back()'),source.indexOf('function resetFilters()'))+
 source.slice(source.indexOf('function openHomeEntry('),source.indexOf('async function openOrder('));
function setup(screen='reports') {
 const state={screen:{value:screen},source:{value:'reports'},actor:{value:{role:'technician'}},listGeneration:0,detailGeneration:0,workGeneration:0,logDetailGeneration:0,closed:0,toasts:0,quotationReads:0};
 for(const name of ['submitting','showQuoteDetails','showContact','showMore','showSettings','mediaBusy','listBusy','loading','workLoading','logDetailLoading'])state[name]={value:false};
 state.selectedId={value:'order'};state.editingReport={value:''};state.retainedReportFiles={value:[]};
 state.emit=event=>{if(event==='close')state.closed++};state.uni={showToast:()=>state.toasts++};state.go=target=>{state.screen.value=target};state.resetFilters=()=>{};state.loadQuotationDictionary=()=>state.quotationReads++;
 vm.createContext(state);vm.runInContext(ts.transpileModule(functions,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,state);return state;
}
for(const screen of ['reports','records','inspection']){
 const s=setup(screen);for(const flag of ['showQuoteDetails','showContact','showMore','showSettings','mediaBusy','loading','listBusy'])s[flag].value=true;
 s.back();assert.equal(s.closed,1);assert.equal(s.toasts,0);assert.equal(s.detailGeneration,1);assert.equal(s.listBusy.value,false);assert.equal(s.showQuoteDetails.value,false);
 s.openHomeEntry('reports');assert.equal(s.screen.value,'reports');assert.equal(s.mediaBusy.value,false);s.back();assert.equal(s.closed,2);
}
const saving=setup();saving.submitting.value=true;saving.back();assert.equal(saving.closed,0);assert.equal(saving.toasts,1);
const detail=setup('detail');detail.back();assert.equal(detail.screen.value,'reports');assert.equal(detail.closed,0);detail.back();assert.equal(detail.closed,1);
const form=setup('create');form.mediaBusy.value=true;form.back();assert.equal(form.screen.value,'create');assert.equal(form.toasts,1);
const sfc=require('vue/compiler-sfc');const {descriptor}=sfc.parse(source);sfc.compileScript(descriptor,{id:'back'});assert.deepEqual(sfc.compileTemplate({source:descriptor.template.content,filename:'OpsWorkflow.vue',id:'back'}).errors,[]);
console.log('PASS: list exit with stale popup/media state, re-entry, detail-to-list-to-home, pending read invalidation and form submission protection');
