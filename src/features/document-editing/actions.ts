"use server"

import { loadDocumentEditing as loadCompleteDocument, loadDocumentFileView, loadDocumentWindowView } from "./server/actions"
import { openDocumentRoom, openDocumentEditor, compactDocumentRoom } from "./server/room-service"
import { commitDocumentVersion, listDocumentVersions } from "./server/version-service"
import { DocumentRoomError } from "./lib/room-client"
import type { DocumentCommitInput } from "./lib/version-contracts"
import type { DocumentSaveResult } from "./lib/canonical-writer"
import type { DocumentEditingInput, DocumentSource } from "./types"

/** Public server-action boundary; storage/auth internals stay feature-private. */
export async function loadDocumentEditing(input: DocumentEditingInput) {
  return loadCompleteDocument(input)
}
export async function openDocumentFileView(input: DocumentEditingInput) {
  return loadDocumentFileView(input)
}
export async function openDocumentWindowView(input: DocumentEditingInput) {
  return loadDocumentWindowView(input)
}

export async function openDocumentCollaboration(source: DocumentSource) {
  return openDocumentRoom(source)
}
export async function checkpointDocumentCollaboration(source: DocumentSource) {
  return compactDocumentRoom(source)
}

export async function openWritableDocument(source: DocumentSource) {
  return openDocumentEditor(source)
}

export async function saveUploadedDocument(input: DocumentCommitInput): Promise<DocumentSaveResult> {
  try { return { ok: true, receipt: await commitDocumentVersion(input) } }
  catch (error) {
    return { ok: false,
      message: error instanceof DocumentRoomError ? error.message : "Could not confirm Save. Your draft is retained. Retry the same request.",
      retrySameRequest: !(error instanceof DocumentRoomError) || error.code === "unavailable",
    }
  }
}

export async function readUploadedDocumentVersions(source: DocumentSource) {
  // Storage locations and request contexts remain private server internals.
  return (await listDocumentVersions(source)).map(version => ({
    id: version.id, createdAt: version.created_at, sizeBytes: version.size_bytes,
    restoredFrom: version.restored_from, original: version.request_id === null,
  }))
}
