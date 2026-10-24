import {
  ORGANIZATION_CORE_DOCUMENT_SECTION_IDS,
  type OrganizationCoreDocumentKey,
} from "./organization-core-documents"
import { resolveRoadmapSections } from "./sections"
import type { RoadmapSectionStatus } from "./types"

export type CoreDocumentPublication = Record<
  OrganizationCoreDocumentKey,
  { status: RoadmapSectionStatus; lastUpdated: string | null }
>
export type CoreDocumentPublicationPatch = Partial<Record<
  OrganizationCoreDocumentKey,
  { status?: RoadmapSectionStatus; lastUpdated: string | null }
>>

export function resolveCoreDocumentPublication(
  profile: Record<string, unknown> | null | undefined
): CoreDocumentPublication {
  const sections = resolveRoadmapSections(profile)
  return Object.fromEntries(
    Object.entries(ORGANIZATION_CORE_DOCUMENT_SECTION_IDS).map(([key, id]) => {
      const section = sections.find((item) => item.id === id)
      return [key, {
        status: section?.status ?? "not_started",
        lastUpdated: section?.lastUpdated ?? null,
      }]
    })
  ) as CoreDocumentPublication
}

// Send only fields the user changed. An unrelated profile save must never
// republish a document or overwrite a newer draft from the document editor.
export function prepareCoreDocumentProfileSave<T extends {
  coreDocumentPublication?: CoreDocumentPublication
} & Partial<Record<OrganizationCoreDocumentKey, string | null>>>(
  company: T,
  saved: T
): Omit<T, "coreDocumentPublication"> & {
  coreDocumentPublication?: CoreDocumentPublicationPatch
} {
  const { coreDocumentPublication, ...payload } = company
  const publication: CoreDocumentPublicationPatch = {}
  for (const key of Object.keys(ORGANIZATION_CORE_DOCUMENT_SECTION_IDS) as OrganizationCoreDocumentKey[]) {
    const contentChanged = company[key] !== saved[key]
    if (!contentChanged) delete payload[key]
    const next = coreDocumentPublication?.[key]
    const previous = saved.coreDocumentPublication?.[key]
    const statusChanged = next && next.status !== previous?.status
    if (next && (contentChanged || statusChanged)) {
      publication[key] = {
        lastUpdated: previous ? previous.lastUpdated : next.lastUpdated,
        ...(statusChanged ? { status: next.status } : {}),
      }
    }
  }
  return { ...payload, coreDocumentPublication: publication }
}
