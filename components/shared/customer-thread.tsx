'use client'
import { newShoppingRequestId } from '@/lib/shopping-booking'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getCustomerThread, sendCustomerThread, type ThreadMessage } from '@/app/actions/customer-repairs'
import s from '@/components/customer/CustomerPages.module.css'

type ThreadData = NonNullable<Awaited<ReturnType<typeof getCustomerThread>>['data']>
function mergeMessages(previous:ThreadMessage[],incoming:ThreadMessage[]) {
  const byId=new Map(previous.map(m=>[m.id,m]))
  incoming.forEach(m=>byId.set(m.id,m))
  return [...byId.values()].sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id))
}
export function CustomerThread({kind,id}:{kind:'order'|'support';id:string}) {
  const [data,setData]=useState<ThreadData>(), [messages,setMessages]=useState<ThreadMessage[]>([])
  const [text,setText]=useState(''), [error,setError]=useState(''), [sending,setSending]=useState(false)
  const [open,setOpen]=useState(kind==='support'), [earlier,setEarlier]=useState(false)
  const pending=useRef<{key:string;body:string}|null>(null), busy=useRef(false), loading=useRef(false)
  const generation=useRef(0)
  const refresh=useCallback(async(version:number)=>{
    if(loading.current)return
    loading.current=true
    try {
      const r=await getCustomerThread(kind,id)
      if(version!==generation.current)return
      if(r.error)setError(r.error)
      else if(r.data){setData(r.data);setMessages(prev=>mergeMessages(prev,r.data!.messages));setError('')}
    } catch {if(version===generation.current)setError('Could not refresh the conversation. Try again.')}
    finally {if(version===generation.current)loading.current=false}
  },[kind,id])
  useEffect(()=>{
    const version=++generation.current
    loading.current=false;busy.current=false;pending.current=null
    setData(undefined);setMessages([]);setText('');setError('');setSending(false);setOpen(kind==='support')
    void refresh(version)
    const run=()=>{if(document.visibilityState==='visible')void refresh(version)}
    const timer=setInterval(run,10000);window.addEventListener('focus',run)
    return()=>{generation.current++;clearInterval(timer);window.removeEventListener('focus',run)}
  },[refresh,kind])
  async function send(e:React.FormEvent) {
    e.preventDefault()
    if(busy.current||!text.trim())return
    busy.current=true;setSending(true);setError('')
    const version=generation.current
    const message=pending.current?.body===text.trim()?pending.current:{key:newShoppingRequestId(),body:text.trim()}
    pending.current=message
    try {
      const r=await sendCustomerThread(kind,id,message.key,message.body)
      if(version!==generation.current)return
      if(r.error)setError(r.error)
      else {pending.current=null;setText('');await refresh(version)}
    } catch {if(version===generation.current)setError('Message could not be confirmed. Retry safely.')}
    finally {if(version===generation.current){busy.current=false;setSending(false)}}
  }
  async function loadEarlier() {
    if(earlier)return
    const version=generation.current;setEarlier(true)
    try {
      const r=await getCustomerThread(kind,id,messages[0]?.id)
      if(version!==generation.current)return
      if(r.data){setData(r.data);setMessages(prev=>mergeMessages(prev,r.data!.messages))}
      else setError(r.error??'Could not load earlier messages.')
    }catch{if(version===generation.current)setError('Could not load earlier messages.')}
    finally{if(version===generation.current)setEarlier(false)}
  }
  const contactLabel=data?.contactLabel??'driver'
  return <section className="space-y-3 text-sm text-white" aria-label={kind==='order'?'Delivery contact':'Support conversation'}>
    {kind==='order'&&<div className="flex flex-wrap items-center gap-3">
      <button type="button" className={s.secondary} onClick={()=>setOpen(v=>!v)} aria-expanded={open}>Message {contactLabel}</button>
      {data?.contact?.phone?<a className={s.primary} href={`tel:${data.contact.phone}`}>Call {contactLabel}</a>:<span className="text-xs text-gray-400">{data?.contact?'Phone unavailable — use messages.':'Contact becomes available for an active assigned delivery.'}</span>}
    </div>}
    {open&&<>
      <p className="text-xs text-gray-400">{data?.status?.replaceAll('_',' ')??'Loading conversation…'}</p>
      {data?.original&&<p className="rounded-xl bg-white/5 p-3 whitespace-pre-wrap break-words">{data.original}</p>}
      {data?.hasEarlier&&<button className={s.textButton} type="button" disabled={earlier} onClick={()=>void loadEarlier()}>{earlier?'Loading…':'Load earlier messages'}</button>}
      <div className="max-h-64 overflow-y-auto space-y-2" aria-live="polite">
        {messages.map(m=><article key={m.id} className="rounded-xl bg-white/5 p-3 break-words">
          <small className="text-[var(--brand-soft)]">{m.sender} · {new Date(m.created_at).toLocaleString('en-GB')}</small>
          <p className="whitespace-pre-wrap">{m.body}</p>
        </article>)}
      </div>
      {data?.canSend&&<form onSubmit={send} className="space-y-2">
        <label>Message<textarea className={s.input} value={text} onChange={e=>setText(e.target.value)} maxLength={4000} rows={3} required disabled={sending}/></label>
        <button className={s.primary} disabled={sending||!text.trim()}>{sending?'Sending…':'Send message'}</button>
      </form>}
    </>}
    {error&&<p role="alert" className={s.error}>{error} <button type="button" onClick={()=>void refresh(generation.current)}>Try again</button></p>}
  </section>
}
