const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const source = fs.readFileSync('src/pages/ops/components/preview/ReportAttachments.vue', 'utf8');
const choose = source.slice(source.indexOf('function choosePhotos()'), source.indexOf('function chooseVideo()'));
async function run(enabled, failRender = false, failLocation = false) {
  let options, output, busy = false;
  const rendered = [];
  const context = {
    props: { photos: [], videos: [], existingPhotos: 0, photoWatermark: enabled },
    busy: { get value() { return busy; } }, mediaError: { value: '' }, active: true,
    setBusy: value => { busy = value; }, failure: () => {},
    watchPicker: () => {}, stopPickerWatch: () => {},
    uni: { chooseImage: value => { options = value; } },
    emit: (event, value) => { output = value; },
    readPhotoLocation: async () => { if (failLocation) throw new Error('定位失败'); return { locationText: '测试位置', latitude: 1, longitude: 2 }; },
    dayjs: () => ({ format: () => '2026-10-28 10:00:00' }),
    watermarkCanvas: { value: { applyWatermark: async (path, meta) => {
      assert.equal(busy, true);
      assert.equal(meta.locationText, '测试位置');
      if (failRender) throw new Error('生成失败');
      rendered.push(path); return `marked:${path}`;
    } } },
  };
  vm.createContext(context);
  vm.runInContext(ts.transpile(choose, { target: ts.ScriptTarget.ES2020 }), context);
  context.choosePhotos();
  await options.success({ tempFilePaths: ['a.jpg', 'b.jpg'], tempFiles: [{ size: 1 }] });
  assert.equal(busy, false);
  if (failRender || failLocation) { assert.equal(output, undefined); assert.equal(context.mediaError.value, failLocation ? '定位失败' : '生成失败'); }
  else assert.deepEqual(Array.from(output), enabled ? ['marked:a.jpg', 'marked:b.jpg'] : ['a.jpg', 'b.jpg']);
  return { context, options };
}
(async () => {
  await run(true); await run(false); await run(true, true); await run(true, false, true);
  const workflow = fs.readFileSync('src/pages/ops/components/preview/OpsWorkflow.vue', 'utf8');
  assert.match(workflow, /v-model:photos="currentLog.photos"[^\n]+photo-watermark/);
  const { parse, compileScript } = require('vue/compiler-sfc');
  for (const path of ['src/pages/ops/components/preview/ReportAttachments.vue', 'src/pages/ops/components/PhotoWatermarkCanvas.vue']) {
    const parsed = parse(fs.readFileSync(path, 'utf8'));
    assert.equal(parsed.errors.length, 0); compileScript(parsed.descriptor, { id: 'watermark-test' });
  }
  console.log('PASS repair watermark: opt-in, sequential transformed paths, busy lifetime, failure blocks original, Vue compile');
})().catch(error => { console.error(error); process.exitCode = 1; });
