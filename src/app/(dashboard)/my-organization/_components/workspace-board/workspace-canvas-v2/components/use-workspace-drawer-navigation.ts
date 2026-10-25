"use client"

import {
  useCallback,
  type Dispatch,
  type SetStateAction,
} from "react"
import {
  patchWorkspaceBoardUiPreferences,
  type WorkspaceBoardUiPreferenceScope,
} from "../../workspace-board-ui-preferences"
import type { WorkspaceCanvasDrawerTab } from "./workspace-canvas-overlay-drawer-tabs"
import { isWorkspaceDataDrawerCollapsedSnapPoint, WORKSPACE_DATA_DRAWER_COLLAPSED_SNAP_POINT } from "./workspace-canvas-overlay-drawer-state"
import { resolveWorkspaceDrawerNavigation } from "./workspace-drawer-navigation"

export function useWorkspaceDrawerNavigation({
  tab,
  activeSnapPoint,
  setTab,
  onSnap,
  uiPreferencesScope,
  onCloseParticleInspector,
  particleSelectionId,
  retainOnParticleClear,
}: {
  tab: WorkspaceCanvasDrawerTab
  activeSnapPoint: number | string | null
  setTab: Dispatch<SetStateAction<WorkspaceCanvasDrawerTab>>
  onSnap: (snap: number | string | null) => void
  uiPreferencesScope: WorkspaceBoardUiPreferenceScope
  onCloseParticleInspector?: (onAccepted?: () => void) => boolean
  particleSelectionId?: string | null
  retainOnParticleClear: () => void
}) {
  const leaveParticle = useCallback((onAccepted?: () => void) => {
    const resume = () => {
      if (particleSelectionId) retainOnParticleClear()
      onAccepted?.()
    }
    if (onCloseParticleInspector?.(resume) === false) return false
    if (particleSelectionId) retainOnParticleClear()
    return true
  }, [onCloseParticleInspector, particleSelectionId, retainOnParticleClear])
  const handleTabChange = useCallback(
    (value: string) => {
      const current = { tab, snapPoint: activeSnapPoint }
      const next = resolveWorkspaceDrawerNavigation(current, value, true)
      if (next === current) return
      const commit = () => {
        patchWorkspaceBoardUiPreferences(uiPreferencesScope, { dataDrawerTab: next.tab })
        setTab(next.tab)
        onSnap(next.snapPoint)
      }
      if (leaveParticle(commit)) commit()
    },
    [tab, activeSnapPoint, leaveParticle, onSnap, setTab, uiPreferencesScope]
  )
  const handleTabOpen = useCallback(
    (value: WorkspaceCanvasDrawerTab, toggleCurrent = false) => {
      // Radix handles other destinations. The current visible panel toggles;
      // retained panel drafts stay mounted while collapsed.
      if (value !== tab) return
      if (toggleCurrent && !particleSelectionId && !isWorkspaceDataDrawerCollapsedSnapPoint(activeSnapPoint)) {
        onSnap(WORKSPACE_DATA_DRAWER_COLLAPSED_SNAP_POINT)
      } else handleTabChange(value)
    },
    [tab, handleTabChange, particleSelectionId, activeSnapPoint, onSnap]
  )
  return { handleTabChange, handleTabOpen, leaveParticle }
}
