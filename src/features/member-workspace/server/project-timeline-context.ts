import { z } from "zod"
import { isOrdinaryWorkspaceProject } from "@/lib/workspace/ordinary-project-access"
import { ensureMemberWorkspaceFeatureAccess } from "./access"
import { resolveMemberWorkspaceActorContext } from "./member-workspace-actor-context"
import { actorCanAccessOrganizations } from "./member-workspace-actor-permissions"
import { resolveTaskTargetProject } from "./task-action-helpers"
import { resolveDirectoryTaskScope } from "./task-directory-scope"

type TimelineContext = {
  actor: Awaited<ReturnType<typeof resolveMemberWorkspaceActorContext>>
  project: Extract<Awaited<ReturnType<typeof resolveTaskTargetProject>>, { project: unknown }>["project"]
  canEdit: boolean
} | { error: string }

export async function resolveProjectTimelineContext(
  projectId: string,
  write = false
): Promise<TimelineContext> {
  if (!z.string().uuid().safeParse(projectId).success)
    return { error: "Choose a valid project." } as const
  const actor = await resolveMemberWorkspaceActorContext(
    await resolveDirectoryTaskScope()
  )
  const access = ensureMemberWorkspaceFeatureAccess(actor)
  if (access) return access
  if (
    !(await isOrdinaryWorkspaceProject({
      supabase: actor.supabase,
      userId: actor.userId,
      projectId,
    }))
  ) {
    return {
      error: "Open the fiscal project to view its review tasks.",
    } as const
  }
  const result = await resolveTaskTargetProject({ actor, projectId })
  if ("error" in result) return result
  const canEdit = actorCanAccessOrganizations(actor) || actor.canEdit
  if (write && !canEdit)
    return { error: "You do not have access to edit this timeline." } as const
  return { actor, project: result.project, canEdit }
}
