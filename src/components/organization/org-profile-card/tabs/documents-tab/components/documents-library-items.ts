import { getDocumentEditorHref } from "@/lib/workspace/editor-navigation"
import { isDocumentsSectionVisible } from "@/lib/organization/core-document-uploads"
import { stripHtml } from "@/lib/markdown/convert"
import type { DriveLibraryDocument } from "../hooks/use-google-drive-library"
import type { OrganizationDocumentFile } from "../hooks/use-organization-document-files"
import type { DocumentIndexRow } from "../types"
import type { NoteDocument } from "@/features/workspace-particles/client"

export type DocumentsLibraryTab = "all" | "images" | "documents"
export type DocumentsLibrarySource = "all" | "uploaded" | "generated"
export type DocumentsLibraryFileType =
  | "all"
  | "image"
  | "document"
  | "spreadsheet"
  | "presentation"
  | "pdf"
  | "other"

export type LibraryItem = {
  id: string
  name: string
  description: string
  source: Exclude<DocumentsLibrarySource, "all">
  fileType: Exclude<DocumentsLibraryFileType, "all">
  updatedAt: string | null
  deleted: boolean
  deletedAt?: string | null
  href?: string
  contentPreview?: string
  hasContent?: boolean
  previewPath?: string
  previewVersion?: string
  row?: DocumentIndexRow
  note?: NoteDocument
  uploadedFile?: OrganizationDocumentFile
  driveDocument?: DriveLibraryDocument
  coreDriveSource?: import("@/lib/roadmap/types").CoreDocumentDriveSource | null
}

export function resolveDocumentsLibraryFileType(
  mimeType: string,
  name = ""
): LibraryItem["fileType"] {
  if (mimeType.startsWith("image/")) return "image"
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) {
    return "spreadsheet"
  }
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) {
    return "presentation"
  }
  if (mimeType === "application/pdf" || name.toLowerCase().endsWith(".pdf")) {
    return "pdf"
  }
  if (
    mimeType.startsWith("text/") ||
    mimeType.includes("document") ||
    mimeType.includes("word")
  ) {
    return "document"
  }
  return "other"
}

export function buildLibraryItems(
  rows: DocumentIndexRow[],
  driveDocuments: DriveLibraryDocument[],
  uploadedFiles: OrganizationDocumentFile[],
  includeMissing = false,
  notes: readonly NoteDocument[] = []
) {
  const attachedFileIds = new Set<string>()
  const localItems: LibraryItem[] = rows.flatMap((row) => {
    if (row.source === "upload" && !row.document?.path && !includeMissing)
      return []
    const coreFile =
      row.source === "roadmap" &&
      !row.section.driveSource &&
      !row.section.documentSource
        ? uploadedFiles.find(
            (file) => file.coreSectionId === row.section.id && !file.deletedAt
          )
        : undefined
    if (coreFile) attachedFileIds.add(coreFile.id)
    return [
      {
        id: row.id,
        coreDriveSource:
          row.source === "roadmap" ? row.section.driveSource : null,
        contentPreview:
          row.source === "roadmap" && !row.section.driveSource
            ? stripHtml(row.section.content ?? "").slice(0, 800)
            : undefined,
        hasContent:
          row.source === "roadmap" &&
          (row.section.hasContent ||
            Boolean(stripHtml(row.section.content ?? "").trim())),
        name: row.name,
        description: row.description,
        source:
          row.source === "upload" ||
          coreFile ||
          (row.source === "roadmap" && row.section.driveSource)
            ? "uploaded"
            : "generated",
        fileType: coreFile
          ? resolveDocumentsLibraryFileType(coreFile.mimeType, coreFile.name)
          : row.source === "upload"
            ? resolveDocumentsLibraryFileType(
                row.document?.mime ?? "application/pdf",
                row.document?.name
              )
            : row.source === "policy" && row.policy.document?.path
              ? resolveDocumentsLibraryFileType(
                  row.policy.document.mime ?? "application/pdf",
                  row.policy.document.name
                )
              : "document",
        updatedAt: coreFile
          ? coreFile.updatedAt
          : row.source === "upload" && !row.document?.path
            ? null
            : row.source === "policy" && !row.policy.document?.path
              ? null
              : row.source === "roadmap"
                ? row.section.driveSource ||
                  row.section.hasContent ||
                  stripHtml(row.section.content ?? "").trim()
                  ? row.updatedAt
                  : null
                : row.updatedAt,
        previewPath: coreFile
          ? `/api/account/organization-document-files?id=${encodeURIComponent(coreFile.id)}`
          : row.source === "upload" && row.document?.path
            ? `/api/account/org-documents?kind=${encodeURIComponent(row.definition.kind)}`
            : row.source === "policy" && row.policy.document?.path
              ? `/api/account/org-policies/document?id=${encodeURIComponent(row.policy.id)}`
              : undefined,
        previewVersion: coreFile
          ? coreFile.updatedAt
          : row.source === "upload"
            ? row.document?.path
            : row.source === "policy"
              ? row.policy.document?.path
              : undefined,
        deleted: false,
        href:
          row.source === "roadmap"
            ? (row.section.driveSource?.webViewLink ??
              getDocumentEditorHref(row.section.slug))
            : undefined,
        uploadedFile: coreFile,
        row,
      } satisfies LibraryItem,
    ]
  })
  const driveItems: LibraryItem[] = driveDocuments.map((document) => ({
    id: `drive:${document.id}`,
    name: document.name,
    description: "Google Drive",
    source: "uploaded",
    fileType: resolveDocumentsLibraryFileType(document.mimeType, document.name),
    updatedAt: document.modifiedAt,
    deleted: document.status === "trashed",
    href: document.webViewLink,
    previewPath: document.status === "available"
      ? `/api/integrations/google-drive/documents/${encodeURIComponent(document.id)}/preview`
      : undefined,
    previewVersion: document.modifiedAt ?? undefined,
    driveDocument: document,
  }))
  const uploadedItems: LibraryItem[] = uploadedFiles
    .filter(
      (file) =>
        !attachedFileIds.has(file.id) &&
        (!file.coreSectionId || isDocumentsSectionVisible(file.coreSectionId))
    )
    .map((file) => ({
      id: `uploaded:${file.id}`,
      name: file.name,
      description: file.mimeType,
      source: "uploaded",
      fileType: resolveDocumentsLibraryFileType(file.mimeType, file.name),
      updatedAt: file.updatedAt,
      deleted: Boolean(file.deletedAt),
      deletedAt: file.deletedAt,
      uploadedFile: file,
      previewPath: file.deletedAt
        ? undefined
        : `/api/account/organization-document-files?id=${encodeURIComponent(file.id)}`,
      previewVersion: file.updatedAt,
    }))
  const noteItems: LibraryItem[] = notes.map((note) => ({
    id: note.id,
    name: note.title,
    description: note.summary,
    contentPreview: note.summary,
    hasContent: true,
    source: "generated",
    fileType: "document",
    updatedAt: note.updatedAt,
    deleted: false,
    note,
  }))
  return [...uploadedItems, ...driveItems, ...localItems, ...noteItems]
}

export function isEmptyDocumentSlot(item: LibraryItem) {
  return (
    (item.row?.source === "upload" && !item.row.document?.path) ||
    (item.row?.source === "roadmap" &&
      !item.coreDriveSource &&
      !item.uploadedFile &&
      !item.hasContent)
  )
}

export function formatCardDate(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date)
}
