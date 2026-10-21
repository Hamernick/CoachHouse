import "server-only"

import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { canEditOrganization, resolveActiveOrganization } from "@/lib/organization/active-org"
import { workspacePageSchema } from "../lib"
import type { Database, Json } from "@/lib/supabase"
import { WorkspaceSharingError } from "./page-projection"

type PageRow = Database["public"]["Tables"]["organization_workspace_pages"]["Row"]

export function decodeWorkspacePage(row: PageRow) {
  return workspacePageSchema.parse({
    id: row.id, orgId: row.org_id, linkId: row.link_id, revision: row.revision,
    draft: { title: row.title, description: row.description, particleIds: row.particle_ids },
    visibility: row.visibility, publishedSnapshot: row.published_snapshot,
    publishedAt: row.published_at, createdAt: row.created_at, updatedAt: row.updated_at,
  })
}

export async function loadPageActor() {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new WorkspaceSharingError("scope", "Sign in to manage shared pages.")
  const active = await resolveActiveOrganization(supabase, user.id)
  if (!canEditOrganization(active.role))
    throw new WorkspaceSharingError("scope", "An organization editor can manage shared pages.")
  // Active scope derives from actual memberships, never platform/support roles.
  return { supabase, actorId: user.id, orgId: active.orgId }
}
export type PageActor = Awaited<ReturnType<typeof loadPageActor>>

export async function loadSavedPage(actor: PageActor, pageId: string) {
  const { data, error } = await actor.supabase.from("organization_workspace_pages")
    .select("*").eq("org_id", actor.orgId).eq("id", pageId)
    .abortSignal(AbortSignal.timeout(15_000)).maybeSingle()
  if (error) throw new WorkspaceSharingError("unavailable", "Unable to load this shared page. Try again.")
  return data
}

export async function loadSavedPageSources(actor: PageActor) {
  const [organization, board] = await Promise.all([
    actor.supabase.from("organizations").select("profile, public_slug, updated_at")
      .eq("user_id", actor.orgId).abortSignal(AbortSignal.timeout(15_000)).maybeSingle(),
    actor.supabase.from("organization_workspace_boards").select("state")
      .eq("org_id", actor.orgId).abortSignal(AbortSignal.timeout(15_000)).maybeSingle(),
  ])
  if (organization.error || board.error || !organization.data || !board.data)
    throw new WorkspaceSharingError("unavailable", "Unable to load saved workspace content. Try again.")
  const state = board.data.state
  const graph: Json | undefined = state && typeof state === "object" && !Array.isArray(state)
    ? state.particleGraph : undefined
  if (!graph) throw new WorkspaceSharingError("invalid", "Save a Particle to the board before sharing.")
  return { ...organization.data, graph }
}

/** Parse only the expected database result; do not expose operation receipts. */
export const committedPageRowSchema = z.object({
  id: z.uuid(), org_id: z.uuid(), link_id: z.uuid(), title: z.string(), description: z.string(),
  particle_ids: z.array(z.uuid()), revision: z.number(), visibility: z.enum(["private", "public"]),
  published_snapshot: z.json().nullable(), published_at: z.string().nullable(),
  created_at: z.string(), updated_at: z.string(),
  last_operation_id: z.uuid().nullable(), last_operation_actor: z.uuid().nullable(), last_operation_hash: z.string().nullable(),
})
