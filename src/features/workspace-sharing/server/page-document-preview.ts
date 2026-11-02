import "server-only"

import { z } from "zod"
import { loadPageActor, loadSavedPageSources } from "./page-context"
import { resolvePageDocumentSources } from "./page-document-sources"
import { documentResponse, documentUnavailable } from "./page-document-response"

const inputSchema = z.strictObject({
  particleId: z.uuid(), canvasId: z.uuid().optional(), digest: z.string().regex(/^[a-f0-9]{64}$/),
})

/** Session-only preview of the exact representation reviewed by the editor.
 * A changed source returns unavailable, never quietly substitutes newer bytes.
 * Preview creates no storage object or public grant. */
export async function handlePageDocumentPreview(request: Request) {
  const input = inputSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!input.success) return documentUnavailable()
  try {
    const actor = await loadPageActor()
    const sources = await loadSavedPageSources(actor, input.data.canvasId ?? null)
    const documents = await resolvePageDocumentSources(actor, {
      graph: sources.graph, draft: { title: "", description: "", particleIds: [input.data.particleId] },
    })
    const document = documents.get(input.data.particleId)?.representation
    if (!document || document.sha256 !== input.data.digest) return documentUnavailable()
    return documentResponse(document.bytes)
  } catch { return documentUnavailable() }
}
