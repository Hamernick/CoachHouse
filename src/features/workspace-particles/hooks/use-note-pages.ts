"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { z } from "zod"
import { useDebounce } from "@/hooks/use-debounce"
import { NOTES_CHANGED_EVENT } from "@/lib/modules/notes-events"
import { noteDocumentSchema, type NoteDocument } from "../lib/particle-notes"

const pageSchema = z.object({ notes: z.array(noteDocumentSchema), nextCursor: z.string().nullable() })
export function useNotePages(organizationId: string, query: string) {
  const search = useDebounce(query, 250)
  const [notes, setNotes] = useState<NoteDocument[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const epoch = useRef(0)
  const loadingRef = useRef(false)
  const reload = useCallback(() => setRevision((value) => value + 1), [])
  const load = useCallback(async (after: string | null, ticket: number) => {
    loadingRef.current = true; setLoading(true); setError(null)
    try {
      const params = new URLSearchParams({ organizationId, q: search, limit: "30" })
      if (after) params.set("cursor", after)
      const response = await fetch(`/api/account/workspace-notes?${params}`, { cache: "no-store" })
      if (!response.ok) throw new Error("Unable to load notes. Try again.")
      const page = pageSchema.parse(await response.json())
      if (ticket !== epoch.current) return
      setNotes((previous) => after ? [...previous, ...page.notes.filter((note) => !previous.some((item) => item.id === note.id))] : page.notes)
      setCursor(page.nextCursor)
    } catch (failure) {
      if (ticket === epoch.current) setError(failure instanceof Error ? failure.message : "Unable to load notes.")
    } finally { if (ticket === epoch.current) { setLoading(false); loadingRef.current = false } }
  }, [organizationId, search])
  const invalidate = useCallback(() => { epoch.current++ }, [])
  useEffect(() => {
    const ticket = ++epoch.current
    setCursor(null)
    void load(null, ticket)
    return invalidate
  }, [load, revision, invalidate])
  useEffect(() => {
    window.addEventListener(NOTES_CHANGED_EVENT, reload)
    window.addEventListener("focus", reload)
    return () => { window.removeEventListener(NOTES_CHANGED_EVENT, reload); window.removeEventListener("focus", reload) }
  }, [reload])
  const more = useCallback(() => {
    if (cursor && !loadingRef.current) void load(cursor, epoch.current)
  }, [cursor, load])
  return { notes, loading, error, more, reload, hasMore: Boolean(cursor), searching: query !== search }
}
