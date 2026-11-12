"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { WorkspacePageLoading } from "@/components/workspace/workspace-page-loading"
import { subscribeWorkspaceAccessChanged } from "@/lib/workspace/access-events"
import { revalidateWorkspaceCanvasAccess } from "../canvas-access-actions"
import { useWorkspaceManagement } from "./workspace-management-context"

import { CanvasSourceContext } from "@/components/workspace/workspace-canvas-source-context"
import { emptyCanvasSourceReferences, mergeCanvasSourceReferences, type CanvasSourceReferences } from "@/lib/workspace/canvas-source-references"

type Scope = { orgId: string; canvasId: string | null; viewerId: string; role: string; canEdit: boolean }

export function WorkspaceCanvasAccessBoundary({ children, initialSources, ...scope }: Scope & { children: ReactNode; initialSources?: CanvasSourceReferences }) {
  // New scope gets a new admission session; an old response cannot reveal it.
  return <CanvasAccessSession key={JSON.stringify(scope)} {...scope} initialSources={initialSources}>{children}</CanvasAccessSession>
}

function CanvasAccessSession({ children, orgId, canvasId, viewerId, role, canEdit, initialSources }: Scope & { children: ReactNode; initialSources?: CanvasSourceReferences }) {
  const [state, setState] = useState<"checking" | "ready" | "retired">("checking")
  const management = useWorkspaceManagement()
  const setScope = management?.setScope
  const setAccessRequest = management?.setAccessRequest
  const sources = useRef(initialSources ?? emptyCanvasSourceReferences())
  const recheck = useRef<(() => void) | null>(null)
  const register = useCallback((next: CanvasSourceReferences, reopen = false) => {
    const merged = mergeCanvasSourceReferences(sources.current, next)
    if (merged === sources.current && !reopen) return
    sources.current = merged
    recheck.current?.()
  }, [])
  const recovery = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    setScope?.(null)
    setAccessRequest?.(null)
    let active = true, retired = false, inFlight = false, epoch = 0
    let timeout: ReturnType<typeof setTimeout> | undefined
    const check = (supersede = false) => {
      if (!active || retired || (inFlight && !supersede)) return
      const version = ++epoch
      clearTimeout(timeout)
      if (document.visibilityState === "hidden") { inFlight = false; return }
      inFlight = true
      const finish = (result: Awaited<ReturnType<typeof revalidateWorkspaceCanvasAccess>>) => {
        if (!active || version !== epoch || retired) return
        clearTimeout(timeout)
        inFlight = false
        if (!result.allowed || result.viewerId !== viewerId || result.role !== role || result.canEdit !== canEdit) {
          retired = true
          setScope?.(null)
          setAccessRequest?.(null)
          setState("retired")
        } else setState("ready")
      }
      timeout = setTimeout(() => finish({ allowed: false }), 15000)
      void revalidateWorkspaceCanvasAccess({ orgId, canvasId, sources: sources.current }).then(finish, () => finish({ allowed: false }))
    }
    const focus = () => check()
    const invalidate = () => check(true)
    recheck.current = invalidate
    const unsubscribe = subscribeWorkspaceAccessChanged(orgId, invalidate)
    window.addEventListener("focus", focus)
    window.addEventListener("online", invalidate)
    window.addEventListener("pagehide", invalidate)
    window.addEventListener("pageshow", invalidate)
    document.addEventListener("visibilitychange", invalidate)
    check(true)
    return () => {
      recheck.current = null
      active = false; epoch++; clearTimeout(timeout)
      unsubscribe()
      window.removeEventListener("focus", focus)
      window.removeEventListener("online", invalidate)
      window.removeEventListener("pagehide", invalidate)
      window.removeEventListener("pageshow", invalidate)
      document.removeEventListener("visibilitychange", invalidate)
    }
  }, [orgId, canvasId, viewerId, role, canEdit, setScope, setAccessRequest])
  useEffect(() => { if (state === "retired") recovery.current?.focus() }, [state])
  if (state === "retired") return <div className="flex flex-1 items-center justify-center">
    <Button ref={recovery} variant="outline" onClick={() => window.location.assign("/workspace")}>Open workspaces</Button>
    <span role="status" className="sr-only">Workspace access needs refreshing.</span>
  </div>
  // Keep the admitted tree intact during background checks. Hiding only its
  // DOM would miss portaled editors; remounting would discard authorized drafts.
  // Denial/error unmounts the entire tree above, including all React portals.
  return state === "checking" ? <WorkspacePageLoading embedded /> : <CanvasSourceContext.Provider value={register}>{children}</CanvasSourceContext.Provider>
}
