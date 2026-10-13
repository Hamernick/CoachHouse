import {
  normalizeWorkspaceDrawerTab,
  type WorkspaceDrawerTab,
} from "@/lib/workspace/routes"
import {
  isWorkspaceDataDrawerCollapsedSnapPoint,
  WORKSPACE_DATA_DRAWER_DEFAULT_SNAP_POINT,
} from "./workspace-canvas-overlay-drawer-state"

export type WorkspaceDrawerNavigation = {
  tab: WorkspaceDrawerTab
  snapPoint: number | string | null
}

// A rejected destination leaves both navigation and presentation unchanged.
export function resolveWorkspaceDrawerNavigation(
  current: WorkspaceDrawerNavigation,
  requested: string,
  leaveAccepted: boolean
): WorkspaceDrawerNavigation {
  const tab = normalizeWorkspaceDrawerTab(requested)
  if (!tab || !leaveAccepted) return current
  return {
    tab,
    snapPoint: isWorkspaceDataDrawerCollapsedSnapPoint(current.snapPoint)
      ? WORKSPACE_DATA_DRAWER_DEFAULT_SNAP_POINT
      : current.snapPoint,
  }
}

export function requestWorkspaceDrawerNavigation(
  current: WorkspaceDrawerNavigation,
  requested: string,
  leave: () => boolean
): WorkspaceDrawerNavigation {
  if (!normalizeWorkspaceDrawerTab(requested)) return current
  return resolveWorkspaceDrawerNavigation(current, requested, leave())
}
