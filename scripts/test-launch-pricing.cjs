const fs = require('fs'),
  path = require('path'),
  assert = require('node:assert/strict'),
  ts = require('typescript')
function load(file) {
  const m = { exports: {} }
  new Function(
    'require',
    'module',
    'exports',
    ts.transpileModule(
      fs.readFileSync(path.join(__dirname, '..', file), 'utf8'),
      { compilerOptions: { module: ts.ModuleKind.CommonJS } },
    ).outputText,
  )(require, m, m.exports)
  return m.exports
}
const p = load('lib/launch-pricing.ts'),
  s = p.DEFAULT_LAUNCH_SETTINGS
for (const [distance, price] of [
  [0, 4.49],
  [2, 4.49],
  [3, 5.69],
  [4, 6.89],
  [5, 8.09],
  [6, 9.29],
  [8, 11.69],
  [10, 14.09],
  [2.5, 5.09],
  [2.125, 4.64],
])
  assert.equal(p.deliveryFare(distance), price)
assert.equal(p.deliveryFare(3) + s.shoppingFee + 25, 34.68)
assert.equal(p.driverShare(10, false).amount, 8)
assert.equal(p.driverShare(4.49, false).amount, 4)
assert.equal(p.driverShare(8.48, true).amount, 7)
assert.equal(p.driverShare(2, false).subsidy, 2)
assert.equal(p.driverShare(2, false).commission, 0)
const items = [
  { name: 'Milk', quantity: 2, estimated_price: 1.5 },
  { name: 'Bread', quantity: 3, estimated_price: 1 },
]
assert.equal(p.validateShoppingItems(items, s), 6)
assert.throws(() =>
  p.validateShoppingItems(
    Array.from({ length: 6 }, (_, i) => ({
      name: 'Item ' + i,
      quantity: 1,
      estimated_price: 1,
    })),
    s,
  ),
)
assert.throws(() =>
  p.validateShoppingItems(
    [{ name: 'Milk', quantity: 7, estimated_price: 1 }],
    s,
  ),
)
assert.throws(() =>
  p.validateShoppingItems(
    [{ name: 'Milk', quantity: 1, estimated_price: 101 }],
    s,
  ),
)
assert.throws(() =>
  p.validateShoppingItems(
    [{ name: 'Milk', quantity: 1, estimated_price: -2 }],
    s,
  ),
)
assert.throws(() => p.validateShoppingItems([{ name: 'Milk', quantity: 1 }], s))
assert.throws(() =>
  p.validateShoppingItems(
    [...items, { name: ' milk ', quantity: 1, estimated_price: 1 }],
    s,
  ),
)
assert.throws(() => p.deliveryFare(NaN))
assert.throws(() => p.validateLaunchSettings({ ...s, commissionPercent: 101 }))
assert.throws(() => p.validateLaunchSettings({ ...s, maxShoppingValue: 101 }))
assert.equal(p.inServiceArea(53.4808, -2.2426, s), true)
assert.equal(p.inServiceArea(51.5074, -0.1278, s), false)
assert.equal(p.inServiceArea(NaN, 0, s), false)
assert.equal(s.deliveryCheckoutEnabled, false)
assert.equal(s.shoppingCheckoutEnabled, false)
console.log(
  'PASS Manchester examples, proportional miles, fixed shopping fee, product/quantity/value limits, minimum earnings, subsidies, service area and disabled launch gates.',
)
