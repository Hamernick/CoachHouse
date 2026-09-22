"use server"

import { revalidatePath } from "next/cache"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import {
  guidedProjectSchema,
  guidedProjectOverview,
  type GuidedProjectInput,
} from "../lib/guided-project"
import { resolveMemberWorkspaceActorContext } from "./member-workspace-actor-context"
import {
  actorCanAccessOrganization,
  actorCanAccessOrganizations,
} from "./member-workspace-actor-permissions"
import { loadMemberWorkspacePersonOptionsForOrganizations } from "./person-options"
import { buildProjectOverviewDocumentContent } from "./project-overview-documents"

export async function loadGuidedProjectPeople(organizationId: string) {
  const actor = await resolveMemberWorkspaceActorContext()
  if (
    !actorCanAccessOrganization(actor, organizationId) ||
    (!actor.canEdit && !actorCanAccessOrganizations(actor))
  )
    return { error: "You cannot create projects for this organization." }
  const people = await loadMemberWorkspacePersonOptionsForOrganizations({
    orgIds: actorCanAccessOrganizations(actor) ? [] : [organizationId],
    supabase: actor.supabase,
    includePlatformAdmins: actorCanAccessOrganizations(actor),
  })
  return { people }
}

export async function createGuidedProjectAction(
  input: GuidedProjectInput
): Promise<{ ok: true; id: string } | { error: string }> {
  const parsed = guidedProjectSchema.safeParse(input)
  if (!parsed.success)
    return {
      error: parsed.error.issues[0]?.message ?? "Check the project details.",
    }
  const value = parsed.data
  const actor = await resolveMemberWorkspaceActorContext()
  if (
    !actorCanAccessOrganization(actor, value.organizationId) ||
    (!actor.canEdit && !actorCanAccessOrganizations(actor))
  )
    return { error: "You cannot create projects for this organization." }
  const { data: organization, error: organizationError } = await actor.supabase
    .from("organizations")
    .select("user_id")
    .eq("user_id", value.organizationId)
    .maybeSingle()
  if (organizationError || !organization)
    return { error: "Choose an accessible organization." }
  const people = await loadMemberWorkspacePersonOptionsForOrganizations({
    orgIds: actorCanAccessOrganizations(actor) ? [] : [value.organizationId],
    supabase: actor.supabase,
    includePlatformAdmins: actorCanAccessOrganizations(actor),
  })
  const peopleById = new Map(people.map((person) => [person.id, person]))
  const memberIds = [...new Set([value.ownerId, ...value.contributorIds])]
  const assignedIds = [
    ...memberIds,
    ...value.tasks.flatMap((task) =>
      task.assigneeId ? [task.assigneeId] : []
    ),
  ]
  if (assignedIds.some((id) => !peopleById.has(id)))
    return {
      error:
        "One or more people are no longer available for this organization.",
    }
  const overview = buildProjectOverviewDocumentContent(
    guidedProjectOverview(value)
  )
  const { data, error } = await createSupabaseAdminClient().rpc(
    "create_guided_organization_project",
    {
      p_actor_id: actor.userId,
      p_org_id: value.organizationId,
      p_request_id: value.requestId,
      p_setup: value,
      p_member_labels: memberIds.map((id) => peopleById.get(id)!.name),
      p_overview_html: overview.documentHtml,
      p_overview_text: overview.documentText,
    }
  )
  if (error)
    return {
      error:
        error.code === "PGRST202" || error.code === "42883"
          ? "Guided setup is not available until the project setup migration is applied."
          : "Project creation failed. Nothing was partially created; you can retry.",
    }
  const result = data as { ok?: boolean; projectId?: string } | null
  if (!result?.ok || !result.projectId)
    return { error: "Project creation could not be completed." }
  revalidatePath("/projects")
  revalidatePath("/organizations")
  revalidatePath("/tasks")
  return { ok: true, id: result.projectId }
}
