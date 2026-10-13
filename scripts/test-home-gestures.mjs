import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'

const source = readFileSync(new URL('../components/home/slide-gestures.ts', import.meta.url), 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const module = { exports: {} }
new Function('exports', 'module', code)(module.exports, module)
const { clampSlide, isDoubleTap, swipeDirection, wheelDirection } = module.exports

test('scroll down advances, scroll up goes back, horizontal scroll follows its direction', () => {
  assert.equal(wheelDirection(0, -120), -1)
  assert.equal(wheelDirection(0, 120), 1)
  assert.equal(wheelDirection(120, 0), 1)
  assert.equal(wheelDirection(-120, 0), -1)
  assert.equal(wheelDirection(0, 0), 0)
})

test('horizontal and vertical swipes navigate; small and diagonal movements do not', () => {
  assert.equal(swipeDirection(-100, 10), 1)
  assert.equal(swipeDirection(100, -10), -1)
  assert.equal(swipeDirection(20, 150), -1)
  assert.equal(swipeDirection(10, -150), 1)
  assert.equal(swipeDirection(100, 100), 0)
  assert.equal(swipeDirection(25, 0), 0)
})

test('double tap requires nearby taps within 320 milliseconds', () => {
  assert.equal(isDoubleTap({ time: 100, x: 20, y: 20 }, { time: 350, x: 24, y: 22 }), true)
  assert.equal(isDoubleTap({ time: 100, x: 20, y: 20 }, { time: 600, x: 24, y: 22 }), false)
  assert.equal(isDoubleTap({ time: 100, x: 20, y: 20 }, { time: 350, x: 80, y: 20 }), false)
  assert.equal(isDoubleTap(null, { time: 350, x: 20, y: 20 }), false)
})

test('navigation stops at the first and last slide', () => {
  assert.equal(clampSlide(-1), 0)
  assert.equal(clampSlide(6), 5)
  assert.equal(clampSlide(3), 3)
})
