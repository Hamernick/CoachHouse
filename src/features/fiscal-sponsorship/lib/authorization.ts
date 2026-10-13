import type { SupabaseClient } from "@supabase/supabase-js"

import type { PlatformAccessLevel } from "@/features/platform-access"
import type { Database } from "@/lib/supabase"

type FiscalAuthorizationClient = SupabaseClient<Database, "public">

export async function canReadGuestFiscalProject({
  projectId, userId, supabase,
}: {
  projectId: string
  userId: string
  supabase: Pick<FiscalAuthorizationClient, "rpc">
}) {
  const { data, error } = await supabase.rpc("fiscal_guest_project_reviewer_access", {
    p_project_id: projectId, p_user_id: userId,
  })
  // This is an extra restriction, not authorization for ordinary projects.
  return !error && (data === null || data === true)
}

export async function canManageFiscalSponsorshipForOrganization({
  accessLevel,
  organizationId,
  projectId,
  supabase,
  userId,
}: {
  accessLevel: PlatformAccessLevel | null
  organizationId: string
  projectId?: string
  supabase: Pick<FiscalAuthorizationClient, "from" | "rpc">
  userId: string
}) {
  if (accessLevel === "developer") return true
  if (accessLevel !== "coach") return false

  if (projectId) {
    const { data, error } = await supabase.rpc("fiscal_guest_project_reviewer_access", {
      p_project_id: projectId,
      p_user_id: userId,
    })
    // Guest projects use explicit reviewers. Never fall back to the host org's
    // coach when the project denies access or the scope lookup is unavailable.
    if (error) return false
    if (data !== null) return data === true
  }

  const { data, error } = await supabase
    .from("organization_coach_assignments")
    .select("coach_user_id")
    .eq("organization_id", organizationId)
    .eq("coach_user_id", userId)
    .maybeSingle<{ coach_user_id: string }>()

  if (error) {
    console.error(
      "[fiscal-sponsorship] Unable to verify coach assignment.",
      error
    )
    return false
  }

  return Boolean(data)
}
