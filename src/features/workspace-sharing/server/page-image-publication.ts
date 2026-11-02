import "server-only"

import { randomUUID } from "node:crypto"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import type { PageActor } from "./page-context"
import { publicationHash, WorkspaceSharingError } from "./page-projection"
import type { resolvePageImageSources, PageImageSource } from "./page-asset-sources"
import { PAGE_LOGO_IMAGE_KEY } from "../lib/page-brand"

type Images = Awaited<ReturnType<typeof resolvePageImageSources>>
type ImageGrant = { id: string; source: PageImageSource; path: string; sha256: string; size: number; width: number; height: number }

/** Stable review identity covers exact prepared bytes AND canonical metadata.
 * Random Storage paths are separate and never reused, including failed retries. */
export function identifyPageImages(images: Images, pageId: string, revision: number, canvasId: string | null) {
  const ids = new Map<string, { assetId: string; width: number; height: number }>()
  const previews: Record<string, string> = {}
  for (const [particleId, { source, representation }] of images) {
    const hash = publicationHash({ pageId, revision, source, sha256: representation.sha256 })
    const id = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`
    ids.set(particleId, { assetId: id, width: representation.width, height: representation.height })
    previews[id] = `/api/account/workspace-page-image?${new URLSearchParams({ ...(particleId === PAGE_LOGO_IMAGE_KEY ? { logo: "primary" } : { particleId }), digest: representation.sha256, ...(canvasId ? { canvasId } : {}) })}`
  }
  return { ids, previews }
}

export async function uploadPageImages(actor: PageActor, pageId: string, images: Images, ids: ReadonlyMap<string, { assetId: string }>) {
  const assets: ImageGrant[] = []
  if (!images.size) return assets
  const uploaded = new Set<string>()
  const admin = createSupabaseAdminClient({ actorId: actor.actorId, requestTimeoutMs: 15_000 })
  for (const [particleId, { source, representation }] of images) {
    const id = ids.get(particleId)?.assetId
    if (!id) throw new WorkspaceSharingError("invalid", "Review these images again.")
    if (uploaded.has(id)) continue
    const path = `${actor.orgId}/${pageId}/${randomUUID()}.webp`
    const { error } = await admin.storage.from("workspace-page-assets").upload(path, representation.bytes, {
      contentType: "image/webp", cacheControl: "0", upsert: false,
    })
    // No page command has run yet. Never delete on ambiguous outcomes: the
    // bounded orphan sweep reconciles unreferenced paths after 24 hours.
    if (error) throw new WorkspaceSharingError("unavailable", "An image could not be prepared. Review and try again.")
    uploaded.add(id)
    assets.push({ id, source, path, sha256: representation.sha256, size: representation.bytes.length,
      width: representation.width, height: representation.height })
  }
  return assets
}
