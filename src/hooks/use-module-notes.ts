"use client"

import { useWorkspaceDataScope } from "@/features/organization-workspace-support/client"
import { useCallback, useEffect, useRef, useState } from "react"

import { getModuleNotesAction, saveModuleNotesAction } from "@/app/actions/module-notes"
import { useDebounce } from "@/hooks/use-debounce"
import { toast } from "@/lib/toast"

function normalizeContent(value: string) {
  return value.trim()
}

export function useModuleNotes(moduleId: string) {
  const { organizationId, storageKey: learningScope } = useWorkspaceDataScope()
  const [value, setValue] = useState("")
  const [loaded, setLoaded] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const lastSavedRef = useRef<string>("")
  const valueRef = useRef(value)
  const mountedRef = useRef(true)
  const loadErrorShown = useRef(false)
  const saveErrorShown = useRef(false)
  const debounced = useDebounce(value, 600)

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    valueRef.current = value
  }, [value])

  const saveNow = useCallback(
    async (rawContent?: string) => {
      if (!loaded) return
      const nextRawValue = rawContent ?? valueRef.current
      const nextNormalizedValue = normalizeContent(nextRawValue)
      if (nextNormalizedValue === lastSavedRef.current) return

      if (mountedRef.current) {
        setIsSaving(true)
      }
      const result = await saveModuleNotesAction(moduleId, nextRawValue, organizationId)
      if (mountedRef.current) {
        setIsSaving(false)
      }

      if ("error" in result) {
        if (!saveErrorShown.current) {
          toast.error(result.error)
          saveErrorShown.current = true
        }
        return
      }

      saveErrorShown.current = false
      lastSavedRef.current = normalizeContent(result.notes?.content ?? "")
    },
    [loaded, moduleId, organizationId],
  )

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
      body: JSON.stringify({ content: nextRawValue, organizationId }),
      keepalive: true,
    }).catch(() => {
      // Non-blocking best-effort flush for refresh/navigation.
    })
  }, [loaded, moduleId, organizationId])

  useEffect(() => {
    let cancelled = false
    setLoaded(false)
    setValue("")
    void getModuleNotesAction(moduleId, organizationId).then((result) => {
      if (cancelled) return
      if ("error" in result) {
        if (!loadErrorShown.current) {
          toast.error(result.error)
          loadErrorShown.current = true
        }
        return
      }
      const nextValue = result.notes?.content ?? ""
      lastSavedRef.current = normalizeContent(nextValue)
      setValue(nextValue)
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [moduleId, organizationId, learningScope])

  useEffect(() => {
    if (!loaded || normalizeContent(debounced) !== normalizeContent(valueRef.current)) return
    void saveNow(debounced)
  }, [debounced, loaded, saveNow])

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

  return { value, setValue, saveNow, isSaving }
}
