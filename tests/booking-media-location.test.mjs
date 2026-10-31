import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { stripTypeScriptTypes } from 'node:module'

function locationFixture(responses, { secure = true, supported = true } = {}) {
  const calls = []
  const navigator = { userAgent: 'iPhone', ...(supported ? { geolocation: {
    getCurrentPosition(ok, fail, options) {
      calls.push(options)
      const response = responses.shift()
      queueMicrotask(() => response.code ? fail(response) : ok(response))
    },
  } } : {}) }
  const source = stripTypeScriptTypes(fs.readFileSync('lib/browser-location.ts', 'utf8')).replace(/export /g, '')
  return { ...vm.runInNewContext(source + ';({ requestBrowserLocation, locationIssue })', { navigator, window: { isSecureContext: secure }, Error }), calls }
}
test('GPS success preserves actual coordinates and requests a fresh fix', async () => {
  const position = { coords: { latitude: 53.48, longitude: -2.24 } }
  const f = locationFixture([position])
  assert.equal(await f.requestBrowserLocation(), position)
  assert.equal(f.calls.length, 1)
  assert.equal(f.calls[0].maximumAge, 0)
})
test('Automatic permission request and address button share one native request', async () => {
  const position = { coords: { latitude: 53.48, longitude: -2.24 } }
  const f = locationFixture([position, position])
  const automatic = f.requestBrowserLocation()
  const button = f.requestBrowserLocation()
  assert.equal(automatic, button)
  assert.equal(f.calls.length, 1, 'native request starts synchronously and is shared')
  assert.equal(await automatic, position)
  assert.equal(await button, position)
  await f.requestBrowserLocation()
  assert.equal(f.calls.length, 2, 'a later deliberate click requests a fresh position')
})
test('A denied prompt clears the pending request so settings changes can be retried', async () => {
  const position = { coords: { latitude: 53.48, longitude: -2.24 } }
  const f = locationFixture([{ code: 1 }, position])
  await assert.rejects(f.requestBrowserLocation(), e => e.code === 1)
  assert.equal(await f.requestBrowserLocation(), position)
  assert.equal(f.calls.length, 2)
})
test('Denied permission is not retried or mislabeled as GPS failure', async () => {
  const f = locationFixture([{ code: 1 }])
  await assert.rejects(f.requestBrowserLocation(), e => e.code === 1)
  assert.equal(f.calls.length, 1)
  assert.match(f.locationIssue({ code: 1 }).help, /iPhone Settings/)
  assert.match(f.locationIssue({ code: 1 }, 'Android').help, /Site settings/)
})
test('Timeout retries once with network-assisted positioning', async () => {
  const position = { coords: { latitude: 53.48, longitude: -2.24 } }
  const f = locationFixture([{ code: 3 }, position])
  assert.equal(await f.requestBrowserLocation(), position)
  assert.equal(f.calls.length, 2)
  assert.equal(f.calls[1].enableHighAccuracy, false)
  assert.ok(f.calls.every(c => c.timeout > 0))
})
test('Repeated timeout and unavailable GPS retain their real error', async () => {
  for (const code of [2, 3]) {
    const f = locationFixture([{ code }, { code }])
    await assert.rejects(f.requestBrowserLocation(), e => e.code === code)
    assert.equal(f.calls.length, 2)
    assert.doesNotMatch(f.locationIssue({ code }).message, /permission|blocked/)
  }
})
test('Insecure and unsupported browsers fail without requesting GPS', async () => {
  for (const options of [{ secure: false }, { supported: false }]) {
    const f = locationFixture([], options)
    await assert.rejects(f.requestBrowserLocation())
    assert.equal(f.calls.length, 0)
  }
})

function compressionFixture(width, height, fail = false) {
  const source = stripTypeScriptTypes(fs.readFileSync('lib/image-compress.ts', 'utf8')).replace(/export /g, '')
  let revoked = false
  const canvas = { width: 0, height: 0, getContext: () => ({ fillRect() {}, drawImage() {} }), toBlob: cb => cb({ type: 'image/jpeg', size: 1000 }) }
  class Image {
    naturalWidth = width; naturalHeight = height
    set src(_value) { queueMicrotask(() => fail ? this.onerror() : this.onload()) }
  }
  const compressImage = vm.runInNewContext(source + ';compressImage', { Image, document: { createElement: () => canvas }, URL: { createObjectURL: () => 'blob:test', revokeObjectURL: () => { revoked = true } }, Error })
  return { compressImage, canvas, get revoked() { return revoked } }
}
test('Portrait and landscape photos both fit within 1280px with original proportions', async () => {
  for (const [w, h, expectedW, expectedH] of [[3000, 4000, 960, 1280], [4000, 3000, 1280, 960]]) {
    const f = compressionFixture(w, h)
    const blob = await f.compressImage({ type: 'image/jpeg', size: 8000000 }, 1280, .82)
    assert.equal(f.canvas.width, expectedW); assert.equal(f.canvas.height, expectedH)
    assert.equal(blob.type, 'image/jpeg'); assert.ok(blob.size < 8000000); assert.ok(f.revoked)
  }
})
test('Small photos are not enlarged or re-encoded into a larger JPEG', async () => {
  const f = compressionFixture(100, 200)
  const original = { type: 'image/jpeg', size: 500 }
  assert.equal(await f.compressImage(original, 1280, .82), original)
  assert.equal(f.canvas.width, 100); assert.equal(f.canvas.height, 200)
})
test('Damaged or unsupported images fail clearly and release object URLs', async () => {
  const f = compressionFixture(0, 0, true)
  await assert.rejects(f.compressImage({}), /JPG, PNG or WebP/)
  assert.ok(f.revoked)
})
