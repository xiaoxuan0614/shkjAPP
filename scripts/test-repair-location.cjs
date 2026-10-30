const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict');
const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/service/repairLocation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:m,exports:m.exports});
const {repairSites,nearestRepairSite}=m.exports;
const sites=repairSites([{id:'a',latitude:'0',longitude:'0'},{id:'invalid',latitude:'',longitude:'0'},{id:'range',latitude:'91',longitude:'0'},{id:'b',latitude:'1',longitude:'1'}]);
assert.equal(sites.length,2);assert.equal(nearestRepairSite(0,0,sites).distance,0);assert.equal(nearestRepairSite(1,1,sites).site.id,'b');
const latitudeForMeters=n=>n/6371000*180/Math.PI;
assert.equal(nearestRepairSite(latitudeForMeters(299.99),0,[sites[0]]).status,'NORMAL');
assert.equal(nearestRepairSite(latitudeForMeters(300.01),0,[sites[0]]).status,'OUT_OF_RANGE');
assert.throws(()=>nearestRepairSite(0,0,[]),/未配置/);
const page=fs.readFileSync('src/pages/ops/components/preview/OpsWorkflow.vue','utf8');assert.ok(page.includes('getImplementationLocation()'));assert.ok(page.includes('isFreshLocation(clockLocation.value)'));assert.ok(!page.includes('服务端暂不支持保存打卡异常原因'));assert.ok(page.includes('request!==clockRequest'));
console.log('PASS repair 300m: nearest of multiple, zero, invalid coordinates, unrounded boundary, missing sites and submission guards');

const {repairAbnormalEvidence:evidence}=m.exports;
assert.equal(JSON.stringify(evidence(false,'old',['old'])), '{}');
assert.throws(()=>evidence(true,'  ',['p']),/原因/);
assert.throws(()=>evidence(true,'reason',[]),/至少1/);
assert.throws(()=>evidence(true,'reason',Array(7).fill('p')),/最多6/);
assert.throws(()=>evidence(true,'reason',['']),/无效/);
assert.equal(evidence(true,' reason ',Array.from({length:6},(_,i)=>'p'+i)).photoFileIds.length,6);
assert.equal(evidence(true,' reason ',['p']).abnormalReason,'reason');
console.log('PASS abnormal evidence: required reason and photos, max6, trim, normal omission');

assert.throws(()=>evidence(true,'reason',['p','p']),/重复/);
assert.equal(evidence(true,'x'.repeat(2000),['p']).abnormalReason.length,2000);
assert.throws(()=>evidence(true,'x'.repeat(2001),['p']),/2000/);
assert.ok(page.includes('viewedWork.abnormalReason'));
assert.ok(page.includes('workBeginPhotos(viewedWork)'));
