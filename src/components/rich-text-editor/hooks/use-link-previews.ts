"use client"

import { useEffect, useRef, useState } from "react"
import { createLinkPreviewQueue } from "@/lib/editor/link-preview-queue"

import type { LinkPreviewMeta, LinkPreviewMetaMap } from "../types"

export function useLinkPreviews(
  links: string[],
  { active = true, bounded = false } = {}
): LinkPreviewMetaMap {
  const [linkMeta, setLinkMeta] = useState<LinkPreviewMetaMap>({})
  const queue = useRef<ReturnType<typeof createLinkPreviewQueue> | null>(null)

  useEffect(() => {
    if (!bounded) return
    const current = createLinkPreviewQueue({
      fetchPreview: (url, signal) => fetch(
        `/api/link-preview?url=${encodeURIComponent(url)}`,
        { cache: "no-store", signal }
      ),
      onResult: (url, metadata) => setLinkMeta((previous) => ({ ...previous, [url]: metadata })),
    })
    queue.current = current
    return () => {
      current.dispose()
      if (queue.current === current) queue.current = null
    }
  }, [bounded])

  useEffect(() => {
    if (bounded) queue.current?.update(links, active)
  }, [links, active, bounded])

  useEffect(() => {
    if (bounded || !active) return
    let cancelled = false

    const loadMeta = async () => {
      const missing = links.filter((href) => !linkMeta[href])
      if (missing.length === 0) return

      const updates: Record<string, LinkPreviewMeta> = {}
      await Promise.all(
        missing.map(async (href) => {
          try {
            const res = await fetch(
              `/api/link-preview?url=${encodeURIComponent(href)}`,
              { cache: "no-store" },
            )
            if (!res.ok) throw new Error("preview failed")
            const data = (await res.json()) as LinkPreviewMeta
            updates[href] = data
          } catch {
            updates[href] = {}
          }
        }),
      )

      if (!cancelled && Object.keys(updates).length > 0) {
        setLinkMeta((prev) => ({ ...prev, ...updates }))
      }
    }

    void loadMeta()
    return () => {
      cancelled = true
    }
  }, [links, linkMeta, active, bounded])

  return linkMeta
}
