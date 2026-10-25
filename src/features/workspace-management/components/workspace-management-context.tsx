"use client"

import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { useWorkspaceNavigation } from "../hooks/use-workspace-navigation"
import { WorkspaceNavigationDialog } from "./workspace-navigation-dialog"
import type { WorkspaceManagementScope, WorkspaceSummary } from "../types"
type AccessRequest = { orgId: string; workspace: WorkspaceSummary; returnFocus: HTMLElement }
const Context = createContext<{
  navigate: (href: string) => void
  accessRequest: AccessRequest | null
  setAccessRequest: (request: AccessRequest | null) => void
  scope: WorkspaceManagementScope | null
  setScope: (scope: WorkspaceManagementScope | null) => void
} | null>(null)
export function WorkspaceManagementProvider({ children }: { children: ReactNode }) {
  const [accessRequest, setAccessRequest] = useState<AccessRequest | null>(null)
  const [scope, setScope] = useState<WorkspaceManagementScope | null>(null)
  const pathname = usePathname()
  const navigation = useWorkspaceNavigation()
  const navigate = navigation.navigate
  // Keep the catalog while the canvas remounts or suspends; clear it on exit.
  useEffect(() => {
    if (pathname !== "/workspace") { setScope(null); setAccessRequest(null) }
  }, [pathname])
  const value = useMemo(() => ({ scope, setScope, accessRequest, setAccessRequest, navigate }), [scope, accessRequest, navigate])
  return <Context.Provider value={value}>{children}<WorkspaceNavigationDialog navigation={navigation} /></Context.Provider>
}
export function useWorkspaceManagement() { return useContext(Context) }
export function WorkspaceManagementBridge(scope: WorkspaceManagementScope) {
  const context = useWorkspaceManagement()
  const setScope = context?.setScope
  const { orgId, currentId, canEdit, workspaces } = scope
  useLayoutEffect(() => {
    setScope?.({ orgId, currentId, canEdit, workspaces })
  }, [setScope, orgId, currentId, canEdit, workspaces])
  return null
}
