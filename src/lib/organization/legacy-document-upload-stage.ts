import "server-only"
import { z } from "zod"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { isLegacyDocumentPath } from "./legacy-document-bindings"

export type LegacyDocumentUploadStage = {
  orgId: string
  documentKind: string
  actorId: string
  path: string
  support?: boolean
}

const stateSchema = z.enum(["staged", "committed", "abandoned", "cleaned"])
const reservationSchema = z.object({ path: z.string(), state: stateSchema })
const cleanupSchema = z.array(z.object({ path: z.string(), kind: z.string() })).max(4)

/** The durable reservation must exist before any bytes are sent. An uncertain
 * reply never permits upload; the same exact path remains available to recovery. */
export async function uploadLegacyDocumentStage(stage: LegacyDocumentUploadStage, body: Buffer, contentType: string) {
  if (!isLegacyDocumentPath(stage.path, stage.orgId, stage.documentKind)) throw new Error("Invalid document upload scope")
  const admin = createSupabaseAdminClient({ actorId: stage.actorId, requestTimeoutMs: 10000 })
  const reserved = await admin.rpc("reserve_legacy_document_upload", {
    p_org: stage.orgId, p_kind: stage.documentKind, p_path: stage.path, p_size: body.byteLength,
    p_actor: stage.actorId, p_support: stage.support ?? false,
  })
  if (reserved.error) {
    if (reserved.error.message.includes("Organization document storage quota exceeded"))
      throw new Error("Organization document storage quota exceeded")
    throw new Error("Unable to reserve document upload")
  }
  const receipt = reservationSchema.safeParse(reserved.data)
  if (!receipt.success || receipt.data.path !== stage.path || receipt.data.state !== "staged")
    throw new Error("Document upload is no longer available")
  const uploaded = await admin.storage.from("org-documents").upload(stage.path, body, { contentType })
  if (uploaded.error) throw new Error("Unable to upload document")
}

/** SQL resolves commit ambiguity, reference safety and current authority before
 * exposing a deletion claim. Cleanup failures retain durable capacity and work. */
export async function reconcileLegacyDocumentUploadStages({
  orgId, actorId, support = false, path = null, attemptedPaths = new Set<string>(),
}: {
  orgId: string; actorId: string; support?: boolean; path?: string | null; attemptedPaths?: Set<string>
}) {
  try {
    const admin = createSupabaseAdminClient({ actorId, requestTimeoutMs: 10000 })
    const args = { p_org: orgId, p_actor: actorId, p_support: support }
    if (path !== null) {
      const abandoned = await admin.rpc("abandon_legacy_document_upload", { ...args, p_path: path })
      if (abandoned.error) throw new Error("Upload recovery unavailable")
      const state = z.enum(["staged", "committed", "abandoned", "cleaned", "missing"]).parse(abandoned.data)
      if (state === "committed" || state === "cleaned" || state === "missing") return
      if (state !== "abandoned") throw new Error("Upload still active")
    }
    const reserved = await admin.rpc("reserve_legacy_document_stage_cleanup", { ...args, p_path: path })
    if (reserved.error) throw new Error("Upload cleanup unavailable")
    const receipts = cleanupSchema.parse(reserved.data)
    if (new Set(receipts.map(item => item.path)).size !== receipts.length || receipts.some(item =>
      (path !== null && item.path !== path) || !isLegacyDocumentPath(item.path, orgId, item.kind)))
      throw new Error("Unexpected upload cleanup scope")
    for (const receipt of receipts) {
      if (attemptedPaths.has(receipt.path)) continue
      attemptedPaths.add(receipt.path)
      const removed = await admin.storage.from("org-documents").remove([receipt.path])
      if (removed.error) { console.warn("Upload cleanup retained; retry required."); continue }
      const finished = await admin.rpc("finish_legacy_document_stage_cleanup", { ...args, p_path: receipt.path })
      if (finished.error || finished.data !== true) console.warn("Upload cleanup accounting retained; retry required.")
    }
  } catch {
    console.warn("Upload cleanup retained; retry required.")
  }
}
