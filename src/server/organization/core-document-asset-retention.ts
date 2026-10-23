import "server-only"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import type { SupabaseClient } from "@supabase/supabase-js"

// Caller must have already authenticated and authorized the organization write.
// Retain on unexpected lookup failures: cleanup must never destroy recovery data.
export async function canRemoveCoreDocumentImage(orgId: string, imageUrl: string | null | undefined) {
  if (!imageUrl) return true
  const admin = createSupabaseAdminClient() as SupabaseClient
  const { data, error } = await admin.from("organization_core_document_versions")
    .select("id").eq("org_id", orgId).contains("content", { imageUrl }).limit(1)
  if (error) return error.code === "42P01" || error.code === "PGRST205"
  return data?.length === 0
}
