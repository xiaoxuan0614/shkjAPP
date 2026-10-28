const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const sfc = require('vue/compiler-sfc'), ts = require('typescript'), vm = require('node:vm')
const pc = process.argv[2] || '/Users/xuan/AI/ClaudeAllData/shkj-OA'
const mobileFiles = ['src/pages/ops/implementLog.vue', 'src/pages/ops/implementRecordDetail.vue', 'src/pages/ops/vehicle.vue', 'src/pages/ops/components/preview/OpsPreview.vue', 'src/pages/ops/components/preview/OpsPreviewForm.vue', 'src/pages/ops/components/preview/previewData.ts']
const pcFiles = ['src/views/resource/vehicle/Vehicle.data.ts', 'src/views/resource/vehicle/Vehicle.api.ts', 'src/views/implement/components/ImplementLogDetailContent.vue', 'src/views/project/detail/components/DetailImplement.vue'].map(file => path.join(pc, file))
for (const file of [...mobileFiles, ...pcFiles]) {
  const source = fs.readFileSync(file, 'utf8')
  assert.doesNotMatch(source, /mileage|currentMileage|odometer|vehicleKm|公里数|行驶公里|行驶里程|当前里程/, file)
  if (file.endsWith('.vue')) {
    const { descriptor, errors } = sfc.parse(source)
    assert.deepEqual(errors, [], file)
    sfc.compileScript(descriptor, { id: file })
    assert.deepEqual(sfc.compileTemplate({ source: descriptor.template.content, filename: file, id: file }).errors, [], file)
  }
}
const mod = { exports: {} }, posts = []
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(pc, 'src/views/resource/vehicle/Vehicle.api.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
  module: mod, exports: mod.exports, require: () => ({ defHttp: { post: data => posts.push(data) } }),
})
for (const update of [false, true]) mod.exports.saveOrUpdate({ vehicleId: 'test', plateNumber: ' 津G227PI ', principal: '测试', currentMileage: 999 }, update)
for (const post of posts) { assert.equal('currentMileage' in post.params, false); assert.equal(post.params.plateNumber, '津G227PI') }
assert.match(fs.readFileSync('src/pages/ops/implementLog.vue', 'utf8'), /draftPayload.vehicleNo/)
console.log('PASS: 双端字段移除、Vue组件编译、车辆保存参数白名单、保留车辆字段')
