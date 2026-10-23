"use server"

import { resolveWorkspaceProjectScope } from "@/lib/workspace/ordinary-project-access"

import { z } from "zod"
import { resolveMemberWorkspaceActorContext } from "./member-workspace-actor-context"
import { actorCanAccessOrganization } from "./member-workspace-actor-permissions"
import {
  loadOrganizationProjectActivityResult,
  type OrganizationActivityResult,
} from "./project-activity"

const inputSchema = z.object({
  orgId: z.string().uuid(),
  projectId: z.string().uuid(),
})

export async function refreshOrganizationProjectActivity(input: {
  orgId: string
  projectId: string
}): Promise<OrganizationActivityResult> {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) return { state: "error", items: [] }
  try {
    const actor = await resolveMemberWorkspaceActorContext()
    const scope = await resolveWorkspaceProjectScope({ supabase: actor.supabase, userId: actor.userId, projectId: parsed.data.projectId })
    if (
      scope === "denied" || !actor.hasMemberWorkspaceAccess ||
      (scope !== "fiscal" && !actorCanAccessOrganization(actor, parsed.data.orgId))
    )
      return { state: "forbidden", items: [] }
    const { data, error } = await actor.supabase
      .from("organization_projects")
      .select("id")
      .eq("id", parsed.data.projectId)
      .eq("org_id", parsed.data.orgId)
      .maybeSingle()
    if (error) return { state: "error", items: [] }
    if (!data) return { state: "forbidden", items: [] }
    return loadOrganizationProjectActivityResult({
      ...parsed.data,
      supabase: actor.supabase,
      projectOnly: scope === "fiscal",
    })
  } catch {
    return { state: "error", items: [] }
  }
}
