"use server";
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";
import { getAppOrigin } from "@/lib/get-app-origin";
import { getBookingPricing } from "@/app/actions/booking-settings";
import { getDeliveryQuote } from "@/app/actions/pricing";
import {
  getShoppingQuote,
  getBfmSettings,
  type CreateShoppingRequestParams,
} from "@/app/actions/shopping";
import type { CreateDeliveryParams } from "@/app/actions/delivery";
import { validateShoppingItems } from "@/lib/shopping-validation";
import { ownsOrderPhoto } from "@/lib/order-media";
import { checkQuoteConsent, deliveryScope } from "@/lib/quote-consent";
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
): Promise<{ url: string } | { error: string }> {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user)
    return {
      error: "Sign in to confirm your order. Your form has been retained.",
    };
  if (input.type === 'buy_for_me' && !Array.isArray(input.order.shopping_items)) return { error: 'Enter a valid shopping list.' };
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
    if (previous?.stripe_session_id) {
      const session = await getStripe().checkout.sessions.retrieve(
        previous.stripe_session_id,
      );
      if (session.status === "complete")
        return { url: `/dashboard/customer/checkout?session_id=${session.id}` };
      if (session.url && session.status === "open") return { url: session.url };
      return {
        error:
          "This checkout expired. Go back to review a fresh quote and retry.",
      };
    }
    let draft: Record<string, unknown>;
    let amount: number;
    let itemsHold = 0;
    if (input.type === "delivery") {
      const p = input.order;
      if (!p.pickup_address?.trim() || !p.delivery_address?.trim())
        return { error: "Select both addresses." };
      const scope = {
        pickupLat: p.pickup_lat,
        pickupLng: p.pickup_lng,
        deliveryLat: p.delivery_lat,
        deliveryLng: p.delivery_lng,
        packageSize: p.package_size,
        promoCode: p.promo_code,
      };
      const quote = await getDeliveryQuote(scope);
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
      const estimated = p.shopping_items.reduce(
        (sum, i) => sum + (i.estimated_price ?? 0) * i.quantity,
        0,
      );
      const bfm = await getBfmSettings();
      if (!bfm.enabled || estimated > bfm.max_purchase_amount)
        return {
          error: "Shopping is unavailable or the shopping limit was exceeded.",
        };
      const quote = await getShoppingQuote({
        shop_lat: p.shop_lat,
        shop_lng: p.shop_lng,
        delivery_lat: p.delivery_lat,
        delivery_lng: p.delivery_lng,
        estimated_items_total: estimated,
        promo_code: p.promo_code,
      });
      if ("error" in quote) return quote;
      if (
        !checkQuoteConsent(
          p.consent_token,
          user.id,
          [p.shop_lat, p.shop_lng, p.delivery_lat, p.delivery_lng, estimated],
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
        package_size: "medium",
        price: quote.data.totalFee,
        base_price: quote.data.deliveryFee,
        surge_multiplier: 1,
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
        "Could not start checkout. Your draft is retained; retry with the same booking reference.",
    };
  }
}
export async function getCheckoutOutcome(sessionId: string) {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { error: "Sign in to view this booking." };
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    if (
      session.metadata?.user_id !== user.id ||
      session.metadata?.type !== "order_booking"
    )
      return { error: "Booking not found." };
    if (session.payment_status !== "paid")
      return {
        error:
          "Payment has not been confirmed yet. Refresh after payment completes.",
      };
    return { data: await fulfillDirectSession(session) };
  } catch {
    return {
      error:
        "Payment confirmation is still processing. Please refresh; do not pay again.",
    };
  }
}
export async function cancelCardBooking(
  deliveryId: string,
): Promise<{ success?: boolean; amount?: number; error?: string }> {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const admin = createAdminClient();
  const { data: job } = await admin
    .from("delivery_requests")
    .select("company_card_reference,customer_id,driver_id,status,bfm_stage")
    .eq("id", deliveryId)
    .maybeSingle();
  const { data: caller } = await admin
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (
    !job ||
    (job.customer_id !== user.id &&
      job.driver_id !== user.id &&
      caller?.role !== "admin")
  )
    return { error: "Not authorized" };
  if (
    job.status !== "cancelled" &&
    (!["requested", "accepted"].includes(job.status) ||
      ["shopping", "purchase_completed", "heading_to_customer"].includes(
        job.bfm_stage,
      ))
  )
    return {
      error:
        "Contact support to cancel after collection or shopping has started.",
    };
  if (job.company_card_reference) {
    try {
      await getStripe().issuing.cards.update(job.company_card_reference, {
        status: "inactive",
      });
    } catch {
      return {
        error:
          "Company card could not be disabled. Contact support before cancelling.",
      };
    }
  }
  const { data, error } = await admin.rpc("cancel_card_order", {
    p_id: deliveryId,
    p_actor: user.id,
  });
  if (error)
    return {
      error:
        "This order cannot be cancelled automatically after collection. Contact support.",
    };
  try {
    await processOrderRefunds(deliveryId);
  } catch {
    /* Persistent refund queue is retried by cron/admin. */
  }
  return { success: true, amount: Number(data?.amount ?? 0) };
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
  if (caller?.role !== "admin") return { error: "Not authorized" };
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
    .select("id,booking_draft")
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
  if (caller?.role !== "admin") return { error: "Not authorized" };
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !reason.trim() ||
    reason.length > 500 ||
    !/^[0-9a-f-]{36}$/i.test(requestKey)
  )
    return { error: "Enter a valid refund amount and reason." };
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
