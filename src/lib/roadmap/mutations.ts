import { SECTION_MAP } from "./definitions"
import { normalizeRoadmapBudgetRows } from "./budget"
import {
  buildRoadmapSection,
  ensureUniqueSlugs,
  isRecord,
  normalizeText,
  serializeRoadmapSections,
  slugify,
} from "./helpers"
import { resolveRoadmapSections } from "./sections"
import type { RoadmapSection, RoadmapSectionStatus } from "./types"
import type { BudgetTableRow } from "@/lib/modules"
import { PUBLIC_ORGANIZATION_PROFILE_SECTION_IDS } from "./public-organization-profile-sections"
import { resolveLegacyPublicProfileSectionContent } from "./public-profile-publication-state"

export function updateRoadmapSection(
  profile: Record<string, unknown> | null | undefined,
  sectionId: string | null,
  updates: {
    title?: string
    subtitle?: string
    driveSource?: RoadmapSection["driveSource"]
    content?: string
    budgetRows?: BudgetTableRow[]
    imageUrl?: string | null
    isPublic?: boolean
    layout?: RoadmapSection["layout"]
    status?: RoadmapSectionStatus
    ctaLabel?: string
    ctaUrl?: string
  }
): { nextProfile: Record<string, unknown>; section: RoadmapSection } {
  const nextProfile = isRecord(profile) ? { ...profile } : {}
  const roadmapRecord = isRecord(nextProfile.roadmap)
    ? { ...(nextProfile.roadmap as Record<string, unknown>) }
    : {}

  const resolved = resolveRoadmapSections(nextProfile)
  const targetId = normalizeText(sectionId) || `section-${Date.now()}`
  const existingIndex = resolved.findIndex((section) => section.id === targetId)
  const now = new Date().toISOString()

  let nextSection: RoadmapSection
  let nextSections: RoadmapSection[]

  if (existingIndex >= 0) {
    const current = resolved[existingIndex]
    const templateTitle = current.templateTitle?.trim() ?? ""
    const templateSubtitle = current.templateSubtitle?.trim() ?? ""

    const nextTitleRaw =
      typeof updates.title === "string" ? updates.title.trim() : current.title
    const storedTitleIsTemplate =
      templateTitle.length > 0 && nextTitleRaw === templateTitle
    const effectiveTitle = storedTitleIsTemplate ? "" : nextTitleRaw
    const nextTitle = effectiveTitle || templateTitle || ""

    const nextSubtitleRaw =
      typeof updates.subtitle === "string"
        ? updates.subtitle.trim()
        : current.subtitle
    const storedSubtitleIsTemplate =
      templateSubtitle.length > 0 && nextSubtitleRaw === templateSubtitle
    const effectiveSubtitle = storedSubtitleIsTemplate ? "" : nextSubtitleRaw
    const nextSubtitle = effectiveSubtitle || templateSubtitle || ""

    const nextContent =
      typeof updates.content === "string"
        ? updates.content
        : current.content || (!current.publicProfileStatusControlled &&
            PUBLIC_ORGANIZATION_PROFILE_SECTION_IDS.has(current.id)
          ? resolveLegacyPublicProfileSectionContent(nextProfile, current)
          : "")
    const nextBudgetRows =
      updates.budgetRows === undefined
        ? (current.budgetRows ?? [])
        : normalizeRoadmapBudgetRows(updates.budgetRows)
    const nextImageUrlRaw =
      typeof updates.imageUrl === "string"
        ? updates.imageUrl.trim()
        : updates.imageUrl === null
          ? ""
          : (current.imageUrl ?? "")
    const nextImageUrl =
      nextImageUrlRaw.length > 0 ? nextImageUrlRaw : undefined
    const nextIsPublic =
      typeof updates.isPublic === "boolean"
        ? updates.isPublic
        : current.isPublic
    const nextLayout = updates.layout ?? current.layout
    const nextStatus = updates.status ?? current.status ?? "not_started"
    let nextPublishedContent = current.publishedContent
    let nextPublicProfileStatusControlled =
      current.publicProfileStatusControlled
    if (
      (updates.status !== undefined || updates.content !== undefined) &&
      PUBLIC_ORGANIZATION_PROFILE_SECTION_IDS.has(current.id)
    ) {
      nextPublicProfileStatusControlled = true
      // Draft and Not started unpublish immediately. Keep the editable content,
      // but never retain a second public copy behind an off switch.
      nextPublishedContent = undefined
    }
    const nextCtaLabel =
      typeof updates.ctaLabel === "string" ? updates.ctaLabel : current.ctaLabel
    const nextCtaUrl =
      typeof updates.ctaUrl === "string" ? updates.ctaUrl : current.ctaUrl
    const nextSlug =
      current.slug && current.slug.trim().length > 0
        ? current.slug
        : slugify(nextTitle) || current.id

    nextSection = {
      ...current,
      title: nextTitle,
      subtitle: nextSubtitle,
      content: nextContent,
      driveSource:
        updates.driveSource === undefined
          ? current.driveSource
          : updates.driveSource,
      documentSource:
        updates.driveSource === undefined
          ? current.documentSource
          : updates.driveSource
            ? "google_drive"
            : "editor",
      publishedContent: nextPublishedContent,
      publicProfileStatusControlled: nextPublicProfileStatusControlled,
      budgetRows: nextBudgetRows,
      imageUrl: nextImageUrl,
      isPublic: nextIsPublic,
      layout: nextLayout,
      status: nextStatus,
      ctaLabel: nextCtaLabel?.trim() || undefined,
      ctaUrl: nextCtaUrl?.trim() || undefined,
      slug: nextSlug,
      lastUpdated: now,
      templateTitle,
      templateSubtitle,
      titleIsTemplate: effectiveTitle.length === 0 && templateTitle.length > 0,
      subtitleIsTemplate:
        effectiveSubtitle.length === 0 && templateSubtitle.length > 0,
    }

    nextSections = resolved.map((section, index) =>
      index === existingIndex ? nextSection : section
    )
  } else {
    const base = SECTION_MAP.get(targetId) ?? null
    const nextTitle = normalizeText(updates.title) || base?.title || ""
    const nextSubtitle = normalizeText(updates.subtitle) || base?.subtitle || ""
    const nextContent =
      typeof updates.content === "string" ? updates.content : ""
    const nextBudgetRows = normalizeRoadmapBudgetRows(updates.budgetRows)
    const nextImageUrlRaw =
      typeof updates.imageUrl === "string"
        ? updates.imageUrl.trim()
        : updates.imageUrl === null
          ? ""
          : ""
    const nextImageUrl =
      nextImageUrlRaw.length > 0 ? nextImageUrlRaw : undefined
    const nextIsPublic =
      typeof updates.isPublic === "boolean" ? updates.isPublic : false
    const nextLayout = updates.layout ?? "square"
    const nextStatus =
      typeof updates.status === "string" &&
      ["not_started", "in_progress", "complete"].includes(updates.status)
        ? (updates.status as RoadmapSectionStatus)
        : nextContent.trim().length > 0
          ? "in_progress"
          : "not_started"
    const controlsPublicProfile =
      (updates.status !== undefined || updates.content !== undefined) &&
      PUBLIC_ORGANIZATION_PROFILE_SECTION_IDS.has(targetId)
    const nextCtaLabel =
      typeof updates.ctaLabel === "string" ? updates.ctaLabel : undefined
    const nextCtaUrl =
      typeof updates.ctaUrl === "string" ? updates.ctaUrl : undefined
    const nextSlug = slugify(nextTitle) || targetId

    nextSection = {
      ...buildRoadmapSection(
        {
          id: targetId,
          title: nextTitle,
          subtitle: nextSubtitle,
          slug: nextSlug,
          content: nextContent,
          driveSource: updates.driveSource,
          publicProfileStatusControlled: controlsPublicProfile || undefined,
          budgetRows: nextBudgetRows,
          imageUrl: nextImageUrl,
          isPublic: nextIsPublic,
          layout: nextLayout,
          status: nextStatus,
          ctaLabel: nextCtaLabel,
          ctaUrl: nextCtaUrl,
          lastUpdated: now,
        },
        base,
        resolved.length
      ),
      lastUpdated: now,
    }

    nextSections = [...resolved, nextSection]
  }

  nextSections = ensureUniqueSlugs(nextSections)
  const updatedSection =
    nextSections.find((section) => section.id === nextSection.id) ?? nextSection

  roadmapRecord.sections = serializeRoadmapSections(nextSections)
  nextProfile.roadmap = roadmapRecord

  return {
    nextProfile,
    section: updatedSection,
  }
}

