"use client"

import { organizationDocumentCollaborationEnabled } from "@/lib/feature-flags"
import { OrganizationDocumentCollaborationPanel } from "@/features/organization-document-collaboration/client"
import { useState, type ComponentType, type RefObject } from "react"
import type { RichTextEditorProps } from "@/components/rich-text-editor/types"
import LoaderCircle from "lucide-react/dist/esm/icons/loader-circle"
import { GoogleDriveMark } from "@/components/roadmap/core-document-source/google-drive-mark"
import { LinkedDriveDocumentEditor } from "@/components/roadmap/core-document-source/linked-drive-document-editor"
import {
  useCoreDocumentSource,
  type CoreDocumentScope,
} from "@/components/roadmap/core-document-source/use-core-document-source"

import { RightRailSlot } from "@/components/app-shell/right-rail"
import { RoadmapRightRailSection } from "@/components/roadmap/roadmap-right-rail-section"
import { Button } from "@/components/ui/button"
import { RoadmapBudgetTableEditor } from "@/components/roadmap/roadmap-budget-table-editor"
import { RoadmapCalendar } from "@/components/roadmap/roadmap-calendar"
import { RoadmapSectionPanel } from "@/components/roadmap/roadmap-section-panel"
import type { RoadmapSection, RoadmapSectionStatus } from "@/lib/roadmap"
import { PUBLIC_ORGANIZATION_PROFILE_SECTION_IDS } from "@/lib/roadmap/public-organization-profile-sections"

import { ROADMAP_TOOLBAR_ID } from "../constants"
import type { RoadmapDraft } from "../types"
import { RoadmapEditorBreadcrumb } from "./roadmap-editor-breadcrumb"

type RoadmapEditorShellProps = {
  sourceScope?: CoreDocumentScope
  sections: RoadmapSection[]
  activeSection: RoadmapSection
  drafts: Record<string, RoadmapDraft>
  roadmapBasePath: string
  onSectionSelect: (next: { id: string; slug: string }) => void
  showRightRail: boolean
  headerTitle: string
  headerSubtitle: string
  showSectionHeader: boolean
  headerIconSize: number | null
  headerTextRef: RefObject<HTMLDivElement | null>
  status: RoadmapSectionStatus
  canEdit: boolean
  onCollaborationPending: (pending: boolean) => void
  onSavedSection: (section: RoadmapSection) => void
  onStatusChange: (nextStatus: RoadmapSectionStatus) => void
  statusSelectDisabled: boolean
  isHydrated: boolean
  isCalendarSection: boolean
  isBudgetSection: boolean
  contentMaxWidth: string
  activeDraft: RoadmapDraft
  editorPlaceholder: string
  onDraftChange: (updates: Partial<RoadmapDraft>) => void
  onImageUpload: (file: File) => Promise<string>
  onSave: () => void
  isDirty: boolean
  savingId: string | null
  sectionIcon: ComponentType<{ className?: string }>
}

