"use server"

import { loadDocumentEditing as loadCompleteDocument, loadDocumentFileView, loadDocumentWindowView } from "./server/actions"
import { openDocumentRoom, compactDocumentRoom } from "./server/room-service"
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
