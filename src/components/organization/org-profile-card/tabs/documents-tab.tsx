"use client"

import { FeatureUpgradeNotice } from "@/components/paywall/feature-upgrade-notice"

import { useMemo, useRef, useState } from "react"

import { useCoreDocumentSource } from "@/components/roadmap/core-document-source/use-core-document-source"
import type { DocumentsRoadmapSection } from "./documents-tab/types"
import { DocumentsNotesPanel } from "../../documents-notes-right-rail"
import { useOrganizationDeepLinkFocus } from "../organization-deep-link-focus"
import {
  DocumentsBanner,
  DocumentsLibraryGrid,
  DocumentsStorageUsage,
  DocumentsToolbar,
  PolicyEditorDialog,
} from "./documents-tab/components"
import type {
  DocumentsLibraryFileType,
  DocumentsLibrarySource,
  DocumentsLibraryTab,
} from "./documents-tab/components/documents-library-grid"
import type { DocumentsViewMode } from "./documents-tab/components/documents-toolbar-types"
import { useDocumentsTabController } from "./documents-tab/hooks"
import { DocumentRowActions } from "./documents-tab/components/document-row-actions"
import { useGoogleDriveLibrary } from "./documents-tab/hooks/use-google-drive-library"
import { useOrganizationDocumentFiles } from "./documents-tab/hooks/use-organization-document-files"
import type { DocumentsTabProps } from "./documents-tab/types"

export type {
  DocumentsOption,
  DocumentsPolicyEntry,
  DocumentsRoadmapSection,
} from "./documents-tab/types"

export function DocumentsTab(props: DocumentsTabProps) {
  return (
    <ScopedDocumentsTab
      key={`${props.userId}:${props.organizationId}`}
      {...props}
    />
  )
}

