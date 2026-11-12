import { z } from "zod"
import { resolveWorkspaceProjectScope } from "@/lib/workspace/ordinary-project-access"
import { resolveMemberWorkspaceActorContext } from "./member-workspace-actor-context"
import { actorCanAccessOrganization, actorCanAccessOrganizations } from "./member-workspace-actor-permissions"
import { ensureMemberWorkspaceFeatureAccess } from "./access"

export async function projectAssetFolderContext(projectId: string, allowFiscalRead = false, actionScope: "workspace" | "platform" = "workspace") {
  if (actionScope !== "workspace" && actionScope !== "platform") throw new Error("Choose a valid project view.")
  if (!z.string().uuid().safeParse(projectId).success) throw new Error("Choose a valid project.")
  const actor = await resolveMemberWorkspaceActorContext(actionScope)
  const scope = await resolveWorkspaceProjectScope({ supabase: actor.supabase, userId: actor.userId, projectId })
  if (scope === "denied" || (scope === "fiscal" && !allowFiscalRead)) throw new Error("Use the fiscal application review for this project.")
  const access = ensureMemberWorkspaceFeatureAccess(actor)
  if (access) throw new Error(access.error)
  const result = await actor.supabase.from("organization_projects")
    .select("id, org_id, project_kind, updated_at").eq("id", projectId).maybeSingle()
  if (result.error || !result.data || (scope !== "fiscal" && !actorCanAccessOrganization(actor, result.data.org_id))) {
    throw new Error("Unable to access that project.")
  }
  return { actor, project: result.data, fiscal: scope === "fiscal", canEdit: scope !== "fiscal" && (actorCanAccessOrganizations(actor) || actor.canEdit) }
}

