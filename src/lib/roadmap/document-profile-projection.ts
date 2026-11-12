import { getOrganizationCoreDocumentKey, ORGANIZATION_CORE_DOCUMENT_SECTION_IDS } from "./organization-core-documents"
import type { RoadmapSection } from "./types"

/** Presentation only. Never use this projection for canonical profile/CAS writes. */
export function omitDocumentProfileSections(
  profile: Record<string, unknown>, sections: RoadmapSection[], roadmapSections: RoadmapSection[],
): Record<string, unknown> {
  const readableIds = new Set(roadmapSections.map(section => section.id))
  const blockedIds = new Set(sections.filter(section => !readableIds.has(section.id)).map(section => section.id))
  if (!blockedIds.size) return profile

  const projected = { ...profile }
  for (const key of Object.keys(projected)) {
    const documentKey = getOrganizationCoreDocumentKey(key)
    if (documentKey && blockedIds.has(ORGANIZATION_CORE_DOCUMENT_SECTION_IDS[documentKey])) delete projected[key]
  }
  const roadmap = profile.roadmap && typeof profile.roadmap === "object" && !Array.isArray(profile.roadmap)
    ? profile.roadmap as Record<string, unknown> : {}
  projected.roadmap = { ...roadmap, sections: roadmapSections }
  return projected
}
