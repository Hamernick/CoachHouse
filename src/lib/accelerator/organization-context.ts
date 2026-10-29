import type { ActiveOrganization } from "@/lib/organization/active-org"
import { resolveActiveOrganization } from "@/lib/organization/active-org"
import type { createSupabaseServerClient } from "@/lib/supabase/server"

// Support views use the selected organization's owner learning record. Ordinary
// learners retain their own records; membership alone never grants access to
// another learner's private submissions. The database enforces the same boundary.
export function organizationLearningUserId(actorId: string, organization: ActiveOrganization) {
  return organization.supportAccess ? organization.orgId : actorId
}

export async function resolveOrganizationLearningContext(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  actorId: string,
  expectedOrgId?: string,
) {
  const organization = await resolveActiveOrganization(supabase, actorId)
  if (expectedOrgId && expectedOrgId !== organization.orgId) {
    throw new Error("The organization changed. Reopen this lesson before saving.")
  }
  return { ...organization, learningUserId: organizationLearningUserId(actorId, organization) }
}
