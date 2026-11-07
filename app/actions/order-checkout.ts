"use server";

import {bookingAvailability} from "@/lib/booking-availability"
import { cancelByPolicy } from "@/app/actions/cancellation"
import { boundedFetch } from "@/lib/short-request"
import { optionalRecipientPhone, parcelContact } from "@/lib/parcel-contact"

import {isPreciseDeliveryAddress,PRECISE_DELIVERY_ADDRESS_ERROR} from "@/lib/precise-delivery-address"
import {revalidatePath} from "next/cache"
import { getAdminActor } from "@/lib/admin-access"
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";
import { getAppOrigin } from "@/lib/get-app-origin";
import { getBookingPricing } from "@/app/actions/booking-settings";
import { type DeliveryQuote, getDeliveryQuote } from "@/app/actions/pricing";
import {
  getShoppingQuote,
  type ShoppingQuote,
  getBfmSettings,
  type CreateShoppingRequestParams,
} from "@/app/actions/shopping";
import type { CreateDeliveryParams } from "@/app/actions/delivery";
import { isPackageSize } from "@/lib/vehicles";
import { shoppingQuoteInputs } from "@/lib/shopping-booking";
import { validateShoppingItems } from "@/lib/shopping-validation";
import { leaseOrderPhotos } from "@/lib/order-photo-lifecycle"
import { ownsOrderPhoto } from "@/lib/order-media";
import { checkQuoteConsent, readQuoteConsent, deliveryScope, shoppingScope } from "@/lib/quote-consent";
import {
  fulfillDirectSession,
  processOrderRefunds,
} from "@/lib/payments/direct";

type Request =
  | { requestKey: string; type: "delivery"; order: CreateDeliveryParams }
  | {
      requestKey: string;
      type: "buy_for_me";
      order: CreateShoppingRequestParams;
    };
