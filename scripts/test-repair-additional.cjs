const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript'),sfc=require('vue/compiler-sfc')
const box={exports:{},require}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/service/repairAdditional.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,box)
const {additionalPayload:p,canAdditional:can,additionalCandidates:c}=box.exports
const d={order:{id:'o',workStatus:'PROCESSING'},actions:{canOwnerApply:true,canStartWork:true,canEditContact:true,canEvaluate:false},members:[{id:'member',userId:'helper',memberStatus:'ACTIVE'}],applications:[{id:'application',applicantUserId:'me',applicationStatus:'PENDING'},{id:'other',applicantUserId:'other',applicationStatus:'PENDING'}],workRecords:[{id:'record',operatorUserId:'me'},{id:'other-record',operatorUserId:'other'}],materialLinks:[{id:'pick',handlerUserId:'me',linkType:'PICK',stockApplyId:'stock'},{id:'other-pick',handlerUserId:'other',linkType:'PICK'}],materialUses:[{id:'use',useStatus:'PENDING_CONFIRM'},{id:'confirmed',useStatus:'CONFIRMED'}]}
const plain=x=>JSON.parse(JSON.stringify(x))
d.order.responsibleUserId='me';d.members[0].personType='INTERNAL'
assert.equal(can('memberExit',d,'other'),false,'contact editing does not confer member removal permission')
assert.equal(can('memberExit',{...d,members:[{...d.members[0],personType:'EXTERNAL'}]},'me'),false,'external unit removal must not use single-member endpoint')
assert.equal(c({...d,applications:[...d.applications,{id:'collab',applicationType:'COLLABORATION',applicantUserId:'me',applicationStatus:'PENDING'}]},'me').applications.length,1,'collaboration has one dedicated management entry')
assert.equal(c(d,'me').applications.length,1)
assert.deepEqual(plain(p('withdraw',d,'me',{targetId:'application',reason:'补充'})),{applicationId:'application',reason:'补充'})
assert.throws(()=>p('withdraw',d,'me',{targetId:'other',reason:'错误'}))
assert.deepEqual(plain(p('memberExit',d,'me',{targetId:'member',reason:'完成协助'})),{orderId:'o',memberId:'member',reason:'完成协助'})
assert.throws(()=>p('memberExit',d,'me',{targetId:'helper',reason:'错误用户ID'}))
for(const kind of ['confirmUse','writeoff','closeRemainder','contact']) {
  assert.equal(box.exports.repairActionTitles[kind],undefined)
  assert.equal(can(kind,d,'me'),false)
  assert.throws(()=>p(kind,d,'me',{reason:'旧入口'}))
}
const clock={targetId:'record',startedAt:Date.now()-7200000,endedAt:Date.now()-3600000,reason:'定位异常'}
assert.equal(can('clockCorrection',d,'me'),false)
assert.throws(()=>p('clockCorrection',d,'me',clock))
assert.throws(()=>p('clockCorrection',d,'me',{...clock,endedAt:Date.now()+3600000}))
assert.throws(()=>p('clockCorrection',d,'me',{...clock,endedAt:clock.startedAt-1}))
assert.throws(()=>p('clockCorrection',d,'me',{...clock,targetId:'other-record'}))
const missing={activityKind:'INITIAL_INSPECTION',repairMethod:'OFFLINE',repairResult:'REPAIRED',faultLocation:'机房',faultDescription:'异常',repairDescription:'恢复',reason:'定位不可用'}
assert.throws(()=>p('missingClock',d,'me',missing))
assert.equal(can('missingClock',d,'me'),false)
assert.throws(()=>p('missingClock',d,'me',missing,['file']))
const done={...d,order:{id:'o',workStatus:'COMPLETED'},actions:{canEvaluate:true}}
assert.equal(can('evaluation',done,'me'),true);assert.equal(can('missingClock',done,'me'),false)
assert.throws(()=>p('evaluation',done,'me',{}))
assert.throws(()=>p('evaluation',done,'me',{serviceAttitudeScore:6,repairQualityScore:5,responseEfficiencyScore:5}))
assert.deepEqual(plain(p('evaluation',done,'me',{serviceAttitudeScore:4,repairQualityScore:5,responseEfficiencyScore:3,opinion:'正常'})),{orderId:'o',serviceAttitudeScore:4,repairQualityScore:5,responseEfficiencyScore:3,opinion:'正常'})
for(const kind of ['contact','confirmUse','memberExit','writeoff','clockCorrection','missingClock'])assert.equal(can(kind,{...d,actions:{},members:[]},'me'),false)
const filename='src/pages/ops/components/preview/RepairAdditionalForm.vue',{descriptor}=sfc.parse(fs.readFileSync(filename,'utf8'),{filename})
sfc.compileScript(descriptor,{id:'additional'})
assert.deepEqual(sfc.compileTemplate({source:descriptor.template.content,filename,id:'additional'}).errors,[])
const vue=require('vue'),events=[]
const componentBox={exports:{},require:n=>n==='vue'?vue:n==='@/service/repairAdditional'?box.exports:{}}
vm.runInNewContext(ts.transpileModule(sfc.compileScript(descriptor,{id:'additional'}).content,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,componentBox)
const setup=kind=>componentBox.exports.default.setup({kind,detail:d,actorId:'me',disabled:false},{expose(){},emit:(...e)=>events.push(e)})
const withdrawForm=setup('withdraw');withdrawForm.submit();assert.equal(events.length,0);assert.ok(withdrawForm.error.value)
Object.assign(withdrawForm.form,{targetId:'application',reason:'更新'})
withdrawForm.submit();assert.equal(events[0][0],'submit');assert.equal(events[0][1].applicationId,'application')
const missingForm=setup('missingClock');Object.assign(missingForm.form,missing);missingForm.photos.value=['local-photo'];missingForm.submit()
assert.equal(events.length,1,'retired missing-clock form cannot submit');assert.ok(missingForm.error.value)
console.log('PASS active additional operations and retired clock actions: payloads, permissions, validation and Vue compilation')
