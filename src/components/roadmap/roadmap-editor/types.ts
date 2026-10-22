import type { RoadmapSection, RoadmapSectionStatus } from "@/lib/roadmap"
import type { BudgetTableRow } from "@/lib/modules"

export type RoadmapEditorLayout = "default" | "centered-right"
export type RoadmapEditorNavigationMode = "route" | "embedded"

export type RoadmapEditorProps = {
  sourceScope?: import("@/components/roadmap/core-document-source/use-core-document-source").CoreDocumentScope
  sections: RoadmapSection[]
  publicSlug: string | null
  canEdit?: boolean
  layout?: RoadmapEditorLayout
  navigationMode?: RoadmapEditorNavigationMode
  showRightRail?: boolean
  initialSectionId?: string | null
  onDirtyChange?: (dirty: boolean) => void
  onRegisterDiscard?: (handler: (() => void) | null) => void
}

export type RoadmapDraft = {
  aiRunId?: string
  requiresPrivateSave?: boolean
  id: string
  title: string
  subtitle: string
  content: string
  budgetRows: BudgetTableRow[]
  imageUrl: string
  layout: RoadmapSection["layout"]
  ctaLabel?: string
  ctaUrl?: string
  slug: string
  lastUpdated: string | null
  placeholder?: string
  status?: RoadmapSectionStatus
}

export type RoadmapDraftStorage = {
  version: number
  updatedAt: string
  drafts: Record<
    string,
    {
      title?: string
      subtitle?: string
      content?: string
      budgetRows?: BudgetTableRow[]
      imageUrl?: string
      aiRunId?: string
      requiresPrivateSave?: boolean
    }
  >
}

export type RoadmapTocItem =
  | { type: "item"; section: RoadmapSection; depth: number }
  | {
      type: "group"
      section: RoadmapSection
      depth: number
      children: RoadmapSection[]
    }
