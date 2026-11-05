"use client"
import {useState} from "react"
import {useRouter} from "next/navigation"
import {recordCollectionMilestone} from "@/app/actions/cancellation"
export function CollectionMilestones({id,travel,arrived}:{id:string;travel?:string|null;arrived?:string|null}){
 const router=useRouter();const[busy,setBusy]=useState(false),[error,setError]=useState("")
 if(arrived)return <p className="text-sm text-green-300">Arrival at collection recorded.</p>
 return <div className="space-y-2"><button key="start-travel" disabled={busy||!!travel} className="min-h-11 w-full rounded-lg border border-white/30 text-white" onClick={()=>record("travel")}>{travel?"Travel started":busy?"Saving…":"Start travel to collection"}</button>{travel&&<button key="record-arrival" disabled={busy} className="min-h-11 w-full rounded-lg border border-white/30 text-white" onClick={()=>record("arrived")}>Confirm arrival at collection</button>}{error&&<p role="alert">{error}</p>}</div>
 async function record(stage:"travel"|"arrived"){
  if(!window.confirm(stage==="travel"?"Confirm you are starting travel to collection?":"Confirm you have arrived at collection?"))return
  setBusy(true);setError("")
  try{const r=await recordCollectionMilestone(id,stage);if(r.error)setError(r.error);else router.refresh()}
  catch{setError("Stage could not save. Please retry.")}finally{setBusy(false)}
 }
}
