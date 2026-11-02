import "server-only"

import { z } from "zod"
import { readParticleGraph } from "@/features/workspace-particles"
import type { WorkspacePageDraft } from "../types"
import { PAGE_LOGO_IMAGE_KEY, pageLogoFileId } from "../lib/page-brand"
import { loadPageActor, type PageActor } from "./page-context"
import { publicationHash, WorkspaceSharingError } from "./page-projection"
import {
  preparePageImage, supportsPublicImageMime, PUBLIC_IMAGE_INPUT_LIMIT,
  PUBLIC_IMAGE_COUNT_LIMIT, PUBLIC_IMAGE_PAGE_LIMIT,
} from "./page-asset-image"

const sourceSchema = z.object({
  id: z.uuid(), org_id: z.uuid(), document_kind: z.null(), deleted_at: z.null(),
  mime_type: z.string(), size_bytes: z.int().positive().max(PUBLIC_IMAGE_INPUT_LIMIT),
  storage_path: z.string().min(1).max(1024), updated_at: z.iso.datetime({ offset: true }),
})
export type PageImageSource = z.infer<typeof sourceSchema>

async function assertCurrentActor(actor: PageActor) {
  const current = await loadPageActor()
  if (current.actorId !== actor.actorId || current.orgId !== actor.orgId)
    throw new WorkspaceSharingError("scope", "Your organization access changed. Reopen Share.")
}

async function loadSources(actor: PageActor, ids: string[], signal: AbortSignal) {
  const { data, error } = await actor.supabase.from("organization_document_files")
    .select("id,org_id,document_kind,deleted_at,mime_type,size_bytes,storage_path,updated_at")
    .eq("org_id", actor.orgId).in("id", ids).is("document_kind", null).is("deleted_at", null)
    .abortSignal(signal)
  const parsed = z.array(sourceSchema).safeParse(data)
  if (error || !parsed.success || parsed.data.length !== ids.length
    || new Set(parsed.data.map(({ id }) => id)).size !== ids.length)
    throw new WorkspaceSharingError("unavailable", "A selected image is unavailable. Refresh Documents and try again.")
  for (const row of parsed.data) {
    const segments = row.storage_path.split("/")
    if (row.org_id !== actor.orgId || !ids.includes(row.id)
      || !row.storage_path.startsWith(`${actor.orgId}/library/`)
      || segments.some((part) => !part || part === "." || part === "..")
      || /[\\%?#\u0000-\u001f\u007f]/.test(row.storage_path))
      throw new WorkspaceSharingError("scope", "A selected image is unavailable.")
    if (!supportsPublicImageMime(row.mime_type))
      throw new WorkspaceSharingError("unsupported", "Choose a supported image before sharing.")
  }
  return new Map(parsed.data.map((row) => [row.id, row]))
}

/** Only canonical selected library images; no URLs, provider fetches, support
 * elevation, global cache or storage writes. This is preparation, NOT a grant.
 * The eventual publication transaction must lock/check returned source evidence.
 */
export async function resolvePageImageSources(actor: PageActor, input: {
  graph: unknown; draft: WorkspacePageDraft; profile?: unknown
}) {
  const graph = readParticleGraph(input.graph, actor.orgId)
  if (!graph.ok) throw new WorkspaceSharingError("invalid", graph.error)
  const selected = new Set(input.draft.particleIds)
  if ([...selected].some((id) => !graph.value.particles.some((item) => item.id === id)))
    throw new WorkspaceSharingError("conflict", "A selected Particle was removed. Review your selection.")
  const candidates = graph.value.particles.flatMap((particle) => {
    if (!selected.has(particle.id) || particle.type !== "activity" || particle.data.source
      || particle.data.widget?.kind !== "image") return []
    return [{ particleId: particle.id, fileId: particle.data.widget.fileId }]
  })
  if (input.profile !== undefined) {
    let logoId: string | undefined
    try { logoId = pageLogoFileId(input.profile) }
    catch { throw new WorkspaceSharingError("invalid", "The saved primary logo is invalid. Update it in Brand kit before sharing.") }
    if (logoId) candidates.push({ particleId: PAGE_LOGO_IMAGE_KEY, fileId: logoId })
  }
  const ids = [...new Set(candidates.map(({ fileId }) => fileId))].sort()
  const images = new Map<string, {
    source: PageImageSource; representation: Awaited<ReturnType<typeof preparePageImage>>
  }>()
  if (!ids.length) return images
  if (ids.length > PUBLIC_IMAGE_COUNT_LIMIT)
    throw new WorkspaceSharingError("unsupported", "Share up to eight distinct images per page.")
  await assertCurrentActor(actor)
  const deadline = AbortSignal.timeout(60_000)
  const sources = await loadSources(actor, ids, deadline)
  const prepared = new Map<string, Awaited<ReturnType<typeof preparePageImage>>>()
  let outputBytes = 0
  // Sequential decode bounds native memory; repeated file placements reuse bytes.
  for (const [id, source] of sources) {
    deadline.throwIfAborted()
    const { data, error } = await actor.supabase.storage.from("org-documents")
      .download(source.storage_path, undefined, { signal: AbortSignal.any([deadline, AbortSignal.timeout(10_000)]) })
    if (error || !data || data.size !== source.size_bytes || data.size > PUBLIC_IMAGE_INPUT_LIMIT)
      throw new WorkspaceSharingError("unavailable", "A selected image could not be read. Try again.")
    const representation = await preparePageImage(Buffer.from(await data.arrayBuffer()), source.mime_type)
    outputBytes += representation.bytes.length
    if (outputBytes > PUBLIC_IMAGE_PAGE_LIMIT)
      throw new WorkspaceSharingError("unsupported", "These images are too large to share together. Select fewer images.")
    prepared.set(id, representation)
  }
  const current = await loadSources(actor, ids, deadline)
  await assertCurrentActor(actor)
  for (const [id, source] of sources) {
    if (publicationHash(current.get(id)) !== publicationHash(source))
      throw new WorkspaceSharingError("conflict", "An image changed. Review it again before sharing.")
  }
  for (const { particleId, fileId } of candidates) {
    const source = sources.get(fileId), representation = prepared.get(fileId)
    if (!source || !representation) throw new WorkspaceSharingError("unavailable", "A selected image is unavailable.")
    images.set(particleId, { source, representation })
  }
  return images
}
