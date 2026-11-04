import type { PackageSize } from "@/lib/vehicles"
export type DeliveryDraft = {
  pickupValue:string; deliveryValue:string
  pickupCoords:{lat:number;lng:number}|null; deliveryCoords:{lat:number;lng:number}|null
  itemDescription:string; itemPhotos:string[]; packageSize:PackageSize|null; promoCode:string
  step?:number; pickupInstructions?:string; deliveryInstructions?:string
  recipientName?:string; recipientPhone?:string; collectionTime?:string; checkoutKey?:string|null
}
const key=(owner:string)=>`godrop-booking:${owner}:delivery`
export function saveDeliveryDraft(owner:string,draft:DeliveryDraft) {
  if(!owner)return
  try { sessionStorage.setItem(key(owner),JSON.stringify({draft,expires:Date.now()+12*3600000})) } catch {}
}
export function loadDeliveryDraft(owner:string):DeliveryDraft|null {
  if(!owner)return null
  try {
    const record=JSON.parse(sessionStorage.getItem(key(owner))??"null")
    return record?.expires>Date.now() && record.draft ? record.draft : null
  } catch {return null}
}
export function clearDeliveryDraft(owner:string) {
  if(owner)try {sessionStorage.removeItem(key(owner))} catch {}
}
