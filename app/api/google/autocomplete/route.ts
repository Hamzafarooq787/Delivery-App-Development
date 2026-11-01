import { NextRequest, NextResponse } from "next/server"
import { integrationIdentity, integrationBudget } from "@/lib/integration-access"
import { googleProxy, validCoordinates } from "@/lib/google-proxy"

export async function POST(req:NextRequest) {
 const access=await integrationIdentity()
 if("error" in access)return NextResponse.json({error:access.error},{status:access.status})
 let body
 try{body=await req.json()}catch{return NextResponse.json({error:"Invalid address search."},{status:400})}
 if(!body||typeof body.input!=="string"||!body.input.trim()||body.input.length>250)return NextResponse.json({error:"Enter an address of up to 250 characters."},{status:400})
 const params=new URLSearchParams({input:body.input.trim(),language:"en"})
 const circle=body.locationBias?.circle
 if(circle!==undefined){
  const lat=circle?.center?.latitude,lng=circle?.center?.longitude,radius=circle?.radius??50000
  if(!validCoordinates(lat,lng)||typeof radius!=="number"||!Number.isFinite(radius)||radius<1||radius>50000)return NextResponse.json({error:"Invalid search location."},{status:400})
  params.set("location",`${lat},${lng}`);params.set("radius",String(radius))
 }
 if(body.includedRegionCodes!==undefined){
  if(!Array.isArray(body.includedRegionCodes)||body.includedRegionCodes.length>5||body.includedRegionCodes.some((r:unknown)=>typeof r!=="string"||!/^[a-z]{2}$/i.test(r)))return NextResponse.json({error:"Invalid country filter."},{status:400})
  if(body.includedRegionCodes.length)params.set("components",body.includedRegionCodes.map((r:string)=>`country:${r.toLowerCase()}`).join("|"))
 }
 const budget=await integrationBudget(access.userId,"maps")
 if(budget)return NextResponse.json({error:budget.error},{status:budget.status,headers:budget.status===429?{"Retry-After":"60"}:{}})
 const result=await googleProxy("place/autocomplete/json",params)
 if("error" in result)return NextResponse.json({error:result.error},{status:result.status})
 const data=result.data
 return NextResponse.json({suggestions:(data.predictions??[]).map((p:any)=>({placePredictions:{text:{text:p.description},placeId:p.place_id}})),status:data.status})
}
