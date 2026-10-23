"use client"

import { createContext, useContext, useLayoutEffect, type ReactNode } from "react"
import { organizationWorkspaceSupportEnabled } from "@/lib/feature-flags"
import { createOrganizationScopedFetch } from "../lib"

const originalFetchByWrapper = new WeakMap<typeof fetch, typeof fetch>()
const WorkspaceSupportMode = createContext(false)
export function useWorkspaceSupportMode() { return useContext(WorkspaceSupportMode) }

// Bind requests to the page's immutable target, rather than a cookie another tab
// can change. This header is a scope, never authorization; the server/RLS recheck it.
export function WorkspaceOrganizationScope({ organizationId, supportAccess = false, children }: { organizationId?: string; supportAccess?: boolean; children: ReactNode }) {
  useLayoutEffect(() => {
    if (!organizationWorkspaceSupportEnabled || !organizationId) return
    const originalFetch = originalFetchByWrapper.get(window.fetch) ?? window.fetch
    const scopedFetch = createOrganizationScopedFetch(originalFetch, organizationId, window.location.href, supportAccess)
    originalFetchByWrapper.set(scopedFetch, originalFetch)
    window.fetch = scopedFetch
    return () => { if (window.fetch === scopedFetch) window.fetch = originalFetch }
  }, [organizationId, supportAccess])
  return <WorkspaceSupportMode.Provider value={supportAccess}>{children}</WorkspaceSupportMode.Provider>
}
