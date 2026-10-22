import type { RefObject } from "react"

import type { RoadmapSection, RoadmapSectionStatus } from "@/lib/roadmap"

import type { RoadmapDraft, RoadmapEditorProps } from "../types"

export type UseRoadmapEditorStateArgs = Pick<
  RoadmapEditorProps,
  | "sourceScope"
  | "sections"
  | "publicSlug"
  | "canEdit"
  | "navigationMode"
  | "initialSectionId"
  | "onDirtyChange"
  | "onRegisterDiscard"
>

export type UseRoadmapEditorStateResult = {
  saveConflict:import("./use-roadmap-save").RoadmapSaveConflict | null
  resolveSaveConflict:(choice:"saved" | "reviewed" | "retry")=>void
  aiApplication: import("@/features/workspace-ai/client").AiDocumentApplication | null
  applyAiProposal: (proposal: import("@/features/workspace-ai/client").AiDocumentProposal) => boolean
  activeSection: RoadmapSection | undefined
  activeDraft: RoadmapDraft | null
  drafts: Record<string, RoadmapDraft>
  handleSectionSelect: (next: { id: string; slug: string }) => void
  roadmapBasePath: string
  headerTitle: string
  headerSubtitle: string
  showSectionHeader: boolean
  headerIconSize: number | null
  headerTextRef: RefObject<HTMLDivElement | null>
  status: RoadmapSectionStatus
  statusSelectDisabled: boolean
  isHydrated: boolean
  isCalendarSection: boolean
  isBudgetSection: boolean
  contentMaxWidth: string
  editorPlaceholder: string
  handleDraftChange: (updates: Partial<RoadmapDraft>) => void
  handleImageUpload: (file: File) => Promise<string>
  handleSave: () => void
  isDirty: boolean
  savingId: string | null
  handleStatusChange: (nextStatus: RoadmapSectionStatus) => void
}
