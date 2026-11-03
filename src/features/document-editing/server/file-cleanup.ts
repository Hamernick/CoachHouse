import "server-only"
import { z } from "zod"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export type DocumentCleanupActor = { actorId: string; support: boolean }
type CleanupFailure = { ok: false; status: number; error: string }
const reservationSchema = z.strictObject({ fileId: z.uuid(), paths: z.array(z.string()).min(1).max(151), complete: z.boolean() })
const stageSchema = z.strictObject({ fileId: z.uuid(), requestId: z.uuid(), actorId: z.uuid(), paths: z.array(z.string()).length(2) })
function failure(error: unknown): CleanupFailure {
 const code = (error as { code?: string })?.code
 return { ok: false, status: code === "42501" ? 403 : code === "PT409" ? 409 : 503,
  error: code === "42501" ? "Document cleanup access changed." : code === "PT409" ? "Document cleanup is not complete. Keep the file in Recently Deleted and retry." : "Unable to confirm document cleanup. Retry the same file." }
}
function cleanupClient(actor: DocumentCleanupActor) {
 const admin = createSupabaseAdminClient({ actorId: actor.actorId, requestTimeoutMs: 15_000 })
 const rpc = admin.rpc.bind(admin) as unknown as (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { code?: string } | null }>
 return { admin, rpc }
}
function scopedPaths(orgId: string, paths: string[]) {
 if (paths.some(path => !path.startsWith(`${orgId}/library/`) || path.split("/").includes(".."))) throw new Error("Unexpected cleanup object scope")
 return paths
}

/** SQL freezes authority and exact identities before Storage performs physical
 * deletion. Partial/lost replies retain the same reservation and quota. */
export async function permanentlyPurgeDocument(orgId: string, fileId: string, actor: DocumentCleanupActor, expiredOnly = false): Promise<{ ok: true } | CleanupFailure> {
 try {
  const { admin, rpc } = cleanupClient(actor)
  const args = { p_org: orgId, p_file: fileId, p_actor: actor.actorId, p_support: actor.support }
  const reserved = await rpc("reserve_document_file_purge", { ...args, p_expired_only: expiredOnly })
  if (reserved.error) return failure(reserved.error)
  const receipt = reservationSchema.parse(reserved.data)
  if (receipt.fileId !== fileId) throw new Error("Unexpected purge receipt")
  if (receipt.complete) return { ok: true }
  const removed = await admin.storage.from("org-documents").remove(scopedPaths(orgId, receipt.paths))
  if (removed.error) return failure(removed.error)
  const finished = await rpc("finish_document_file_purge", args)
  if (finished.error || finished.data !== true) return failure(finished.error)
  return { ok: true }
 } catch (error) { return failure(error) }
}

/** Existing library cleanup trigger only. Never guesses that an unknown staged
 * Save failed; only durable abandoned operations are eligible. */
export async function reconcileAbandonedDocumentStages(orgId: string, actor: DocumentCleanupActor) {
 try {
  const { admin, rpc } = cleanupClient(actor)
  const read = await rpc("read_abandoned_document_stages", { p_org: orgId, p_actor: actor.actorId, p_support: actor.support })
  if (read.error) return
  const stages = z.array(stageSchema).max(4).parse(read.data)
  for (const stage of stages) {
   const removed = await admin.storage.from("org-documents").remove(scopedPaths(orgId, stage.paths))
   if (removed.error) continue
   await rpc("finish_abandoned_document_version", { p_file_id: stage.fileId, p_request_id: stage.requestId, p_actor_id: stage.actorId })
  }
 } catch { /* Preserve pending capacity; a later existing cleanup invocation retries. */ }
}
