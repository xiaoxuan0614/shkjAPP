const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict')
const ts = require('typescript'), sfc = require('vue/compiler-sfc')
let conversion = 'complete', accuracy = 20, options, calls = 0
const sdk = { convertFrom(points, type, done) { calls++; assert.equal(type, 'gps'); done(conversion, { info: conversion === 'complete' ? 'ok' : 'error', locations: [{ lng: 118.98, lat: 39.22 }] }) } }
const moduleValue = { exports: {} }
let source = fs.readFileSync('src/utils/implementationLocation.ts', 'utf8').replace(/\/\/ #ifndef H5[\s\S]*?\/\/ #endif/g, '')
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, {
  module: moduleValue, exports: moduleValue.exports, require: () => ({ default: async () => sdk }), setTimeout, clearTimeout,
  navigator: { geolocation: { getCurrentPosition(resolve, reject, config) { options = config; resolve({ timestamp: Date.now(), coords: { latitude: 39.2, longitude: 118.9, accuracy } }) } } },
})
const api = moduleValue.exports
async function run() {
  assert.equal(api.IMPLEMENTATION_RADIUS_METERS, 500)
  let location = await api.getImplementationLocation()
  assert.equal(location.coordinateSystem, 'gcj02'); assert.equal(location.longitude, 118.98)
  assert.equal(options.enableHighAccuracy, true); assert.equal(options.maximumAge, 0)
  assert.equal(api.isFreshLocation({ ...location, status: 'NORMAL' }), true)
  assert.equal(api.isFreshLocation({ ...location, status: 'OUT_OF_RANGE' }), true)
  for (const status of ['FAILED', 'NO_SITE', 'PENDING']) assert.equal(api.isFreshLocation({ ...location, status }), false)
  assert.equal(api.isFreshLocation({ ...location, status: 'NORMAL', acquiredAt: Date.now() - 120001 }), false)
  assert.equal(api.isFreshLocation({ ...location, status: 'NORMAL', coordinateSystem: 'wgs84' }), false)
  assert.equal(api.isFreshLocation({ ...location, status: 'NORMAL', latitude: NaN }), false)
  for (const bad of [undefined, null, 0, -1, NaN, 101, 1000]) {
    accuracy = bad; const before = calls; await assert.rejects(api.getImplementationLocation(), /精度/); assert.equal(calls, before)
  }
  accuracy = 100; await api.getImplementationLocation()
  conversion = 'error'; await assert.rejects(api.getImplementationLocation(), /转换失败/)
  await assert.rejects(api.convertGps({}, 39, 118), /未就绪/)
  await assert.rejects(api.convertGps(sdk, NaN, 118), /无效/)
  const page = fs.readFileSync('src/pages/ops/implementLog.vue', 'utf8')
  assert.match(page, /nearest.distance <= IMPLEMENTATION_RADIUS_METERS/)
  assert.match(page, /const checkOut = async \(\) => \{\s*if \(!validateCurrentLocation\(\)\) return/)
  assert.match(page, /const submitBackfill = async \(\) => \{\s*if \(submitting.value\) return;\s*if \(!validateCurrentLocation\(\)\) return/)
  assert.match(page, /request !== locationRequest/)
  for (const filename of ['src/pages/ops/implementLog.vue', 'src/pages/ops/components/LocationPanel.vue']) {
    const { descriptor, errors } = sfc.parse(fs.readFileSync(filename, 'utf8'))
    assert.deepEqual(errors, []); sfc.compileScript(descriptor, { id: filename })
    assert.deepEqual(sfc.compileTemplate({ source: descriptor.template.content, id: filename, filename }).errors, [])
  }
  console.log('PASS: 高精度/禁缓存、GCJ02显式转换、转换失败拒绝、精度100米门槛、失效位置、签到签退补签退门禁、过期请求与Vue编译')
}
run().catch(error => { console.error(error); process.exitCode = 1 })
