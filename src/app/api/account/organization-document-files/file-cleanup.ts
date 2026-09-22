import type { createSupabaseRouteHandlerClient } from "@/lib/supabase/route"
const BUCKET = "org-documents"
const RETENTION_DAYS = 30

export async function purgeExpiredFiles(
  supabase: ReturnType<typeof createSupabaseRouteHandlerClient>,
  orgId: string
) {
  const cutoff = new Date(
    Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString()
  const { data: expired, error } = await supabase
    .from("organization_document_files")
    .select("id, storage_path")
    .eq("org_id", orgId)
    .is("document_kind", null)
    .lt("deleted_at", cutoff)
    .limit(100)
    .returns<Array<{ id: string; storage_path: string }>>()

  if (error || !expired?.length) return
  const scopedFiles = expired.filter(
    (file) =>
      file.storage_path.startsWith(`${orgId}/library/`) &&
      !file.storage_path.split("/").includes("..")
  )
  if (!scopedFiles.length) return
  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove(scopedFiles.map((file) => file.storage_path))
  if (storageError) return

  await supabase
    .from("organization_document_files")
    .delete()
    .in(
      "id",
      scopedFiles.map((file) => file.id)
    )
}
