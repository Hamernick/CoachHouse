"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useWorkspaceEditorStatus } from "@/components/workspace/workspace-editor-status"
import type { OrgProfile } from "@/lib/organization/org-profile-brand-types"
import type { WorkspaceBrandKitProfileEditorProps } from "../components/workspace-brand-kit-profile-editor-types"

export function useWorkspaceBrandInlineSave(props: WorkspaceBrandKitProfileEditorProps) {
  const locked = useRef(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [dirtyFields, setDirtyFields] = useState<Set<string>>(() => new Set())
  const reportDirty = useCallback((id: string, dirty: boolean) => {
    setDirtyFields((previous) => {
      if (previous.has(id) === dirty) return previous
      const next = new Set(previous)
      if (dirty) next.add(id); else next.delete(id)
      return next
    })
  }, [])
  useWorkspaceEditorStatus({ label: "Brand kit", dirty: dirtyFields.size > 0, pending, error: Boolean(error) })
  useEffect(() => {
    if (!pending) return
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener("beforeunload", guard)
    return () => window.removeEventListener("beforeunload", guard)
  }, [pending])
  async function save(updates: Partial<OrgProfile>) {
    if (props.readOnly) throw new Error("This brand kit is read-only.")
    if (!props.inlineEdit) { props.onChange(updates); return }
    if (locked.current) throw new Error("Another change is saving. Try again in a moment.")
    if (!props.profile.expectedOrganizationId) throw new Error("Reload the organization before saving.")
    locked.current = true
    setPending(true)
    setError("")
    try {
      await props.onAutoSave({ ...updates, expectedOrganizationId: props.profile.expectedOrganizationId })
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save this change. Please try again.")
      throw error
    } finally { locked.current = false; setPending(false) }
  }
  return { save, pending, error, reportDirty }
}
