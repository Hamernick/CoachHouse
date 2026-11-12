import "server-only"
import { z } from "zod"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { isLegacyDocumentPath } from "./legacy-document-bindings"
import { reconcileLegacyDocumentUploadStages } from "./legacy-document-upload-stage"

const receiptSchema = z.array(z.object({ path: z.string(), fileId: z.string().uuid(), kind: z.string() })).max(4)

/** Retry durable failed stages and committed outgoing paths. SQL fences new
 * references and verifies absence before releasing quota. Failures retain work. */
export async function reconcileLegacyDocumentCleanup({
  orgId, documentKind, actorId, support = false, attemptedPaths = new Set<string>(),
}: {
  orgId: string
  documentKind: string | null
  actorId: string
  support?: boolean
  attemptedPaths?: Set<string>
}) {
  if (documentKind === null) await reconcileLegacyDocumentUploadStages({ orgId, actorId, support, attemptedPaths })
  try {
    const admin = createSupabaseAdminClient({ actorId, requestTimeoutMs: 10000 })
    const args = { p_org: orgId, p_actor: actorId, p_support: support }
    const reserved = await admin.rpc("reserve_legacy_document_cleanup", { ...args, p_kind: documentKind })
    if (reserved.error) throw new Error("Cleanup reservation unavailable")
    const receipts = receiptSchema.parse(reserved.data)
    if (new Set(receipts.map(item => item.path)).size !== receipts.length ||
      receipts.some(item => (documentKind !== null && item.kind !== documentKind) || !isLegacyDocumentPath(item.path, orgId, item.kind)))
      throw new Error("Unexpected cleanup scope")
    for (const receipt of receipts) {
      if (attemptedPaths.has(receipt.path)) continue
      attemptedPaths.add(receipt.path)
      // Storage forwards the verified service actor header to its SQL guard,
      // which rechecks current organization, entitlement and folder authority.
      const removed = await admin.storage.from("org-documents").remove([receipt.path])
      if (removed.error) { console.warn("Document cleanup retained; retry required."); continue }
      const finished = await admin.rpc("finish_legacy_document_cleanup", { ...args, p_path: receipt.path })
      if (finished.error || finished.data !== true) console.warn("Document cleanup accounting retained; retry required.")
    }
  } catch {
    console.warn("Document cleanup retained; retry required.")
  }
}
