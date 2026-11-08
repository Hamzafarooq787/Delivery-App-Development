import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const read = path => fs.readFileSync(path, 'utf8')
const jsx = (type, props) => ({ type, props })
function load(path, imports = {}) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(read(path), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, { exports, require: name => name === 'react/jsx-runtime' ? { jsx, jsxs: jsx } : imports[name] ?? {}, Intl, Date })
  return exports
}
const strings = node => Array.isArray(node) ? node.flatMap(strings) :
  typeof node === 'string' ? [node] : node?.props ? strings(node.props.children) : []

test('Review safety consent stays in the pinned footer and activating Pay without it focuses the checkbox', () => {
  const source = read('components/customer/NewDeliveryModal.tsx')
  const footer = source.match(/<footer [^>]*data-review[^>]*>[\s\S]*?<\/footer>/)?.[0]
  assert.ok(footer)
  assert.match(footer, /ref=\{safetyConfirmation\}[\s\S]*type="checkbox"[\s\S]*Confirm your item is legal and safe[\s\S]*<div className=\{styles.actions\}>/)
  assert.match(footer, /onClick=\{\(\) => confirmed \? void handleSubmit\(\) : showSafetyConfirmation\(\)\}/)
  assert.match(footer, /aria-disabled=\{!confirmed/)
  const focusFunction = source.match(/function showSafetyConfirmation\(\) \{[\s\S]*?\n  \}/)?.[0]
  assert.ok(focusFunction)
  const calls = []
  vm.runInNewContext(focusFunction + '\nshowSafetyConfirmation()', {
    setSafetyHighlighted: value => calls.push(['highlight', value]),
    safetyConfirmation: { current: {
      scrollIntoView: () => calls.push(['scroll']),
      focus: () => calls.push(['focus']),
    } },
  })
  assert.deepEqual(calls, [['highlight', true], ['scroll'], ['focus']])
  assert.match(read('components/customer/DeliverySteps.module.css'), /\.footer\[data-review=true\]\{max-height:none;overflow:visible\}/)
})

test('Parcel cancellation displays the policy quote, with purchase copy reserved for shopping review', () => {
  const parcel = { fee: 2.5, refund: 3.19, review: false, status: 'accepted', canCancel: true }
  const render = (serviceType, data) => {
    let index = 0
    const { OrderActionsPanel } = load('components/admin/order-actions-panel.tsx', {
      react: {
        useState: value => [({ 3: true, 8: { key: 'order:admin:0', data } })[index++] ?? value, () => {}],
        useEffect() {}, useRef: current => ({ current }), useTransition: () => [false, () => {}],
      },
      'next/navigation': { useRouter: () => ({}) },
    })
    return strings(OrderActionsPanel({ orderId: 'order', orderStatus: 'accepted', drivers: [], serviceType, paymentMethod: 'stripe' })).join(' ')
  }
  const parcelCopy = render('delivery', parcel)
  assert.match(parcelCopy, /parcel order.*Customer cancellation fee:.*£2.50.*Estimated customer refund:.*£3.19/)
  assert.doesNotMatch(parcelCopy, /Purchased goods/)
  assert.doesNotMatch(render('delivery', { ...parcel, review: true }), /Purchased goods/)
  assert.match(render('buy_for_me', { ...parcel, review: true }), /Purchased goods require admin review/)
  assert.doesNotMatch(render('buy_for_me', parcel), /Purchased goods/)
  const { matchesCancellationPreview } = load('lib/cancellation-policy.ts')
  assert.equal(matchesCancellationPreview(parcel, { ...parcel }), true)
  for (const change of [{ fee: 0 }, { refund: 4 }, { status: 'collected' }, { review: true }, { canCancel: false }]) {
    assert.equal(matchesCancellationPreview({ ...parcel, ...change }, parcel), false)
  }
})

test('Insurance with no expiry or an expired/rejected policy never completes verification or clears a motor vehicle', () => {
  const { driverVerificationProgress, driverDispatchReadiness } = load('lib/driver-compliance.ts')
  const vehicles = [{ vehicle_type: 'bicycle' }, { vehicle_type: 'motorcycle' }]
  const docs = ['identity', 'selfie', 'vehicle_registration'].map(document_type => ({ document_type }))
  const today = '2026-11-08'
  for (const insurance of [{}, { expires_on: '2026-11-07' }, { expires_on: today, review_status: 'rejected' }]) {
    const documents = [...docs, { document_type: 'insurance', ...insurance }]
    const progress = driverVerificationProgress(vehicles, documents, today)
    assert.equal(progress.percent, 80)
    assert.equal(progress.ready, false)
    assert.equal(progress.complete.includes('insurance'), false)
    const dispatch = driverDispatchReadiness(vehicles, documents, today)
    assert.deepEqual(Array.from(dispatch.eligible, v => v.vehicle_type), ['bicycle'])
  }
  const documents = [...docs, { document_type: 'insurance', expires_on: today }]
  assert.equal(driverVerificationProgress(vehicles, documents, today).percent, 100)
  assert.equal(driverDispatchReadiness(vehicles, documents, today).eligible.length, 2)
})

test('Vehicle saves omit bicycle motor details and require ownership of the exact updated row', async () => {
  const owner = 'driver'
  const calls = []
  let saved = { id: 'motorcycle-row', vehicle_type: 'motorcycle', make: 'Honda', model: 'CD70' }
  const query = {
    insert(row) { calls.push(['insert', { ...row }]); return query },
    update(row) { calls.push(['update', { ...row }]); return query },
    select() { return query },
    eq(...args) { calls.push(args); return query },
    single: async () => ({ data: { id: 'new-bike', vehicle_type: 'bicycle' }, error: null }),
    maybeSingle: async () => ({ data: saved, error: null }),
  }
  const { addVehicle, updateVehicle } = load('app/actions/vehicles.ts', {
    '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: owner } } }) } }) },
    '@/lib/supabase/admin': { createAdminClient: () => ({ from: table => { assert.equal(table, 'driver_vehicles'); return query } }) },
    '@/lib/vehicles': load('lib/vehicles.ts'), 'next/cache': { revalidatePath() {} },
  })
  const motor = { vehicle_type: 'motorcycle', colour: 'Red', make: 'Honda', model: 'CD70', registration_number: 'REG', driving_licence_details: 'licence', insurance_details: 'insurance' }
  assert.equal((await addVehicle({ ...motor, vehicle_type: 'bicycle' })).vehicle.id, 'new-bike')
  assert.deepEqual(calls.shift(), ['insert', { driver_id: owner, vehicle_type: 'bicycle', colour: 'Red' }])
  assert.match((await addVehicle({ ...motor, make: '' })).error, /Make and model/)
  assert.equal((await updateVehicle('motorcycle-row', motor)).vehicle, saved)
  assert.equal(calls[0][1].model, 'CD70')
  assert.deepEqual(calls.slice(1), [['id', 'motorcycle-row'], ['driver_id', owner]])
  saved = null
  assert.match((await updateVehicle('unowned-row', motor)).error, /could not be found/)
})
