import "server-only"

import { z } from "zod"
import { pageDirectoryRequestSchema, pageDirectorySchema } from "../lib/page-directory"
import { decodeWorkspacePage, loadPageActor, loadSavedPage } from "./page-context"
import { WorkspaceSharingError } from "./page-projection"

/** Organization-editor discovery deliberately does not depend on surviving canvases. */
export async function loadPageDirectory(input: unknown) {
  const parsed = pageDirectoryRequestSchema.safeParse(input)
  if (!parsed.success) throw new WorkspaceSharingError("invalid", "Reload shared pages.")
  const actor = await loadPageActor()
  let query = actor.supabase.from("organization_workspace_pages").select("id,title,visibility")
    .eq("org_id", actor.orgId).order("id").limit(26)
  if (parsed.data.after) query = query.gt("id", parsed.data.after)
  const { data, error } = await query.abortSignal(AbortSignal.timeout(15_000))
  if (error) throw new WorkspaceSharingError("unavailable", "Unable to load shared pages. Try again.")
  const rows = data ?? []
  return pageDirectorySchema.parse({ workspaceId: actor.orgId, pages: rows.slice(0, 25),
    next: rows.length > 25 ? rows[24].id : null })
}

export async function loadPageManagement(input: unknown) {
  const parsed = z.strictObject({ pageId: z.uuid() }).safeParse(input)
  if (!parsed.success) throw new WorkspaceSharingError("invalid", "Choose a saved page.")
  const actor = await loadPageActor()
  const page = await loadSavedPage(actor, parsed.data.pageId)
  if (!page) throw new WorkspaceSharingError("scope", "This page is unavailable for this organization.")
  return decodeWorkspacePage(page)
}
