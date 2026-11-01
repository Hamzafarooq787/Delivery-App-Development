import { NextRequest, NextResponse } from "next/server"
import { integrationIdentity, integrationBudget } from "@/lib/integration-access"
import { googleProxy, validCoordinates } from "@/lib/google-proxy"

export async function GET(req:NextRequest) {
 const access=await integrationIdentity()
 if("error" in access)return NextResponse.json({error:access.error},{status:access.status})
 const origin=req.nextUrl.searchParams.get("origin"),destination=req.nextUrl.searchParams.get("destination")
 if(!origin?.trim()||!destination?.trim()||origin.length>400||destination.length>400)return NextResponse.json({error:"Enter valid collection and delivery addresses."},{status:400})
 const budget=await integrationBudget(access.userId,"maps")
 if(budget)return NextResponse.json({error:budget.error},{status:budget.status,headers:budget.status===429?{"Retry-After":"60"}:{}})
 const result=await googleProxy("directions/json",new URLSearchParams({origin,destination,departure_time:"now"}))
 if("error" in result)return NextResponse.json({error:result.error},{status:result.status})
 return NextResponse.json(result.data)
}
