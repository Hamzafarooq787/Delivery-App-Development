import {cache} from 'react'
import {createClient} from '@/lib/supabase/server'
import {createAdminClient} from '@/lib/supabase/admin'
import type {AdminScope} from './admin-operations'
const adminSession=cache(async()=>{
 const session=await createClient();const {data:{user}}=await session.auth.getUser();if(!user)return null
 const db=createAdminClient();const [profile,settings]=await Promise.all([db.from('users').select('role,account_status,admin_access').eq('id',user.id).maybeSingle(),db.from('surge_pricing_settings').select('operational_settings').eq('id',true).single()])
 const data=profile.data;if(profile.error||settings.error||data?.role!=='admin'||data.account_status!=='active')return null
 if(settings.data.operational_settings?.requireAdminMfa){const level=await session.auth.mfa.getAuthenticatorAssuranceLevel();if(level.error||level.data.currentLevel!=='aal2')return null}
 return{id:user.id,owner:data.admin_access?.owner===true,scopes:data.admin_access?.scopes??[]}
})
export async function getAdminActor(scope:AdminScope|'any'='operations'){
 const actor=await adminSession();if(!actor)return null
 if(!actor.owner&&(scope==='any'?!actor.scopes.length:!actor.scopes.includes(scope)))return null
 return actor
}
export async function auditAdmin(actor:string,event:string,entity:string,details:Record<string,unknown>={}){
 const {error}=await createAdminClient().rpc('append_admin_audit',{p_actor:actor,p_event:event,p_entity:entity,p_details:details})
 if(error)throw new Error('The change could not be recorded. Please refresh before retrying.')
}
export async function runAdminMutation<T>(scope:AdminScope,event:string,entity:unknown,work:()=>Promise<T>):Promise<T>{
 const actor=await getAdminActor(scope);if(!actor)return{error:'Permission or authenticator verification is required.'} as T
 const result=await work()
 const details:Record<string,unknown>={outcome:result&&typeof result==='object'&&'error' in result?'failed':'completed'}
 if(result&&typeof result==='object')for(const key of ['amount','refundAmount','refunded','campaignId','id'])if(key in result){const value=(result as Record<string,unknown>)[key];if(['number','boolean','string'].includes(typeof value))details[key]=value}
 await auditAdmin(actor.id,event,typeof entity==='string'?entity:'settings',details)
 return result
}
