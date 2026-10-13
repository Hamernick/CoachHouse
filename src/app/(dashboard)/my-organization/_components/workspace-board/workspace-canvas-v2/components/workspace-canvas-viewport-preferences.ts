"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MutableRefObject,
} from "react"
import type { OnMoveEnd, ReactFlowInstance } from "@xyflow/react"

import {
  normalizeWorkspaceCanvasViewportPreference,
  patchWorkspaceBoardUiPreferences,
  readWorkspaceBoardUiPreferences,
  type WorkspaceBoardUiPreferenceScope,
  type WorkspaceCanvasViewportPreference,
  WORKSPACE_CANVAS_VIEWPORT_LAYOUT_VERSION,
} from "../../workspace-board-ui-preferences"

type WorkspaceCanvasViewportPreferenceState = {
  loaded: boolean
  viewport: WorkspaceCanvasViewportPreference | null
}

export function useWorkspaceCanvasViewportPreferences({
  flowInstanceRef,
  isFlowReady,
  orgId,
  tutorialActive,
  viewerId,
}: {
  flowInstanceRef: MutableRefObject<ReactFlowInstance | null>
  isFlowReady: boolean
  orgId: string
  tutorialActive: boolean
  viewerId: string
}) {
  const uiPreferencesScope = useMemo<WorkspaceBoardUiPreferenceScope>(
    () => ({
      orgId,
      viewerId,
    }),
    [orgId, viewerId]
  )
  const [canvasViewportPreferenceState, setCanvasViewportPreferenceState] =
    useState<WorkspaceCanvasViewportPreferenceState>({
      loaded: false,
      viewport: null,
    })
  const [viewportZoom, setViewportZoom] = useState(1)

  useEffect(() => {
    const preferences = readWorkspaceBoardUiPreferences(uiPreferencesScope)
    const layoutMatches =
      preferences.canvasViewportLayoutVersion ===
      WORKSPACE_CANVAS_VIEWPORT_LAYOUT_VERSION
    const canvasViewport = layoutMatches ? preferences.canvasViewport : null
    if (canvasViewport) {
      setViewportZoom(canvasViewport.zoom)
    }
    if (!layoutMatches) {
      patchWorkspaceBoardUiPreferences(uiPreferencesScope, {
        canvasViewport: null,
        canvasViewportLayoutVersion: WORKSPACE_CANVAS_VIEWPORT_LAYOUT_VERSION,
      })
    }
    setCanvasViewportPreferenceState({
      loaded: true,
      viewport: canvasViewport,
    })
  }, [uiPreferencesScope])

  useEffect(() => {
    if (!canvasViewportPreferenceState.loaded) return
    if (!canvasViewportPreferenceState.viewport) return
    if (tutorialActive) return
    if (!isFlowReady) return
    const flowInstance = flowInstanceRef.current
    if (!flowInstance) return

    void flowInstance.setViewport(canvasViewportPreferenceState.viewport, {
      duration: 0,
    })
  }, [
    canvasViewportPreferenceState.loaded,
    canvasViewportPreferenceState.viewport,
    flowInstanceRef,
    isFlowReady,
    tutorialActive,
  ])

  const handleCanvasMoveEnd = useCallback<OnMoveEnd>(
    (_event, viewport) => {
      setViewportZoom(viewport.zoom)
      if (!canvasViewportPreferenceState.loaded) return
      if (tutorialActive) return
      const canvasViewport =
        normalizeWorkspaceCanvasViewportPreference(viewport)
      if (!canvasViewport) return

      patchWorkspaceBoardUiPreferences(uiPreferencesScope, {
        canvasViewport,
        canvasViewportLayoutVersion: WORKSPACE_CANVAS_VIEWPORT_LAYOUT_VERSION,
      })
    },
    [canvasViewportPreferenceState.loaded, tutorialActive, uiPreferencesScope]
  )

  return {
    handleCanvasMoveEnd,
    viewportZoom,
    suppressInitialFit:
      !canvasViewportPreferenceState.loaded ||
      (!tutorialActive && canvasViewportPreferenceState.viewport !== null),
    uiPreferencesScope,
  }
}
