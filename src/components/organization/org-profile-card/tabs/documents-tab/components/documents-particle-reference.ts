import type { ParticleLibraryDocument } from "@/features/workspace-particles/client"
import {
  isEmptyDocumentSlot,
  type LibraryItem,
} from "./documents-library-items"

export function documentParticleReference(
  item: LibraryItem
): ParticleLibraryDocument | null {
  if (item.deleted || isEmptyDocumentSlot(item)) return null
  const title = item.name
  if (item.note)
    return {
      title,
      name: title,
      mimeType: "text/markdown",
      source: item.note.source,
    }
  if (item.uploadedFile && !item.uploadedFile.deletedAt)
    return {
      fileId: item.uploadedFile.id,
      title,
      name: item.uploadedFile.name,
      mimeType: item.uploadedFile.mimeType,
      size: item.uploadedFile.sizeBytes,
    }
  const drive = item.driveDocument
  if (drive) {
    if (item.driveDocument && item.driveDocument.status !== "available")
      return null
    return {
      title,
      name: drive.name,
      mimeType: drive.mimeType,
      source: { kind: "drive", id: drive.id, webViewLink: drive.webViewLink },
    }
  }
  if (item.coreDriveSource && item.row?.source === "roadmap")
    return {
      title,
      name: item.coreDriveSource.name,
      mimeType: "application/octet-stream",
      source: {
        kind: "roadmap_drive",
        sectionId: item.row.section.slug || item.row.section.id,
        fileId: item.coreDriveSource.fileId,
        webViewLink: item.coreDriveSource.webViewLink,
      },
    }
  if (item.row?.source === "upload" && item.row.document?.path)
    return {
      title,
      name: item.row.document.name,
      mimeType: item.row.document.mime ?? "application/pdf",
      size: item.row.document.size || undefined,
      source: { kind: "upload", documentKind: item.row.definition.kind },
    }
  if (item.row?.source === "policy" && item.row.policy.document?.path)
    return {
      title,
      name: item.row.policy.document.name,
      mimeType: item.row.policy.document.mime ?? "application/pdf",
      size: item.row.policy.document.size || undefined,
      source: { kind: "policy", id: item.row.policy.id },
    }
  if (item.row?.source === "roadmap" && item.hasContent)
    return {
      title,
      name: item.name,
      mimeType: "text/markdown",
      source: {
        kind: "roadmap",
        sectionId: item.row.section.slug || item.row.section.id,
      },
    }
  return null
}
