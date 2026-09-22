import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase"
import { loadPlatformAccessLevel } from "@/lib/admin/platform-access"
import { loadOrganizationCoachActorScope } from "@/lib/admin/organization-coach-scope"
import { canAccessOrganizationInCoachScope } from "@/lib/organization-coach-scope"
import {
  hasPlatformCapability,
  resolveLegacyPlatformAccessLevel,
} from "@/features/platform-access"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { resolveActiveOrganization } from "./active-org"

// Call only after authenticating userId with the session client.
export async function resolveOrganizationDocumentAccess(
  supabase: SupabaseClient<Database>,
  userId: string,
  organizationId?: string | null
) {
  if (!organizationId) {
    return { ...(await resolveActiveOrganization(supabase, userId)), supabase }
  }
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle()
  if (error) return { error: "Unable to verify document access." }
  const accessLevel =
    (await loadPlatformAccessLevel({ supabase, userId })) ??
    resolveLegacyPlatformAccessLevel(profile?.role)
  if (!hasPlatformCapability(accessLevel, "organizations"))
    return { error: "Forbidden" }
  const admin = createSupabaseAdminClient()
  const scope = await loadOrganizationCoachActorScope({
    supabase: admin,
    accessLevel,
    userId,
  })
  if (!canAccessOrganizationInCoachScope(scope, organizationId))
    return { error: "Forbidden" }
  const { data: organization, error: organizationError } = await admin
    .from("organizations")
    .select("user_id")
    .eq("user_id", organizationId)
    .maybeSingle()
  if (organizationError || !organization)
    return { error: "Organization not found." }
  return { supabase: admin, orgId: organizationId, role: "admin" as const }
}
