"use client"

import { getDocumentEditorHref } from "@/lib/workspace/editor-navigation"

import { useMemo, useRef, useState, type ReactNode } from "react"
import dynamic from "next/dynamic"
import { IconWorld } from "@tabler/icons-react"

import { CoreDocumentChoices } from "@/components/roadmap/core-document-source/core-document-choices"
import { CoreDocumentMenu } from "@/components/roadmap/core-document-source/core-document-menu"
import type { useCoreDocumentSource } from "@/components/roadmap/core-document-source/use-core-document-source"
import { Dialog, DialogContent,
  DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Empty } from "@/components/ui/empty"
import { DocumentsLibraryCard } from "./documents-library-card"
import { ORGANIZATION_DOCUMENT_ACCEPT } from "@/lib/organization/document-storage"
import { DocumentsSelectionToolbar } from "./documents-selection-toolbar"
import type { DriveLibraryDocument } from "../hooks/use-google-drive-library"
import { useDocumentsLibrarySelection } from "../hooks/use-documents-library-selection"
import type { OrganizationDocumentFile } from "../hooks/use-organization-document-files"
import type {
  DocumentDefinition,
  DocumentIndexRow,
  DocumentsPolicyEntry,
} from "../types"
import {
  buildLibraryItems,
  isEmptyDocumentSlot,
  type LibraryItem,
  type DocumentsLibraryTab,
  type DocumentsLibrarySource,
  type DocumentsLibraryFileType,
} from "./documents-library-items"
export type {
  DocumentsLibraryTab,
  DocumentsLibrarySource,
  DocumentsLibraryFileType,
} from "./documents-library-items"

const DocumentPreviewDialog = dynamic(
  () =>
    import("./document-preview-dialog").then(
      (module) => module.DocumentPreviewDialog
    ),
  // Keep the library mounted while the optional viewer chunk loads.
  { loading: () => null }
)

type DocumentsLibraryGridProps = {
  hasStorageAccess: boolean
  coreSource: ReturnType<typeof useCoreDocumentSource>
  viewMode?: "grid" | "list"
  renderRowActions?: (row: DocumentIndexRow) => ReactNode
  rows: DocumentIndexRow[]
  driveDocuments: DriveLibraryDocument[]
  uploadedFiles: OrganizationDocumentFile[]
  searchQuery: string
  uploadingFiles: boolean
  uploadingCoreSectionId: string | null
  onUploadCoreDocument: (sectionId: string, file: File) => Promise<void>
  tab: DocumentsLibraryTab
  source: DocumentsLibrarySource
  fileType: DocumentsLibraryFileType
  showDeleted: boolean
  canEdit: boolean
  editMode: boolean
  onEditPolicy: (policy: DocumentsPolicyEntry) => void
  onViewPolicyDocument: (policy: DocumentsPolicyEntry) => Promise<void>
  onUpload: (definition: DocumentDefinition, file: File) => Promise<void>
  uploadingKind: string | null
  onViewUpload: (
    definition: Extract<DocumentIndexRow, { source: "upload" }>["definition"]
  ) => Promise<void>
  onViewUploadedFile: (file: OrganizationDocumentFile) => Promise<void>
  onDownloadUploadedFile: (file: OrganizationDocumentFile) => Promise<void>
  onDownloadUpload: (
    definition: Extract<DocumentIndexRow, { source: "upload" }>["definition"]
  ) => Promise<void>
  onDeleteUpload: (
    definition: Extract<DocumentIndexRow, { source: "upload" }>["definition"],
    options?: { confirm?: boolean }
  ) => Promise<void>
  onDownloadPolicyDocument: (policy: DocumentsPolicyEntry) => Promise<void>
  onRemovePolicyDocument: (
    policy: DocumentsPolicyEntry,
    options?: { confirm?: boolean }
  ) => Promise<void>
  onDetachDriveDocument: (documentId: string) => Promise<void>
  pendingUploadedFileIds: string[]
  onTrashUploadedFile: (file: OrganizationDocumentFile) => Promise<void>
  onRestoreUploadedFile: (file: OrganizationDocumentFile) => Promise<void>
  onPermanentlyDeleteUploadedFile: (
    file: OrganizationDocumentFile
  ) => Promise<void>
  onReset: () => void
}

