"use client"

import { useEffect, useRef, useState } from "react"
import { useWorkspaceWindowHeaderActive } from "@/components/workspace/workspace-window-header-slots"
import { subscribeWorkspaceAccessChanged } from "@/lib/workspace/access-events"
import { revalidateCoreDocuments } from "../core-access-actions"

type Scope = { organizationId: string; userId: string }
type Access = { key: string; state: "checking" | "ready" | "locked"; canEdit: boolean }

/** Preserve the draft owner during checks; callers unmount bodies and portals
 * and disable saving when unavailable. A denied session requires reopening. */
export function useCoreDocumentAccess(scope: Scope | undefined, sectionIds: string[]) {
  const active = useWorkspaceWindowHeaderActive()
  const key = JSON.stringify(scope ? { ...scope, sectionIds: [...new Set(sectionIds)].sort() } : null)
  const [access, setAccess] = useState<Access>({ key, state: "checking", canEdit: false })
  const retired = useRef<string | null>(null)
  useEffect(() => {
    if (!scope) return
    if (retired.current === key) return
    retired.current = null
    setAccess({ key, state: "checking", canEdit: false })
    if (!active) return
    const input = JSON.parse(key) as Scope & { sectionIds: string[] }
    let disposed = false, epoch = 0, pending = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const cancel = () => { epoch++; pending = false; clearTimeout(timer) }
    const fail = () => {
      retired.current = key; cancel()
      setAccess({ key, state: "locked", canEdit: false })
    }
    const check = (clear = false) => {
      if (disposed || retired.current === key || (pending && !clear)) return
      if (clear) { cancel(); setAccess({ key, state: "checking", canEdit: false }) }
      if (document.visibilityState === "hidden") return
      const version = ++epoch
      pending = true
      timer = setTimeout(fail, 15000)
      void revalidateCoreDocuments(input).then(result => {
        if (disposed || version !== epoch || retired.current === key) return
        if (result?.userId !== input.userId || result.organizationId !== input.organizationId || typeof result.canEdit !== "boolean") { fail(); return }
        clearTimeout(timer); pending = false
        setAccess({ key, state: "ready", canEdit: result.canEdit })
      }).catch(() => { if (!disposed && version === epoch) fail() })
    }
    const focus = () => check()
    const invalidate = () => check(true)
    const hide = () => {
      if (retired.current === key) return
      cancel(); setAccess({ key, state: "checking", canEdit: false })
    }
    const visibility = () => document.visibilityState === "hidden" ? hide() : invalidate()
    const unsubscribe = subscribeWorkspaceAccessChanged(input.organizationId, invalidate)
    window.addEventListener("focus", focus)
    window.addEventListener("online", invalidate)
    window.addEventListener("pageshow", invalidate)
    window.addEventListener("pagehide", hide)
    document.addEventListener("visibilitychange", visibility)
    check()
    return () => {
      disposed = true; cancel(); unsubscribe()
      window.removeEventListener("focus", focus)
      window.removeEventListener("online", invalidate)
      window.removeEventListener("pageshow", invalidate)
      window.removeEventListener("pagehide", hide)
      document.removeEventListener("visibilitychange", visibility)
    }
  // Primitive key captures the entire source scope; typing must not restart checks.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, active])
  if (!scope) return { state: "ready" as const, canEdit: true }
  if (retired.current === key) return { state: "locked" as const, canEdit: false }
  return active && access.key === key ? access : { state: "checking" as const, canEdit: false }
}
