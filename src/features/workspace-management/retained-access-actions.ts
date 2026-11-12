"use server"
import { resolveOptionalAuthenticatedAppContext } from "@/lib/auth/request-context"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { retainedAccessPageSchema, retainedAccessQuerySchema } from "./lib/retained-access"

export async function listRetainedWorkspaceAccess(input: unknown) {
  const parsed = retainedAccessQuerySchema.safeParse(input)
  if (!parsed.success) return { error: "Choose a valid workspace.", code: "invalid" as const }
  try {
    const context = await resolveOptionalAuthenticatedAppContext()
    if (!context || context.activeOrg.orgId !== parsed.data.orgId) return { error: "Reopen your workspace to review access.", code: "denied" as const }
    const actorId = context.user.id
    const result = await createSupabaseAdminClient({ actorId, requestTimeoutMs: 10000 }).rpc("list_retained_workspace_access", {
      p_org_id: parsed.data.orgId, p_actor_id: actorId, p_after: parsed.data.after,
    })
    if (result.error?.code === "42501") return { error: "You cannot review this access.", code: "denied" as const }
    if (result.error) return { error: "Unable to load deleted workspaces. Try again.", code: "unavailable" as const }
    const page = retainedAccessPageSchema.safeParse(result.data)
    if (page.success) return { data: page.data }
  } catch { /* Return no raw provider or roster data. */ }
  return { error: "Unable to load deleted workspaces. Try again.", code: "unavailable" as const }
}
