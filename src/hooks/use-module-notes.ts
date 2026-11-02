"use client"

import { useWorkspaceDataScope } from "@/features/organization-workspace-support/client"
import { useCallback, useEffect, useRef, useState } from "react"
import { getModuleNotesAction, saveModuleNotesAction } from "@/app/actions/module-notes"
import type { Json } from "@/lib/supabase/schema/json"
import { moduleNotesDraftKey, readModuleNotesDraft, writeModuleNotesDraft, type ModuleNotesDraft } from "./module-notes-draft"

type LoadState = "loading" | "ready" | "error" | "conflict"
type Session = {
  key: string; active: boolean; loaded: boolean; value: string; base: string
  revision: Json | null; pending: Promise<void> | null
}

export function useModuleNotes(moduleId: string) {
  const { organizationId, storageKey: learningScope } = useWorkspaceDataScope()
  const key = moduleNotesDraftKey(learningScope, moduleId)
  const [value, setDisplayedValue] = useState("")
  const [loadState, setLoadState] = useState<LoadState>("loading")
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [savedValue, setSavedValue] = useState("")
  const session = useRef<Session | null>(null)
  const request = useRef(0)

  const persist = useCallback((current: Session) => {
    const stored = readModuleNotesDraft(current.key)
    if (current.value.trim() === current.base && stored && stored.content !== current.value) return
    const kept = writeModuleNotesDraft(current.key, current.value.trim() === current.base ? null : {
      content: current.value, base: current.base, revision: current.revision,
    })
    if (!kept && current.active) setError("This browser cannot keep a recovery draft. Keep this page open until your notes save.")
  }, [])

  const load = useCallback(async (preserved?: ModuleNotesDraft) => {
    const id = ++request.current
    if (session.current) session.current.active = false
    const draft = preserved ?? readModuleNotesDraft(key)
    const current: Session = { key, active: true, loaded: false, value: draft?.content ?? "", base: "", revision: null, pending: null }
    session.current = current
    setLoadState("loading")
    setIsSaving(false)
    setError(null)
    setDisplayedValue(current.value)
    try {
      const result = await getModuleNotesAction(moduleId, organizationId)
      if (!current.active || id !== request.current) return
      if ("error" in result) throw new Error(result.error)
      current.base = (result.notes?.content ?? "").trim()
      current.revision = result.revision
      current.value = draft?.content ?? result.notes?.content ?? ""
      setSavedValue(result.notes?.content ?? "")
      setDisplayedValue(current.value)
      if (draft && draft.base !== current.base && draft.content.trim() !== current.base) {
        setLoadState("conflict")
        return
      }
      current.loaded = true
      setLoadState("ready")
      persist(current)
    } catch {
      if (current.active && id === request.current) {
        setLoadState("error")
        setError("Notes could not be loaded. Retry before editing.")
      }
    }
  }, [key, moduleId, organizationId, persist])

  useEffect(() => {
    void load()
    return () => {
      request.current += 1
      if (session.current) session.current.active = false
    }
  }, [load])

  const setValue = useCallback((content: string) => {
    const current = session.current
    if (!current?.active || !current.loaded || current.key !== key) return
    current.value = content
    setDisplayedValue(content)
    persist(current)
  }, [key, persist])

  const saveNow = useCallback(async () => {
    const current = session.current
    if (!current?.active || !current.loaded || current.key !== key) return
    if (current.pending) return current.pending
    if (current.value.trim() === current.base) return
    const save = async () => {
      setIsSaving(true)
      setError(null)
      try {
        // Serialize changes; a successful older response never clears a newer draft.
        while (current.active && current.loaded && current.value.trim() !== current.base) {
          const content = current.value
          const result = await saveModuleNotesAction(moduleId, content, organizationId, current.revision)
          if (!current.active) return
          if ("error" in result) {
            setError(result.error)
            if (result.conflict) {
              current.loaded = false
              await load({ content: current.value, base: current.base, revision: current.revision })
            }
            return
          }
          current.base = (result.notes?.content ?? "").trim()
          current.revision = result.revision
          setSavedValue(result.notes?.content ?? "")
          persist(current)
        }
      } catch {
        if (current.active) setError("Notes could not be saved. Your draft is kept on this device. Retry.")
      } finally {
        current.pending = null
        if (current.active) setIsSaving(false)
      }
    }
    current.pending = save()
    return current.pending
  }, [key, load, moduleId, organizationId, persist])

  useEffect(() => {
    if (loadState !== "ready") return
    const timer = setTimeout(() => { void saveNow() }, 600)
    return () => clearTimeout(timer)
  }, [value, loadState, saveNow])

  useEffect(() => {
    const flush = () => {
      const current = session.current
      if (!current?.active || !current.loaded || current.key !== key || current.value.trim() === current.base) return
      void fetch(`/api/modules/${moduleId}/notes`, {
        method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true,
        body: JSON.stringify({ content: current.value, organizationId, revision: current.revision }),
      }).catch(() => { /* The scoped draft remains until an acknowledged save or read. */ })
    }
    const warn = (event: BeforeUnloadEvent) => {
      const current = session.current
      if (current?.active && current.value.trim() !== current.base) { event.preventDefault(); event.returnValue = "" }
    }
    window.addEventListener("pagehide", flush)
    window.addEventListener("beforeunload", warn)
    return () => { window.removeEventListener("pagehide", flush); window.removeEventListener("beforeunload", warn) }
  }, [key, moduleId, organizationId])

  const resolveConflict = useCallback((useDraft: boolean) => {
    const current = session.current
    if (!current?.active || current.key !== key || loadState !== "conflict") return
    current.loaded = true
    if (!useDraft) current.value = savedValue
    setDisplayedValue(current.value)
    setLoadState("ready")
    setError(null)
    persist(current)
  }, [key, loadState, persist, savedValue])

  return { value, setValue, saveNow, isSaving, loadState, error, retryLoad: load, savedValue, resolveConflict }
}
