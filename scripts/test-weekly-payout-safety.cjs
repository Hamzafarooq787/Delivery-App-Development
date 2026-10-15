const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const ts = require('typescript')

let attempted = false,
  transferred = 0,
  failSave = true
const row = { id: 'batch', driver_id: 'driver', amount: 7.74 }
function query(table) {
  let update,
    selecting = false,
    claiming = false
  const q = {
    select() {
      selecting = true
      return q
    },
    eq() {
      return q
    },
    in() {
      return q
    },
    not() {
      return q
    },
    is(field) {
      if (field === 'transfer_attempted_at') claiming = true
      return q
    },
    single() {
      return q
    },
    maybeSingle() {
      return q
    },
    update(value) {
      update = value
      return q
    },
    then(resolve, reject) {
      let result = { data: null, error: null }
      if (table === 'driver_profiles')
        result.data = { stripe_connect_account_id: 'acct_test' }
      else if (table === 'payouts' && update?.transfer_attempted_at) {
        if (!attempted) {
          attempted = true
          result.data = { id: row.id }
        }
      } else if (
        table === 'payouts' &&
        update?.stripe_transfer_id &&
        failSave
      ) {
        result.error = {
          message: 'simulated database outage after Stripe transfer',
        }
      } else if (table === 'payouts' && !update && selecting) {
        result.data = claiming ? (attempted ? [] : [row]) : []
      }
      return Promise.resolve(result).then(resolve, reject)
    },
  }
  return q
}
const admin = { from: query, rpc: async () => ({ error: null }) }
const stripe = {
  accounts: {
    retrieve: async () => ({
      id: 'acct_test',
      capabilities: { transfers: 'active' },
    }),
  },
  transfers: {
    create: async (payload, options) => {
      transferred++
      assert.equal(payload.amount, 774)
      assert.equal(payload.currency, 'gbp')
      assert.equal(options.idempotencyKey, 'weekly-driver-payout-batch')
      return { id: 'tr_test' }
    },
  },
}
const moduleObject = { exports: {} }
const compiled = ts.transpileModule(
  fs.readFileSync(path.join(__dirname, '../lib/weekly-payouts.ts'), 'utf8'),
  {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  },
).outputText
new Function('require', 'module', 'exports', compiled)(
  (name) => {
    if (name === 'server-only') return {}
    if (name === '@/lib/supabase/admin')
      return { createAdminClient: () => admin }
    if (name === '@/lib/stripe/server') return { getStripe: () => stripe }
    throw new Error(`Unexpected dependency ${name}`)
  },
  moduleObject,
  moduleObject.exports,
)

;(async () => {
  const { runWeeklyPayouts } = moduleObject.exports
  const first = await runWeeklyPayouts()
  assert.equal(first.blocked, 1)
  assert.equal(transferred, 1)
  failSave = false
  await runWeeklyPayouts()
  assert.equal(
    transferred,
    1,
    'uncertain transfer must require reconciliation, not an automatic retry',
  )
  attempted = false
  transferred = 0
  await Promise.all([runWeeklyPayouts(), runWeeklyPayouts()])
  assert.equal(transferred, 1, 'only one concurrent run may claim the payout')
  console.log(
    'PASS GBP transfer amount, stable idempotency key, concurrent claim and no automatic retry after uncertain transfer.',
  )
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
