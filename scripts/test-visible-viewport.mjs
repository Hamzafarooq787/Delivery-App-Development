import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'
let cleanup, savedHeight
const ref = { current: { style: { setProperty: (key, value) => { assert.equal(key, '--customer-viewport-height'); savedHeight = value } } } }
const viewport = new EventTarget()
Object.assign(viewport, { height: 750, scale: 1 })
globalThis.window = new EventTarget()
Object.assign(window, { innerHeight: 926, visualViewport: viewport })
globalThis.requestAnimationFrame = callback => { callback(); return 1 }
globalThis.cancelAnimationFrame = () => {}
const source = ts.transpileModule(readFileSync('hooks/use-visible-viewport.ts','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const module = { exports: {} }
new Function('require','module','exports',source)(name => {
  assert.equal(name,'react')
  return { useRef: () => ref, useLayoutEffect: effect => { cleanup = effect() } }
},module,module.exports)
module.exports.useVisibleViewport()
assert.equal(savedHeight,'750px','Safari toolbar area must be excluded')
viewport.height = 690; viewport.dispatchEvent(new Event('resize'))
assert.equal(savedHeight,'690px','Expanded browser bars must reduce screen height')
window.innerHeight = 430; viewport.height = 390; window.dispatchEvent(new Event('resize'))
assert.equal(savedHeight,'390px','Rotation must update the visible screen')
viewport.height = 250; viewport.scale = 2; viewport.dispatchEvent(new Event('resize'))
assert.equal(savedHeight,'390px','Pinch zoom must not shrink the layout')
cleanup(); viewport.scale = 1; viewport.height = 680; viewport.dispatchEvent(new Event('resize'))
assert.equal(savedHeight,'390px','Unmount must remove viewport listeners')
window.innerHeight = 640; window.visualViewport = undefined
module.exports.useVisibleViewport()
assert.equal(savedHeight,'640px','Older browsers must fall back to innerHeight')
cleanup()
console.log('PASS: Safari visual viewport, toolbar resize, rotation, pinch zoom, older-browser fallback and cleanup.')
