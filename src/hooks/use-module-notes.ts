"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
import {
  NOTES_CHANGED_EVENT,
  notifyNotesChanged,
} from "@/lib/modules/notes-events"

import {
  getModuleNotesAction,
  saveModuleNotesAction,
} from "@/app/actions/module-notes"
import { useDebounce } from "@/hooks/use-debounce"
import { toast } from "@/lib/toast"

function normalizeContent(value: string) {
  return value.trim()
}

export function useModuleNotes(moduleId: string) {
  const [value, setValue] = useState("")
  const [loaded, setLoaded] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const origin = useId()
  const saving = useRef<Promise<boolean> | null>(null)
  const loadEpoch = useRef(0)
  const lastSavedRef = useRef<string>("")
  const valueRef = useRef(value)
  const mountedRef = useRef(true)
  const loadErrorShown = useRef(false)
  const saveErrorShown = useRef(false)
  const debounced = useDebounce(value, 600)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    valueRef.current = value
  }, [value])

  const saveNow = useCallback(async () => {
    if (!loaded) return
    while (saving.current) await saving.current
    const nextRawValue = valueRef.current
    const nextNormalizedValue = normalizeContent(nextRawValue)
    if (nextNormalizedValue === lastSavedRef.current) return

    if (mountedRef.current) {
      setIsSaving(true)
    }
    const request = saveModuleNotesAction(moduleId, nextRawValue).catch(() => ({
      error: "Unable to save notes. Retry to keep your draft.",
    }))
    saving.current = request.then((result) => !("error" in result))
    const result = await request
    saving.current = null
    if (mountedRef.current) {
      setIsSaving(false)
    }

    if ("error" in result) {
      if (mountedRef.current) setError(result.error)
      if (!saveErrorShown.current) {
        toast.error(result.error)
        saveErrorShown.current = true
      }
      return
    }

    saveErrorShown.current = false
    lastSavedRef.current = normalizeContent(result.notes?.content ?? "")
    if (mountedRef.current) setError(null)
    notifyNotesChanged(moduleId, origin)
  }, [loaded, moduleId, origin])

  const saveWithKeepalive = useCallback(() => {
    if (!loaded) return
    const nextRawValue = valueRef.current
    const nextNormalizedValue = normalizeContent(nextRawValue)
    if (nextNormalizedValue === lastSavedRef.current) return

    void fetch(`/api/modules/${moduleId}/notes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: nextRawValue }),
      keepalive: true,
    }).catch(() => {
      // Non-blocking best-effort flush for refresh/navigation.
    })
  }, [loaded, moduleId])

  const reload = useCallback(async () => {
    const epoch = ++loadEpoch.current
    const initialValue = valueRef.current
    setLoaded(false)
    const result = await getModuleNotesAction(moduleId).catch(() => ({
      error: "Unable to load notes. Try again.",
    }))
    if (!mountedRef.current || epoch !== loadEpoch.current) return
    if ("error" in result) {
      setError(result.error)
      if (!loadErrorShown.current) {
        toast.error(result.error)
        loadErrorShown.current = true
      }
      return
    }
    const nextValue = result.notes?.content ?? ""
    lastSavedRef.current = normalizeContent(nextValue)
    if (valueRef.current === initialValue) {
      valueRef.current = nextValue
      setValue(nextValue)
    }
    setLoaded(true)
    setError(null)
    loadErrorShown.current = false
  }, [moduleId])

  const invalidateLoad = useCallback(() => {
    loadEpoch.current++
  }, [])
  useEffect(() => {
    void reload()
    return invalidateLoad
  }, [reload, invalidateLoad])

  useEffect(() => {
    if (!loaded) return
    void saveNow()
  }, [debounced, loaded, saveNow])

  useEffect(() => {
    const changed = (event: Event) => {
      if (
        !(event instanceof CustomEvent) ||
        event.detail?.moduleId !== moduleId ||
        event.detail?.origin === origin
      )
        return
      if (normalizeContent(valueRef.current) === lastSavedRef.current)
        void reload()
    }
    window.addEventListener(NOTES_CHANGED_EVENT, changed)
    return () => window.removeEventListener(NOTES_CHANGED_EVENT, changed)
  }, [moduleId, origin, reload])

  useEffect(() => {
    if (!loaded) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        saveWithKeepalive()
      }
    }

    const handlePageHide = () => {
      saveWithKeepalive()
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("pagehide", handlePageHide)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("pagehide", handlePageHide)
      void saveNow()
    }
  }, [loaded, saveNow, saveWithKeepalive])

  const update = (next: string) => {
    valueRef.current = next
    setValue(next)
  }
  return {
    value,
    setValue: update,
    saveNow,
    isSaving,
    loaded,
    error,
    reload,
    dirty: normalizeContent(value) !== lastSavedRef.current,
  }
}
