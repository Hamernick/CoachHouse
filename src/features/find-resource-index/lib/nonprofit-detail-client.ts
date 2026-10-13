import type { NonprofitDirectoryItem } from "../nonprofit-types"
import { nonprofitDirectoryMapItem } from "./nonprofit-map-item"

export async function loadNonprofitMapItem(id: string) {
  const ein = id.replace(/^nonprofit:/, "")
  if (!/^\d{9}$/.test(ein)) return null
  const response = await fetch(`/api/public/nonprofits/${ein}`, {
    signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) return null
  const result = (await response.json()) as {
    version: number
    item: NonprofitDirectoryItem
  }
  return result.version === 1 && result.item?.ein === ein
    ? nonprofitDirectoryMapItem(result.item)
    : null
}
