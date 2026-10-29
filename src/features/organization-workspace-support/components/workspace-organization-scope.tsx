"use client"

import { createContext, useContext, useLayoutEffect, type ReactNode } from "react"
import { organizationWorkspaceSupportEnabled } from "@/lib/feature-flags"
import { createOrganizationScopedFetch } from "../lib"

const originalFetchByWrapper = new WeakMap<typeof fetch, typeof fetch>()
const WorkspaceDataScope = createContext<{ organizationId?: string; storageKey: string }>({ storageKey: "unscoped" })
export function useWorkspaceDataScope() { return useContext(WorkspaceDataScope) }
const WorkspaceSupportMode = createContext(false)
export function useWorkspaceSupportMode() { return useContext(WorkspaceSupportMode) }

// Bind requests to the page's immutable target, rather than a cookie another tab
// can change. This header is a scope, never authorization; the server/RLS recheck it.
export function WorkspaceOrganizationScope({ organizationId, actorId, supportAccess = false, children }: { organizationId?: string; actorId?: string; supportAccess?: boolean; children: ReactNode }) {
  useLayoutEffect(() => {
    if (!organizationWorkspaceSupportEnabled || !organizationId) return
    const originalFetch = originalFetchByWrapper.get(window.fetch) ?? window.fetch
    const scopedFetch = createOrganizationScopedFetch(originalFetch, organizationId, window.location.href, supportAccess)
    originalFetchByWrapper.set(scopedFetch, originalFetch)
    window.fetch = scopedFetch
    return () => { if (window.fetch === scopedFetch) window.fetch = originalFetch }
  }, [organizationId, supportAccess])
  const storageKey = `${organizationId ?? "none"}:${actorId ?? "none"}`
  return (
    <WorkspaceDataScope.Provider key={storageKey} value={{ organizationId, storageKey }}>
      <WorkspaceSupportMode.Provider value={supportAccess}>{children}</WorkspaceSupportMode.Provider>
    </WorkspaceDataScope.Provider>
  )
}
