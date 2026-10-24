import { ROADMAP_SECTION_IDS } from "@/lib/roadmap"
import {
  hasMeaningfulRoadmapBudgetRows,
  normalizeRoadmapBudgetRows,
  roadmapBudgetRowsEqual,
} from "@/lib/roadmap/budget"
import { resolveRoadmapSectionDerivedStatus } from "@/lib/roadmap/helpers"
import type { RoadmapSection, RoadmapSectionStatus } from "@/lib/roadmap"

import {
  DEFAULT_PLACEHOLDER,
  ROADMAP_DRAFT_STORAGE_VERSION,
  ROADMAP_TOC_GROUPS,
} from "./constants"
import type { RoadmapDraft, RoadmapDraftStorage, RoadmapTocItem } from "./types"

const ROADMAP_SECTION_ORDER = new Map<string, number>(
  ROADMAP_SECTION_IDS.map((id, index) => [id, index])
)

export function isFrameworkSection(section: RoadmapSection) {
  return ROADMAP_SECTION_ORDER.has(section.id)
}

export function createDraft(section: RoadmapSection): RoadmapDraft {
  return {
    id: section.id,
    title: section.titleIsTemplate ? "" : section.title,
    subtitle: section.subtitleIsTemplate ? "" : (section.subtitle ?? ""),
    content: section.content ?? "",
    budgetRows: section.budgetRows ?? [],
    imageUrl: section.imageUrl ?? "",
    layout: section.layout ?? "square",
    ctaLabel: section.ctaLabel,
    ctaUrl: section.ctaUrl,
    slug: section.slug,
    lastUpdated: section.lastUpdated ?? null,
    placeholder: section.prompt ?? section.placeholder ?? DEFAULT_PLACEHOLDER,
  }
}

export function createDraftMap(
  sections: RoadmapSection[]
): Record<string, RoadmapDraft> {
  return Object.fromEntries(
    sections.map((section) => [section.id, createDraft(section)] as const)
  )
}

type RoadmapSectionBaseline = {
  title: string
  subtitle: string
  content: string
  budgetRows: RoadmapDraft["budgetRows"]
  imageUrl: string
}

export function getRoadmapSectionBaseline(
  section: RoadmapSection
): RoadmapSectionBaseline {
  return {
    title: section.titleIsTemplate ? "" : section.title,
    subtitle: section.subtitleIsTemplate ? "" : (section.subtitle ?? ""),
    content: section.content ?? "",
    budgetRows: section.budgetRows ?? [],
    imageUrl: section.imageUrl ?? "",
  }
}

export function isRoadmapDraftDirty(
  section: RoadmapSection,
  draft: RoadmapDraft
): boolean {
  const baseline = getRoadmapSectionBaseline(section)
  return (
    draft.requiresPrivateSave === true ||
    draft.title !== baseline.title ||
    draft.subtitle !== baseline.subtitle ||
    draft.content !== baseline.content ||
    !roadmapBudgetRowsEqual(draft.budgetRows, baseline.budgetRows) ||
    draft.imageUrl !== baseline.imageUrl
  )
}

