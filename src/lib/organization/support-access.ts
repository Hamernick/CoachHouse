import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase"
import { organizationWorkspaceSupportEnabled } from "@/lib/feature-flags"

export const ORGANIZATION_SCOPE_HEADER = "x-coach-house-organization-id"
export const SUPPORT_ORGANIZATION_COOKIE = "coach_house_support_org"

// A separate live database grant, never an email, profile role or JWT metadata claim.
export async function hasWorkspaceSupportAccess(client: SupabaseClient<Database>) {
  if (!organizationWorkspaceSupportEnabled) return false
  const { data, error } = await client.rpc("has_workspace_support_access" as never)
  if (error) throw new Error("Unable to verify workspace support access.")
  return data === true
}
