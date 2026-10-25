import {
  normalizeOrganizationNarrativeHtml,
  resolveLegacyOrganizationNarratives,
} from "./organization-narratives"
import { PUBLIC_ORGANIZATION_PROFILE_SECTION_IDS } from "./public-organization-profile-sections"
import { resolveRoadmapSections } from "./sections"
import { resolveLegacyPublicProfileSectionContent } from "./public-profile-publication-state"

export { PUBLIC_ORGANIZATION_PROFILE_SECTION_IDS }

export type PublicOrganizationProfileNarratives = {
  originStory: string
  needStatement: string
  mission: string
  vision: string
  values: string
  theoryOfChange: string
}

function readLegacyProfileString(
  profile: Record<string, unknown>,
  ...keys: string[]
) {
  for (const key of keys) {
    const value = profile[key]
    if (typeof value !== "string") continue
    const trimmed = value.trim()
    if (trimmed) return trimmed
  }
  return ""
}

export function resolvePublicOrganizationProfileNarratives(
  profile: Record<string, unknown> | null | undefined
): PublicOrganizationProfileNarratives {
  const normalizedProfile = profile ?? {}
  const sectionById = new Map(
    resolveRoadmapSections(normalizedProfile).map((section) => [
      section.id,
      section,
    ])
  )
  const legacyNarratives =
    resolveLegacyOrganizationNarratives(normalizedProfile)

  const resolveSection = (sectionId: string, legacyValue: string) => {
    const section = sectionById.get(sectionId)
    if (section?.publicProfileStatusControlled) {
      return normalizeOrganizationNarrativeHtml(
        section.status === "complete" ? section.content : ""
      )
    }
    if (!section || section.lastUpdated === null) {
      return normalizeOrganizationNarrativeHtml(legacyValue)
    }
    const content = resolveLegacyPublicProfileSectionContent(normalizedProfile, section)
    return normalizeOrganizationNarrativeHtml(content)
  }

  return {
    originStory: resolveSection(
      "origin_story",
      readLegacyProfileString(normalizedProfile, "origin_story", "originStory")
    ),
    needStatement: resolveSection(
      "need",
      readLegacyProfileString(
        normalizedProfile,
        "need",
        "needStatement",
        "need_statement"
      )
    ),
    mission: resolveSection("mission_vision_values", legacyNarratives.mission),
    vision: resolveSection("vision", legacyNarratives.vision),
    values: resolveSection("values", legacyNarratives.values),
    theoryOfChange: resolveSection(
      "theory_of_change",
      readLegacyProfileString(
        normalizedProfile,
        "theory_of_change",
        "theoryOfChange"
      )
    ),
  }
}
