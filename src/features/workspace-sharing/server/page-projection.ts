import "server-only"

import { createHash } from "node:crypto"
import { z } from "zod"
import { projectParticlePublicContent, readParticleGraph } from "@/features/workspace-particles"
import type { WorkspacePageDraft } from "../types"
import { workspacePageSnapshotSchema } from "../lib"

export class WorkspaceSharingError extends Error {
  constructor(public readonly code: "invalid" | "scope" | "conflict" | "unsupported" | "unavailable", message: string, public readonly uncertain = false) {
    super(message)
  }
}

export function publicationHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}

/** Selected persisted records only. Drive links are supplied exclusively by
 * the server's canonical-source resolver, never by an action input. */
export function projectWorkspacePage(input: {
  orgId: string
  profile: unknown
  publicSlug: string | null
  graph: unknown
  draft: WorkspacePageDraft
  driveLinks?: ReadonlyMap<string, string>
}) {
  const graph = readParticleGraph(input.graph, input.orgId)
  if (!graph.ok) throw new WorkspaceSharingError(graph.code === "scope" ? "scope" : "invalid", graph.error)
  const byId = new Map(graph.value.particles.map((particle) => [particle.id, particle]))
  const items = input.draft.particleIds.map((id) => {
    const particle = byId.get(id)
    if (!particle) throw new WorkspaceSharingError("conflict", "A selected Particle was removed. Review your selection.")
    const driveLink = input.driveLinks?.get(id)
    if (driveLink) return {
      id: particle.id, title: particle.title, description: particle.description,
      content: { kind: "drive_link" as const, href: driveLink },
    }
    const result = projectParticlePublicContent(particle)
    if (!result.ok) throw new WorkspaceSharingError("unsupported", `${particle.title}: ${result.error}`)
    return result.value
  })
  const profile = z.object({ name: z.string().trim().min(1).max(240) }).safeParse(input.profile)
  if (!profile.success || !input.publicSlug)
    throw new WorkspaceSharingError("invalid", "Add an organization name and public URL in organization settings first.")
  const snapshot = workspacePageSnapshotSchema.safeParse({
    version: 1,
    brand: { name: profile.data.name, organizationSlug: input.publicSlug },
    title: input.draft.title,
    description: input.draft.description,
    items,
  })
  if (!snapshot.success) throw new WorkspaceSharingError("invalid", "Review your page details before publishing.")
  return snapshot.data
}

export function assertSavedPageSelection(graphValue: unknown, orgId: string, draft: WorkspacePageDraft) {
  const graph = readParticleGraph(graphValue, orgId)
  if (!graph.ok) throw new WorkspaceSharingError("invalid", graph.error)
  const ids = new Set(graph.value.particles.map((particle) => particle.id))
  if (draft.particleIds.some((id) => !ids.has(id)))
    throw new WorkspaceSharingError("conflict", "A selected Particle was removed. Review your selection.")
}
