"use server"

import { loadPageDirectory, loadPageManagement } from "./server/page-directory"
import { WorkspaceSharingError } from "./server/page-projection"

function failure(error: unknown) {
  return { ok: false as const, error: error instanceof WorkspaceSharingError ? error.message : "Unable to load shared pages. Try again." }
}
export async function loadWorkspacePageDirectoryAction(input: unknown) {
  try { return { ok: true as const, value: await loadPageDirectory(input) } }
  catch (error) { return failure(error) }
}
export async function loadWorkspacePageManagementAction(input: unknown) {
  try { return { ok: true as const, value: await loadPageManagement(input) } }
  catch (error) { return failure(error) }
}
