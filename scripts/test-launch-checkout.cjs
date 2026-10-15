process.env.GODROP_LAUNCH_VERIFIED = 'true'
const fs = require('fs'),
  path = require('path'),
  assert = require('node:assert/strict'),
  ts = require('typescript')
const base = path.join(__dirname, '..')
let settings,
  user = { id: 'customer', email: 'test@example.test' },
  role = 'customer',
  created,
  sessionPayload,
  confirmed = false,
  notices = 0,
  session = {
    id: 'cs_test',
    currency: 'gbp',
    payment_status: 'paid',
    payment_intent: 'pi_test',
    amount_total: 3468,
    metadata: {
      type: 'booking',
      delivery_id: 'order',
      customer_id: 'customer',
    },
  }
let order = {
  id: 'order',
  customer_id: 'customer',
  status: 'requested',
  pickup_address: 'Manchester',
  package_size: 'medium',
  tracking_number: 'TRK-TEST',
}
function chain(result) {
  const q = {}
  for (const name of ['select', 'eq', 'single', 'update']) q[name] = () => q
  q.then = (ok, bad) => Promise.resolve(result).then(ok, bad)
  return q
}
const admin = {
  from: (t) =>
    chain({
      data:
        t === 'users'
          ? { role }
          : t === 'delivery_requests'
            ? order
            : { id: 'payment' },
      error: null,
    }),
  rpc: async (name, args) => {
    if (name === 'godrop_launch_ready') return { data: true }
    if (name === 'create_launch_booking') {
      created = args
      return { data: 'order' }
    }
    if (name === 'confirm_launch_payment') {
      const previous = confirmed
      confirmed = true
      return { data: !previous }
    }
    return { data: null }
  },
}
const stripe = {
  checkout: {
    sessions: {
      retrieve: async () => session,
      create: async (p) => {
        sessionPayload = p
        return { id: 'cs_test', url: 'https://checkout.stripe.test/session' }
      },
      expire: async () => {},
    },
  },
  refunds: { create: async () => ({ id: 're_test' }) },
}
function load(file) {
  const m = { exports: {} }
  const code = ts.transpileModule(
    fs.readFileSync(path.join(base, file), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText
  new Function('require', 'module', 'exports', code)(
    (n) => {
      if (n === 'server-only') return {}
      if (n === '@/lib/launch-pricing') return pricing
      if (n === '@/lib/launch-settings')
        return { readLaunchSettings: async () => settings }
      if (n === '@/lib/supabase/server')
        return {
          createClient: async () => ({
            auth: { getUser: async () => ({ data: { user } }) },
          }),
        }
      if (n === '@/lib/supabase/admin')
        return { createAdminClient: () => admin }
      if (n === '@/lib/stripe/server')
        return { getStripe: () => stripe, isStripeConfigured: () => true }
      if (n === '@/lib/get-app-origin')
        return { getAppOrigin: async () => 'https://godrop.test' }
      if (n === './pricing')
        return {
          getDeliveryQuote: async () => ({
            data: {
              finalPrice: 5.69,
              basePrice: 5.69,
              surgeMultiplier: 1,
              discountAmount: 0,
              promoCodeText: null,
              distanceMiles: 3,
              durationMin: 12,
            },
          }),
        }
      if (n === '@/app/actions/notifications')
        return {
          notifyDriversOfNewDelivery: async () => {
            notices++
          },
        }
      return require(n)
    },
    m,
    m.exports,
  )
  return m.exports
}
const pricing = load('lib/launch-pricing.ts')
settings = {
  ...pricing.DEFAULT_LAUNCH_SETTINGS,
  deliveryCheckoutEnabled: true,
  shoppingCheckoutEnabled: true,
}
process.env.STRIPE_WEBHOOK_SECRET = 'test'
process.env.GODROP_SHOPPING_FUNDING_READY = 'true'
;(async () => {
  const checkout = load('app/actions/booking-checkout.ts'),
    fulfillment = load('lib/booking-fulfillment.ts')
  const input = {
    service: 'shopping',
    details: {
      shop_name: 'Shop',
      shop_address: 'Manchester',
      shop_lat: 53.48,
      shop_lng: -2.24,
      delivery_address: 'Manchester',
      delivery_lat: 53.49,
      delivery_lng: -2.25,
      shopping_items: [
        {
          name: 'Groceries',
          quantity: 1,
          estimated_price: 25,
          substitution_preference: 'contact_me',
        },
      ],
    },
  }
  let r = await checkout.startBookingCheckout(input)
  assert.ok(r.url)
  assert.equal(created.p_quote.totalCharge, 34.68)
  assert.equal(created.p_quote.shoppingFee, 3.99)
  assert.equal(created.p_quote.shoppingFunds, 25)
  assert.equal(created.p_quote.driverAmount, 7.74)
  assert.equal(
    sessionPayload.line_items.reduce(
      (n, l) => n + l.price_data.unit_amount * l.quantity,
      0,
    ),
    3468,
  )
  assert.equal(sessionPayload.metadata.type, 'booking')
  assert.equal(notices, 0)
  settings.shoppingCheckoutEnabled = false
  assert.ok((await checkout.startBookingCheckout(input)).error)
  settings.shoppingCheckoutEnabled = true
  role = 'driver'
  assert.ok((await checkout.startBookingCheckout(input)).error)
  role = 'customer'
  user = null
  assert.ok((await checkout.startBookingCheckout(input)).error)
  user = { id: 'customer' }
  session.payment_status = 'unpaid'
  await assert.rejects(() => fulfillment.fulfillBooking('cs_test'))
  session.payment_status = 'paid'
  session.currency = 'usd'
  await assert.rejects(() => fulfillment.fulfillBooking('cs_test'))
  session.currency = 'gbp'
  order.customer_id = 'other'
  await assert.rejects(() => fulfillment.fulfillBooking('cs_test'))
  order.customer_id = 'customer'
  await fulfillment.fulfillBooking('cs_test')
  await fulfillment.fulfillBooking('cs_test')
  assert.equal(notices, 1)
  console.log(
    'PASS authoritative checkout totals, service/purchase split, role and launch gates, no unpaid dispatch, currency/owner checks, repeat fulfillment and one notification.',
  )
})().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
