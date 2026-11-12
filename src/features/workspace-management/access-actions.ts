"use server"

import { resolveOptionalAuthenticatedAppContext } from "@/lib/auth/request-context"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { workspaceAccessChangeSchema, workspaceAccessDataSchema, workspaceAccessTargetSchema, type WorkspaceAccessChange, type WorkspaceAccessTarget } from "./lib/access"

async function execute(input: WorkspaceAccessTarget, change?: WorkspaceAccessChange) {
  try {
    const context = await resolveOptionalAuthenticatedAppContext()
    if (!context) return { error: "Sign in to review access.", code: "denied" as const }
    if (context.activeOrg.orgId !== input.orgId) return { error: "Your organization changed. Reopen access.", code: "denied" as const }
    const actorId = context.user.id
    const result = await createSupabaseAdminClient({ actorId, requestTimeoutMs: 10000 }).rpc("workspace_access_control", {
      p_org_id: input.orgId, p_canvas_id: input.canvasId ?? "default", p_actor_id: actorId,
      ...(change ? { p_expected_revision: change.revision, p_members: change.members } : {}),
    })
    if (result.error?.code === "40001") return { error: "Access changed. Reload before saving.", code: "conflict" as const }
    if (result.error?.code === "42501") return { error: "You cannot change or review this access. Reopen the workspace.", code: "denied" as const }
    if (result.error) return { error: "Unable to confirm access. Reload and try again.", code: "unavailable" as const }
    const parsed = workspaceAccessDataSchema.safeParse(result.data)
    if (!parsed.success) return { error: "Unable to load access. Try again.", code: "unavailable" as const }
    return { data: parsed.data }
  } catch {
    return { error: "Unable to confirm access. Reload and try again.", code: "unavailable" as const }
  }
}

export async function loadWorkspaceAccess(input: unknown) {
  const parsed = workspaceAccessTargetSchema.safeParse(input)
  if (!parsed.success) return { error: "Choose a valid workspace.", code: "invalid" as const }
  return execute(parsed.data)
}

export async function saveWorkspaceAccess(input: unknown) {
  const parsed = workspaceAccessChangeSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Review access.", code: "invalid" as const }
  return execute(parsed.data, parsed.data)
}
