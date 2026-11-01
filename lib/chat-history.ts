export type ChatMessage = {role:"user"|"assistant";content:string}
export function chatWindow(messages:ChatMessage[]):ChatMessage[]{
 const result:ChatMessage[]=[]
 let size=0
 for(let i=messages.length-1;i>=0&&result.length<19;i--){
  const message=messages[i]
  if(size+message.content.length>12000)break
  result.unshift(message);size+=message.content.length
 }
 while(result[0]?.role === "assistant")result.shift()
 return result
}
export function validChatMessages(messages:unknown):messages is ChatMessage[]{
 return Array.isArray(messages)&&messages.length>0&&messages.length<=20&&messages.every(m=>m&&["user","assistant"].includes(m.role)&&typeof m.content==="string"&&m.content.trim().length>0&&m.content.length<=4000)&&messages.reduce((n,m)=>n+m.content.length,0)<=12000&&messages.at(-1)?.role==="user"
}