export function RoadmapEditorShell({
  sourceScope,
  sections,
  activeSection,
  drafts,
  roadmapBasePath,
  onSectionSelect,
  showRightRail,
  headerTitle,
  headerSubtitle,
  showSectionHeader,
  headerIconSize,
  headerTextRef,
  status,
  canEdit,
  onStatusChange,
  onSavedSection,
  onCollaborationPending,
  statusSelectDisabled,
  isHydrated,
  isCalendarSection,
  isBudgetSection,
  contentMaxWidth,
  activeDraft,
  editorPlaceholder,
  onDraftChange,
  onImageUpload,
  onSave,
  isDirty,
  savingId,
  sectionIcon: SectionIcon,
}: RoadmapEditorShellProps) {
  const [livePending, setLivePending] = useState(false)
  const [sourceOverride, setSourceOverride] = useState<RoadmapSection | null>(
    null
  )
  const source = useCoreDocumentSource(sourceScope, setSourceOverride)
  const sourceSection =
    sourceOverride?.id === activeSection.id &&
    (sourceOverride.lastUpdated ?? "") >= (activeSection.lastUpdated ?? "")
      ? sourceOverride
      : activeSection
  const linked = sourceSection.driveSource
  function chooseDrive() {
    if (
      (isDirty || livePending) &&
      !window.confirm(
        "You have unsaved changes. Link a Google Drive document instead? Your saved editor draft will be kept."
      )
    )
      return
    void source.change(sourceSection, "drive")
  }
  const controlsPublicProfile = PUBLIC_ORGANIZATION_PROFILE_SECTION_IDS.has(
    activeSection.id
  )

  const editorProps: RichTextEditorProps | undefined = isCalendarSection || isBudgetSection
              ? undefined
              : {
                  toolbarActions:
                    canEdit && sourceScope ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-11 sm:size-8"
                        onClick={chooseDrive}
                        disabled={source.pending}
                        aria-label="Choose from Google Drive"
                        aria-busy={source.pending}
                        title="Choose from Google Drive"
                      >
                        {source.pending
                          ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                          : <GoogleDriveMark />}
                      </Button>
                    ) : undefined,
                  value: activeDraft.content,
                  onChange: (value) => onDraftChange({ content: value }),
                  readOnly: !canEdit,
                  placeholder: editorPlaceholder,
                  countClassName:
                    "bg-[#f5f5f5] px-4 py-2 text-xs text-muted-foreground dark:bg-[#1c1c1c]",
                  contentClassName:
                    "flex-1 min-h-0 overflow-y-auto overscroll-contain bg-[#fafafa] dark:bg-[#171717] rounded-none",
                  onImageUpload: canEdit ? onImageUpload : undefined,
                  insertUploadedImage: true,
                  disableResize: true,
                  toolbarTrailingActions: canEdit ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={onSave}
                      disabled={statusSelectDisabled || !isDirty}
                      className="text-muted-foreground hover:text-foreground gap-2"
                    >
                      {savingId === activeSection.id
                        ? "Saving…"
                        : isDirty
                          ? "Save"
                          : "Saved"}
                    </Button>
                  ) : null,
                  toolbarPortalId: ROADMAP_TOOLBAR_ID,
                  toolbarClassName:
                    "flex-nowrap gap-0.5 overflow-x-auto overscroll-x-contain rounded-xl border border-border/60 bg-background/80 py-1 shadow-none sm:gap-0.5 [&>div]:shrink-0 [&_button]:min-h-11 [&_button]:min-w-11 sm:[&_button]:min-h-8 sm:[&_button]:min-w-8 [&_[data-toolbar-menu-trigger]]:gap-0.5 [&_[data-toolbar-menu-trigger]]:has-[>svg]:px-1 sm:[&_[data-toolbar-menu-trigger]]:has-[>svg]:px-1.5",
                  className:
                    "flex h-full min-h-0 flex-1 flex-col bg-card shadow-none dark:bg-[#1f1f1f]",
                  editorClassName:
                    "flex-1 min-h-0 h-full overflow-visible rounded-none bg-transparent dark:bg-[#171717]",
                }

  return (
    <>
      {showRightRail ? (
        <RightRailSlot>
          <RoadmapRightRailSection
            sections={sections}
            basePath={roadmapBasePath}
            activeSectionId={activeSection.id}
            drafts={drafts}
            onSectionSelect={next => {
              if (!livePending || window.confirm("This document has unsaved edits. Leave it anyway?")) onSectionSelect(next)
            }}
          />
        </RightRailSlot>
      ) : null}
      <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col gap-2 overflow-hidden">
        <RoadmapEditorBreadcrumb title={headerTitle || activeSection.title} className={contentMaxWidth} />
        {source.error ? <p role="alert" className="text-destructive text-sm">{source.error}</p> : null}
        <RoadmapSectionPanel
          title={headerTitle}
          subtitle={headerSubtitle}
          icon={SectionIcon}
          status={controlsPublicProfile ? activeSection.status : status}
          controlsPublicProfile={controlsPublicProfile}
          canEdit={canEdit}
          onStatusChange={onStatusChange}
          statusSelectDisabled={statusSelectDisabled || livePending || (organizationDocumentCollaborationEnabled && isDirty)}
          isHydrated={isHydrated}
          showHeader={showSectionHeader}
          compactHeader={!isCalendarSection && !isBudgetSection}
          headerVariant={isCalendarSection ? "calendar" : "default"}
          headerIconSize={headerIconSize}
          headerTextRef={headerTextRef}
          contentMaxWidth={contentMaxWidth}
          toolbarSlotId={
            !isCalendarSection && !isBudgetSection
              ? ROADMAP_TOOLBAR_ID
              : undefined
          }
          body={
            isCalendarSection ? (
              <RoadmapCalendar />
            ) : linked ? (
              sourceScope ? <LinkedDriveDocumentEditor
                key={`${sourceScope.userId}:${sourceScope.organizationId}:${sourceSection.id}:${linked.fileId}`}
                scope={sourceScope}
                section={sourceSection}
                editorProps={editorProps}
                onReplace={canEdit ? chooseDrive : undefined}
                replacing={source.pending}
              /> : <a href={linked.webViewLink} target="_blank" rel="noopener noreferrer">Open {linked.name} in Google Drive</a>
            ) : organizationDocumentCollaborationEnabled && sourceScope ? (
              !isHydrated ? <p className="text-muted-foreground text-sm">Opening document…</p> : <OrganizationDocumentCollaborationPanel key={`${sourceScope.organizationId}:${activeSection.id}`}
                organizationId={sourceScope.organizationId} userId={sourceScope.userId} section={sourceSection} canEdit={canEdit} hideTextEditor={isBudgetSection} initialDraft={isDirty ? activeDraft : undefined}
                onSavedSection={onSavedSection} onPendingChange={pending => { setLivePending(pending); onCollaborationPending(pending) }} editorProps={editorProps} />
            ) : isBudgetSection ? (
              <RoadmapBudgetTableEditor
                rows={activeDraft.budgetRows}
                canEdit={canEdit}
                isDirty={isDirty}
                isSaving={savingId === activeSection.id}
                onRowsChange={(budgetRows) => onDraftChange({ budgetRows })}
                onSave={onSave}
              />
            ) : undefined
          }
          editorProps={editorProps}
        />
      </div>
    </>
  )
}
