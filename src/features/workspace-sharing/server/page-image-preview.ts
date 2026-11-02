import "server-only"

import { z } from "zod"
import { loadPageActor, loadSavedPageSources } from "./page-context"
import { resolvePageImageSources } from "./page-asset-sources"
import { imageResponse, imageUnavailable } from "./page-image-response"

const inputSchema = z.strictObject({
  particleId: z.uuid(), canvasId: z.uuid().optional(), digest: z.string().regex(/^[a-f0-9]{64}$/),
})

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
      graph: sources.graph, draft: { title: "", description: "", particleIds: [input.data.particleId] },
    })
    const image = images.get(input.data.particleId)?.representation
    if (!image || image.sha256 !== input.data.digest) return imageUnavailable()
    return imageResponse(image.bytes)
  } catch { return imageUnavailable() }
}
