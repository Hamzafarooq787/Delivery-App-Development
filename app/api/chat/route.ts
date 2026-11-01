import Anthropic from "@anthropic-ai/sdk"
import { NextRequest, NextResponse } from "next/server"
import { integrationIdentity,integrationBudget } from "@/lib/integration-access"
import {validChatMessages} from "@/lib/chat-history"

export async function POST(req:NextRequest) {
 const access=await integrationIdentity()
 if("error" in access)return NextResponse.json({error:access.error},{status:access.status})
 let body
 try{body=await req.json()}catch{return NextResponse.json({error:"Invalid chat request."},{status:400})}
 const messages=body?.messages
 if(!validChatMessages(messages))return NextResponse.json({error:"Send a message of up to 4,000 characters with a short recent conversation."},{status:400})
 const key=process.env.ANTHROPIC_API_KEY
 if(!key)return NextResponse.json({error:"AI assistance is unavailable. Please use the support request form."},{status:503})
 const budget=await integrationBudget(access.userId,"chat")
 if(budget)return NextResponse.json({error:budget.error},{status:budget.status,headers:budget.status===429?{"Retry-After":"60"}:{}})
 try{
  const client=new Anthropic({apiKey:key,timeout:15000,maxRetries:0})
  const response=await client.messages.create({model:"claude-opus-4-7",max_tokens:1024,system:"You are a support assistant for GoDrop. Give concise guidance about deliveries, payouts, verification and accounts. You cannot access, change, confirm or invent customer orders, balances, refunds, payouts or account records. Refer account-specific questions to the in-app support request form.",messages:messages.map(m=>({role:m.role,content:m.content.trim()}))})
  const reply=response.content.filter(b=>b.type==="text").map(b=>b.text).join("\n").trim()
  if(!reply)return NextResponse.json({error:"No reply was received. Please retry or contact support."},{status:502})
  return NextResponse.json({reply})
 }catch(error){
  return NextResponse.json({error:"AI assistance is temporarily unavailable. Please retry or use the support request form."},{status:error instanceof Anthropic.RateLimitError?429:503})
 }
}
