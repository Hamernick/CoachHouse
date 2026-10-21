import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase"
import type { OrganizationBrandIdentity } from "./brand-identity-schema"
import { saveProfileWithBrandIdentity } from "./brand-identity-persistence"

export async function persistOrganizationProfile({ supabase, orgId, expectedUpdatedAt, brandIdentity, expectedBrandRevision, profilePatch }: {
  supabase: SupabaseClient<Database>
  orgId: string
  expectedUpdatedAt?: string
  brandIdentity?: OrganizationBrandIdentity
  expectedBrandRevision?: string | null
  profilePatch: Database["public"]["Tables"]["organizations"]["Insert"]
}): Promise<{ error: string } | { ok: true }> {
  if (brandIdentity) return saveProfileWithBrandIdentity({
    supabase, orgId, expectedUpdatedAt, identity: brandIdentity,
    expectedRevision: expectedBrandRevision ?? null, profilePatch,
  })
  if (expectedUpdatedAt) {
    const { data, error } = await supabase.from("organizations").update(profilePatch)
      .eq("user_id", orgId).eq("updated_at", expectedUpdatedAt).select("user_id")
      .maybeSingle<{ user_id: string }>()
    if (error) return { error: error.message }
    if (!data) return { error: "This organization was updated elsewhere. Reload before saving." }
  } else {
    const { error } = await supabase.from("organizations").insert(profilePatch)
    if (error) return { error: error.message }
  }
  return { ok: true }
}