export function removeRoadmapSection(
  profile: Record<string, unknown> | null | undefined,
  sectionId: string | null | undefined
): {
  nextProfile: Record<string, unknown>
  sections: RoadmapSection[]
  removed: boolean
  error?: string
} {
  const nextProfile = isRecord(profile) ? { ...profile } : {}
  const roadmapRecord = isRecord(nextProfile.roadmap)
    ? { ...(nextProfile.roadmap as Record<string, unknown>) }
    : {}
  const resolved = resolveRoadmapSections(nextProfile)
  const targetId = normalizeText(sectionId)

  if (!targetId) {
    return {
      nextProfile,
      sections: resolved,
      removed: false,
      error: "Missing section id.",
    }
  }

  if (resolved.length <= 1) {
    return {
      nextProfile,
      sections: resolved,
      removed: false,
      error: "At least one section is required.",
    }
  }

  const nextSections = resolved.filter((section) => section.id !== targetId)

  if (nextSections.length === resolved.length) {
    return {
      nextProfile,
      sections: resolved,
      removed: false,
      error: "Section not found.",
    }
  }

  const updatedSections = ensureUniqueSlugs(nextSections)
  roadmapRecord.sections = serializeRoadmapSections(updatedSections)
  nextProfile.roadmap = roadmapRecord

  return { nextProfile, sections: updatedSections, removed: true }
}
