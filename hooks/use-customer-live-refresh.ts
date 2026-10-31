'use client'
import { newShoppingRequestId } from '@/lib/shopping-booking'
import { useEffect,useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
/** One authenticated subscription; visible polling recovers unavailable realtime. */
export function useCustomerLiveRefresh(refresh:()=>Promise<unknown>,tables:string,interval=20000){
 const callback=useRef(refresh);callback.current=refresh
 useEffect(()=>{let alive=true,busy=false,debounce:ReturnType<typeof setTimeout>|undefined,channel:ReturnType<ReturnType<typeof createClient>['channel']>|undefined
 const run=async()=>{if(!alive||busy||document.visibilityState!=='visible')return;busy=true;try{await callback.current()}catch{/* Each view retains data and renders its own error state. */}finally{busy=false}}
 const schedule=()=>{clearTimeout(debounce);debounce=setTimeout(()=>void run(),250)}
 const client=createClient()
 void client.auth.getUser().then(({data:{user}})=>{if(!alive||!user)return;channel=client.channel(`customer-refresh-${tables}-${newShoppingRequestId()}`);for(const table of tables.split(','))channel=channel.on('postgres_changes',{event:'*',schema:'public',table,filter:`${table==='delivery_requests'||table==='payments'?'customer_id':table==='users'?'id':'user_id'}=eq.${user.id}`},schedule);channel.subscribe()}).catch(()=>{})
 const timer=interval>0?setInterval(run,interval):undefined;window.addEventListener('focus',run);document.addEventListener('visibilitychange',run);document.addEventListener('godrop-order-created',run)
 return()=>{alive=false;if(timer)clearInterval(timer);clearTimeout(debounce);if(channel)void client.removeChannel(channel);window.removeEventListener('focus',run);document.removeEventListener('visibilitychange',run);document.removeEventListener('godrop-order-created',run)}
 },[tables,interval])
}
