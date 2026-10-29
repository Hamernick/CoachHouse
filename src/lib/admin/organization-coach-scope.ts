import type { SupabaseClient } from "@supabase/supabase-js"

import type { PlatformAccessLevel } from "@/features/platform-access"
import type { Database } from "@/lib/supabase"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import type {
  OrganizationCoachActorScope,
  OrganizationCoachScopeStatus,
} from "@/lib/organization-coach-scope"

type AdminClient = SupabaseClient<Database>

function isMissingScopeTable(error: { code?: string | null }) {
  return error.code === "42P01" || error.code === "PGRST205"
}

export async function loadOrganizationCoachScopeStatus({
  supabase = createSupabaseAdminClient(),
}: {
  supabase?: AdminClient
} = {}): Promise<OrganizationCoachScopeStatus> {
  const { data, error } = await supabase
    .from("organization_coach_scope_settings")
    .select("assigned_only_enabled, activated_at")
    .eq("id", true)
    .maybeSingle<{
      assigned_only_enabled: boolean
      activated_at: string | null
    }>()

  if (error && isMissingScopeTable(error)) {
    return {
      available: false,
      assignedOnlyEnabled: false,
      activatedAt: null,
    }
  }
  if (error) throw new Error("Unable to load coach visibility settings.")

  return {
    available: true,
    assignedOnlyEnabled: data?.assigned_only_enabled === true,
    activatedAt: data?.activated_at ?? null,
  }
}

export async function loadOrganizationCoachActorScope({
  accessLevel,
  supabase = createSupabaseAdminClient(),
  userId,
}: {
  accessLevel: PlatformAccessLevel | null
  supabase?: AdminClient
  userId: string
}): Promise<OrganizationCoachActorScope> {
  if (accessLevel !== "coach") return { mode: "all" }

  const status = await loadOrganizationCoachScopeStatus({ supabase })
  if (!status.available || !status.assignedOnlyEnabled) {
    return { mode: "all" }
  }

  const [assignmentResult, staffResult] = await Promise.all([
    supabase
      .from("organization_coach_assignments")
      .select("organization_id")
      .eq("coach_user_id", userId)
      .returns<Array<{ organization_id: string }>>(),
    supabase
      .from("platform_staff_members")
      .select("can_access_unassigned_organizations, can_access_all_organizations")
      .eq("user_id", userId)
      .maybeSingle<{ can_access_unassigned_organizations: boolean; can_access_all_organizations: boolean }>(),
  ])

  if (assignmentResult.error && isMissingScopeTable(assignmentResult.error))
    return { mode: "all" }
  if (assignmentResult.error)
    throw new Error("Unable to load coach organization access.")
  if (staffResult.error && staffResult.error.code !== "42703")
    throw new Error("Unable to load coach visibility permission.")

  if (!staffResult.error && staffResult.data?.can_access_all_organizations === true) {
    return { mode: "all", canAccessAll: true }
  }

  const organizationIds = new Set(
    (assignmentResult.data ?? []).map((row) => row.organization_id)
  )
  if (!staffResult.data?.can_access_unassigned_organizations) {
    return { mode: "assigned", organizationIds }
  }

  const [organizations, allAssignments] = await Promise.all([
    supabase.from("organizations").select("user_id", { count: "exact" }),
    supabase.from("organization_coach_assignments").select("organization_id", { count: "exact" }),
  ])
  if (
    organizations.error ||
    allAssignments.error ||
    organizations.count !== organizations.data?.length ||
    allAssignments.count !== allAssignments.data?.length
  ) {
    throw new Error("Unable to load unassigned organization visibility.")
  }
  const coveredIds = new Set(
    (allAssignments.data ?? []).map((row) => row.organization_id)
  )
  for (const organization of organizations.data ?? []) {
    if (!coveredIds.has(organization.user_id))
      organizationIds.add(organization.user_id)
  }
  return {
    mode: "assigned",
    organizationIds,
    canAccessUnassigned: true,
  }
}
