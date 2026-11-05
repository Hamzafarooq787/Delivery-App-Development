import "server-only"
import {createAdminClient} from "@/lib/supabase/admin"
import {getStripe} from "@/lib/stripe/server"

export function isShoppingSimulation(reference:string|null|undefined){
 return !!reference?.startsWith("sandbox_")
}

/** Recheck the provider on every simulated purchase operation. Never trust a UI flag. */
export async function requireSandboxPayment(id:string){
 if(!/^(sk|rk)_test_/.test(process.env.STRIPE_SECRET_KEY??""))throw Error("Shopping simulation is disabled in live mode.")
 const db=createAdminClient()
 const {data:payment,error}=await db.from("payments").select("stripe_payment_intent").eq("delivery_id",id).eq("purpose","booking").eq("status","paid").maybeSingle()
 if(error||!payment?.stripe_payment_intent)throw Error("A paid Stripe sandbox booking is required.")
 const stripe=getStripe()
 const [intent,balance]=await Promise.all([stripe.paymentIntents.retrieve(payment.stripe_payment_intent),stripe.balance.retrieve()])
 if(intent.livemode!==false||balance.livemode!==false||intent.status!=="succeeded"||intent.currency!=="gbp")throw Error("Only successful GBP test payments can use shopping simulation.")
 return payment.stripe_payment_intent as string
}

export async function verifiedShoppingSimulation(id:string,reference:string){
 if(reference!==`sandbox_${id}`)throw Error("Invalid shopping simulation reference.")
 const intent=await requireSandboxPayment(id)
 const {data,error}=await createAdminClient().from("shopping_sandbox_sessions").select("driver_id,payment_intent,simulated_spent").eq("delivery_id",id).maybeSingle()
 if(error||!data||data.payment_intent!==intent)throw Error("This order has no verified sandbox session.")
 return data as {driver_id:string;payment_intent:string;simulated_spent:number|null}
}