export function DocumentsLibraryGrid({
  coreSource,
  hasStorageAccess,
  viewMode = "grid",
  renderRowActions,
  rows,
  driveDocuments,
  uploadedFiles,
  searchQuery,
  uploadingFiles,
  uploadingCoreSectionId,
  onUploadCoreDocument,
  tab,
  source,
  fileType,
  showDeleted,
  canEdit,
  editMode,
  onEditPolicy,
  onViewPolicyDocument,
  onViewUpload,
  onUpload,
  uploadingKind,
  onViewUploadedFile,
  onDownloadUploadedFile,
  onDownloadUpload,
  onDeleteUpload,
  onDownloadPolicyDocument,
  onRemovePolicyDocument,
  onDetachDriveDocument,
  pendingUploadedFileIds,
  onTrashUploadedFile,
  onRestoreUploadedFile,
  onPermanentlyDeleteUploadedFile,
  onReset,
}: DocumentsLibraryGridProps) {
  const [coreChoice, setCoreChoice] = useState<LibraryItem | null>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const uploadTargetRef = useRef<LibraryItem | null>(null)
  const [previewItem, setPreviewItem] = useState<LibraryItem | null>(null)
  const previewTriggerRef = useRef<HTMLButtonElement | null>(null)
  const items = useMemo(() => {
    return buildLibraryItems(rows, driveDocuments, uploadedFiles, true).filter(
      (item) => {
        if (
          !item.row &&
          !item.name
            .toLocaleLowerCase()
            .includes(searchQuery.trim().toLocaleLowerCase())
        )
          return false
        if (item.deleted !== showDeleted) return false
        if (tab === "images" && item.fileType !== "image") return false
        if (tab === "documents" && item.fileType === "image") return false
        if (source !== "all" && item.source !== source) return false
        if (fileType !== "all" && item.fileType !== fileType) return false
        return true
      }
    )
  }, [
    driveDocuments,
    fileType,
    rows,
    searchQuery,
    showDeleted,
    source,
    tab,
    uploadedFiles,
  ])
  const selection = useDocumentsLibrarySelection({
    items,
    canEdit,
    canEditNative: hasStorageAccess,
    editMode,
    actions: {
      onDeleteUpload,
      onDetachDriveDocument,
      onDownloadPolicyDocument,
      onDownloadUpload,
      onDownloadUploadedFile,
      onPermanentlyDeleteUploadedFile,
      onRemovePolicyDocument,
      onTrashUploadedFile,
    },
  })

  const canUpload =
    hasStorageAccess &&
    canEdit &&
    editMode &&
    !uploadingKind &&
    !uploadingFiles &&
    !selection.pending &&
    selection.selectedIds.length === 0

  function uploadToItem(item: LibraryItem, file: File) {
    if (!canUpload || !isEmptyDocumentSlot(item)) return
    if (item.row?.source === "upload") void onUpload(item.row.definition, file)
    if (item.row?.source === "roadmap")
      void onUploadCoreDocument(item.row.section.id, file)
  }

  function openItem(item: LibraryItem, trigger: HTMLButtonElement) {
    if (item.coreDriveSource) {
      window.open(
        item.coreDriveSource.webViewLink,
        "_blank",
        "noopener,noreferrer"
      )
      return
    }
    if (item.row?.source === "roadmap" && isEmptyDocumentSlot(item)) {
      setCoreChoice(item)
      return
    }
    if (isEmptyDocumentSlot(item)) {
      if (!canUpload || !uploadInputRef.current) return
      uploadTargetRef.current = item
      uploadInputRef.current.accept =
        item.row?.source === "roadmap" ? "" : ORGANIZATION_DOCUMENT_ACCEPT
      uploadInputRef.current.click()
      return
    }
    if (item.row?.source === "roadmap" && item.hasContent && item.href) {
      window.location.assign(item.href)
      return
    }
    if (
      item.previewPath &&
      (item.fileType === "pdf" || item.fileType === "image")
    ) {
      previewTriggerRef.current = trigger
      setPreviewItem(item)
      return
    }
    if (item.href) {
      window.open(item.href, "_blank", "noopener,noreferrer")
      return
    }
    if (item.uploadedFile) {
      void onViewUploadedFile(item.uploadedFile)
      return
    }
    if (!item.row) return
    if (item.row.source === "upload") {
      void onViewUpload(item.row.definition)
      return
    }
    if (item.row.source === "policy") {
      if (item.row.policy.document?.path) {
        void onViewPolicyDocument(item.row.policy)
      } else {
        onEditPolicy(item.row.policy)
      }
    }
  }

  if (items.length === 0) {
    return (
      <div className="py-14">
        <Empty
          variant="subtle"
          size="sm"
          icon={<IconWorld className="size-5" aria-hidden />}
          title={
            showDeleted
              ? "No recently deleted files"
              : "No documents match this view"
          }
          description={
            showDeleted
              ? "Deleted files remain here for 30 days before permanent removal."
              : "Adjust the tab, filter, or search to see more files."
          }
          actions={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="underline-offset-4 hover:underline"
              onClick={onReset}
            >
              Show all files
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <>
      <Dialog
        open={Boolean(coreChoice)}
        onOpenChange={(open) => {
          if (!open && !coreSource.pending) setCoreChoice(null)
        }}
      >
        <DialogContent>
          <DialogTitle className="sr-only">
            Choose a source for {coreChoice?.name}
          </DialogTitle>
          <DialogDescription className="sr-only">Start a draft in Coach House or link a file from Google Drive.</DialogDescription>
          {coreChoice?.row?.source === "roadmap" ? (
            <CoreDocumentChoices
              title={coreChoice.name}
              canWrite={hasStorageAccess}
              pending={coreSource.pending}
              error={coreSource.error}
              onWrite={() => {
                window.location.assign(
                  getDocumentEditorHref(coreChoice.row!.source === "roadmap" ? coreChoice.row!.section.slug : "", true)
                )
              }}
              onDrive={() => {
                if (coreChoice.row?.source === "roadmap") {
                  const section = coreChoice.row.section
                  setCoreChoice(null)
                  void coreSource.change(section, "drive")
                }
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      <input
        ref={uploadInputRef}
        type="file"
        accept={ORGANIZATION_DOCUMENT_ACCEPT}
        className="hidden"
        aria-label="Upload to document slot"
        disabled={!canUpload}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          const target = uploadTargetRef.current
          event.currentTarget.value = ""
          if (file && target) uploadToItem(target, file)
        }}
      />
      {previewItem ? (
        <DocumentPreviewDialog
          item={previewItem}
          returnFocusRef={previewTriggerRef}
          onClose={() => setPreviewItem(null)}
        />
      ) : null}
      {selection.selectedItems.length > 0 ? (
        <DocumentsSelectionToolbar
          count={selection.selectedItems.length}
          canDelete={selection.canDelete}
          canDownload={selection.canDownload}
          pending={selection.pending}
          onDelete={() => void selection.remove()}
          onDownload={() => void selection.download()}
        />
      ) : null}
      <div
        className={
          viewMode === "list"
            ? "grid gap-3"
            : "grid grid-cols-2 gap-3 md:grid-cols-3"
        }
      >
        {items.map((item) => {
          const selected = selection.selectedIds.includes(item.id)
          return (
            <DocumentsLibraryCard
              key={item.id}
              item={item}
              actions={
                item.row?.source === "roadmap" &&
                canEdit &&
                editMode &&
                !selection.selectedIds.length ? (
                  <CoreDocumentMenu
                    title={item.name}
                    canEditContent={hasStorageAccess || Boolean(item.coreDriveSource)}
                    pending={coreSource.pending}
                    className="absolute top-1 right-1 z-20 size-11 sm:size-8"
                    onEdit={() => {
                      window.open(
                        item.coreDriveSource?.webViewLink ??
                          getDocumentEditorHref(item.row?.source === "roadmap" ? item.row.section.slug : "", true),
                        item.coreDriveSource ? "_blank" : "_self",
                        "noopener,noreferrer"
                      )
                    }}
                    onReplace={() => {
                      if (item.row?.source === "roadmap")
                        void coreSource.change(item.row.section, "drive")
                    }}
                    onRemove={() => {
                      if (
                        item.row?.source === "roadmap" &&
                        window.confirm(
                          `Remove ${item.name}'s content or link? Its title stays. No Google Drive file is deleted.`
                        )
                      ) {
                        void coreSource.change(item.row.section, "remove")
                      }
                    }}
                  />
                ) : undefined
              }
              viewMode={viewMode}
              selected={selected}
              selecting={selection.selectedIds.length > 0}
              pending={selection.pending}
              uploading={
                (item.row?.source === "upload" &&
                  uploadingKind === item.row.definition.kind) ||
                (item.row?.source === "roadmap" &&
                  uploadingCoreSectionId === item.row.section.id)
              }
              canEdit={canEdit && (hasStorageAccess || Boolean(item.driveDocument) || item.row?.source === "roadmap")}
              editMode={editMode}
              onOpen={(trigger) => openItem(item, trigger)}
              onDropFile={
                canUpload && isEmptyDocumentSlot(item)
                  ? (file) => uploadToItem(item, file)
                  : undefined
              }
              onToggle={() => selection.toggle(item.id)}
              renderRowActions={renderRowActions}
              pendingUploadedFileIds={pendingUploadedFileIds}
              onRestoreUploadedFile={onRestoreUploadedFile}
              onTrashUploadedFile={onTrashUploadedFile}
              onPermanentlyDeleteUploadedFile={onPermanentlyDeleteUploadedFile}
            />
          )
        })}
      </div>
    </>
  )
}
