"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { adminApproveDriver } from "@/app/actions/delivery"

export function ApproveDriverButton({driverId,name,documentIds,disabled}:{driverId:string;name:string;documentIds:string[];disabled:boolean}) {
  const router=useRouter()
  const [busy,start]=useTransition()
  const [error,setError]=useState("")
  return <>
    <button type="button" disabled={disabled||busy||!documentIds.length} className="w-full rounded-xl border border-green-500/20 bg-green-500/10 p-2.5 text-sm font-bold text-green-400 disabled:opacity-40"
      onClick={()=>{
        if(!window.confirm(`Approve ${name}? Confirm you reviewed all ${documentIds.length} displayed documents. Pending documents will be marked approved.`))return
        setError("")
        start(async()=>{
          try {
            const result=await adminApproveDriver(driverId,documentIds)
            if(result.error)setError(result.error)
            else router.refresh()
          } catch {setError("Approval could not be checked. Refresh before retrying.")}
        })
      }}>{busy?"Saving approval…":"Approve Driver"}</button>
    {error&&<p role="alert" className="text-sm text-red-300">{error}</p>}
  </>
}
