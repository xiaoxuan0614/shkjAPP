const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const vm = require('node:vm')
const context = { exports: {}, URL, console }
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/utils/videoPlayback.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, context)
const { videoFilePath, videoPlaylistUrl, startVideoPlayback } = context.exports
const base = 'https://api.example.test/shouhuiApi'
const origin = 'https://app.example.test'
const tick = () => new Promise(resolve => setImmediate(resolve))
class Video extends EventTarget {
  currentTime = 0; paused = true; volume = 1; muted = false; duration = 60
  sources = []; plays = 0; native = false
  set src(value) { this.sources.push(value); this._src = value }
  get src() { return this._src || '' }
  canPlayType() { return this.native ? 'maybe' : '' }
  pause() { this.paused = true }
  play() { this.plays++; this.paused = false; return Promise.resolve() }
  load() {}
  removeAttribute() { this._src = '' }
}
class Hls {
  static Events = { ERROR: 'error' }
  static instances = []
  static isSupported() { return true }
  constructor(config) { this.config = config; Hls.instances.push(this) }
  on(_, callback) { this.callback = callback }
  loadSource(url) { this.url = url }
  attachMedia(video) { this.video = video }
  destroy() { this.destroyed = true }
  emit(fatal) { this.callback('error', { fatal }) }
}
function session(loadStatus, native = false, loadHls = async () => Hls) {
  const video = new Video(); video.native = native
  const states = []
  const dispose = startVideoPlayback(video, {
    originalUrl: 'https://api.example.test/original.mp4', loadStatus, loadHls,
    playlistUrl: path => videoPlaylistUrl(path, base), onState: state => states.push(state),
  })
  return { video, states, dispose }
}
const ready = async () => ({ status: 'READY', playlistPath: '/sys/common/static/hls/job/index.m3u8' })

test('only known static URLs become relative API paths; encoding and proxy handled', () => {
  assert.equal(videoFilePath('period/现场.mp4', base, origin), 'period/现场.mp4')
  assert.equal(videoFilePath(base + '/sys/common/static/period/%E7%8E%B0%E5%9C%BA.mp4?x=1', base, origin), 'period/现场.mp4')
  assert.equal(videoFilePath('/api/sys/common/static/p/a.mp4', base, origin, '/api'), 'p/a.mp4')
  for (const path of ['https://outside.test/a.mp4', 'https://api.example.test.evil/a.mp4', 'blob:test', '../secret', 'p/%2e%2e/a', 'javascript:alert(1)', '//outside.test/a.mp4']) {
    assert.equal(videoFilePath(path, base, origin), null, path)
  }
  assert.equal(videoPlaylistUrl('/sys/common/static/hls/job/index.m3u8', '/api'), '/api/sys/common/static/hls/job/index.m3u8')
  assert.equal(videoPlaylistUrl('https://outside.test/index.m3u8', base), null)
  assert.equal(videoPlaylistUrl('/sys/common/static/hls/../private/index.m3u8', base), null)
})
test('READY uses native HLS, never simultaneously loads original', async () => {
  const s = session(ready, true, async () => { throw Error('must not import') })
  assert.equal(s.video.sources.length, 0)
  await tick()
  assert.deepEqual(s.video.sources, [base + '/sys/common/static/hls/job/index.m3u8'])
  s.dispose(); assert.equal(s.video.src, '')
})
test('READY uses hls.js with bounded forward/back buffers', async () => {
  const s = session(ready); await tick()
  const h = Hls.instances.at(-1)
  assert.equal(h.video, s.video); assert.equal(h.config.maxBufferLength, 10)
  assert.equal(h.config.maxMaxBufferLength, 20); assert.equal(h.config.backBufferLength, 10)
  assert.equal(s.video.sources.length, 0)
  s.dispose(); assert.equal(h.destroyed, true)
})
for (const status of ['QUEUED', 'PROCESSING', 'NOT_REQUESTED', 'FAILED', 'UNKNOWN']) {
  test(status + ' immediately selects original without preparing or polling', async () => {
    let calls = 0
    const s = session(async () => { calls++; return { status } }); await tick()
    assert.equal(calls, 1); assert.equal(s.video.sources.length, 1)
    assert.match(s.video.src, /original.mp4$/); s.dispose()
  })
}
test('network/timeout failures fall back, but 401/403 do not', async () => {
  for (const error of [new Error('timeout'), { statusCode: 503 }]) {
    const s = session(async () => { throw error }); await tick()
    assert.match(s.video.src, /original.mp4$/); s.dispose()
  }
  for (const error of [{ code: 401 }, { statusCode: 403 }, { data: { code: 403 } }]) {
    const s = session(async () => { throw error }); await tick()
    assert.equal(s.video.sources.length, 0); assert.equal(s.states.at(-1).denied, true); s.dispose()
  }
})
test('nonfatal errors do not switch; fatal errors fall back once and preserve position/pause/volume', async () => {
  const s = session(ready); await tick(); const h = Hls.instances.at(-1)
  h.emit(false); assert.equal(s.video.sources.length, 0)
  s.video.currentTime = 23; s.video.paused = true; s.video.volume = .4; s.video.muted = true
  h.emit(true); h.emit(true)
  assert.equal(h.destroyed, true); assert.equal(s.video.sources.length, 1)
  s.video.currentTime = 0
  s.video.dispatchEvent(new Event('loadedmetadata'))
  assert.equal(s.video.currentTime, 23); assert.equal(s.video.volume, .4); assert.equal(s.video.muted, true)
  assert.equal(s.video.plays, 0)
  s.video.dispatchEvent(new Event('error')); assert.equal(s.states.at(-1).failed, true)
  assert.equal(s.video.sources.length, 1); s.dispose()
})
test('autoplay rejection during fallback prompts play, not another fallback', async () => {
  const s = session(ready, true); await tick()
  s.video.paused = false
  s.video.play = () => Promise.reject({ name: 'NotAllowedError' })
  s.video.dispatchEvent(new Event('error'))
  s.video.dispatchEvent(new Event('loadedmetadata')); await tick()
  assert.equal(s.video.sources.length, 2); assert.equal(s.states.at(-1).failed, false)
  assert.match(s.states.at(-1).message, /点击播放/); s.dispose()
})
test('no HLS support or failed lazy import falls back once', async () => {
  for (const load of [async () => ({ isSupported: () => false }), async () => { throw Error('chunk unavailable') }]) {
    const s = session(ready, false, load); await tick()
    assert.equal(s.video.sources.length, 1); assert.match(s.video.src, /original.mp4$/); s.dispose()
  }
})
test('closing or switching invalidates late status and library import', async () => {
  let resolve
  const s = session(() => new Promise(r => { resolve = r }))
  s.dispose(); resolve(await ready()); await tick(); assert.equal(s.video.sources.length, 0)
  let resolveImport
  const t = session(ready, false, () => new Promise(r => { resolveImport = r })); await tick()
  const count = Hls.instances.length
  t.dispose(); resolveImport(Hls); await tick(); assert.equal(Hls.instances.length, count)
})
