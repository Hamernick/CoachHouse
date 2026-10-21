"use server"

import { revalidatePath } from "next/cache"
import { reviewWorkspacePage, writeWorkspacePage } from "./page-service"
import { WorkspaceSharingError } from "./page-projection"
import { loadPageEditorData } from "./page-editor-data"

function failure(error: unknown) {
  return error instanceof WorkspaceSharingError
    ? { ok: false as const, code: error.code, error: error.message, uncertain: error.uncertain }
    : { ok: false as const, code: "unavailable" as const, error: "Unable to confirm this save. Retry the same request before making another change.", uncertain: true }
}

export async function loadWorkspacePageEditorAction(input: unknown) {
  try { return { ok: true as const, value: await loadPageEditorData(input) } }
  catch (error) { return { ...failure(error), uncertain: false } }
}

export async function reviewWorkspacePageAction(input: unknown) {
  try { return { ok: true as const, value: await reviewWorkspacePage(input) } }
  catch (error) { return { ...failure(error), uncertain: false } }
}

export async function commitWorkspacePageAction(input: unknown) {
  try {
    const value = await writeWorkspacePage(input)
    // Replays repair invalidation if the original response was interrupted.
    revalidatePath("/workspace")
    revalidatePath("/[org]/[uniqueLink]", "page")
    return { ok: true as const, value }
  } catch (error) { return failure(error) }
}
