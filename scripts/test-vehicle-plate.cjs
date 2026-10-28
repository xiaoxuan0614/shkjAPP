const fs = require('node:fs')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const ts = require('typescript')
const mod = { exports: {} }
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/utils/vehiclePlate.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { module: mod, exports: mod.exports })
const { isValidVehiclePlate, normalizeVehiclePlate } = mod.exports
for (const plate of ['', '津G227PI', '津G227PO', '津G227P1', '津I227PO', '津O227PI', '津G12IO34', ' 津g227pi ', '津G1234挂']) {
  assert.equal(isValidVehiclePlate(plate), true, plate)
}
for (const plate of ['津G123', '津G1234567', '津1227PI', 'G227PI', '津G22 PI', '津G22@PI']) {
  assert.equal(isValidVehiclePlate(plate), false, plate)
}
assert.equal(normalizeVehiclePlate(' 津g227pi '), '津G227PI')
console.log('PASS: I/O、7/8位、大小写归一、选填及非法格式校验')
