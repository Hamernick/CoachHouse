import { env } from "@/lib/env"
import { normalizeEin } from "@/lib/organization/ein"
import type { ExternalResourceMapItem } from "@/lib/public-map/resource-map-items"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

// Called only with visible items from the sanitized public projection. Fetch the
// single requested identity field by exact organization ID, retaining its gates.
export async function withPublicResourceEins(items: ExternalResourceMapItem[]) {
  const ids = [...new Set(items.map((item) => item.resourceOrganizationId).filter((id): id is string => Boolean(id)))]
  if (!ids.length || !env.SUPABASE_SERVICE_ROLE_KEY) return items
  const { data, error } = await createSupabaseAdminClient()
    .from("resource_map_organizations")
    .select("id, ein")
    .in("id", ids)
    .eq("visibility", "published")
    .in("review_status", ["approved", "verified"])
    .not("approved_at", "is", null)
    .is("hidden_at", null)
    .is("suppressed_at", null)
    .is("deleted_at", null)
  if (error) {
    console.warn("[resource-map] public EIN lookup unavailable", { code: error.code })
    return items
  }
  const eins = new Map((data ?? []).map((row) => [row.id, normalizeEin(row.ein)]))
  return items.map((item) => ({ ...item, ein: eins.get(item.resourceOrganizationId ?? "") ?? null }))
}
