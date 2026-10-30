import { http } from '@/utils/http'
import { resultOf, type Transport } from './restAssignment'
export const restApi:Transport=async(method,url,data)=>{
  try{return resultOf(await http({url,method,...(method==='GET'?{query:data}:{data}),hideErrorToast:true}))}
  catch(e:any){const body=e?.data||e;if(body?.success===false)throw Object.assign(new Error(body.message||'请求失败'),{definite:true,errorCode:body.errorCode,code:body.code});throw e}
}
