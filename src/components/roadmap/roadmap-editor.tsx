"use client"

import { RoadmapConflictReview } from "./roadmap-editor/components/roadmap-conflict-review"
import SparklesIcon from "lucide-react/dist/esm/icons/sparkles"
import { useMemo } from "react"
import { useAiDocumentBridge } from "@/features/workspace-ai/client"

import { ROADMAP_SECTION_ICONS } from "@/components/roadmap/roadmap-icons"
import { RoadmapEditorShell } from "@/components/roadmap/roadmap-editor/components"
import { useRoadmapEditorState } from "@/components/roadmap/roadmap-editor/hooks/use-roadmap-editor-state"
import type { RoadmapEditorProps } from "@/components/roadmap/roadmap-editor/types"

export type { RoadmapEditorLayout } from "@/components/roadmap/roadmap-editor/types"

export function RoadmapEditor(props: RoadmapEditorProps) {
  const {
    activeSection,
    activeDraft,
    drafts,
    handleSectionSelect,
    roadmapBasePath,
    headerTitle,
    headerSubtitle,
    showSectionHeader,
    headerIconSize,
    headerTextRef,
    status,
    statusSelectDisabled,
    isHydrated,
    isCalendarSection,
    isBudgetSection,
    contentMaxWidth,
    editorPlaceholder,
    handleDraftChange,
    handleImageUpload,
    handleSave,
    isDirty,
    savingId,
    handleStatusChange,
    applyAiProposal,
    aiApplication,
    saveConflict,
    resolveSaveConflict,
  } = useRoadmapEditorState(props)

  const aiTarget = useMemo(() => props.sourceScope && activeSection ? {
    ...props.sourceScope, sectionId: activeSection.id, title: activeSection.title, revision: activeSection.lastUpdated,
  } : null,[props.sourceScope,activeSection])
  useAiDocumentBridge(aiTarget && activeDraft && !isCalendarSection && !isBudgetSection && !activeSection?.driveSource && props.canEdit !== false ? {
    target: aiTarget, content: activeDraft.content, dirty: isDirty, saving: Boolean(savingId), apply: applyAiProposal,application:aiApplication,
  } : null)

  if (!activeSection || !activeDraft) {
    return null
  }

  const SectionIcon = ROADMAP_SECTION_ICONS[activeSection.id] ?? SparklesIcon

  return (
    <>
    <RoadmapConflictReview key={`${props.sourceScope?.userId}:${props.sourceScope?.organizationId}:${activeSection.id}`} conflict={saveConflict} draft={activeDraft} onResolve={resolveSaveConflict} />
    <RoadmapEditorShell
      key={`${props.sourceScope?.userId}:${props.sourceScope?.organizationId}:${activeSection.id}`}
      sourceScope={props.sourceScope}
      sections={props.sections}
      activeSection={activeSection}
      drafts={drafts}
      roadmapBasePath={roadmapBasePath}
      onSectionSelect={handleSectionSelect}
      showRightRail={props.showRightRail ?? true}
      headerTitle={headerTitle}
      headerSubtitle={headerSubtitle}
      showSectionHeader={showSectionHeader}
      headerIconSize={headerIconSize}
      headerTextRef={headerTextRef}
      status={status}
      canEdit={props.canEdit ?? true}
      onStatusChange={handleStatusChange}
      statusSelectDisabled={statusSelectDisabled}
      isHydrated={isHydrated}
      isCalendarSection={isCalendarSection}
      isBudgetSection={isBudgetSection}
      contentMaxWidth={contentMaxWidth}
      activeDraft={activeDraft}
      editorPlaceholder={editorPlaceholder}
      onDraftChange={handleDraftChange}
      onImageUpload={handleImageUpload}
      onSave={handleSave}
      isDirty={isDirty}
      savingId={savingId}
      sectionIcon={SectionIcon}
    />
    </>
  )
}
