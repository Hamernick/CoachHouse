"use client"

import { useSyncExternalStore } from "react"
import type { DocumentEditorSession } from "../lib/editor-session"

/** Session ownership lives above retained window panels. Minimize/resize never
 * changes the editor's key or constructs a second CRDT document. */
export function useDocumentEditorSession(session: DocumentEditorSession) {
  return useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot)
}
