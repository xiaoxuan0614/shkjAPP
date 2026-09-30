const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const vm = require('node:vm')
const context = { exports: {}, AbortController, Date, setTimeout, clearTimeout }
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/utils/videoPoster.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, context)
const { createVideoPosterQueue } = context.exports
const tick = () => new Promise(resolve => setImmediate(resolve))
test('serial decoding, duplicate subscriptions and cached small posters', async () => {
  const pending = [], calls = [], results = []
  const q = createVideoPosterQueue((src) => new Promise(resolve => { calls.push(src); pending.push(resolve) }))
  q.request('a', p => results.push(p)); q.request('a', p => results.push(p)); q.request('b', p => results.push(p))
  await tick(); assert.deepEqual(calls, ['a'])
  pending.shift()('jpeg:a'); await tick(); assert.deepEqual(calls, ['a', 'b'])
  assert.deepEqual(results, ['jpeg:a', 'jpeg:a'])
  pending.shift()('jpeg:b'); await tick()
  q.request('a', p => results.push(p)); assert.equal(calls.length, 2); assert.equal(results.at(-1), 'jpeg:a')
})
test('offscreen/unmounted subscriptions cancel extraction and cannot receive late results', async () => {
  let resolve, signal, called = false
  const q = createVideoPosterQueue((_, s) => new Promise(r => { resolve = r; signal = s }))
  const cancel = q.request('a', () => { called = true }); await tick()
  cancel(); assert.equal(signal.aborted, true); resolve('late'); await tick(); assert.equal(called, false)
})
test('playback pauses extraction, aborted jobs resume once after preview closes', async () => {
  let attempts = 0
  const results = []
  const q = createVideoPosterQueue((_, signal) => new Promise(resolve => {
    attempts++
    if (attempts === 1) signal.addEventListener('abort', () => resolve(null))
    else resolve('jpeg:a')
  }))
  q.request('a', p => results.push(p)); await tick()
  const resume = q.pause(); await tick(); assert.equal(attempts, 1); assert.equal(results.length, 0)
  resume(); resume(); await tick(); assert.equal(attempts, 2); assert.deepEqual(results, ['jpeg:a'])
})
test('decode/CORS failure does not loop and next video is still processed', async () => {
  const calls = [], results = []
  const q = createVideoPosterQueue(async src => { calls.push(src); if (src === 'bad') throw Error('decode'); return 'jpeg' })
  q.request('bad', p => results.push(p)); q.request('good', p => results.push(p)); await tick()
  q.request('bad', p => results.push(p)); await tick()
  assert.deepEqual(calls, ['bad', 'good']); assert.deepEqual(results, [null, 'jpeg', null])
})
test('cache is bounded to 24 entries', async () => {
  let calls = 0
  const q = createVideoPosterQueue(async () => { calls++; return 'jpeg' })
  for (let i = 0; i < 25; i++) { q.request(String(i), () => {}); await tick() }
  q.request('24', () => {}); await tick(); assert.equal(calls, 25)
  q.request('0', () => {}); await tick(); assert.equal(calls, 26)
})
