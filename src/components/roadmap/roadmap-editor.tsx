"use client"

import { useCoreDocumentAccess } from "@/features/document-editing/client"
import { resolveCoreDocumentSource } from "@/lib/roadmap/core-document-source"

import { RoadmapConflictReview } from "./roadmap-editor/components/roadmap-conflict-review"
import { useWorkspaceWindowHeaderActive } from "@/components/workspace/workspace-window-header-slots"
import { useEffect, useState } from "react"
import SparklesIcon from "lucide-react/dist/esm/icons/sparkles"
import { useMemo } from "react"
import { useAiDocumentBridge } from "@/features/workspace-ai/client"

import { ROADMAP_SECTION_ICONS } from "@/components/roadmap/roadmap-icons"
import { RoadmapEditorShell } from "@/components/roadmap/roadmap-editor/components"
import { useRoadmapEditorState } from "@/components/roadmap/roadmap-editor/hooks/use-roadmap-editor-state"
import type { RoadmapEditorProps } from "@/components/roadmap/roadmap-editor/types"

export type { RoadmapEditorLayout } from "@/components/roadmap/roadmap-editor/types"

export function RoadmapEditor(props: RoadmapEditorProps) {
  return <RoadmapEditorSession key={`${props.sourceScope?.userId}:${props.sourceScope?.organizationId}:${props.publicSlug}`} {...props} />
}

function RoadmapEditorSession(props: RoadmapEditorProps) {
  const access = useCoreDocumentAccess(props.sourceScope, props.sections.filter(section => section.id !== "calendar" && resolveCoreDocumentSource(section) === "editor").map(section => section.id))
  const canEdit = access.state === "ready" && access.canEdit && props.canEdit !== false
  const { onDirtyChange } = props
  const [legacyPending, setLegacyPending] = useState(false)
  const [collaborationPending, setCollaborationPending] = useState(false)
  useEffect(() => { onDirtyChange?.(legacyPending || collaborationPending) }, [onDirtyChange, legacyPending, collaborationPending])
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
    handleSavedSection,
  } = useRoadmapEditorState({ ...props, canEdit, onDirtyChange: setLegacyPending })

  const contextActive=useWorkspaceWindowHeaderActive()
  const aiTarget = useMemo(() => props.sourceScope && activeSection ? {
    ...props.sourceScope, sectionId: activeSection.id, title: activeSection.title, revision: activeSection.lastUpdated,
  } : null,[props.sourceScope,activeSection])
  useAiDocumentBridge(access.state === "ready" && contextActive && aiTarget && activeDraft && !isCalendarSection && !isBudgetSection && !activeSection?.driveSource && canEdit ? {
    target: aiTarget, content: activeDraft.content, dirty: isDirty, saving: Boolean(savingId), apply: applyAiProposal,application:aiApplication,
  } : null)

  if (access.state !== "ready") return <p role="status" className="text-muted-foreground p-3 text-sm">{access.state === "checking" ? "Checking access…" : "Document unavailable. Close and reopen to check access."}</p>

  if (!activeSection || !activeDraft) {
    return null
  }

  const SectionIcon = ROADMAP_SECTION_ICONS[activeSection.id] ?? SparklesIcon

  return (
    <>
    <RoadmapConflictReview key={`conflict:${props.sourceScope?.userId}:${props.sourceScope?.organizationId}:${activeSection.id}`} conflict={saveConflict} draft={activeDraft} onResolve={resolveSaveConflict} />
    <RoadmapEditorShell
      key={`editor:${props.sourceScope?.userId}:${props.sourceScope?.organizationId}:${activeSection.id}`}
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
      canEdit={canEdit}
      onStatusChange={handleStatusChange}
      onSavedSection={handleSavedSection}
      onCollaborationPending={setCollaborationPending}
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
