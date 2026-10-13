"use client"

import {
  useCallback,
  useTransition,
  type Dispatch,
  type SetStateAction,
} from "react"
import {
  patchWorkspaceBoardUiPreferences,
  type WorkspaceBoardUiPreferenceScope,
} from "../../workspace-board-ui-preferences"
import type { WorkspaceCanvasDrawerTab } from "./workspace-canvas-overlay-drawer-tabs"
import { requestWorkspaceDrawerNavigation } from "./workspace-drawer-navigation"

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
  onCloseParticleInspector?: () => boolean
  particleSelectionId?: string | null
  retainOnParticleClear: () => void
}) {
  const [, startTabTransition] = useTransition()
  const leaveParticle = useCallback(() => {
    if (onCloseParticleInspector?.() === false) return false
    if (particleSelectionId) retainOnParticleClear()
    return true
  }, [onCloseParticleInspector, particleSelectionId, retainOnParticleClear])
  const handleTabChange = useCallback(
    (value: string) => {
      const current = { tab, snapPoint: activeSnapPoint }
      const next = requestWorkspaceDrawerNavigation(
        current,
        value,
        leaveParticle
      )
      if (next === current) return
      patchWorkspaceBoardUiPreferences(uiPreferencesScope, {
        dataDrawerTab: next.tab,
      })
      startTabTransition(() => {
        setTab(next.tab)
      })
      onSnap(next.snapPoint)
    },
    [tab, activeSnapPoint, leaveParticle, onSnap, setTab, uiPreferencesScope]
  )
  const handleTabOpen = useCallback(
    (value: WorkspaceCanvasDrawerTab) => {
      // Radix handles a changed value. Clicking the already selected tab restores it.
      if (value === tab) handleTabChange(value)
    },
    [tab, handleTabChange]
  )
  return { handleTabChange, handleTabOpen, leaveParticle }
}
