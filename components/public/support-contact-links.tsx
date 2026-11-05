"use client"
import {useEffect,useState} from "react"
export function SupportContactLinks(){
 const [contact,setContact]=useState<{email?:string;phone?:string}|null>(null)
 useEffect(()=>{let active=true;fetch("/api/public/contact",{signal:AbortSignal.timeout(4500)}).then(async r=>{if(r.ok&&active)setContact(await r.json())}).catch(()=>{});return()=>{active=false}},[])
 if(!contact?.email&&!contact?.phone)return null
 return <div className="flex flex-wrap justify-center gap-3">{contact.email&&<a className="inline-flex min-h-11 items-center underline" href={`mailto:${contact.email}`}>{contact.email}</a>}{contact.phone&&<a className="inline-flex min-h-11 items-center underline" href={`tel:${contact.phone}`}>{contact.phone}</a>}</div>
}
