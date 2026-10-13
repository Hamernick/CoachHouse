import type { PublicMapResourceGuide } from "@/lib/public-map/resource-guide-definitions"
import type { FindResourceCatalogResponse } from "./catalog-query"

export function mergeResourceGuideSummaries(local: PublicMapResourceGuide[], platform: PublicMapResourceGuide[], summaries?: FindResourceCatalogResponse["guides"]) {
  if (!summaries) return local
  const loaded = new Map(local.map((guide) => [guide.id, guide]))
  const merged = new Map(platform.map((guide) => [guide.id, guide]))
  for (const summary of summaries) {
    const itemCount = summary.itemCount + (merged.get(summary.id)?.itemCount ?? 0)
    merged.set(summary.id, { ...summary, itemCount, items: loaded.get(summary.id)?.items ?? [] })
  }
  return [...merged.values()]
}
