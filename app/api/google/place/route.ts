import { NextRequest, NextResponse } from "next/server"
import { integrationIdentity, integrationBudget } from "@/lib/integration-access"
import { googleProxy, validCoordinates } from "@/lib/google-proxy"

export async function GET(req:NextRequest) {
 const access=await integrationIdentity()
 if("error" in access)return NextResponse.json({error:access.error},{status:access.status})
 const placeId=req.nextUrl.searchParams.get("placeId")
 if(!placeId||placeId.length>300||!/^[a-zA-Z0-9_-]+$/.test(placeId))return NextResponse.json({error:"Invalid place ID."},{status:400})
 const budget=await integrationBudget(access.userId,"maps")
 if(budget)return NextResponse.json({error:budget.error},{status:budget.status,headers:budget.status===429?{"Retry-After":"60"}:{}})
 const result=await googleProxy("place/details/json",new URLSearchParams({place_id:placeId,fields:"geometry"}))
 if("error" in result)return NextResponse.json({error:result.error},{status:result.status})
 const loc=result.data.result?.geometry?.location
 if(!loc||!validCoordinates(loc.lat,loc.lng))return NextResponse.json({error:"Location not found."},{status:404})
 return NextResponse.json({location:{latitude:loc.lat,longitude:loc.lng}})
}
