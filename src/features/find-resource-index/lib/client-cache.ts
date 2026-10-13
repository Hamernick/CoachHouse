import type { FindResourceCatalogResponse } from "./catalog-query"

const MAX_ENTRIES = 80
const FRESH_MS = 300_000
type Entry = { value?: FindResourceCatalogResponse; etag?: string; expires: number; pending?: Promise<FindResourceCatalogResponse> }
const cache = new Map<string, Entry>()

export function clearFindResourceQueryCache() { cache.clear() }

export function loadFindResourceQuery(url: string, revalidate = false): Promise<FindResourceCatalogResponse> {
  let entry = cache.get(url)
  if (entry?.pending) return entry.pending
  if (!revalidate && entry?.value && entry.expires > Date.now()) return Promise.resolve(entry.value)
  entry ??= { expires: 0 }
  cache.delete(url)
  cache.set(url, entry)
  while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value!)
  const current = entry
  current.pending = fetch(url, {
    cache: "no-cache",
    headers: { Accept: "application/json", ...(current.etag ? { "If-None-Match": current.etag } : {}) },
  }).then(async (response) => {
    if (response.status === 304 && current.value) {
      current.expires = Date.now() + FRESH_MS
      return current.value
    }
    if (!response.ok) throw new Error(`Resource query failed: ${response.status}`)
    const value = await response.json() as FindResourceCatalogResponse
    if (value.version !== 3 || !Array.isArray(value.resourceItems) || !value.page || typeof value.revision !== "string") throw new Error("Invalid resource query response")
    current.value = value
    current.etag = response.headers.get("etag") ?? undefined
    current.expires = Date.now() + FRESH_MS
    return value
  }).finally(() => { current.pending = undefined })
  return current.pending
}
