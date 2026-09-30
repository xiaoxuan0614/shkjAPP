export type VideoPlaybackState = { message: string; failed: boolean; denied?: boolean }
export type VideoHlsStatus = { status?: string; playlistPath?: string }

const validRelativePath = (path: string) => Boolean(path) &&
  !/[?#\\\u0000-\u001f]/.test(path) &&
  !path.split('/').some(part => !part || part === '.' || part === '..' || /%2f|%5c|%2e/i.test(part))

/** Only our own static resource URLs may be sent to the authenticated HLS API. */
export function videoFilePath(source: string, apiBase: string, pageOrigin: string, proxyBase = ''): string | null {
  const raw = source.trim()
  if (!raw) return null
  if (/^(blob:|data:|file:|wxfile:)/i.test(raw)) return null
  const bases = [apiBase, proxyBase].filter(Boolean).map(base => new URL(base.replace(/\/$/, '') + '/', pageOrigin))
  if (/^[a-z][\w+.-]*:/i.test(raw) || raw.startsWith('/')) {
    try {
      const url = new URL(raw, pageOrigin)
      const base = bases.find(base => url.origin === base.origin && url.pathname.startsWith(base.pathname + 'sys/common/static/'))
      if (!base || url.username || url.password) return null
      const path = decodeURIComponent(url.pathname.slice((base.pathname + 'sys/common/static/').length))
      return validRelativePath(path) ? path : null
    } catch { return null }
  }
  const path = raw.replace(/^(?:shouhuiApi\/)?sys\/common\/static\//, '')
  return validRelativePath(path) ? path : null
}

export function videoPlaylistUrl(path: unknown, mediaBase: string): string | null {
  if (typeof path !== 'string' || !path.startsWith('/sys/common/static/hls/')) return null
  if (!validRelativePath(path.slice(1)) || !path.endsWith('.m3u8')) return null
  return mediaBase.replace(/\/$/, '') + path
}

export function isVideoAccessDenied(error: any): boolean {
  return [error?.statusCode, error?.code, error?.data?.code, error?.response?.status]
    .some(code => Number(code) === 401 || Number(code) === 403)
}

type PlaybackOptions = {
  originalUrl: string
  loadStatus: () => Promise<VideoHlsStatus | null>
  playlistUrl: (path: unknown) => string | null
  loadHls: () => Promise<typeof import('hls.js').default>
  onState: (state: VideoPlaybackState) => void
}

/** One preview session; disposal also invalidates late status/import results. */
export function startVideoPlayback(video: HTMLVideoElement, options: PlaybackOptions): () => void {
  let disposed = false
  let generation = 0
  let fallbackUsed = false
  let hls: import('hls.js').default | null = null
  let removeEvents = () => {}
  const state = (message: string, failed = false, denied = false) => {
    if (!disposed) options.onState({ message, failed, denied })
  }
  const clearSource = () => {
    generation++
    removeEvents()
    removeEvents = () => {}
    hls?.destroy()
    hls = null
    video.pause()
    video.removeAttribute('src')
    video.load()
  }
  const failed = () => {
    clearSource()
    state('视频无法播放。请检查网络；当前浏览器也可能不支持该视频编码，可打开原视频下载后播放。', true)
  }
  const original = (fallback = false) => {
    if (disposed) return
    if (fallback && fallbackUsed) return
    const snapshot = fallback ? {
      time: video.currentTime, paused: video.paused, volume: video.volume, muted: video.muted,
    } : null
    if (fallback) fallbackUsed = true
    clearSource()
    const current = generation
    const active = () => !disposed && current === generation
    state(fallback ? '分段播放不可用，已切换原视频。' : '点击播放原视频')
    const onError = () => { if (active()) failed() }
    const onMetadata = () => {
      if (!active() || !snapshot) return
      video.volume = snapshot.volume
      video.muted = snapshot.muted
      if (snapshot.time > 0) {
        try {
          if (!Number.isFinite(video.duration) || snapshot.time >= video.duration) throw new Error('unseekable')
          video.currentTime = snapshot.time
        } catch { state('已切换原视频，无法恢复原进度，请从头播放。') }
      }
      if (!snapshot.paused) {
        void video.play().catch(() => {
          if (active()) state('已切换原视频，请点击播放继续。')
        })
      }
    }
    video.addEventListener('error', onError)
    video.addEventListener('loadedmetadata', onMetadata, { once: true })
    removeEvents = () => {
      video.removeEventListener('error', onError)
      video.removeEventListener('loadedmetadata', onMetadata)
    }
    video.src = options.originalUrl
    video.load()
  }
  const attach = async (url: string) => {
    clearSource()
    const current = generation
    const fatal = () => { if (!disposed && current === generation) original(true) }
    state('点击播放视频')
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.addEventListener('error', fatal)
      removeEvents = () => video.removeEventListener('error', fatal)
      video.src = url
      video.load()
      return
    }
    try {
      const Hls = await options.loadHls()
      if (disposed || current !== generation) return
      if (!Hls.isSupported()) { fatal(); return }
      hls = new Hls({ maxBufferLength: 10, maxMaxBufferLength: 20, backBufferLength: 10 })
      hls.on(Hls.Events.ERROR, (_, data) => { if (data.fatal) fatal() })
      hls.loadSource(url)
      hls.attachMedia(video)
    } catch { fatal() }
  }
  state('正在准备视频…')
  void (async () => {
    try {
      const result = await options.loadStatus()
      if (disposed) return
      const url = result?.status === 'READY' ? options.playlistUrl(result.playlistPath) : null
      if (url) await attach(url)
      else original()
    } catch (error) {
      if (disposed) return
      if (isVideoAccessDenied(error)) {
        state('登录已失效或没有视频访问权限，请重新登录或联系管理员。', true, true)
      } else original()
    }
  })()
  return () => {
    disposed = true
    clearSource()
  }
}
