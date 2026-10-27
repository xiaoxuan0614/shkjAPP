const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript')
let tree=[{id:'ops',departName:'运维部'},{id:'other',departName:'工程部'}],fail=false
const calls=[]
const box={exports:{},require:()=>({http:{get:async(url,params)=>{
  calls.push([url,params])
  if(url.includes('queryTreeList'))return {success:true,result:tree}
  if(fail)return {success:false}
  assert.equal(params.departId,'ops');assert.equal(params.pageSize,100)
  return {success:true,result:{total:101,records:params.pageNo===1?[{id:'u1',realname:'运维甲',status:1},{id:'disabled',status:2},{id:'deleted',delFlag:1}]:[{id:'u2',realname:'运维乙'}]}}
}}})}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/service/operationsMembership.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,box)
;(async()=>{
  assert.equal((await box.exports.readOperationsUsers()).map(u=>u.value).join(','),'u1,u2')
  assert.equal(calls.filter(c=>c[0]==='/sys/user/list').length,2)
  fail=true;await assert.rejects(box.exports.readOperationsUsers(),/人员查询失败/)
  tree=[];await assert.rejects(box.exports.readOperationsUsers(),/未找到/)
  tree=[{id:'a',departName:'运维部'},{id:'b',departName:'运维部'}];await assert.rejects(box.exports.readOperationsUsers(),/多个运维部/)
  console.log('PASS operations department candidates, pagination, disabled users and fail-closed errors')
})().catch(e=>{console.error(e);process.exitCode=1})
