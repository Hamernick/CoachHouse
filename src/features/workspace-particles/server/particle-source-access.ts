import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase"
import type { Particle, ParticleGraph } from "../types"
import { ParticleMutationError } from "../lib/authorized-mutation"
import type { ParticleDocumentSource } from "../lib/particle-library-document"
import { getParticleNotes } from "../lib/particle-notes"
import { assertProfileParticleSourceAccess } from "./profile-reference-access"

type ParticleSourceReference =
  | { kind: "opportunity"; id: string; organizationId: string }
  | { kind: "file"; id: string }
  | { kind: "person"; id: string }
  | ParticleDocumentSource

function references(particle: Particle): ParticleSourceReference[] {
  if (particle.type === "people")
    return particle.data.personIds.map((id) => ({ kind: "person", id }))
  if (particle.type !== "activity") return []
  const widget = particle.data.widget
  if (widget?.kind === "opportunity") return [{ kind: "opportunity", id: widget.opportunityId, organizationId: widget.organizationId }]
  if (widget?.kind === "notes" && widget.source.kind === "module")
    return [{ kind: "module_note", moduleId: widget.source.moduleId }]
  if (widget?.kind === "image") return [{ kind: "file", id: widget.fileId }]
  if (widget?.kind !== "document") return []
  if (widget.fileId) return [{ kind: "file", id: widget.fileId }]
  return widget.source ? [widget.source] : []
}

/** Validate new/replaced/re-added source references with the actor's RLS client.
 * Existing broken references remain movable/removable. No provider calls, byte
 * reads, or checks for ordinary position, size, title and connection changes.
 * Lesson-note bodies remain personal; only the readable module ID is checked.
 */
export async function assertParticleSourceReferenceAccess({
  supabase,
  previous,
  next,
}: {
  supabase: SupabaseClient<Database>
  previous: ParticleGraph
  next: ParticleGraph
}) {
  if (previous.workspaceId !== next.workspaceId)
    throw new ParticleMutationError(
      "scope",
      "Particle source belongs to another workspace."
    )
  const previousById = new Map(
    previous.particles.map((particle) => [particle.id, particle])
  )
  const pending = new Map<string, ParticleSourceReference>()
  for (const particle of next.particles) {
    const before = previousById.get(particle.id)
    const retained = new Set(
      before && !(before.canvasHidden && !particle.canvasHidden)
        ? references(before).map((source) => JSON.stringify(source))
        : []
    )
    for (const source of references(particle)) {
      const key = JSON.stringify(source)
      if (!retained.has(key)) pending.set(key, source)
    }
  }
  const sources = [...pending.values()]
  await assertProfileParticleSourceAccess(
    supabase,
    next.workspaceId,
    sources.filter(
      (source) =>
        source.kind === "upload" ||
        source.kind === "policy" ||
        source.kind === "roadmap" ||
        source.kind === "roadmap_drive" ||
        source.kind === "person"
    )
  )
  const nextById = new Map(
    next.particles.map((particle) => [particle.id, particle])
  )
  for (const source of sources) {
    if (source.kind !== "workspace_note") continue
    const target = nextById.get(source.id)
    if (!target || getParticleNotes(target)?.kind !== "workspace")
      throw new ParticleMutationError(
        "scope",
        "This note is unavailable. Choose an available note from Documents."
      )
  }
  // Bound query URL size when a batch places many documents.
  for (let offset = 0; offset < sources.length; offset += 100) {
    const chunk = sources.slice(offset, offset + 100)
    const opportunities = chunk.filter(source => source.kind === "opportunity")
    if (opportunities.length) {
      if (opportunities.some(source => source.organizationId !== next.workspaceId))
        throw new ParticleMutationError("scope", "Opportunity belongs to another organization.")
      const { data, error } = await supabase.from("organization_finance_opportunities").select("id")
        .eq("org_id", next.workspaceId).in("id", opportunities.map(source => source.id))
        .abortSignal(AbortSignal.timeout(15_000))
      if (error) throw new ParticleMutationError("unavailable", "Could not verify this opportunity. Try again.")
      const available = new Set((data ?? []).map(row => row.id))
      if (opportunities.some(source => !available.has(source.id)))
        throw new ParticleMutationError("scope", "This opportunity is unavailable.")
    }
    const files = chunk.filter((source) => source.kind === "file")
    const drive = chunk.filter((source) => source.kind === "drive")
    const modules = chunk.filter((source) => source.kind === "module_note")
    if (modules.length) {
      const { data, error } = await supabase
        .from("modules")
        .select("id")
        .in(
          "id",
          modules.map((source) => source.moduleId)
        )
        .abortSignal(AbortSignal.timeout(15_000))
      if (error)
        throw new ParticleMutationError(
          "unavailable",
          "Could not verify this lesson. Try again."
        )
      const available = new Set((data ?? []).map((row) => row.id))
      if (modules.some((source) => !available.has(source.moduleId)))
        throw new ParticleMutationError(
          "scope",
          "This lesson is unavailable. Choose an accessible Accelerator lesson."
        )
    }
    if (files.length) {
      const { data, error } = await supabase
        .from("organization_document_files")
        .select("id, storage_path")
        .eq("org_id", next.workspaceId)
        .is("document_kind", null)
        .is("deleted_at", null)
        .in(
          "id",
          files.map((source) => source.id)
        )
        .abortSignal(AbortSignal.timeout(15_000))
      if (error)
        throw new ParticleMutationError(
          "unavailable",
          "Could not verify this file. Try again."
        )
      const available = new Set(
        (data ?? [])
          .filter(
            (row) =>
              row.storage_path.startsWith(`${next.workspaceId}/library/`) &&
              !row.storage_path.split("/").includes("..")
          )
          .map((row) => row.id)
      )
      if (files.some((source) => !available.has(source.id)))
        throw new ParticleMutationError(
          "scope",
          "This file is unavailable. Choose an available file from Documents."
        )
    }
    if (drive.length) {
      const { data, error } = await supabase
        .from("organization_external_documents")
        .select("id, web_view_link")
        .eq("org_id", next.workspaceId)
        .eq("provider", "google_drive")
        .eq("status", "available")
        .in(
          "id",
          drive.map((source) => source.id)
        )
        .abortSignal(AbortSignal.timeout(15_000))
      if (error)
        throw new ParticleMutationError(
          "unavailable",
          "Could not verify this Drive file. Try again."
        )
      const available = new Map(
        (data ?? []).map((row) => [row.id, row.web_view_link])
      )
      if (
        drive.some((source) => available.get(source.id) !== source.webViewLink)
      )
        throw new ParticleMutationError(
          "scope",
          "This Drive file is unavailable. Refresh it in Documents and try again."
        )
    }
  }
}
