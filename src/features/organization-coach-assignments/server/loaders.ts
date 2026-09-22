import { HIDDEN_TEST_STAFF_IDS } from "@/lib/admin/staff-picker-exclusions"
import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import {
  loadOrganizationCoachActorScope,
  loadOrganizationCoachScopeStatus,
} from "@/lib/admin/organization-coach-scope"
import type {
  OrganizationCoachAssignment,
  OrganizationCoachAssignmentData,
  OrganizationCoachOption,
} from "../types"

export {
  loadOrganizationCoachActorScope,
  loadOrganizationCoachScopeStatus,
} from "@/lib/admin/organization-coach-scope"


type AdminClient = SupabaseClient<Database>
type AssignmentRow =
  Database["public"]["Tables"]["organization_coach_assignments"]["Row"]
type ProfileRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "full_name" | "email" | "avatar_url"
>

function isMissingAssignmentsTable(error: {
  code?: string | null
  message?: string | null
}) {
  return error.code === "42P01" || error.code === "PGRST205"
}

function toCoachOption(profile: ProfileRow): OrganizationCoachOption {
  return {
    id: profile.id,
    name: profile.full_name?.trim() || profile.email?.trim() || "Coach",
    email: profile.email?.trim() || null,
    avatarUrl: profile.avatar_url?.trim() || null,
  }
}

async function loadCoachProfiles(supabase: AdminClient) {
  const { data: staff, error: staffError } = await supabase
    .from("platform_staff_members")
    .select("user_id, access_level")
    .in("access_level", ["coach", "developer"])

  if (staffError) throw new Error("Unable to load coaches.")
  const staffById = new Map((staff ?? []).map((row) => [row.user_id, row.access_level]))
  const coachIds = (staff ?? []).map((row) => row.user_id).filter((id) => !HIDDEN_TEST_STAFF_IDS.has(id))
  if (coachIds.length === 0) return []

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url")
    .in("id", coachIds)
    .returns<ProfileRow[]>()

  if (error) throw new Error("Unable to load coach profiles.")
  return (data ?? [])
    .map((profile) => ({ ...toCoachOption(profile), assignable: staffById.get(profile.id) === "coach" }))
    .sort((left, right) => left.name.localeCompare(right.name))
}

async function loadAssignmentRows(
  supabase: AdminClient,
  organizationIds: string[]
) {
  if (organizationIds.length === 0) {
    return { available: true, rows: [] as AssignmentRow[] }
  }

  const { data, error } = await supabase
    .from("organization_coach_assignments")
    .select(
      "organization_id, coach_user_id, assigned_by, created_at, updated_at"
    )
    .in("organization_id", organizationIds)
    .order("organization_id")
    .order("coach_user_id")
    .returns<AssignmentRow[]>()

  if (error && isMissingAssignmentsTable(error)) {
    return { available: false, rows: [] as AssignmentRow[] }
  }
  if (error) throw new Error("Unable to load organization coach assignments.")
  return { available: true, rows: data ?? [] }
}

function mapAssignments(
  rows: AssignmentRow[],
  coachById: Map<string, OrganizationCoachOption>
) {
  const assignments = new Map<string, OrganizationCoachAssignment[]>()
  for (const row of rows) {
    const coach = coachById.get(row.coach_user_id)
    if (!coach) continue
    const organizationAssignments = assignments.get(row.organization_id) ?? []
    organizationAssignments.push({
      organizationId: row.organization_id,
      coach,
      assignedBy: row.assigned_by,
      updatedAt: row.updated_at,
    })
    assignments.set(row.organization_id, organizationAssignments)
  }
  for (const organizationAssignments of assignments.values()) {
    organizationAssignments.sort((left, right) =>
      left.coach.name.localeCompare(right.coach.name)
    )
  }
  return assignments
}

export async function loadOrganizationCoachAssignmentData({
  organizationIds,
  supabase = createSupabaseAdminClient(),
}: {
  organizationIds: string[]
  supabase?: AdminClient
}): Promise<OrganizationCoachAssignmentData> {
  const [coachOptions, assignmentResult, scopeStatus] = await Promise.all([
    loadCoachProfiles(supabase),
    loadAssignmentRows(supabase, organizationIds),
    loadOrganizationCoachScopeStatus({ supabase }),
  ])
  const coachById = new Map(coachOptions.map((coach) => [coach.id, coach]))

  return {
    available: assignmentResult.available,
    assignmentsByOrganizationId: mapAssignments(
      assignmentResult.rows,
      coachById
    ),
    coachOptions,
    scopeStatus,
  }
}
