type PosterResult = string | null
type PosterCallback = (poster: PosterResult) => void
type PosterExtractor = (source: string, signal: AbortSignal) => Promise<PosterResult>

/** One decoder at a time; cache only small JPEGs, never full videos. */
export function createVideoPosterQueue(extract: PosterExtractor) {
  const cache = new Map<string, { poster: PosterResult; expires: number }>()
  const jobs = new Map<string, { listeners: Set<PosterCallback> }>()
  let active: { source: string; controller: AbortController } | null = null
  let paused = 0
  const pump = () => {
    if (paused || active || !jobs.size) return
    const [source, job] = jobs.entries().next().value!
    const controller = new AbortController()
    active = { source, controller }
    void Promise.resolve().then(() => extract(source, controller.signal)).catch(() => null).then(poster => {
      if (controller.signal.aborted || jobs.get(source) !== job) return
      jobs.delete(source)
      cache.delete(source)
      cache.set(source, { poster, expires: Date.now() + (poster ? 30 * 60_000 : 60_000) })
      while (cache.size > 24) cache.delete(cache.keys().next().value!)
      for (const listener of job.listeners) listener(poster)
    }).finally(() => {
      active = null
      pump()
    })
  }
  return {
    request(source: string, callback: PosterCallback) {
      const hit = cache.get(source)
      if (hit && hit.expires > Date.now()) {
        cache.delete(source); cache.set(source, hit)
        callback(hit.poster)
        return () => {}
      }
      let job = jobs.get(source)
      if (!job) { job = { listeners: new Set() }; jobs.set(source, job) }
      job.listeners.add(callback)
      pump()
      return () => {
        job.listeners.delete(callback)
        if (!job.listeners.size && jobs.get(source) === job) {
          jobs.delete(source)
          if (active?.source === source) active.controller.abort()
        }
      }
    },
    pause() {
      paused++
      active?.controller.abort()
      let released = false
      return () => {
        if (released) return
        released = true
        paused--
        pump()
      }
    },
  }
}

function extractVideoPoster(source: string, signal: AbortSignal): Promise<PosterResult> {
  if (signal.aborted) return Promise.resolve(null)
  return new Promise(resolve => {
    const video = document.createElement('video')
    const canvas = document.createElement('canvas')
    let settled = false
    const finish = (poster: PosterResult = null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
      video.onloadedmetadata = video.onloadeddata = video.onseeked = video.onerror = null
      video.pause()
      video.removeAttribute('src')
      video.load()
      canvas.width = canvas.height = 0
      resolve(poster)
    }
    const abort = () => finish()
    const timer = setTimeout(abort, 8000)
    signal.addEventListener('abort', abort, { once: true })
    const capture = () => {
      if (settled || signal.aborted || video.seeking || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return
      try {
        const scale = Math.min(1, 320 / Math.max(video.videoWidth, video.videoHeight))
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
        const context = canvas.getContext('2d')
        if (!context) { finish(); return }
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        finish(canvas.toDataURL('image/jpeg', 0.75))
      } catch { finish() }
    }
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.playsInline = true
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      // A near-zero seek requests a decodable first frame without playing.
      try { video.currentTime = Number.isFinite(video.duration) ? Math.min(0.01, video.duration / 2) : 0.01 }
      catch { finish() }
    }
    video.onloadeddata = capture
    video.onseeked = capture
    video.onerror = abort
    try { video.src = source; video.load() } catch { finish() }
  })
}

export const videoPosterQueue = createVideoPosterQueue(extractVideoPoster)
