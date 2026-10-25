import "server-only"

import { randomUUID } from "node:crypto"
import { readParticleGraph } from "@/features/workspace-particles"
import { publicSharingEnabled } from "@/lib/feature-flags"
import { pageChoice, pageEditorDataSchema, pageEditorRequestSchema } from "../lib/page-editor"
import { decodeWorkspacePage, loadPageActor, loadSavedPage, loadSavedPageSources } from "./page-context"
import { WorkspaceSharingError } from "./page-projection"

export async function loadPageEditorData(input: unknown) {
  const parsed = pageEditorRequestSchema.safeParse(input)
  if (!parsed.success) throw new WorkspaceSharingError("invalid", "Choose between 1 and 50 saved Particles to share.")
  const actor = await loadPageActor()
  if (actor.orgId !== parsed.data.workspaceId)
    throw new WorkspaceSharingError("scope", "The organization changed. Reopen Share from the current workspace.")
  const [sources, pages] = await Promise.all([
    loadSavedPageSources(actor),
    actor.supabase.from("organization_workspace_pages").select("id,title,visibility,particle_ids")
      .eq("org_id", actor.orgId).order("updated_at", { ascending: false }).order("id")
      .limit(50).abortSignal(AbortSignal.timeout(15_000)),
  ])
  if (pages.error) throw new WorkspaceSharingError("unavailable", "Unable to load shared pages. Try again.")
  const graph = readParticleGraph(sources.graph, actor.orgId)
  if (!graph.ok) throw new WorkspaceSharingError("invalid", graph.error)
  const initialParticleIds = [...new Set(parsed.data.initialParticleIds ?? [parsed.data.particleId])]
  const savedIds = new Set(graph.value.particles.map((particle) => particle.id))
  if (!savedIds.has(parsed.data.particleId) || initialParticleIds.some((id) => !savedIds.has(id)))
    throw new WorkspaceSharingError("conflict", "Save this Particle before sharing it, then try again.")
  const summaries = (pages.data ?? []).map((row) => ({ id: row.id, title: row.title, visibility: row.visibility, particleIds: row.particle_ids }))
  const pageId = parsed.data.pageId ?? (initialParticleIds.length === 1 ? summaries.find((page) => page.particleIds.includes(parsed.data.particleId))?.id : undefined)
  const page = pageId ? await loadSavedPage(actor, pageId) : null
  if (pageId && !page) throw new WorkspaceSharingError("conflict", "This page is no longer available. Reopen Share.")
  return pageEditorDataSchema.parse({
    workspaceId: actor.orgId, publishingEnabled: publicSharingEnabled,
    suggestedPageId: randomUUID(), page: page ? decodeWorkspacePage(page) : null,
    pages: summaries, choices: graph.value.particles.map(pageChoice),
    initialParticleIds,
  })
}