function timestampMs(value: unknown): number | null {
  if (typeof value !== "string") return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function latestSectionUpdatedAtMs(sections: RoadmapSection[]): number | null {
  const latest = sections.reduce((max, section) => {
    const parsed = timestampMs(section.lastUpdated)
    return parsed === null ? max : Math.max(max, parsed)
  }, 0)
  return latest > 0 ? latest : null
}

function hasSavedSectionValue(section: RoadmapSection): boolean {
  return (
    section.content.trim().length > 0 ||
    hasMeaningfulRoadmapBudgetRows(section.budgetRows ?? []) ||
    (section.imageUrl?.trim().length ?? 0) > 0 ||
    (!section.titleIsTemplate && section.title.trim().length > 0) ||
    (!section.subtitleIsTemplate && (section.subtitle ?? "").trim().length > 0)
  )
}

function isBlankStoredDraft(
  draft: RoadmapDraftStorage["drafts"][string]
): boolean {
  return (
    [draft.title, draft.subtitle, draft.content, draft.imageUrl].every(
      (value) => typeof value !== "string" || value.trim().length === 0
    ) &&
    !hasMeaningfulRoadmapBudgetRows(
      normalizeRoadmapBudgetRows(draft.budgetRows)
    )
  )
}

export function buildRoadmapTocItems(
  sections: RoadmapSection[]
): RoadmapTocItem[] {
  const sectionMap = new Map(sections.map((section) => [section.id, section]))
  const items: RoadmapTocItem[] = []
  const seen = new Set<string>()

  ROADMAP_TOC_GROUPS.forEach((group) => {
    const section = sectionMap.get(group.id)
    if (!section) return
    seen.add(section.id)
    if (group.children?.length) {
      const children = group.children
        .map((childId) => sectionMap.get(childId))
        .filter((child): child is RoadmapSection => Boolean(child))
      children.forEach((child) => seen.add(child.id))
      items.push({ type: "group", section, depth: 0, children })
      return
    }
    items.push({ type: "item", section, depth: 0 })
  })

  sections.forEach((section) => {
    if (seen.has(section.id)) return
    items.push({ type: "item", section, depth: 0 })
  })

  return items
}

export function loadRoadmapDraftsFromStorage(
  storageKey: string,
  sections: RoadmapSection[]
): Record<string, RoadmapDraft> {
  const next = createDraftMap(sections)
  if (typeof window === "undefined") return next

  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return next

    const parsed = JSON.parse(raw) as RoadmapDraftStorage
    if (parsed?.version !== ROADMAP_DRAFT_STORAGE_VERSION || !parsed.drafts) {
      return next
    }
    const storageUpdatedAtMs = timestampMs(parsed.updatedAt)
    const latestServerUpdatedAtMs = latestSectionUpdatedAtMs(sections)
    const serverIsNewer = storageUpdatedAtMs !== null && latestServerUpdatedAtMs !== null && storageUpdatedAtMs < latestServerUpdatedAtMs

    sections.forEach((section) => {
      const draft = parsed.drafts[section.id]
      if (!draft || (serverIsNewer && !draft.aiRunId && draft.lastUpdated === undefined)) return
      if (!draft.aiRunId && hasSavedSectionValue(section) && isBlankStoredDraft(draft)) return
      next[section.id] = {
        ...next[section.id],
        title: draft.title ?? next[section.id].title,
        subtitle: draft.subtitle ?? next[section.id].subtitle,
        content: draft.content ?? next[section.id].content,
        budgetRows:
          draft.budgetRows === undefined
            ? next[section.id].budgetRows
            : normalizeRoadmapBudgetRows(draft.budgetRows),
        imageUrl: draft.imageUrl ?? next[section.id].imageUrl,
        requiresPrivateSave: draft.requiresPrivateSave === true,
        aiRunId: typeof draft.aiRunId === "string" ? draft.aiRunId : undefined,
        reviewedAiRevision:typeof draft.reviewedAiRevision === "string" ? draft.reviewedAiRevision : undefined,
        lastUpdated:typeof draft.lastUpdated === "string" || draft.lastUpdated === null ? draft.lastUpdated : next[section.id].lastUpdated,
      }
    })
  } catch {
    return next
  }

  return next
}

export function persistRoadmapDraftsToStorage({
  storageKey,
  sections,
  drafts,
}: {
  storageKey: string
  sections: RoadmapSection[]
  drafts: Record<string, RoadmapDraft>
}): void {
  if (typeof window === "undefined") return

  const payload: RoadmapDraftStorage = {
    version: ROADMAP_DRAFT_STORAGE_VERSION,
    updatedAt: new Date().toISOString(),
    drafts: {},
  }

  sections.forEach((section) => {
    const draft = drafts[section.id]
    if (!draft || !isRoadmapDraftDirty(section, draft)) return
    payload.drafts[section.id] = {
      title: draft.title,
      subtitle: draft.subtitle,
      content: draft.content,
      budgetRows: draft.budgetRows,
      imageUrl: draft.imageUrl,
      requiresPrivateSave: draft.requiresPrivateSave === true,
      aiRunId:draft.aiRunId,
      reviewedAiRevision:draft.reviewedAiRevision,
      lastUpdated:draft.lastUpdated,
    }
  })

  if (Object.keys(payload.drafts).length === 0) {
    window.localStorage.removeItem(storageKey)
    return
  }

  window.localStorage.setItem(storageKey, JSON.stringify(payload))
}

export function resolveRoadmapSectionStatus(
  section: RoadmapSection,
  draft?: RoadmapDraft | null
): RoadmapSectionStatus {
  if (section.status === "complete") return "complete"
  if (
    draft &&
    (draft.content.trim().length > 0 ||
      hasMeaningfulRoadmapBudgetRows(draft.budgetRows) ||
      draft.title.trim().length > 0 ||
      draft.subtitle.trim().length > 0 ||
      draft.imageUrl.trim().length > 0) &&
    isRoadmapDraftDirty(section, draft)
  ) {
    return "in_progress"
  }
  return resolveRoadmapSectionDerivedStatus(section)
}
