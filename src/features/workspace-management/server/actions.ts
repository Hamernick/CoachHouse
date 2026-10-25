"use server"

import { revalidatePath } from "next/cache"
import { resolveOptionalAuthenticatedAppContext } from "@/lib/auth/request-context"
import { canEditOrganization } from "@/lib/organization/active-org"
import { changeWorkspaceCatalog, summarizeWorkspaces, workspaceCommandSchema } from "../lib"

export async function saveWorkspaceCommand(input: unknown) {
  const parsed = workspaceCommandSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Review the workspace name." }
  const context = await resolveOptionalAuthenticatedAppContext()
  if (!context) return { error: "Sign in to manage workspaces." }
  const { supabase, activeOrg, profileAudience, user } = context
  if (parsed.data.orgId !== activeOrg.orgId) return { error: "Your organization changed. Refresh before saving." }
  if (!profileAudience.isAdmin && !canEditOrganization(activeOrg.role)) return { error: "You do not have permission to manage workspaces." }
  try {
    const ready = await supabase.rpc("workspace_canvas_storage_version")
    if (ready.error || typeof ready.data !== "number" || ready.data < 1) return { error: "Workspace changes are not available yet. Please try again later." }
    if (parsed.data.kind === "delete" && parsed.data.id === null && ready.data < 2) return { error: "Deleting the starting workspace is not available yet. Please try again later." }
    for (let attempt = 0; attempt < 4; attempt++) {
      const read = await supabase.from("organization_workspace_boards").select("state, updated_at").eq("org_id", activeOrg.orgId).maybeSingle()
      if (read.error) throw new Error("Unable to load workspaces. Try again.")
      const state = changeWorkspaceCatalog(read.data?.state, parsed.data, new Date().toISOString())
      const write = read.data
        ? await supabase.from("organization_workspace_boards").update({ state, updated_by: user.id }).eq("org_id", activeOrg.orgId).eq("updated_at", read.data.updated_at).select("org_id").maybeSingle()
        : await supabase.from("organization_workspace_boards").insert({ org_id: activeOrg.orgId, state, updated_by: user.id }).select("org_id").maybeSingle()
      if (write.error?.code === "23505") continue
      if (write.error) throw new Error("Unable to confirm the save. Retry to confirm your workspace.")
      if (!write.data) continue
      revalidatePath("/workspace")
      return { ok: true as const, workspaces: summarizeWorkspaces(state), id: parsed.data.id }
    }
    return { error: "The workspace changed while saving. Please try again." }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to save workspace." }
  }
}
