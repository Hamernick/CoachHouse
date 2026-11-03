import type { createSupabaseRouteHandlerClient } from "@/lib/supabase/route"
import { permanentlyPurgeDocument, reconcileAbandonedDocumentStages, type DocumentCleanupActor } from "@/features/document-editing/server"
const RETENTION_DAYS = 30

export async function purgeExpiredFiles(
 supabase: ReturnType<typeof createSupabaseRouteHandlerClient>, orgId: string, actor: DocumentCleanupActor,
) {
 // GET can serve restricted export during closure, including support clients.
 // Never start opportunistic deletion from that read-only window.
 const admit = supabase.rpc.bind(supabase) as unknown as (name: string, input: { p_org: string }) => PromiseLike<{ data: unknown; error: unknown }>
 const admission = await admit("organization_storage_write_admitted", { p_org: orgId })
 if (admission.error || admission.data !== true) return
 await reconcileAbandonedDocumentStages(orgId, actor)
 const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
 const { data: expired, error } = await supabase.from("organization_document_files")
  .select("id, storage_path").eq("org_id", orgId).is("document_kind", null).lt("deleted_at", cutoff).limit(2)
  .returns<Array<{ id: string; storage_path: string }>>()
 if (error || !expired) return
 for (const file of expired) {
  if (file.storage_path.startsWith(`${orgId}/library/`) && !file.storage_path.split("/").includes(".."))
   await permanentlyPurgeDocument(orgId, file.id, actor, true)
 }
}
