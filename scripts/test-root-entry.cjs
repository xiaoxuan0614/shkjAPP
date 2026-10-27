const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript')
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const helper={exports:{}};vm.runInNewContext(compile(fs.readFileSync('src/utils/rootEntry.ts','utf8')),helper)
const {isRootEntry}=helper.exports
for(const hash of ['', '#', '#/', '#/?from=bookmark'])assert.equal(isRootEntry({pathname:'/',hash}),true)
assert.equal(isRootEntry({pathname:'/index.html',hash:''}),true)
assert.equal(isRootEntry({pathname:'/oa/',hash:'#/'},'/oa/'),true)
assert.equal(isRootEntry({pathname:'/oa/index.html',hash:''},'/oa/'),true)
assert.equal(isRootEntry({pathname:'/',hash:'#/pages/ops/repairDetail?id=1'}),false)
assert.equal(isRootEntry({pathname:'/oauth2-app/login',hash:''}),false)
let logged=false,oauth=false,mixin,calls=[]
const box={exports:{},window:{location:{pathname:'/',hash:''}},getCurrentPages:()=>[{route:'pages/home/index'}],uni:{addInterceptor(){},reLaunch(options){calls.push(options);box.window.location.hash='#'+options.url;options.complete?.()}},require:name=>{
  if(name==='@/utils/rootEntry')return helper.exports
  if(name==='@/store')return {useUserStore:()=>({isLogined:logged}),usePermissionStore:()=>({})}
  if(name==='@/common/constants')return {HOME_PAGE:'/pages/home/index'}
  if(name==='@/common/uitls')return {isOAuth2AppEnv:()=>oauth}
  return {}
}}
vm.runInNewContext(compile(fs.readFileSync('src/interceptors/route.ts','utf8').replace('import.meta.env.BASE_URL',"'/'")),box)
box.exports.routeInterceptor.install({mixin:m=>mixin=m})
const show=()=>mixin.onShow.call({$mpType:'page'})
show();assert.equal(calls.at(-1).url,'/pages/login/login')
logged=true;box.window.location.hash='';show();assert.equal(calls.at(-1).url,'/pages/home/index')
const count=calls.length;show();assert.equal(calls.length,count,'canonical home must not redirect repeatedly')
box.window.location.hash='#/pages/ops/repairDetail?id=1';show();assert.equal(calls.length,count,'preserve deep links')
logged=false;oauth=true;box.window.location.hash='#/';show();assert.equal(calls.at(-1).url,'/pages/login/loginOauth2')
console.log('PASS root entry, logged-in/out, OAuth, deployment base, deep links and loop guard')
