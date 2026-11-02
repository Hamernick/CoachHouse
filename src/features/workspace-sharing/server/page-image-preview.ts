import "server-only"

import { z } from "zod"
import { loadPageActor, loadSavedPageSources } from "./page-context"
import { resolvePageImageSources } from "./page-asset-sources"
import { imageResponse, imageUnavailable } from "./page-image-response"
import { PAGE_LOGO_IMAGE_KEY } from "../lib/page-brand"

const inputSchema = z.strictObject({
  particleId: z.uuid().optional(), logo: z.literal("primary").optional(),
  canvasId: z.uuid().optional(), digest: z.string().regex(/^[a-f0-9]{64}$/),
}).refine(input => Boolean(input.particleId) !== Boolean(input.logo))

/** Session-only preview of the exact representation reviewed by the editor.
 * A changed source returns unavailable, never quietly substitutes newer bytes.
 * Preview creates no storage object or public grant. */
export async function handlePageImagePreview(request: Request) {
  const input = inputSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!input.success) return imageUnavailable()
  try {
    const actor = await loadPageActor()
    const sources = await loadSavedPageSources(actor, input.data.canvasId ?? null)
    const images = await resolvePageImageSources(actor, {
      graph: sources.graph, ...(input.data.logo ? { profile: sources.profile } : {}),
      draft: { title: "", description: "", particleIds: input.data.particleId ? [input.data.particleId] : [] },
    })
    const image = images.get(input.data.particleId ?? PAGE_LOGO_IMAGE_KEY)?.representation
    if (!image || image.sha256 !== input.data.digest) return imageUnavailable()
    return imageResponse(image.bytes)
  } catch { return imageUnavailable() }
}
