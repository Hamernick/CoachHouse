"use server"

import { randomUUID } from "node:crypto"
import { logger } from "@/lib/logger"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { hasWorkspaceSupportAccess } from "@/lib/organization/support-access"
import { readOrganizationRequestScope } from "@/server/organization/request-scope"
import { organizationWorkspaceSupportEnabled } from "@/lib/feature-flags"
import { mapSupportOrganization } from "../lib"
import type { WorkspaceSupportParticipant, WorkspaceSupportPresenceInput, WorkspaceSupportPresenceResult, WorkspaceSupportSearchResult, WorkspaceSupportSearchRow } from "../types"

async function context() {
  if (!organizationWorkspaceSupportEnabled) throw new Error("Workspace support is not enabled.")
  const client = await createSupabaseServerClient()
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user) throw new Error("Sign in again to access this workspace.")
  return client
}

export async function searchSupportOrganizations(query: string, offset = 0): Promise<WorkspaceSupportSearchResult> {
  const empty = { organizations: [], total: 0, hasMore: false }
  if (typeof query !== "string" || query.trim().length < 2) return empty
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) return { ...empty, error: "Invalid search page." }
  try {
    const client = await context()
    const { data, error } = await client.rpc("search_workspace_support_organizations_v2" as never, { p_query: query.trim().slice(0, 100), p_offset: offset } as never)
    if (error) return { ...empty, error: "Unable to search support workspaces." }
    const rows = (data ?? []) as WorkspaceSupportSearchRow[]
    const total = Number(rows[0]?.total_count ?? 0)
    return { organizations: rows.map(mapSupportOrganization), total, hasMore: offset + rows.length < total }
  } catch {
    return { ...empty, error: "Workspace support access is unavailable." }
  }
}

export async function syncWorkspaceSupportPresence(input: WorkspaceSupportPresenceInput): Promise<WorkspaceSupportPresenceResult> {
  const requestId = randomUUID()
  const started = performance.now()
  try {
    const client = await context()
    if ((await readOrganizationRequestScope())?.supportRequested && !await hasWorkspaceSupportAccess(client)) throw new Error("Support access revoked")
    const { data, error } = await client.rpc("sync_workspace_support_presence" as never, {
      p_org: input.organizationId, p_session: input.sessionId, p_path: input.path,
      p_position: input.position, p_editing: input.editing,
    } as never)
    if (error?.code === "PT404") {
      logger.warn("workspace_presence_target_unavailable", { requestId, organizationId: input.organizationId })
      return { error: "This workspace is unavailable. Choose another organization.", code: "organization_unavailable", retryable: false, requestId }
    }
    if (error) throw error
    return { participants: data as unknown as WorkspaceSupportParticipant[] }
  } catch {
    if (Math.random() < 0.1) logger.warn("workspace_presence_unavailable", { requestId, organizationId: input.organizationId, durationMs: Math.round(performance.now() - started) })
    return { error: "Live presence is temporarily unavailable.", requestId }
  }
}

export async function leaveWorkspaceSupportPresence(organizationId: string, sessionId: string) {
  const client = await context()
  await client.rpc("leave_workspace_support_presence" as never, { p_org: organizationId, p_session: sessionId } as never)
}
