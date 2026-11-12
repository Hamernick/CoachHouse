"use server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { accessDataSchema, type AccessResult } from "@/lib/workspace/access"
import { projectAssetFolderContext } from "./project-asset-folder-context"
import { folderAccessTargetSchema, folderAccessChangeSchema, type FolderAccessTarget, type FolderAccessChange } from "../lib/project-folder-access"
async function execute(input: FolderAccessTarget, change?: FolderAccessChange): Promise<AccessResult> {
  let actor: Awaited<ReturnType<typeof projectAssetFolderContext>>["actor"]
  try { ({ actor } = await projectAssetFolderContext(input.projectId, false, input.actionScope)) }
  catch { return { error: "Folder access is no longer available. Reopen the project.", code: "denied" } }
  try {
    const result = await createSupabaseAdminClient({ actorId: actor.userId, requestTimeoutMs: 10000 }).rpc("project_folder_access_review", {
      p_project_id: input.projectId, p_folder_id: input.folderId, p_actor_id: actor.userId,
      ...(change ? { p_expected_revision: change.revision, p_members: change.members, ...(change.workspaceChanges ? { p_workspace_changes: change.workspaceChanges } : {}) } : {}),
    })
    if (result.error?.code === "40001") return { error: "Access changed. Reload before saving.", code: "conflict" }
    if (result.error?.code === "42501") return { error: "Folder access is no longer available.", code: "denied" }
    if (result.error) return { error: "Unable to confirm access. Reload and try again.", code: "unavailable" }
    const parsed = accessDataSchema.safeParse(result.data)
    if (!parsed.success) return { error: "Unable to load access. Try again.", code: "unavailable" }
    return { data: parsed.data }
  } catch {
    return { error: "Unable to confirm access. Reload and try again.", code: "unavailable" }
  }
}
export async function loadProjectFolderAccess(input: unknown): Promise<AccessResult> {
  const parsed = folderAccessTargetSchema.safeParse(input)
  if (!parsed.success) return { error: "Choose a valid folder.", code: "invalid" }
  return execute(parsed.data)
}
export async function saveProjectFolderAccess(input: unknown): Promise<AccessResult> {
  const parsed = folderAccessChangeSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Review access.", code: "invalid" }
  return execute(parsed.data, parsed.data)
}
