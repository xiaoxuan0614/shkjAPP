// Only static dictionaries use this in-memory cache; never business/table dictionaries.
export const DICTIONARY_TTL = 10 * 60 * 1000
const entries = new Map<string, { value: unknown; expiresAt: number }>()
const pending = new Map<string, Promise<unknown>>()
let owner = ''
let generation = 0

export const clearDictionaryCache = () => {
  entries.clear()
  pending.clear()
  owner = ''
  generation++
}

export const dictionaryCacheGeneration = () => generation

export const dictionaryOwner = (user: {
  token?: string; userid?: string; username?: string; tenantId?: unknown
}) => JSON.stringify([user.token, user.userid, user.username, user.tenantId])

export const isStaticDictionaryRequest = (url: string, query?: Record<string, any>) =>
  /^\/sys\/dict\/getDictItems\/[a-zA-Z0-9_-]+$/.test(url) &&
  (!query || Object.keys(query).length === 0)

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value))

export async function cachedDictionary<T>(key: string, identity: string, fetcher: () => Promise<T>): Promise<T> {
  if (owner !== identity) {
    clearDictionaryCache()
    owner = identity
  }
  const cached = entries.get(key)
  if (cached && cached.expiresAt > Date.now()) return copy(cached.value as T)
  entries.delete(key)
  let request = pending.get(key) as Promise<T> | undefined
  if (!request) {
    const version = generation
    request = Promise.resolve().then(fetcher).then((value) => {
      const response = value as any
      // A malformed/business-failed response must not poison the cache.
      if (version === generation && response?.success !== false &&
        (Array.isArray(response) || Array.isArray(response?.result))) {
        entries.set(key, { value: copy(value), expiresAt: Date.now() + DICTIONARY_TTL })
      }
      return value
    }).finally(() => {
      if (pending.get(key) === request) pending.delete(key)
    })
    pending.set(key, request)
  }
  return copy(await request)
}
