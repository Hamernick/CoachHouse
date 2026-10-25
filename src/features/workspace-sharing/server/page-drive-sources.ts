import "server-only"

import { z } from "zod"
import { readParticleGraph } from "@/features/workspace-particles"
import { resolveRoadmapSections } from "@/lib/roadmap/sections"
import type { Json } from "@/lib/supabase"
import type { WorkspacePageDraft } from "../types"
import { canonicalDrivePublicLink } from "../lib"
import type { PageActor } from "./page-context"
import { WorkspaceSharingError } from "./page-projection"

export type DriveSourceCheck = {
  id: string
  provider_file_id: string
  web_view_link: string
  updated_at: string
}

export async function resolvePageDriveSources(actor: PageActor, input: {
  graph: Json
  profile: Json
  draft: WorkspacePageDraft
}) {
  const graph = readParticleGraph(input.graph, actor.orgId)
  if (!graph.ok) throw new WorkspaceSharingError("invalid", graph.error)
  const selected = new Set(input.draft.particleIds)
  const candidates = graph.value.particles.flatMap((particle) => {
    if (!selected.has(particle.id) || particle.type !== "activity" || particle.data.source) return []
    const widget = particle.data.widget
    if (widget?.kind !== "document" || widget.fileId || !widget.source
      || (widget.source.kind !== "drive" && widget.source.kind !== "roadmap_drive")) return []
    return [{ particle, source: widget.source }]
  })
  const attachments = candidates.filter((item) => item.source.kind === "drive")
  const ids = [...new Set(attachments.flatMap((item) => item.source.kind === "drive" ? [item.source.id] : []))]
  if (ids.some((id) => !z.uuid().safeParse(id).success))
    throw new WorkspaceSharingError("scope", "Choose an available Drive file from Documents.")
  const checks: DriveSourceCheck[] = []
  if (ids.length) {
    const result = await actor.supabase.from("organization_external_documents")
      .select("id,provider_file_id,web_view_link,updated_at")
      .eq("org_id", actor.orgId).eq("provider", "google_drive").eq("status", "available")
      .in("id", ids).abortSignal(AbortSignal.timeout(15_000))
    if (result.error) throw new WorkspaceSharingError("unavailable", "Unable to verify the selected Drive files. Try again.")
    checks.push(...result.data ?? [])
  }
  const byId = new Map(checks.map((check) => [check.id, check]))
  const profile = input.profile && typeof input.profile === "object" && !Array.isArray(input.profile)
    ? input.profile : null
  const hasProfileSources = candidates.some((item) => item.source.kind === "roadmap_drive")
  const sections = hasProfileSources ? resolveRoadmapSections(profile) : []
  const links = new Map<string, string>()
  for (const { particle, source } of candidates) {
    let href: string | null = null
    if (source.kind === "drive") {
      const row = byId.get(source.id)
      if (row && row.web_view_link === source.webViewLink)
        href = canonicalDrivePublicLink(row.web_view_link, row.provider_file_id)
    } else {
      const section = sections.find((item) => item.id === source.sectionId || item.slug === source.sectionId)
      if (section?.documentSource !== "editor" && section?.driveSource?.fileId === source.fileId
        && section.driveSource.webViewLink === source.webViewLink)
        href = canonicalDrivePublicLink(section.driveSource.webViewLink, section.driveSource.fileId)
    }
    if (!href) throw new WorkspaceSharingError("scope", `${particle.title}: this Drive source changed or is unavailable. Refresh it in Documents before sharing.`)
    links.set(particle.id, href)
  }
  return { links, checks, expectedProfile: hasProfileSources ? input.profile : null }
}
