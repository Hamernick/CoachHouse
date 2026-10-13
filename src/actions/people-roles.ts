"use server"

import { requireServerSession } from "@/lib/auth"
import { resolveActiveOrganization } from "@/lib/organization/active-org"
import { readPeopleRoles } from "@/lib/people/roles"

export async function listPeopleRolesAction(): Promise<
  { roles: string[] } | { error: string }
> {
  const { supabase, session } = await requireServerSession("/people")
  const { orgId } = await resolveActiveOrganization(supabase, session.user.id)
  const { data, error } = await supabase
    .from("organizations")
    .select("profile")
    .eq("user_id", orgId)
    .maybeSingle<{ profile: Record<string, unknown> | null }>()
  if (error)
    return { error: "Unable to load roles. Close the menu and try again." }
  return { roles: readPeopleRoles(data?.profile ?? {}) }
}
