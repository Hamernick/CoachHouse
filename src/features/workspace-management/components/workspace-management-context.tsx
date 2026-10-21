"use client"

import { createContext, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from "react"
import type { WorkspaceManagementScope, WorkspaceSummary } from "../types"
type AccessRequest = { orgId: string; workspace: WorkspaceSummary; returnFocus: HTMLElement }
const Context = createContext<{
  accessRequest: AccessRequest | null
  setAccessRequest: (request: AccessRequest | null) => void
  scope: WorkspaceManagementScope | null
  setScope: (scope: WorkspaceManagementScope | null) => void
} | null>(null)
export function WorkspaceManagementProvider({ children }: { children: ReactNode }) {
  const [accessRequest, setAccessRequest] = useState<AccessRequest | null>(null)
  const [scope, setScope] = useState<WorkspaceManagementScope | null>(null)
  const value = useMemo(() => ({ scope, setScope, accessRequest, setAccessRequest }), [scope, accessRequest])
  return <Context.Provider value={value}>{children}</Context.Provider>
}
export function useWorkspaceManagement() { return useContext(Context) }
export function WorkspaceManagementBridge(scope: WorkspaceManagementScope) {
  const context = useWorkspaceManagement()
  const setScope = context?.setScope
  const { orgId, currentId, canEdit, workspaces } = scope
  useLayoutEffect(() => {
    setScope?.({ orgId, currentId, canEdit, workspaces })
    return () => setScope?.(null)
  }, [setScope, orgId, currentId, canEdit, workspaces])
  return null
}
