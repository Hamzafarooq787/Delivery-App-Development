"use client"
import {useState} from "react"
import {useRouter} from "next/navigation"
import {recordCollectionMilestone} from "@/app/actions/cancellation"
export function CollectionMilestones({id,travel,arrived}:{id:string;travel?:string|null;arrived?:string|null}){
 const router=useRouter();const[busy,setBusy]=useState(false),[error,setError]=useState("")
 if(arrived)return <p className="text-sm text-green-300">Arrival at collection recorded.</p>
 return <div className="space-y-2"><button disabled={busy} className="min-h-11 w-full rounded-lg border border-white/30 text-white" onClick={async()=>{if(!window.confirm(travel?"Confirm you have arrived at collection?":"Confirm you are starting travel to collection?"))return;setBusy(true);try{const r=await recordCollectionMilestone(id,travel?"arrived":"travel");if(r.error)setError(r.error);else router.refresh()}catch{setError("Stage could not save. Please retry.")}finally{setBusy(false)}}}>{busy?"Saving…":travel?"Arrived at collection":"Start travel to collection"}</button>{error&&<p role="alert">{error}</p>}</div>
}
