import "server-only"

import type { MemberWorkspacePersonOption } from "../types"
import type { resolveMemberWorkspaceActorContext } from "./member-workspace-actor-context"
import type { OrganizationProjectRecord } from "./project-starter-data"
import { toMemberWorkspaceDataError } from "./table-errors"

// Call only with the actor-scoped result of list_fiscal_guest_projects.
// Labels are presentation data; never persist them as host memberships.
export async function attachFiscalProjectReviewerLabels({
  projects,
  people,
  supabase,
}: {
  projects: OrganizationProjectRecord[]
  people: MemberWorkspacePersonOption[]
  supabase: Awaited<ReturnType<typeof resolveMemberWorkspaceActorContext>>["supabase"]
}) {
  if (projects.length === 0) return projects
  const namesById = new Map(people
    .filter((person) => person.groupKey === "platform-admins")
    .map((person) => [person.id, person.name.trim()] as const))
  if (namesById.size === 0) return projects.map((project) => ({ ...project, member_labels: [] }))

  const { data, error } = await supabase
    .from("fiscal_project_reviewers")
    .select("project_id, user_id")
    .in("project_id", projects.map((project) => project.id))
    .in("user_id", [...namesById.keys()])
  if (error) throw toMemberWorkspaceDataError(error, "Unable to load fiscal project reviewers.")

  const namesByProject = new Map<string, Set<string>>()
  for (const reviewer of data ?? []) {
    const name = namesById.get(reviewer.user_id)
    if (!name) continue
    const names = namesByProject.get(reviewer.project_id) ?? new Set<string>()
    names.add(name)
    namesByProject.set(reviewer.project_id, names)
  }
  return projects.map((project) => ({
    ...project,
    member_labels: [...(namesByProject.get(project.id) ?? [])].sort((a, b) => a.localeCompare(b)),
  }))
}
