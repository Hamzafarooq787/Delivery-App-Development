import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import ts from 'typescript'
function load(file, imports = {}) {
 const source = ts.transpileModule(readFileSync(file,'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
 const module = { exports: {} }
 new Function('require','module','exports',source)(name => imports[name],module,module.exports)
 return module.exports
}
const rules = load('lib/customer-viewport.ts')
let cleanup, savedHeight, writes = 0
const values = new Map(), attributes = new Map()
const root = { style: { setProperty: (key,value) => values.set(key,value), getPropertyValue: key => values.get(key) || '', removeProperty: key => values.delete(key) }, setAttribute: (key,value) => attributes.set(key,value), removeAttribute: key => attributes.delete(key) }
const viewport = new EventTarget(); Object.assign(viewport,{height:750,scale:1})
globalThis.window = new EventTarget(); Object.assign(window,{innerHeight:926,visualViewport:viewport})
globalThis.document = { documentElement: root }
vm.runInNewContext(rules.CUSTOMER_VIEWPORT_BOOTSTRAP,{window,document,location:{pathname:'/dashboard/customer'}})
assert.equal(values.get('--customer-viewport-height'),'750px','Viewport must be correct before hydration')
assert.equal(attributes.get('data-customer-height'),'h800 h760')
const ref = { current: { style: { setProperty: (key,value) => { assert.equal(key,'--customer-viewport-height'); savedHeight=value; writes++ } } } }
globalThis.requestAnimationFrame = callback => {callback(); return 1}; globalThis.cancelAnimationFrame=()=>{}
const hook=load('hooks/use-visible-viewport.ts',{'react':{useRef:()=>ref,useLayoutEffect:effect=>{cleanup=effect()}},'@/lib/customer-viewport':rules})
hook.useVisibleViewport()
assert.equal(writes,0,'Hydration must not repaint an unchanged viewport')
viewport.height=690; viewport.dispatchEvent(new Event('resize'))
assert.equal(savedHeight,'690px')
viewport.dispatchEvent(new Event('scroll')); viewport.dispatchEvent(new Event('resize'))
assert.equal(writes,1,'Unchanged scroll and resize events must not repaint')
window.innerHeight=430;viewport.height=390;window.dispatchEvent(new Event('resize'))
assert.equal(savedHeight,'390px');assert.equal(attributes.get('data-customer-height'),'h800 h760 h660 h640 h590 h520')
viewport.height=250;viewport.scale=2;viewport.dispatchEvent(new Event('resize'));assert.equal(savedHeight,'390px')
cleanup();viewport.scale=1;viewport.height=680;viewport.dispatchEvent(new Event('resize'));assert.equal(savedHeight,'390px');assert.equal(attributes.has('data-customer-height'),false)
window.innerHeight=640;window.visualViewport=undefined;hook.useVisibleViewport();assert.equal(savedHeight,'640px');cleanup()
vm.runInNewContext(rules.CUSTOMER_VIEWPORT_BOOTSTRAP,{window,document,location:{pathname:'/'}});assert.equal(attributes.size,0,'Other routes must not get customer viewport settings')
const css=readFileSync('components/customer/CustomerHome.module.css','utf8')
assert.equal(css.includes('container-type'),false);assert.match(css,/font-family:system-ui/)
console.log('PASS: pre-hydration viewport, no redundant repaint, Safari bars, rotation, pinch zoom, cleanup, legacy fallback and other-route isolation.')