function ScopedDocumentsTab({
  organizationId,
  userId,
  documents,
  policyEntries,
  policyProgramOptions,
  policyPeopleOptions,
  roadmapSections,
  publicSlug,
  editMode,
  canEdit,
  initialFocusKey,
  focusRequestId,
  notes,
}: DocumentsTabProps) {
  const [coreOverrides, setCoreOverrides] = useState<
    Record<string, DocumentsRoadmapSection>
  >({})
  const coreSource = useCoreDocumentSource(
    { userId, organizationId },
    (section) => {
      setCoreOverrides((current) => ({ ...current, [section.id]: section }))
    }
  )
  const currentSections = roadmapSections.map((section) =>
    coreOverrides[section.id] &&
    (coreOverrides[section.id].lastUpdated ?? "") >= (section.lastUpdated ?? "")
      ? coreOverrides[section.id]
      : section
  )
  const documentsRootRef = useRef<HTMLElement>(null)
  const controller = useDocumentsTabController({
    userId,
    documents,
    policyEntries,
    policyProgramOptions,
    policyPeopleOptions,
    roadmapSections: currentSections,
  })
  const [libraryTab, setLibraryTab] = useState<DocumentsLibraryTab>("all")
  const [viewMode, setViewMode] = useState<DocumentsViewMode>("grid")
  const [librarySource, setLibrarySource] =
    useState<DocumentsLibrarySource>("all")
  const [libraryFileType, setLibraryFileType] =
    useState<DocumentsLibraryFileType>("all")
  const [showDeleted, setShowDeleted] = useState(false)
  const googleDrive = useGoogleDriveLibrary({ enabled: canEdit && editMode })
  const storageRefreshKey = JSON.stringify([
    controller.documentsState,
    controller.policiesState.map((policy) => policy.document),
  ])
  const documentFiles = useOrganizationDocumentFiles(storageRefreshKey)
  const visibleDriveDocuments = useMemo(() => {
    const query = controller.searchQuery.trim().toLocaleLowerCase()
    if (!query) return googleDrive.documents
    return googleDrive.documents.filter((document) =>
      document.name.toLocaleLowerCase().includes(query)
    )
  }, [controller.searchQuery, googleDrive.documents])

  useOrganizationDeepLinkFocus({
    focusKey: initialFocusKey,
    requestId: focusRequestId,
    rootRef: documentsRootRef,
  })

  const resetLibrary = () => {
    controller.clearFilters()
    setLibraryTab("all")
    setLibrarySource("all")
    setLibraryFileType("all")
    setShowDeleted(false)
  }

  return (
    <section
      ref={documentsRootRef}
      className="pb-6"
      aria-labelledby="documents-title"
    >
      <DocumentsBanner canEdit={canEdit} uploading={documentFiles.uploading}>
        <DocumentsToolbar
          searchQuery={controller.searchQuery}
          tab={libraryTab}
          viewMode={viewMode}
          source={librarySource}
          fileType={libraryFileType}
          showDeleted={showDeleted}
          canEdit={canEdit}
          editMode={editMode}
          canUpload={documentFiles.hasStorageAccess}
          driveConnected={googleDrive.connected}
          drivePending={googleDrive.pending}
          onSearchQueryChange={controller.setSearchQuery}
          onTabChange={setLibraryTab}
          onViewModeChange={setViewMode}
          onSourceChange={setLibrarySource}
          onFileTypeChange={setLibraryFileType}
          onShowDeletedChange={setShowDeleted}
          onReset={resetLibrary}
          onUploadFiles={documentFiles.uploadFiles}
          onGoogleDrive={() => void googleDrive.connectOrPick()}
        />

        {documentFiles.hasStorageAccess ? (
          <DocumentsStorageUsage usedBytes={documentFiles.usedBytes} limitBytes={documentFiles.limitBytes} loading={documentFiles.loading} />
        ) : !documentFiles.loading ? (
          <FeatureUpgradeNotice title="Your files, connected">
            Connect Google Drive to use your own files on Free. Upgrade to create, edit, and store documents in Coach House. Existing documents remain readable.
          </FeatureUpgradeNotice>
        ) : null}

        <div id="documents-index" className="mt-4" aria-live="polite">
          <DocumentsLibraryGrid
            coreSource={coreSource}
            hasStorageAccess={documentFiles.hasStorageAccess}
            viewMode={viewMode}
            renderRowActions={(row) => (
              <DocumentRowActions
                row={row}
                canEdit={canEdit && documentFiles.hasStorageAccess}
                editMode={editMode}
                publicSlug={publicSlug}
                uploadingKind={controller.uploadingKind}
                deletingKind={controller.deletingKind}
                viewingKind={controller.viewingKind}
                downloadingKind={controller.downloadingKind}
                deletingPolicyId={controller.deletingPolicyId}
                viewingPolicyDocumentId={controller.viewingPolicyDocumentId}
                downloadingPolicyDocumentId={
                  controller.downloadingPolicyDocumentId
                }
                onUpload={controller.handleUpload}
                onDeleteUpload={controller.handleDelete}
                onViewUpload={controller.handleView}
                onDownloadUpload={controller.handleDownload}
                onEditPolicy={controller.openEditPolicyDialog}
                onDeletePolicy={controller.handleDeletePolicy}
                onViewPolicyDocument={controller.viewPolicyDocument}
                onDownloadPolicyDocument={controller.downloadPolicyDocument}
              />
            )}
            rows={controller.filteredRows}
            driveDocuments={visibleDriveDocuments}
            uploadedFiles={documentFiles.files}
            searchQuery={controller.searchQuery}
            uploadingFiles={documentFiles.uploading}
            uploadingCoreSectionId={documentFiles.uploadingCoreSectionId}
            onUploadCoreDocument={async (sectionId, file) => {
              await documentFiles.uploadFiles([file], sectionId)
            }}
            tab={libraryTab}
            source={librarySource}
            fileType={libraryFileType}
            showDeleted={showDeleted}
            canEdit={canEdit}
            editMode={editMode}
            onEditPolicy={controller.openEditPolicyDialog}
            onViewPolicyDocument={controller.viewPolicyDocument}
            onViewUpload={controller.handleView}
            onUpload={controller.handleUpload}
            uploadingKind={controller.uploadingKind}
            onViewUploadedFile={documentFiles.openFile}
            onDownloadUploadedFile={documentFiles.downloadFile}
            onDownloadUpload={controller.handleDownload}
            onDeleteUpload={controller.handleDelete}
            onDownloadPolicyDocument={controller.downloadPolicyDocument}
            onRemovePolicyDocument={controller.removePolicyDocumentFile}
            onDetachDriveDocument={googleDrive.detachDocument}
            pendingUploadedFileIds={documentFiles.pendingFileIds}
            onTrashUploadedFile={documentFiles.trashFile}
            onRestoreUploadedFile={documentFiles.restoreFile}
            onPermanentlyDeleteUploadedFile={
              documentFiles.permanentlyDeleteFile
            }
            onReset={resetLibrary}
          />
        </div>

        {notes ? <DocumentsNotesPanel notes={notes} /> : null}
      </DocumentsBanner>

      <PolicyEditorDialog
        readOnly={!canEdit || !documentFiles.hasStorageAccess}
        open={controller.policyDialogOpen}
        onOpenChange={controller.handlePolicyDialogOpenChange}
        draft={controller.policyDraft}
        categoryOptions={controller.categoryOptions}
        peopleOptions={policyPeopleOptions}
        programOptions={policyProgramOptions}
        pending={controller.policySavePending}
        pendingDocumentName={controller.policyDocumentPending?.name ?? null}
        pendingDocumentUpload={controller.policyDocumentBusy}
        viewingDocument={
          controller.viewingPolicyDocumentId === controller.policyDraft.id
        }
        onChange={controller.setPolicyDraft}
        onToggleCategory={controller.togglePolicyCategory}
        onCreateCategory={controller.createPolicyCategory}
        onRemoveCategory={controller.removePolicyCategory}
        onSelectDocument={controller.selectPolicyDocument}
        onClearPendingDocument={controller.clearPendingPolicyDocument}
        onRemoveExistingDocument={controller.markPolicyDocumentForRemoval}
        onViewDocument={controller.viewPolicyDraftDocument}
        onSave={controller.handleSavePolicy}
      />
    </section>
  )
}
