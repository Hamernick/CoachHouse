"use client"

import { useRef, useState } from "react"
import { DocumentsBanner } from "@/components/organization/org-profile-card/tabs/documents-tab/components/documents-banner"
import { DocumentsLibraryGrid } from "@/components/organization/org-profile-card/tabs/documents-tab/components/documents-library-grid"
import { buildRoadmapRows } from "@/components/organization/org-profile-card/tabs/documents-tab/hooks/use-documents-index-row-builders"
import { resolveRoadmapSections, type RoadmapSection } from "@/lib/roadmap"
import { RoadmapEditorShell } from "@/components/roadmap/roadmap-editor/components/roadmap-editor-shell"
import { createDraft } from "@/components/roadmap/roadmap-editor/helpers"
import { ROADMAP_SECTION_ICONS } from "@/components/roadmap/roadmap-icons"
import { Button } from "@/components/ui/button"

const initialSections = resolveRoadmapSections({}).filter((section) => ["vision", "values", "origin_story"].includes(section.id))
const nothing = async () => {}

export function DocumentsPreview() {
  const [sections, setSections] = useState(initialSections)
  const [readOnly, setReadOnly] = useState(false)
  const [editor, setEditor] = useState(false)
  const coreSource = {
    pending: false,
    error: null,
    change: async (section: { id: string }, mode: "drive" | "remove" | "editor") => {
      setSections((current) => current.map((entry): RoadmapSection => entry.id === section.id ? { ...entry, content: "", lastUpdated: "2026-09-21T12:00:00Z", documentSource: mode === "drive" ? "google_drive" : "editor", driveSource: mode === "drive" ? { provider: "google_drive", fileId: "visual_fixture_123", name: "Google document title", webViewLink: "https://docs.google.com/document/d/visual_fixture_123/edit" } : null } : entry))
      return true
    },
  }
  return <div className="w-full space-y-4">
    <div className="flex flex-wrap gap-2"><Button onClick={() => setReadOnly((value) => !value)}>{readOnly ? "Enable editing" : "View only"}</Button><Button onClick={() => setEditor((value) => !value)}>{editor ? "Show cards" : "Show editor"}</Button></div>
    {editor ? <div className="h-[650px]"><CoreEditorPreview canEdit={!readOnly} /></div> :
    <DocumentsBanner canEdit={!readOnly}><h1 id="documents-title" className="mb-4 text-2xl font-semibold">Documents</h1>
      <DocumentsLibraryGrid hasStorageAccess coreSource={coreSource} rows={buildRoadmapRows(sections)} driveDocuments={[]} uploadedFiles={[]} searchQuery="" uploadingFiles={false} uploadingCoreSectionId={null} onUploadCoreDocument={nothing} tab="all" source="all" fileType="all" showDeleted={false} canEdit={!readOnly} editMode={!readOnly} onEditPolicy={() => {}} onViewPolicyDocument={nothing} onUpload={nothing} uploadingKind={null} onViewUpload={nothing} onViewUploadedFile={nothing} onDownloadUploadedFile={nothing} onDownloadUpload={nothing} onDeleteUpload={nothing} onDownloadPolicyDocument={nothing} onRemovePolicyDocument={nothing} onDetachDriveDocument={nothing} pendingUploadedFileIds={[]} onTrashUploadedFile={nothing} onRestoreUploadedFile={nothing} onPermanentlyDeleteUploadedFile={nothing} onReset={() => {}} />
    </DocumentsBanner>}
  </div>
}


// A public layout fixture renders the presentation shell, not a fabricated
// authenticated session. Real editor admission is covered by the browser fixture.
function CoreEditorPreview({ canEdit }: { canEdit: boolean }) {
  const section = initialSections.find(section => section.id === "vision")!
  const [draft, setDraft] = useState(() => createDraft(section))
  const headerTextRef = useRef<HTMLDivElement>(null)
  return <RoadmapEditorShell sourceScope={{ userId: "visual-user", organizationId: "visual-org" }}
    sections={initialSections} activeSection={section} drafts={{ vision: draft }}
    roadmapBasePath="/workspace/roadmap" onSectionSelect={() => {}} showRightRail={false}
    headerTitle={section.title} headerSubtitle={section.subtitle} showSectionHeader
    headerIconSize={null} headerTextRef={headerTextRef} status={section.status} canEdit={canEdit}
    onCollaborationPending={() => {}} onSavedSection={() => {}} onStatusChange={() => {}}
    statusSelectDisabled={!canEdit} isHydrated isCalendarSection={false} isBudgetSection={false}
    contentMaxWidth="max-w-3xl" activeDraft={draft} editorPlaceholder="Write here"
    onDraftChange={updates => setDraft(previous => ({ ...previous, ...updates }))}
    onImageUpload={async () => { throw new Error("Upload outside layout fixture") }}
    onSave={() => {}} isDirty={draft.content !== section.content} savingId={null}
    sectionIcon={ROADMAP_SECTION_ICONS.vision} />
}
