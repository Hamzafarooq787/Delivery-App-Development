export const DEFAULT_CANCELLATION = {travelFee:2.5,travelDriver:2,arrivedFee:3.5,arrivedDriver:3,graceMinutes:2}
export type CancellationSettings=typeof DEFAULT_CANCELLATION
export function validCancellationSettings(value:unknown):value is CancellationSettings{
 if(!value||typeof value!=="object")return false
 const v=value as CancellationSettings
 return Object.keys(DEFAULT_CANCELLATION).every(k=>{const n=v[k as keyof CancellationSettings];return typeof n==="number"&&Number.isFinite(n)&&n>=0&&n<=100&&Math.abs(Math.round(n*100)-n*100)<1e-7})&&Number.isInteger(v.graceMinutes)&&v.graceMinutes<=60&&v.travelDriver<=v.travelFee&&v.arrivedDriver<=v.arrivedFee
}

export function cancellationSummary(config:CancellationSettings){
 return `Cancel for free before your driver starts travel and for ${config.graceMinutes} minutes after travel starts. After this grace period, the fee is £${config.travelFee.toFixed(2)}. After arrival, £${config.arrivedFee.toFixed(2)} applies immediately; there is no arrival grace period. The balance returns to the original payment method. Driver fault or no-show has no fee. Purchased shopping needs an admin review before any refund.`
}

export type CancellationPreview = { fee: number; refund: number; review: boolean; status: string; canCancel: boolean }
export function matchesCancellationPreview(current: CancellationPreview, shown?: CancellationPreview) {
 return !!shown && current.canCancel && shown.canCancel && Number(current.fee)===Number(shown.fee) &&
  Number(current.refund)===Number(shown.refund) && current.review===shown.review && current.status===shown.status
}
