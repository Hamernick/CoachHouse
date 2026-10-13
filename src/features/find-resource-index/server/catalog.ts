import { createHash } from "node:crypto"
import { fetchPublicResourceIndexSnapshot } from "@/lib/queries/resource-map-index-snapshot"
import { serializeFindResourceIndexItem } from "../lib"
import { buildFindResourceCatalog, type FindResourceCatalog } from "../lib/catalog-query"

const CACHE_MS = 300_000
let snapshot: { expires: number; value: FindResourceCatalog } | undefined
let pending: Promise<FindResourceCatalog> | undefined

// One compact server snapshot supplies counts, guide membership and bounded queries.
// DB pages use the shared Next cache; never cache one unbounded Next payload.
export function getFindResourceCatalog() {
  if (snapshot && snapshot.expires > Date.now()) return Promise.resolve(snapshot.value)
  if (pending) return pending
  pending = fetchPublicResourceIndexSnapshot().then((items) => {
    const index = items.map(serializeFindResourceIndexItem)
    const revision = createHash("sha256").update(JSON.stringify(index)).digest("hex").slice(0, 24)
    const value = buildFindResourceCatalog(index, revision)
    snapshot = { expires: Date.now() + CACHE_MS, value }
    return value
  }).finally(() => { pending = undefined })
  return pending
}
