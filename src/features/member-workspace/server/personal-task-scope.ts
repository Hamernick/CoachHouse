import type { Database } from "@/lib/supabase"
import type { resolveMemberWorkspaceActorContext } from "./member-workspace-actor-context"
import { toMemberWorkspaceDataError } from "./table-errors"

type TaskIdentity = { id: string; org_id: string; created_by: string | null }
type Assignment = { task_id: string; user_id: string }

export function personalTaskIds(
  tasks: TaskIdentity[],
  assignments: Assignment[],
  userId: string
) {
  const assigned = new Set(assignments.map((row) => row.task_id))
  const mine = new Set(
    assignments
      .filter((row) => row.user_id === userId)
      .map((row) => row.task_id)
  )
  return new Set(
    tasks
      .filter(
        (task) =>
          mine.has(task.id) ||
          (task.created_by === userId && !assigned.has(task.id))
      )
      .map((task) => task.id)
  )
}

export async function loadPersonalTaskScope({
  tasks,
  userId,
  supabase,
}: {
  tasks: TaskIdentity[]
  userId: string
  supabase: Awaited<
    ReturnType<typeof resolveMemberWorkspaceActorContext>
  >["supabase"]
}) {
  if (!tasks.length)
    return {
      taskIds: new Set<string>(),
      organizationNames: new Map<string, string>(),
    }
  const [assignments, organizations] = await Promise.all([
    supabase
      .from("organization_task_assignees")
      .select("task_id, user_id")
      .in(
        "task_id",
        tasks.map((task) => task.id)
      )
      .returns<Assignment[]>(),
    supabase
      .from("organizations")
      .select("user_id, profile")
      .in("user_id", [...new Set(tasks.map((task) => task.org_id))])
      .returns<
        Array<
          Pick<
            Database["public"]["Tables"]["organizations"]["Row"],
            "user_id" | "profile"
          >
        >
      >(),
  ])
  if (assignments.error)
    throw toMemberWorkspaceDataError(
      assignments.error,
      "Unable to load your assigned tasks."
    )
  if (organizations.error)
    throw toMemberWorkspaceDataError(
      organizations.error,
      "Unable to load task organizations."
    )
  return {
    taskIds: personalTaskIds(tasks, assignments.data ?? [], userId),
    organizationNames: new Map(
      (organizations.data ?? []).map((org) => {
        const profile = org.profile
        const name =
          profile && typeof profile === "object" && !Array.isArray(profile)
            ? profile.name
            : null
        return [
          org.user_id,
          typeof name === "string" && name.trim()
            ? name.trim()
            : "Unnamed organization",
        ]
      })
    ),
  }
}
