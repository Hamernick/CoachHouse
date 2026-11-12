import "server-only"
import { filterDocumentActivityAudience } from "@/lib/organization/document-activity-audience"
import { requirePlatformCapability } from "@/lib/admin/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { loadOrganizationCoachActorScope } from "@/lib/admin/organization-coach-scope"
import { loadMemberWorkspaceTasksPage } from "@/features/member-workspace"
import type { CoachDashboardInput } from "../types"

export async function loadCoachDashboard(
  requestedScope: "assigned" | "all" = "assigned"
): Promise<CoachDashboardInput> {
  const actor = await requirePlatformCapability("organizations")
  const scope =
    actor.accessLevel === "developer" && requestedScope === "all"
      ? "all"
      : "assigned"
  const db = createSupabaseAdminClient()
  const now = new Date()
  const issues: string[] = []
  const [profile, assignments, personalTasks] = await Promise.all([
    db
      .from("profiles")
      .select("full_name,email,avatar_url")
      .eq("id", actor.userId)
      .maybeSingle(),
    db
      .from("organization_coach_assignments")
      .select("organization_id")
      .eq("coach_user_id", actor.userId),
    loadMemberWorkspaceTasksPage().catch(() => null),
  ])
  if (profile.error) issues.push("Profile could not be loaded.")
  if (assignments.error)
    issues.push("Organization assignments could not be loaded.")
  if (!personalTasks) issues.push("Tasks could not be loaded.")
  let ids = (assignments.data ?? []).map((row) => row.organization_id)
  let organizationScopeError = Boolean(assignments.error)
  const actorScope = await loadOrganizationCoachActorScope({
    accessLevel: actor.accessLevel,
    supabase: db,
    userId: actor.userId,
  })
  if (scope === "assigned" && actorScope.mode === "assigned") {
    ids = [...actorScope.organizationIds]
  }
  if (scope === "all") {
    const allOrganizations = await db.from("organizations").select("user_id")
    organizationScopeError = Boolean(allOrganizations.error)
    if (allOrganizations.error)
      issues.push("Organization directory could not be loaded.")
    ids = (allOrganizations.data ?? []).map((row) => row.user_id)
  }
  // Keep the recording fixture hidden; staff demonstration organizations remain visible.
  ids = ids.filter((id) => id !== "886455ec-a664-4f13-83f1-471ddd1f5ffd")
  const coachFilter =
    scope === "all" ||
    (actorScope.mode === "assigned" && actorScope.canAccessUnassigned)
      ? "all"
      : actor.userId
  const since = new Date(now)
  since.setDate(since.getDate() - 372)
  const [orgs, projects, events, personal] = ids.length
    ? await Promise.all([
        db.from("organizations").select("user_id,profile").in("user_id", ids),
        db
          .from("organization_projects")
          .select("id,name,org_id,end_date,status,organization_unassigned", { count: "exact" })
          .in("org_id", ids)
          .eq("project_kind", "standard")
          .neq("created_source", "system")
          .neq("created_source", "starter_seed")
          .not("status", "in", "(completed,cancelled)")
          .order("end_date")
          .limit(5),
        db
          .from("organization_project_activity_events")
          .select("id,title,org_id,project_id,entity_type,occurred_at,project:organization_projects(project_kind)")
          .in("org_id", ids)
          .order("occurred_at", { ascending: false })
          .limit(10),
        db
          .from("organization_project_activity_events")
          .select("id,occurred_at")
          .eq("actor_id", actor.userId)
          .in("org_id", ids)
          .gte("occurred_at", since.toISOString())
          .order("occurred_at", { ascending: false })
          .limit(2000),
      ])
    : [null, null, null, null]
  if (orgs?.error) issues.push("Organizations could not be loaded.")
  if (projects?.error) issues.push("Projects could not be loaded.")
  if (events?.error || personal?.error)
    issues.push("Activity history is unavailable.")
  const visibleActivity = await Promise.allSettled([
    filterDocumentActivityAudience(events?.data ?? [], actor.userId),
    filterDocumentActivityAudience(personal?.data ?? [], actor.userId),
  ])
  if (visibleActivity.some(result => result.status === "rejected")) issues.push("Activity history is unavailable.")
  const visibleEvents = visibleActivity[0].status === "fulfilled" ? visibleActivity[0].value : []
  const visiblePersonal = visibleActivity[1].status === "fulfilled" ? visibleActivity[1].value : []
  const names = new Map(
    (orgs?.data ?? []).map((row) => {
      const profile = row.profile as Record<string, unknown> | null
      return [
        row.user_id,
        typeof profile?.name === "string" && profile.name.trim()
          ? profile.name.trim()
          : "Unnamed organization",
      ]
    })
  )
  const tasks =
    personalTasks?.taskGroups
      .flatMap((group) => group.tasks)
      .filter((task) => task.status !== "done")
      .sort((a, b) => a.endDate.localeCompare(b.endDate)) ?? []
  return {
    scope,
    directoryCoachFilter: coachFilter,
    includesUnassigned: actorScope.mode === "assigned" && Boolean(actorScope.canAccessUnassigned),
    user: {
      id: actor.userId,
      name:
        profile.data?.full_name ||
        profile.data?.email?.split("@")[0] ||
        "Your dashboard",
      email: profile.data?.email ?? "",
      avatarUrl: profile.data?.avatar_url ?? null,
      role: actor.accessLevel === "coach" ? "Coach" : "Platform admin",
    },
    organizations: [...names].map(([id, name]) => ({
      id,
      name,
      href: `/organizations?coach=${coachFilter}&search=${encodeURIComponent(name)}`,
    })),
    projects: (projects?.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      organization: row.organization_unassigned ? "No organization" : names.get(row.org_id) ?? "Organization",
      dueDate: row.end_date,
      status: row.status,
    })),
    organizationCount: organizationScopeError || orgs?.error ? null : names.size,
    projectCount:
      projects?.error || organizationScopeError ? null : (projects?.count ?? 0),
    tasks: tasks.slice(0, 5).map((task) => ({
      id: task.id,
      name: task.title,
      organization: task.organizationName ?? task.projectName,
      dueDate: task.endDate,
      projectId: task.projectId,
    })),
    taskCount: personalTasks ? tasks.length : null,
    activity: visibleEvents.map((row) => ({
      id: row.id,
      title: row.title,
      organization: names.get(row.org_id) ?? "Organization",
      occurredAt: row.occurred_at,
      kind: row.entity_type,
      href: row.project_id
        ? `/${row.project?.project_kind === "organization_admin" ? "organizations" : "projects"}/${row.project_id}`
        : `/organizations?coach=${coachFilter}&search=${encodeURIComponent(names.get(row.org_id) ?? "")}`,
    })),
    personalActivity: visiblePersonal.map((row) => row.occurred_at),
    activityTruncated: (personal?.data?.length ?? 0) === 2000,
    issues,
    loadedAt: now.toISOString(),
  }
}
