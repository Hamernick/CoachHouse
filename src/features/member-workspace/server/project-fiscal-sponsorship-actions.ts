"use server"

import { isOrdinaryWorkspaceProject } from "@/lib/workspace/ordinary-project-access"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { resolveMemberWorkspaceActorContext } from "./member-workspace-actor-context"
import { actorCanAccessOrganization, actorCanAccessOrganizations } from "./member-workspace-actor-permissions"
import { ensureMemberWorkspaceFeatureAccess } from "./access"
import { mergeProjectOptions, projectFiscalSponsorshipEnabled } from "../lib/project-fiscal-sponsorship"

export async function enableProjectFiscalSponsorshipAction(projectId: string, scope: "workspace" | "platform" = "workspace") {
  if (scope !== "workspace" && scope !== "platform") return { error: "Choose a valid project view." }
  if (!z.string().uuid().safeParse(projectId).success) return { error: "Choose a valid project." }
  const actor = await resolveMemberWorkspaceActorContext(scope)
  if (!(await isOrdinaryWorkspaceProject({ supabase: actor.supabase, userId: actor.userId, projectId }))) return { error: "Use the fiscal application review for this project." }
  const access = ensureMemberWorkspaceFeatureAccess(actor)
  if (access) return access
  if (!actorCanAccessOrganizations(actor) && !actor.canEdit) {
    return { error: "Only project editors can add tabs." }
  }
  const { data: project, error } = await actor.supabase.from("organization_projects")
    .select("id, org_id, updated_at, option_settings, guided_setup").eq("id", projectId).maybeSingle()
  if (error || !project || !actorCanAccessOrganization(actor, project.org_id)) {
    return { error: "Unable to access that project." }
  }
  if (!projectFiscalSponsorshipEnabled(project.option_settings, project.guided_setup)) {
    const result = await createSupabaseAdminClient().from("organization_projects")
      .update({ option_settings: mergeProjectOptions(project.option_settings, undefined, true), updated_by: actor.userId })
      .eq("id", projectId).eq("org_id", project.org_id).eq("updated_at", project.updated_at)
      .select("id").maybeSingle()
    if (result.error) return { error: "Could not add Fiscal Sponsorship. Try again." }
    if (!result.data) return { error: "The project changed. Refresh and try again." }
  }
  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/organizations/${projectId}`)
  revalidatePath("/projects")
  revalidatePath("/organizations")
  return { ok: true as const }
}
