"use client"

import { useCallback, useEffect, useState } from "react"
import { z } from "zod"
import { noteDocumentSchema, type NoteDocument } from "../lib/particle-notes"
import { NOTES_CHANGED_EVENT } from "@/lib/modules/notes-events"
import { useWorkspaceWindowHeaderActive } from "@/components/workspace/workspace-window-header-slots"

const responseSchema = z.object({ notes: z.array(noteDocumentSchema) })
export function useNoteDocuments(organizationId: string) {
  const active = useWorkspaceWindowHeaderActive()
  const [notes, setNotes] = useState<NoteDocument[]>([])
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const reload = useCallback(() => setRevision((value) => value + 1), [])
  useEffect(() => {
    if (!active) return
    const abort = new AbortController()
    void fetch(
      `/api/account/workspace-notes?${new URLSearchParams({ organizationId })}`,
      { cache: "no-store", signal: abort.signal }
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load notes. Try again.")
        const result = responseSchema.parse(await response.json())
        if (!abort.signal.aborted) {
          setNotes(result.notes)
          setError(null)
        }
      })
      .catch((failure: unknown) => {
        if (!abort.signal.aborted)
          setError(
            failure instanceof Error ? failure.message : "Unable to load notes."
          )
      })
    return () => abort.abort()
  }, [organizationId, active, revision])
  useEffect(() => {
    window.addEventListener(NOTES_CHANGED_EVENT, reload)
    window.addEventListener("focus", reload)
    return () => {
      window.removeEventListener(NOTES_CHANGED_EVENT, reload)
      window.removeEventListener("focus", reload)
    }
  }, [reload])
  return { notes, error, reload }
}
