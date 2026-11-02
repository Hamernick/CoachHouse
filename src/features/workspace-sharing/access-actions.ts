"use server"

import { executePageAccess } from "./server/page-access"
import { WorkspaceSharingError } from "./server/page-projection"

export async function workspacePageAccessAction(input: unknown) {
  try { return { ok: true as const, ...await executePageAccess(input) } }
  catch (error) {
    return error instanceof WorkspaceSharingError
      ? { ok: false as const, code: error.code, error: error.message, uncertain: error.uncertain }
      : { ok: false as const, code: "unavailable" as const, error: "Unable to confirm. Retry the same request.", uncertain: true }
  }
}
