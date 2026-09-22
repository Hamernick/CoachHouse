"use client"

import { useEffect, useState } from "react"

import type { ExternalResourceMapItem } from "@/lib/public-map/resource-map-items"

import { resolvePublicMapResourceDetailPresentation } from "@/lib/public-map/resource-seasonal-presentation"

const PUBLIC_RESOURCE_DETAIL_ENDPOINT = "/api/public/resource-map/items"
const PUBLIC_RESOURCE_DETAIL_CACHE_MS = 5 * 60 * 1000
const resourceDetailLoadById = new Map<
  string,
  { expiresAt: number; load: Promise<ExternalResourceMapItem | null> }
>()

export function loadPublicMapResourceItemDetail(id: string) {
  const cached = resourceDetailLoadById.get(id)
  if (cached && cached.expiresAt > Date.now()) return cached.load

  const load = fetch(
    `${PUBLIC_RESOURCE_DETAIL_ENDPOINT}/${encodeURIComponent(id)}`,
    {
      cache: "no-store",
      headers: { Accept: "application/json" },
    }
  )
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Resource detail failed: ${response.status}`)
      }
      const payload = (await response.json()) as { resourceItem?: unknown }
      return payload.resourceItem && typeof payload.resourceItem === "object"
        ? (payload.resourceItem as ExternalResourceMapItem)
        : null
    })
    .catch((error) => {
      resourceDetailLoadById.delete(id)
      throw error
    })

  resourceDetailLoadById.set(id, {
    expiresAt: Date.now() + PUBLIC_RESOURCE_DETAIL_CACHE_MS,
    load,
  })
  return load
}

export function usePublicMapResourceItemDetail(
  item: ExternalResourceMapItem | null,
  enabled: boolean
) {
  const [detailItem, setDetailItem] = useState(item)

  useEffect(() => {
    setDetailItem(item)
    if (!item || !enabled) return

    let cancelled = false
    void loadPublicMapResourceItemDetail(item.id)
      .then((loadedItem) => {
        if (!cancelled && loadedItem) {
          setDetailItem(resolvePublicMapResourceDetailPresentation(item, loadedItem))
        }
      })
      .catch((error) => {
        if (cancelled) return
        console.warn("[public-map] resource detail unavailable", {
          message: error instanceof Error ? error.message : String(error),
        })
      })

    return () => {
      cancelled = true
    }
  }, [enabled, item])

  return detailItem && item && detailItem.id === item.id
    ? resolvePublicMapResourceDetailPresentation(item, detailItem)
    : item
}
