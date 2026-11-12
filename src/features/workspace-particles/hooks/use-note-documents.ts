"use client"

import { useEffect } from "react"
import { z } from "zod"
import { noteDocumentSchema } from "../lib/particle-notes"
import { NOTES_CHANGED_EVENT } from "@/lib/modules/notes-events"
import { documentLibraryUrl, useDocumentLibraryRead, type DocumentLibraryScope } from "@/components/organization/org-profile-card/tabs/documents-tab/hooks/use-document-library-read"

const responseSchema = z.object({ notes: z.array(noteDocumentSchema) })
async function readNotes(signal: AbortSignal, scope: DocumentLibraryScope) {
  const response = await fetch(documentLibraryUrl("/api/account/workspace-notes", scope), { cache: "no-store", signal })
  if (!response.ok) throw new Error("Unable to load notes.")
  return responseSchema.parse(await response.json())
}

export function useNoteDocuments(scope: DocumentLibraryScope) {
  const library = useDocumentLibraryRead(scope, readNotes)
  const reload = library.refresh
  useEffect(() => {
    window.addEventListener(NOTES_CHANGED_EVENT, reload)
    return () => window.removeEventListener(NOTES_CHANGED_EVENT, reload)
  }, [reload])
  return { notes: library.data?.notes ?? [], error: library.error, loading: library.loading, reload }
}
