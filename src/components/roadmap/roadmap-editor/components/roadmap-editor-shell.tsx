"use client"

import { useState, type ComponentType, type RefObject } from "react"
import { useSearchParams } from "next/navigation"
import { hasMeaningfulRoadmapBudgetRows } from "@/lib/roadmap/budget"
import { stripHtml } from "@/lib/markdown/convert"
import { CoreDocumentChoices } from "@/components/roadmap/core-document-source/core-document-choices"
import { GoogleDriveMark } from "@/components/roadmap/core-document-source/google-drive-mark"
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

import { DEFAULT_PLACEHOLDER, ROADMAP_TOOLBAR_ID } from "../constants"
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
  const searchParams = useSearchParams()
  const [writingId, setWritingId] = useState<string | null>(null)
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
  const hasContent = Boolean(
    stripHtml(activeDraft.content).trim() ||
    /<(img|table|iframe)\b/i.test(activeDraft.content) ||
    hasMeaningfulRoadmapBudgetRows(activeDraft.budgetRows ?? [])
  )
  const showSourceChoice =
    canEdit &&
    sourceScope &&
    !linked &&
    !hasContent &&
    writingId !== activeSection.id &&
    searchParams.get("write") !== "1"
  function chooseDrive() {
    if (
      isDirty &&
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

  return (
    <>
      {showRightRail ? (
        <RightRailSlot>
          <RoadmapRightRailSection
            sections={sections}
            basePath={roadmapBasePath}
            activeSectionId={activeSection.id}
            drafts={drafts}
            onSectionSelect={onSectionSelect}
          />
        </RightRailSlot>
      ) : null}
      <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col gap-2 overflow-hidden">
        <RoadmapEditorBreadcrumb title={headerTitle || activeSection.title} className={contentMaxWidth} />
        <RoadmapSectionPanel
          title={headerTitle}
          subtitle={headerSubtitle}
          icon={SectionIcon}
          status={controlsPublicProfile ? activeSection.status : status}
          controlsPublicProfile={controlsPublicProfile}
          canEdit={canEdit}
          onStatusChange={onStatusChange}
          statusSelectDisabled={statusSelectDisabled}
          isHydrated={isHydrated}
          showHeader={showSectionHeader}
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
              <div className="bg-card mx-auto w-full max-w-lg space-y-4 rounded-xl border p-6">
                <h2 className="text-lg font-semibold">{activeSection.title}</h2>
                <p className="text-muted-foreground text-sm">
                  Linked to {linked.name}. Edit this document in Google Drive.
                </p>
                <Button asChild variant="outline" className="min-h-11">
                  <a
                    href={linked.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <GoogleDriveMark />
                    Open in Google Drive
                  </a>
                </Button>
                {canEdit && sourceScope ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-11"
                    onClick={chooseDrive}
                    disabled={source.pending}
                  >
                    <GoogleDriveMark />
                    Replace with Google Drive
                  </Button>
                ) : null}
                {source.error ? (
                  <p role="alert" className="text-destructive text-sm">
                    {source.error}
                  </p>
                ) : null}
              </div>
            ) : showSourceChoice ? (
              <CoreDocumentChoices
                title={activeSection.title}
                pending={source.pending}
                error={source.error}
                onWrite={() => setWritingId(activeSection.id)}
                onDrive={chooseDrive}
              />
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
          editorProps={
            isCalendarSection || isBudgetSection
              ? undefined
              : {
                  toolbarActions:
                    canEdit && sourceScope ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="min-h-11 sm:min-h-8"
                        onClick={chooseDrive}
                        disabled={source.pending}
                      >
                        <GoogleDriveMark />
                        {source.pending
                          ? "Connecting…"
                          : "Choose from Google Drive"}
                      </Button>
                    ) : undefined,
                  value: activeDraft.content,
                  onChange: (value) => onDraftChange({ content: value }),
                  readOnly: !canEdit,
                  placeholder: editorPlaceholder,
                  header: activeDraft.placeholder ?? DEFAULT_PLACEHOLDER,
                  headerClassName:
                    "bg-[#f4f4f5] px-4 pt-4 pb-3 text-sm text-muted-foreground dark:bg-[#1f1f1f]",
                  countClassName:
                    "bg-[#e6e6e6] px-4 py-2 text-xs text-muted-foreground dark:bg-[#1c1c1c]",
                  contentClassName:
                    "flex-1 min-h-0 overflow-y-auto overscroll-contain bg-[#ededed] dark:bg-[#171717] rounded-none",
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
                    "rounded-xl border border-border/60 bg-background/80 shadow-[0_1px_1px_rgba(0,0,0,0.06)] dark:shadow-[0_1px_1px_rgba(0,0,0,0.24)]",
                  className:
                    "flex h-full min-h-0 flex-1 flex-col bg-card dark:bg-[#1f1f1f]",
                  editorClassName:
                    "flex-1 min-h-0 h-full overflow-visible rounded-none bg-transparent dark:bg-[#171717]",
                }
          }
        />
      </div>
    </>
  )
}
