/** Refund display never changes the underlying paid state used for dispatch. */
export function paymentDisplayStatus(status:string,charged:number,refunds:{amount:number;state:string}[]){
 const returned=refunds.filter(r=>r.state==='succeeded').reduce((sum,r)=>sum+Number(r.amount),0)
 if(returned>0&&Math.round(returned*100)>=Math.round(charged*100))return 'refunded'
 if(returned>0)return 'partially_refunded'
 if(refunds.some(r=>['pending','requires_action'].includes(r.state)))return 'refund_pending'
 return status
}
