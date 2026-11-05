export const DEFAULT_CANCELLATION = {travelFee:2.5,travelDriver:2,arrivedFee:3.5,arrivedDriver:3}
export type CancellationSettings=typeof DEFAULT_CANCELLATION
export function validCancellationSettings(value:unknown):value is CancellationSettings{
 if(!value||typeof value!=="object")return false
 const v=value as CancellationSettings
 return Object.keys(DEFAULT_CANCELLATION).every(k=>{const n=v[k as keyof CancellationSettings];return typeof n==="number"&&Number.isFinite(n)&&n>=0&&n<=100&&Math.abs(Math.round(n*100)-n*100)<1e-7})&&v.travelDriver<=v.travelFee&&v.arrivedDriver<=v.arrivedFee
}

export function cancellationSummary(config:CancellationSettings){
 return `Cancel for free before your driver starts travel. Once travel starts, the fee is £${config.travelFee.toFixed(2)}; after arrival, £${config.arrivedFee.toFixed(2)}. The balance returns to the original payment method. Driver fault or no-show has no fee. Purchased shopping needs an admin review before any refund.`
}
