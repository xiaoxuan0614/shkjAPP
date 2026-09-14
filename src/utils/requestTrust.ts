/** Only the configured API origin and path may receive session credentials. */
export function isTrustedApiUrl(url: string, baseUrl: string): boolean {
  const parse = (value: string) => {
    const match = /^(https?):\/\/([^/?#]+)([^?#]*)(?:[?#].*)?$/i.exec(value)
    if (!match || /[@\\\s]/.test(match[2])) return null
    let path: string
    try { path = decodeURIComponent(match[3] || '/') } catch { return null }
    if (/[\\\s%]/.test(path) || path.split('/').some(part => part === '.' || part === '..')) return null
    return { origin: `${match[1]}://${match[2]}`.toLowerCase(), path }
  }
  const target = parse(url), base = parse(baseUrl)
  if (!target || !base || target.origin !== base.origin) return false
  const prefix = base.path.replace(/\/+$/, '')
  return target.path === prefix || target.path.startsWith(`${prefix}/`)
}

export function removeSessionHeaders(header: Record<string, any>) {
  for (const key of Object.keys(header)) {
    if (/^(authorization|proxy-authorization|cookie|x-access-token|x-tenant-id|x-sign|v-sign|x-timestamp)$/i.test(key)) delete header[key]
  }
}
