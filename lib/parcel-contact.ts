import { normaliseUKPhone } from "./uk-phone"

export function parcelContact(name: unknown, phone: unknown, time: unknown, now=Date.now()) {
  const recipient_name = typeof name==="string" ? name.trim() : ""
  const recipient_phone = normaliseUKPhone(phone)
  if (recipient_name.length<2 || recipient_name.length>100) return {error:"Enter the recipient’s name."}
  if (!recipient_phone) return {error:"Enter a valid UK phone number for the recipient."}
  if (typeof time!=="string") return {error:"Choose when to collect the parcel."}
  const date=time==="asap" ? null : Date.parse(time)
  if (date!==null && (!Number.isFinite(date) || date<=now || date>now+30*86400000)) return {error:"Choose a future collection time within the next 30 days."}
  return {recipient_name,recipient_phone,collection_at:date===null?null:new Date(date).toISOString()}
}

export function addressPostcode(address:string) {
  return address.match(/\b(?:GIR\s*0AA|[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i)?.[0]?.replace(/\s/g,"").toUpperCase() ?? null
}
