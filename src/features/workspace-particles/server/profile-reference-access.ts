import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase"
import { DOCUMENTS } from "@/lib/organization/core-document-definitions"
import { resolveRoadmapSections } from "@/lib/roadmap/sections"
import type { ParticleDocumentSource } from "../lib/particle-library-document"
import { ParticleMutationError } from "../lib/authorized-mutation"

export type ProfileParticleSource = Extract<
  ParticleDocumentSource,
  { kind: "upload" | "policy" | "roadmap" | "roadmap_drive" }
> | { kind: "person"; id: string }
const personReference = z.object({ id: z.string().uuid() })
const documentPath = z.object({ path: z.string().min(1) })
const policyDocument = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1),
  document: documentPath,
})

function validPath(path: string, prefix: string) {
  return path.startsWith(prefix) && !path.split("/").includes("..")
}

/** Resolve references from the existing profile owner, without signing URLs or
 * copying content into the graph. Read-time authorization remains mandatory. */
export async function assertProfileParticleSourceAccess(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  sources: readonly ProfileParticleSource[]
) {
  if (!sources.length) return
  const personOnly = sources.every((source) => source.kind === "person")
  const unavailableMessage = personOnly
    ? "This person is unavailable. Refresh People and try again."
    : "This source is unavailable. Choose an available source."
  const { data, error } = await supabase
    .from("organizations")
    .select("profile")
    .eq("user_id", workspaceId)
    .abortSignal(AbortSignal.timeout(15_000))
    .maybeSingle()
  if (error)
    throw new ParticleMutationError(
      "unavailable",
      "Could not verify this source. Try again."
    )
  const profile = data?.profile
  if (!profile || typeof profile !== "object" || Array.isArray(profile))
    throw new ParticleMutationError(
      "scope",
      unavailableMessage
    )
  const documents = profile.documents
  const policies = Array.isArray(profile.policies) ? profile.policies : []
  const people = new Set(
    (Array.isArray(profile.org_people) ? profile.org_people : []).flatMap((item) => {
      const parsed = personReference.safeParse(item)
      return parsed.success ? [parsed.data.id] : []
    })
  )
  const sections = sources.some((source) => source.kind === "roadmap" || source.kind === "roadmap_drive")
    ? resolveRoadmapSections(profile)
    : []
  for (const source of sources) {
    let available = false
    if (source.kind === "person") {
      available = people.has(source.id)
    } else if (source.kind === "upload") {
      const definition = DOCUMENTS.find(
        (item) => item.kind === source.documentKind
      )
      const parsed = documentPath.safeParse(
        definition &&
          documents &&
          typeof documents === "object" &&
          !Array.isArray(documents)
          ? documents[definition.key]
          : null
      )
      available = Boolean(
        definition &&
        parsed.success &&
        validPath(parsed.data.path, `${workspaceId}/${definition.key}/`)
      )
    } else if (source.kind === "policy") {
      available = policies.some((item) => {
        const parsed = policyDocument.safeParse(item)
        return (
          parsed.success &&
          parsed.data.id === source.id &&
          validPath(
            parsed.data.document.path,
            `${workspaceId}/policies/${source.id}/`
          )
        )
      })
    } else {
      available = sections.some(
        (section) =>
          (section.id === source.sectionId || section.slug === source.sectionId) &&
          (source.kind !== "roadmap_drive" || (
            section.documentSource !== "editor" &&
            section.driveSource?.fileId === source.fileId &&
            section.driveSource.webViewLink === source.webViewLink
          ))
      )
    }
    if (!available)
      throw new ParticleMutationError(
        "scope",
        unavailableMessage
      )
  }
}
