import "server-only"
import { hasWorkspaceSupportAccess } from "./support-access"
import { readOrganizationRequestScope } from "@/server/organization/request-scope"

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
  if (organizationId === userId) {
    return { supabase, orgId: organizationId, role: "owner" as const }
  }
  const supportAccess = await hasWorkspaceSupportAccess(supabase)
  const requestScope = await readOrganizationRequestScope()
  if (requestScope?.supportRequested && !supportAccess) return { error: "Workspace support access was revoked." }
  if (supportAccess) {
    const admin = createSupabaseAdminClient({ actorId: userId })
    const { data, error } = await admin.from("organizations").select("user_id").eq("user_id", organizationId).maybeSingle()
    if (error) return { error: "Unable to verify document access.", code: "unavailable" as const }
    if (!data) return { error: "Organization not found." }
    return { supabase: admin, orgId: organizationId, role: "admin" as const, supportAccess: true, staffAccessLevel: "coach" as const }
  }
  const membership = await supabase.from("organization_memberships")
    .select("role").eq("org_id", organizationId).eq("member_id", userId).maybeSingle()
  if (membership.error) return { error: "Unable to verify document membership.", code: "unavailable" as const }
  if (membership.data) {
    const role = membership.data.role
    if (["owner", "admin", "staff", "board", "member"].includes(role)) {
      return { supabase, orgId: organizationId, role: role as import("./active-org").OrganizationMemberRole }
    }
    return { error: "Forbidden" }
  }
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle()
  if (error) return { error: "Unable to verify document access.", code: "unavailable" as const }
  const accessLevel =
    (await loadPlatformAccessLevel({ supabase, userId })) ??
    resolveLegacyPlatformAccessLevel(profile?.role)
  if (!hasPlatformCapability(accessLevel, "organizations"))
    return { error: "Forbidden" }
  const admin = createSupabaseAdminClient({ actorId: userId })
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
  if (organizationError) return { error: "Unable to verify document access.", code: "unavailable" as const }
  if (!organization) return { error: "Organization not found." }
  return { supabase: admin, orgId: organizationId, role: "admin" as const, staffAccessLevel: accessLevel }
}
