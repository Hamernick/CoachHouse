import { PUBLIC_ORGANIZATION_PROFILE_SECTION_IDS } from "./public-organization-profile-sections"
import { resolveLegacyPublicProfileSectionContent } from "./public-profile-publication-state"

import { SECTION_DEFINITIONS, SECTION_MAP } from "./definitions"
import {
  buildRoadmapSection,
  defaultRoadmapSections,
  ensureUniqueSlugs,
  getStoredRoadmap,
  isRecord,
  normalizeText,
  shouldRemoveTestSection,
} from "./helpers"
import type { RoadmapSection, StoredSection } from "./types"

function resolveStoredRoadmapSections(
  profile: Record<string, unknown> | null | undefined,
): RoadmapSection[] {
  const storedRoadmap = getStoredRoadmap(profile)
  const rawSections = storedRoadmap.sections

  if (Array.isArray(rawSections)) {
    const entries = rawSections
      .map((entry) => (isRecord(entry) ? (entry as StoredSection) : null))
      .filter((entry): entry is StoredSection => Boolean(entry))

    const storedById = new Map<string, StoredSection>()
    const customEntries: StoredSection[] = []

    entries.forEach((entry) => {
      if (shouldRemoveTestSection(entry)) return
      const id = normalizeText(entry?.id)
      if (!id) return
      if (SECTION_MAP.has(id)) {
        storedById.set(id, entry)
      } else {
        customEntries.push(entry)
      }
    })

    const frameworkSections = SECTION_DEFINITIONS.map((definition, index) =>
      buildRoadmapSection(storedById.get(definition.id), definition, index),
    )
    const customSections = customEntries.map((entry, index) =>
      buildRoadmapSection(entry, null, SECTION_DEFINITIONS.length + index),
    )
    const merged = [...frameworkSections, ...customSections]

    if (merged.length > 0) {
      return ensureUniqueSlugs(merged)
    }
  }

  if (isRecord(rawSections)) {
    const sections = SECTION_DEFINITIONS.map((definition, index) =>
      buildRoadmapSection(
        rawSections[definition.id] as StoredSection | undefined,
        definition,
        index,
      ),
    )
    return ensureUniqueSlugs(sections)
  }

  return ensureUniqueSlugs(defaultRoadmapSections())
}

// Legacy profile text was already public. Reflect that in both editors until
// the organization explicitly changes its publication status; no data rewrite.
export function resolveRoadmapSections(
  profile: Record<string, unknown> | null | undefined
): RoadmapSection[] {
  return resolveStoredRoadmapSections(profile).map((section) => {
    if (!section.publicProfileStatusControlled &&
      PUBLIC_ORGANIZATION_PROFILE_SECTION_IDS.has(section.id) &&
      resolveLegacyPublicProfileSectionContent(profile ?? {}, section).trim()) {
      return { ...section, status: "complete" }
    }
    return section
  })
}

export function cleanupRoadmapTestSections(
  profile: Record<string, unknown> | null | undefined,
): {
  nextProfile: Record<string, unknown>
  changed: boolean
} {
  const nextProfile = isRecord(profile) ? { ...profile } : {}
  const roadmapRecord = isRecord(nextProfile.roadmap)
    ? { ...(nextProfile.roadmap as Record<string, unknown>) }
    : {}
  const rawSections = roadmapRecord.sections
  let changed = false

  if (Array.isArray(rawSections)) {
    const filtered = rawSections.filter((entry) => {
      if (!isRecord(entry)) return true
      return !shouldRemoveTestSection(entry as StoredSection)
    })
    if (filtered.length !== rawSections.length) {
      roadmapRecord.sections = filtered
      changed = true
    }
  } else if (isRecord(rawSections)) {
    const nextSections = { ...(rawSections as Record<string, unknown>) }
    for (const [key, value] of Object.entries(nextSections)) {
      if (!isRecord(value)) {
        if (shouldRemoveTestSection(undefined, key)) {
          delete nextSections[key]
          changed = true
        }
        continue
      }
      if (shouldRemoveTestSection(value as StoredSection, key)) {
        delete nextSections[key]
        changed = true
      }
    }
    if (changed) {
      roadmapRecord.sections = nextSections
    }
  }

  if (!changed) {
    return { nextProfile, changed }
  }

  nextProfile.roadmap = roadmapRecord
  return { nextProfile, changed }
}

export function resolveRoadmapHeroUrl(
  profile: Record<string, unknown> | null | undefined,
): string | null {
  const storedRoadmap = getStoredRoadmap(profile)
  const heroUrl = storedRoadmap.heroUrl
  if (typeof heroUrl !== "string") return null
  const trimmed = heroUrl.trim()
  return trimmed.length > 0 ? trimmed : null
}
