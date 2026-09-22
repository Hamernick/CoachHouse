import "server-only"
import { requirePlatformCapability } from "@/lib/admin/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
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
  if (scope === "all") {
    const allOrganizations = await db.from("organizations").select("user_id")
    organizationScopeError = Boolean(allOrganizations.error)
    if (allOrganizations.error)
      issues.push("Organization directory could not be loaded.")
    ids = (allOrganizations.data ?? []).map((row) => row.user_id)
  }
  ids = ids.filter(
    (id) =>
      ![
        "fe0fd7c3-c0fd-4c20-9e80-b14d68da5d0c",
        "886455ec-a664-4f13-83f1-471ddd1f5ffd",
      ].includes(id)
  )
  const coachFilter = scope === "all" ? "all" : actor.userId
  const since = new Date(now)
  since.setDate(since.getDate() - 372)
  const [orgs, projects, events, personal] = ids.length
    ? await Promise.all([
        db.from("organizations").select("user_id,profile").in("user_id", ids),
        db
          .from("organization_projects")
          .select("id,name,org_id,end_date,status", { count: "exact" })
          .in("org_id", ids)
          .eq("project_kind", "standard")
          .neq("created_source", "system")
          .neq("created_source", "starter_seed")
          .not("status", "in", "(completed,cancelled)")
          .order("end_date")
          .limit(5),
        db
          .from("organization_project_activity_events")
          .select("id,title,org_id,project_id,entity_type,occurred_at")
          .in("org_id", ids)
          .order("occurred_at", { ascending: false })
          .limit(10),
        db
          .from("organization_project_activity_events")
          .select("occurred_at", { count: "exact" })
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
      organization: names.get(row.org_id) ?? "Organization",
      dueDate: row.end_date,
      status: row.status,
    })),
    organizationCount: organizationScopeError ? null : ids.length,
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
    activity: (events?.data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      organization: names.get(row.org_id) ?? "Organization",
      occurredAt: row.occurred_at,
      kind: row.entity_type,
      href: row.project_id
        ? `/projects/${row.project_id}`
        : `/organizations?search=${encodeURIComponent(names.get(row.org_id) ?? "")}`,
    })),
    personalActivity: (personal?.data ?? []).map((row) => row.occurred_at),
    activityTruncated: (personal?.count ?? 0) > (personal?.data?.length ?? 0),
    issues,
    loadedAt: now.toISOString(),
  }
}
