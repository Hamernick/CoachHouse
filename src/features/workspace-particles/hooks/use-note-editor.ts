"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { NOTES_CHANGED_EVENT, notifyNotesChanged } from "@/lib/modules/notes-events"
import { sameNoteContent, type NoteContent } from "@/lib/modules/note-content"
import { NoteSaveError, readNote, writeNote, type NoteDetail } from "../lib/note-editor-client"
import type { NoteDocument } from "../lib/particle-notes"

type Attempt = { detail: NoteDetail; body: NoteContent; id: string }
export function useNoteEditor(note: NoteDocument | null, organizationId: string, editable: boolean) {
  const router = useRouter()
  const origin = useId()
  const [detail, setDetail] = useState<NoteDetail | null>(null)
  const [draft, setDraft] = useState<NoteContent>({ content: "" })
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [generation, setGeneration] = useState(0)
  const [initialBody, setInitialBody] = useState<NoteContent>({ content: "" })
  const current = useRef({ detail, draft })
  const attempt = useRef<Attempt | null>(null)
  const flight = useRef<Promise<boolean> | null>(null)
  const epoch = useRef(0)
  const mounted = useRef(true)
  const dirty = Boolean(detail && !sameNoteContent(draft, detail.body))
  const canEdit = Boolean(note && (note.source.kind === "module_note" || editable))
  const update = useCallback((body: NoteContent) => {
    current.current.draft = body
    setDraft(body)
  }, [])
  const reload = useCallback(async (quiet = false) => {
    const ticket = ++epoch.current
    if (!quiet) {
      setError(null)
      setDetail(null)
      current.current.detail = null
      attempt.current = null
    }
    if (!note) return
    try {
      const next = await readNote(note, organizationId)
      if (!mounted.current || ticket !== epoch.current) return
      if (quiet) {
        const snapshot = current.current
        if (flight.current || !snapshot.detail || !sameNoteContent(snapshot.draft, snapshot.detail.body)) return
        if (sameNoteContent(snapshot.detail.body, next.body)) {
          current.current.detail = next
          setDetail(next)
          return
        }
      }
      current.current = { detail: next, draft: next.body }
      setDetail(next); setDraft(next.body); setInitialBody(next.body)
      setGeneration((value) => value + 1)
    } catch (failure) {
      if (!quiet && mounted.current && ticket === epoch.current) setError(failure instanceof Error ? failure.message : "Unable to load this note.")
    }
  }, [note, organizationId])
  const invalidate = useCallback(() => { epoch.current++ }, [])
  useEffect(() => {
    mounted.current = true
    void reload()
    return () => { mounted.current = false; invalidate() }
  }, [reload, invalidate])

  const save = useCallback(async (): Promise<boolean> => {
    if (flight.current) { if (!await flight.current) return false }
    if (!note || !current.current.detail) return false
    if (sameNoteContent(current.current.draft, current.current.detail.body)) return true
    if (!canEdit) return false
    const run = async () => {
      setPending(true)
      try {
        // Confirm an ambiguous response with the same operation ID before saving newer typing.
        for (let pass = 0; pass < 2; pass++) {
          const snapshot = current.current
          if (!snapshot.detail || sameNoteContent(snapshot.draft, snapshot.detail.body)) break
          const request = attempt.current ?? { detail: snapshot.detail, body: snapshot.draft, id: crypto.randomUUID() }
          attempt.current = request
          const next = await writeNote(note, request.detail, request.body, request.id)
          if (!next) throw new Error("Unable to confirm this note.")
          attempt.current = null
          const unchanged = sameNoteContent(current.current.draft, request.body)
          current.current.detail = next
          if (unchanged) current.current.draft = next.body
          if (!mounted.current) return true
          setDetail(next)
          if (unchanged) setDraft(next.body)
          setError(null)
          notifyNotesChanged(note.source.kind === "module_note" ? note.source.moduleId : undefined, origin)
        }
        router.refresh()
        return Boolean(current.current.detail && sameNoteContent(current.current.draft, current.current.detail.body))
      } catch (failure) {
        if (failure instanceof NoteSaveError && !failure.retryable) attempt.current = null
        if (mounted.current) setError(failure instanceof Error ? failure.message : "Note not saved. Your draft is still here.")
        return false
      } finally { if (mounted.current) setPending(false) }
    }
    const request = run()
    flight.current = request
    try { return await request } finally { if (flight.current === request) flight.current = null }
  }, [note, canEdit, router, origin])
  useEffect(() => {
    if (!dirty || error || !canEdit || pending) return
    const timer = setTimeout(() => void save(), 650)
    return () => clearTimeout(timer)
  }, [dirty, draft, error, canEdit, pending, save])
  useEffect(() => {
    if (!dirty && !pending) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty, pending])
  useEffect(() => {
    const refresh = (event: Event) => {
      if (event instanceof CustomEvent && (event.detail?.origin === origin ||
        (event.detail?.moduleId && (note?.source.kind !== "module_note" || event.detail.moduleId !== note.source.moduleId)))) return
      const snapshot = current.current
      if (!flight.current && snapshot.detail && sameNoteContent(snapshot.draft, snapshot.detail.body)) void reload(true)
    }
    window.addEventListener(NOTES_CHANGED_EVENT, refresh)
    window.addEventListener("focus", refresh)
    return () => { window.removeEventListener(NOTES_CHANGED_EVENT, refresh); window.removeEventListener("focus", refresh) }
  }, [note, origin, reload])
  const remove = async () => {
    if (flight.current) await flight.current
    const snapshot = current.current.detail
    if (!note || !snapshot || !canEdit) return false
    setPending(true)
    try {
      await writeNote(note, snapshot, null, crypto.randomUUID())
      attempt.current = null
      current.current = { detail: null, draft: { content: "" } }
      setDetail(null); setDraft({ content: "" }); setError(null)
      notifyNotesChanged(note.source.kind === "module_note" ? note.source.moduleId : undefined, origin)
      router.refresh()
      return true
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to delete this note.")
      return false
    } finally { setPending(false) }
  }
  return { detail, draft, initialBody, generation, dirty, pending, error, canEdit, update, reload, save, remove }
}