export async function startOrderCheckout(
  input: Request,
): Promise<{ url: string } | { error: string; restartCheckout?:boolean }> {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user)
    return {
      error: "Sign in to confirm your order. Keep this form open if possible.",
    };
  if (input.type === 'buy_for_me') {
    if (!Array.isArray(input.order.shopping_items) || input.order.shopping_items.some(item => !item || typeof item !== "object")) return { error: 'Enter a valid shopping list.' };
    if (!isPackageSize(input.order.package_size ?? "small")) return { error: "Select a shopping size." };
  }
  const photos = input.type === 'delivery' ? input.order.item_photo_urls ?? [] : input.order.shopping_items?.map(i=>i?.photo_url) ?? [];
  if (!Array.isArray(photos) || photos.some(photo=>!ownsOrderPhoto(photo,user.id))) return { error: 'Upload your own item photos before booking.' };
  if (!isStripeConfigured())
    return { error: "Card payments are currently unavailable." };
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      input.requestKey,
    )
  )
    return { error: "Invalid booking reference. Reopen the form." };
  const instructions = [
    input.order.delivery_instructions,
    "pickup_instructions" in input.order
      ? input.order.pickup_instructions
      : undefined,
    "shop_instructions" in input.order
      ? input.order.shop_instructions
      : undefined,
  ];
  if (
    instructions.some(
      (value) =>
        value != null && (typeof value !== "string" || value.length > 500),
    )
  )
    return { error: "Keep each access instruction within 500 characters." };
  const admin = createAdminClient();
  try {
    const { data: previous, error: readError } = await admin
      .from("payments")
      .select("*")
      .eq("customer_id", user.id)
      .eq("request_key", input.requestKey)
      .maybeSingle();
    if (readError) throw readError;
    const { consent_token: _token, ...stableOrder } = input.order;
    const fingerprint = createHash("sha256")
      .update(JSON.stringify(stableOrder))
      .digest("hex");
    if (
      previous?.booking_draft?.fingerprint &&
      previous.booking_draft.fingerprint !== fingerprint
    )
      return {
        error:
          "Booking details changed. Go back and review a fresh quote before retrying.",
      };
    if (previous?.status === "paid")
      return { url: `/dashboard/customer/tracking?id=${previous.delivery_id}` };
    const shownScope=input.type==="delivery"?deliveryScope({pickupLat:input.order.pickup_lat,pickupLng:input.order.pickup_lng,deliveryLat:input.order.delivery_lat,deliveryLng:input.order.delivery_lng,packageSize:input.order.package_size,promoCode:input.order.promo_code}):shoppingScope({...input.order,...shoppingQuoteInputs(input.order.shopping_items)})
    const shown=readQuoteConsent(input.order.consent_token,user.id,shownScope)
    if(previous&&shown&&Number(previous.amount)!==shown.amount&&!previous.stripe_session_id){
      await admin.from("payments").update({status:"failed"}).eq("id",previous.id).eq("status","pending")
      return {error:"The previous unpaid price has been retired. Confirm the current reviewed total again.",restartCheckout:true}
    }
    if (previous?.stripe_session_id) {
      const session = await getStripe().checkout.sessions.retrieve(
        previous.stripe_session_id,
      );
      if (session.status === "complete")
        return { url: `/dashboard/customer/checkout?session_id=${session.id}` };
      if(shown&&Number(previous.amount)!==shown.amount){
        if(session.status==="open")await getStripe().checkout.sessions.expire(session.id)
        await admin.from("payments").update({status:"failed"}).eq("id",previous.id).eq("status","pending")
        return {error:"Your earlier unpaid checkout had a different total and has been closed. Confirm the current reviewed price again.",restartCheckout:true}
      }
      if(!shown)return {error:"Quote expired. Return to Review for a fresh ten-minute quote."}
      if (session.url && session.status === "open") return { url: session.url };
      return {
        error:
          "This checkout expired. Go back to review a fresh quote and retry.",
      };
    }
    if (!await leaseOrderPhotos(user.id,photos)) return {error:'An item photo is no longer available. Please upload it again before paying.'};
    let draft: Record<string, unknown>;
    let amount: number;
    let itemsHold = 0;
    if (input.type === "delivery") {
      const p = input.order;
      const contact = parcelContact(p.recipient_name,p.recipient_phone,p.collection_at ?? "asap");
      if ("error" in contact) return {error:contact.error!};
      if (!p.pickup_address?.trim() || !p.delivery_address?.trim())
        return { error: "Select both addresses." };
      if (!isPreciseDeliveryAddress(p.delivery_address)) return {error:PRECISE_DELIVERY_ADDRESS_ERROR};
      const scope = {
        pickupLat: p.pickup_lat,
        pickupLng: p.pickup_lng,
        deliveryLat: p.delivery_lat,
        deliveryLng: p.delivery_lng,
        packageSize: p.package_size,
        promoCode: p.promo_code,
      };
      const approved=readQuoteConsent<DeliveryQuote>(p.consent_token,user.id,deliveryScope(scope))
      if(approved?.snapshot){const unavailable=await bookingAvailability(user.id,"delivery",{lat:p.pickup_lat,lng:p.pickup_lng},{lat:p.delivery_lat,lng:p.delivery_lng});if(unavailable)return {error:unavailable}}
      const quote=approved?.snapshot?{data:approved.snapshot}:await getDeliveryQuote(scope);
      if ("error" in quote) return quote;
      if (
        !checkQuoteConsent(
          p.consent_token,
          user.id,
          deliveryScope(scope),
          quote.data.finalPrice,
        )
      )
        return {
          error: "Quote changed or expired. Go back and review the new price.",
        };
      amount = quote.data.finalPrice;
      draft = {
        ...p,
        ...contact,
        service_type: "delivery",
        price: amount,
        base_price: quote.data.basePrice,
        surge_multiplier: quote.data.surgeMultiplier,
        discount_amount: quote.data.discountAmount,
        promo_code_id: quote.data.promoCodeId,
        promo_code: quote.data.promoCodeText,
        discount_campaign: quote.data.discountCampaign,
        distance_miles: quote.data.distanceMiles,
        duration_min: quote.data.durationMin,
      };
    } else if (input.type === "buy_for_me") {
      const p = input.order;
      const contact = optionalRecipientPhone(p.recipient_phone);
      if (contact.error) return { error: contact.error };
      const limits = await getBookingPricing();
      if (p.limits_acknowledged !== true)
        return {
          error: `Confirm the shopping limits: ${limits.maxShoppingWeightKg} kg total and ${limits.maxShoppingDimensionCm} cm maximum package dimension.`,
        };
      const invalid = validateShoppingItems(p.shopping_items, limits);
      if (invalid) return { error: invalid };
      if (
        !p.shop_name?.trim() ||
        !p.shop_address?.trim() ||
        !p.delivery_address?.trim()
      )
        return { error: "Enter the shop and delivery addresses." };
      const estimate = shoppingQuoteInputs(p.shopping_items);
      const estimated = estimate.estimated_items_total;
      const packageSize = p.package_size ?? "small";
      const bfm = await getBfmSettings();
      if (!bfm.enabled || estimated > bfm.max_purchase_amount)
        return {
          error: "Shopping is unavailable or the shopping limit was exceeded.",
        };
      const approved=readQuoteConsent<ShoppingQuote>(p.consent_token,user.id,shoppingScope({...p,...estimate,package_size:packageSize}))
      if(approved?.snapshot){const unavailable=await bookingAvailability(user.id,"buy_for_me",{lat:p.shop_lat,lng:p.shop_lng},{lat:p.delivery_lat,lng:p.delivery_lng});if(unavailable)return {error:unavailable}}
      const quote=approved?.snapshot?{data:approved.snapshot}:await getShoppingQuote({
        shop_lat: p.shop_lat,
        shop_lng: p.shop_lng,
        delivery_lat: p.delivery_lat,
        delivery_lng: p.delivery_lng,
        ...estimate,
        package_size: packageSize,
        promo_code: p.promo_code,
      });
      if ("error" in quote) return quote;
      if (
        !checkQuoteConsent(
          p.consent_token,
          user.id,
          shoppingScope({...p,...estimate,package_size:packageSize}),
          quote.data.totalCharge,
        )
      )
        return {
          error: "Quote changed or expired. Go back and review the new price.",
        };
      amount = quote.data.totalCharge;
      itemsHold = quote.data.itemsHold;
      draft = {
        ...p,
        recipient_phone: contact.recipient_phone,
        shopping_limits: {
          weightKg: limits.maxShoppingWeightKg,
          dimensionCm: limits.maxShoppingDimensionCm,
          products: limits.maxShoppingProducts,
          quantity: limits.maxQuantityPerProduct,
        },
        service_type: "buy_for_me",
        pickup_address: p.shop_address,
        pickup_lat: p.shop_lat,
        pickup_lng: p.shop_lng,
        package_size: packageSize,
        price: quote.data.totalFee,
        base_price: quote.data.basePrice ?? quote.data.deliveryFee,
        surge_multiplier: quote.data.surgeMultiplier ?? 1,
        discount_amount: quote.data.discountAmount,
        promo_code_id: quote.data.promoCodeId,
        promo_code: quote.data.promoCodeText,
        discount_campaign: quote.data.discountCampaign,
        service_fee: quote.data.serviceFee,
        max_spend_approved: itemsHold,
        estimated_items_total: estimated,
        distance_miles: quote.data.distanceMiles,
        duration_min: quote.data.durationMin,
      };
    } else return { error: "Invalid service" };
    if (!Number.isFinite(amount) || amount < 0.5)
      return { error: "Invalid checkout amount." };
    draft.checkout_ui_version = 1;
    draft.fingerprint = fingerprint;
    draft.tracking_number = `GD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    // Ignore duplicate request inserts; both concurrent attempts use the same persisted draft and Stripe key.
    const { error: insertError } = await admin.rpc("reserve_order_checkout", {
      p_customer: user.id,
      p_key: input.requestKey,
      p_amount: amount,
      p_draft: draft,
      p_funds_available: null,
    });
    if (insertError) {
      if (insertError.message?.includes("discount_"))
        return {
          error:
            "This discount has already been reserved or is no longer available. Resume the existing checkout or review a fresh quote.",
        };
      throw insertError;
    }
    const { data: payment, error: paymentError } = await admin
      .from("payments")
      .select("*")
      .eq("customer_id", user.id)
      .eq("request_key", input.requestKey)
      .single();
    if (paymentError) throw paymentError;
    if (
      payment.booking_draft?.fingerprint !== fingerprint ||
      Number(payment.amount) !== amount
    )
      return {
        error:
          "Booking details or price changed. Go back and review a fresh quote.",
      };
    const saved = payment.booking_draft;
    const origin = await getAppOrigin();
    const lineItems = [
      {
        price_data: {
          currency: "gbp",
          unit_amount: Math.round(Number(saved.price) * 100),
          product_data: {
            name:
              input.type === "buy_for_me"
                ? "Shopping service and delivery"
                : "Collect & Deliver",
          },
        },
        quantity: 1,
      },
    ];
    if (Number(saved.max_spend_approved) > 0)
      lineItems.push({
        price_data: {
          currency: "gbp",
          unit_amount: Math.round(Number(saved.max_spend_approved) * 100),
          product_data: {
            name: "Shopping purchase funds — unused amount refunded",
          },
        },
        quantity: 1,
      });
    const expiry =
      Math.floor(new Date(payment.created_at).getTime() / 1000) + 86400;
    if (expiry < Date.now() / 1000 + 1800)
      return {
        error:
          "This booking reference expired. Go back and review a fresh quote.",
      };
    const session = await getStripe().checkout.sessions.create(
      {
        expires_at: expiry,
        mode: "payment",
        ...(saved.checkout_ui_version === 1 ? {locale:"en-GB" as const} : {}),
        adaptive_pricing: { enabled: false },
        payment_method_types: ["card"],
        customer_email: user.email,
        line_items: lineItems,
        metadata: {
          type: "order_booking",
          payment_id: payment.id,
          user_id: user.id,
        },
        success_url: `${origin}/dashboard/customer/checkout?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/dashboard/customer/checkout?payment_id=${payment.id}&canceled=1`,
      },
      { idempotencyKey: `booking:${payment.id}` },
    );
    if (!session.url) throw new Error("Checkout URL unavailable");
    const { error: saveError } = await admin
      .from("payments")
      .update({ stripe_session_id: session.id })
      .eq("id", payment.id)
      .is("stripe_session_id", null);
    if (saveError) throw saveError;
    return { url: session.url };
  } catch (error) {
    console.error(
      "[Order checkout]",
      error instanceof Error ? error.message : "Failed",
    );
    return {
      error:
        "Could not start checkout. Keep this form open and try again.",
    };
  }
}
export async function getCheckoutOutcome(sessionId: string) {
  if (!/^cs_[a-zA-Z0-9_]{5,250}$/.test(sessionId)) return {error:"Booking not found."}
  const client = await createClient(boundedFetch(4500))
  const {data:identity}=await client.auth.getClaims()
  const user=identity?.claims.sub
  if(!user)return {error:"Sign in to view this booking."}
  try {
    const admin=createAdminClient(boundedFetch(4000))
    const {data:payment}=await admin.from("payments").select("delivery_id,status")
      .eq("stripe_session_id",sessionId).eq("customer_id",user).eq("purpose","booking").maybeSingle()
    if(payment?.status==="paid" && payment.delivery_id){
      const {data:order}=await admin.from("delivery_requests").select("id,tracking_number,service_type").eq("id",payment.delivery_id).eq("customer_id",user).maybeSingle()
      if(order)return {data:order}
    }
    const session=await getStripe().checkout.sessions.retrieve(sessionId,{}, {timeout:6500,maxNetworkRetries:0})
    if(session.metadata?.user_id!==user||session.metadata?.type!=="order_booking")return {error:"Booking not found."}
    if(session.payment_status!=="paid")return {error:"Payment has not been confirmed yet. Please do not pay again."}
    return {data:await fulfillDirectSession(session)}
  } catch {
    return {error:"Payment confirmation is still processing. Please refresh; do not pay again."}
  }
}
export async function cancelCardBooking(deliveryId:string):Promise<{success?:boolean;amount?:number;error?:string}> {
 const db=await createClient();const {data:{user}}=await db.auth.getUser()
 if(!user)return {error:"Sign in again."}
 const {data:order}=await createAdminClient().from("delivery_requests").select("customer_id,driver_id").eq("id",deliveryId).maybeSingle()
 if(!order)return {error:"Order unavailable."}
 const fault=order.customer_id===user.id?"customer":order.driver_id===user.id?"driver":"admin"
 const result=await cancelByPolicy(deliveryId,0,"Cancellation requested",fault)
 return result.data&&!result.data.review?{success:true,amount:Number(result.data.refund)}:{error:result.error??"Cancellation is waiting for admin review."}
}

/** Resume the same immutable checkout; never create a second charge on a return-page retry. */
export async function resumeOrderCheckout(
  paymentId: string,
): Promise<{ url?: string; error?: string }> {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { error: "Sign in to resume your checkout." };
  const { data: payment } = await createAdminClient()
    .from("payments")
    .select("stripe_session_id,delivery_id,status")
    .eq("id", paymentId)
    .eq("customer_id", user.id)
    .eq("payment_method", "stripe")
    .maybeSingle();
  if (!payment) return { error: "Checkout not found." };
  if (payment.status === "paid" && payment.delivery_id)
    return { url: `/dashboard/customer/tracking?id=${payment.delivery_id}` };
  if (!payment.stripe_session_id)
    return { error: "Checkout is still being prepared. Please retry." };
  try {
    const session = await getStripe().checkout.sessions.retrieve(
      payment.stripe_session_id,
    );
    if (session.status === "complete")
      return { url: `/dashboard/customer/checkout?session_id=${session.id}` };
    if (session.status === "open" && session.url) return { url: session.url };
    return {
      error: "Checkout expired. Return to your booking form for a fresh quote.",
    };
  } catch {
    return {
      error:
        "Checkout could not be loaded. Retry without creating a new booking.",
    };
  }
}
export async function retryOrderRefunds(
  deliveryId: string,
): Promise<{ error?: string; success?: boolean }> {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const admin = createAdminClient();
  const { data: caller } = await admin
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!(await getAdminActor("finance"))) return { error: "Not authorized" };
  try {
    await processOrderRefunds(deliveryId);
    return { success: true };
  } catch {
    return {
      error:
        "Stripe refund reconciliation failed. The request remains recorded; retry or inspect Stripe.",
    };
  }
}
export async function getPendingOrderCheckouts() {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return [];
  const { data } = await createAdminClient()
    .from("payments")
    .select("id,booking_draft").eq("purpose","booking")
    .eq("customer_id", user.id)
    .eq("payment_method", "stripe")
    .eq("status", "pending")
    .gt("created_at", new Date(Date.now() - 86400000).toISOString())
    .not("stripe_session_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(5);
  return (data ?? []).map((row) => ({
    id: row.id,
    label:
      row.booking_draft?.service_type === "buy_for_me"
        ? "Buy for Me"
        : "Collect & Deliver",
  }));
}
export async function adminRefundCardOrder(
  deliveryId: string,
  amount: number,
  reason: string,
  requestKey: string,
): Promise<{ error?: string; success?: boolean }> {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const admin = createAdminClient();
  const { data: caller } = await admin
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!(await getAdminActor("finance"))) return { error: "Not authorized" };
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !reason.trim() ||
    reason.length > 500 ||
    !/^[0-9a-f-]{36}$/i.test(requestKey)
  )
    return { error: "Enter a valid refund amount and reason." };
  const {data:order,error:lookupError}=await admin.from("delivery_requests").select("status").eq("id",deliveryId).maybeSingle();
  if(lookupError || !order || order.status === "cancelled") return { error: "This order is closed or unavailable. Check its existing refunds." };
  const { error } = await admin.rpc("queue_admin_card_refund", {
    p_id: deliveryId,
    p_actor: user.id,
    p_amount: Math.round(amount * 100) / 100,
    p_reason: reason.trim(),
    p_key: requestKey,
  });
  if (error)
    return {
      error:
        "Refund could not be queued. Check the remaining refundable amount.",
    };
  try {
    await processOrderRefunds(deliveryId);
  } catch {
    /* Recorded and retried by reconciliation. */
  }
  return { success: true };
}

export async function adminRefundWaitingPayment(paymentId:string,amount:number,reason:string,key:string){
 const actor=await getAdminActor('finance');if(!actor)return{error:'Finance permission and required MFA are needed.'}
 if(!Number.isFinite(amount)||amount<=0||typeof reason!=='string'||reason.trim().length<3||reason.length>500||!/^[0-9a-f-]{36}$/i.test(key))return{error:'Enter a valid amount and review reason.'}
 const result=await createAdminClient().rpc('queue_waiting_refund',{p_actor:actor.id,p_payment:paymentId,p_amount:Math.round(amount*100)/100,p_reason:reason.trim(),p_key:key});if(result.error)return{error:'Refund could not be queued. Check the remaining amount and payment state.'}
 try{await processOrderRefunds(result.data)}catch{/* The durable queue remains visible and retryable. */}revalidatePath(`/dashboard/admin/orders/${result.data}`);revalidatePath('/dashboard/customer/payments');return{success:true}
}
