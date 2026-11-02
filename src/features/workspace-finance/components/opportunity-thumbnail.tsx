"use client"

import { useState, type ReactNode } from "react"
import { useOpportunityFilePreview } from "./use-opportunity-file-preview"

export function OpportunityThumbnail({ fileId, organizationId, fallback = null }: { fileId: string; organizationId?: string; fallback?: ReactNode }) {
  const image = useOpportunityFilePreview(true, organizationId, fileId)
  const [failed, setFailed] = useState(false)
  if (!image.url || failed) return fallback
  // Reuse the authenticated file service; never expose private storage paths.
  // eslint-disable-next-line @next/next/no-img-element
  return <img data-opportunity-thumbnail src={image.url} alt="" draggable={false} loading="lazy" onError={() => setFailed(true)} className="size-9 shrink-0 rounded-md object-cover outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10" />
}
