"use server"

import { resolveMemberWorkspaceActorContext } from "./member-workspace-actor-context"
import { actorCanAccessOrganization } from "./member-workspace-actor-permissions"
import { projectOptionSettingsSchema } from "../lib/project-option-settings"

export async function loadProjectOptionSettings(projectId: string) {
  const actor = await resolveMemberWorkspaceActorContext()
  const scope = await actor.supabase
    .from("organization_projects")
    .select("org_id")
    .eq("id", projectId)
    .maybeSingle()
  if (
    scope.error ||
    !scope.data ||
    !actorCanAccessOrganization(actor, scope.data.org_id)
  ) {
    return { error: "Unable to load project options." }
  }
  const result = await actor.supabase
    .from("organization_projects")
    .select("option_settings")
    .eq("id", projectId)
    .eq("org_id", scope.data.org_id)
    .maybeSingle()
  if (result.error) {
    if (["42703", "PGRST204"].includes(result.error.code))
      return { settings: undefined }
    return {
      error: "Unable to load project options. Close and reopen to retry.",
    }
  }
  if (!result.data?.option_settings) return { settings: undefined }
  const parsed = projectOptionSettingsSchema.safeParse(
    result.data.option_settings
  )
  return parsed.success
    ? { settings: parsed.data }
    : { error: "Saved project options could not be read." }
}
