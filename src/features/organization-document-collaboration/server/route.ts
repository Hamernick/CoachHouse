import { syncOrganizationDocument } from "./sync-document"
import { syncDocumentPresence } from "./presence"
import type { DocumentSyncInput } from "../types"

async function documentPost(request: Request, operation: (input: DocumentSyncInput) => Promise<unknown>) {
  const respond = (body: unknown, status = 200) => Response.json(body, {
    status, headers: { "Cache-Control": "no-store" },
  })
  // Preserve the same-origin protection of server actions for this JSON endpoint.
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return respond({ error: "Invalid request origin." }, 403)
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return respond({ error: "Expected a JSON document request." }, 415)
  }
  try {
    const body = await request.text()
    if (body.length > 1_000_000) return respond({ error: "Document request is too large." }, 413)
    const input = JSON.parse(body) as DocumentSyncInput
    if (!input || typeof input !== "object" || Array.isArray(input)
      || typeof input.organizationId !== "string" || typeof input.sectionId !== "string"
      || typeof input.clientId !== "string" || !Number.isInteger(input.version)) {
      return respond({ error: "Invalid document request." }, 400)
    }
    // Reuse the existing authenticated, organization-scoped authorization and CAS writes.
    return respond(await operation(input))
  } catch {
    return respond({ error: "Unable to read the document request." }, 400)
  }
}

export async function handleDocumentCollaborationPost(request: Request) { return documentPost(request, syncOrganizationDocument) }
export async function handleDocumentPresencePost(request: Request) { return documentPost(request, syncDocumentPresence) }
