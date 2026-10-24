"use client"

import { useMemo, type MutableRefObject } from "react"
import type { ReactFlowInstance } from "@xyflow/react"

import type { WorkspaceBoardUiPreferenceScope } from "../../workspace-board-ui-preferences"
import { useWorkspaceCanvasPeoplePlacementController } from "./workspace-canvas-people-placement-controller"
import type { WorkspaceCanvasSurfaceV2Props } from "./workspace-canvas-surface-v2-types"

export function useWorkspaceCanvasSurfacePeopleState({
  allowEditing,
  flowInstanceRef,
  organizationEditorData,
  presentationMode,
  tutorialActive,
  uiPreferencesScope,
  workspaceDataDrawerCanEdit,
}: {
  allowEditing: boolean
  flowInstanceRef: MutableRefObject<ReactFlowInstance | null>
  organizationEditorData: WorkspaceCanvasSurfaceV2Props["organizationEditorData"]
  presentationMode: boolean
  tutorialActive: boolean
  uiPreferencesScope: WorkspaceBoardUiPreferenceScope
  workspaceDataDrawerCanEdit: boolean
}) {
  const workspaceDataDrawerPeople = useMemo(
    () => organizationEditorData.people ?? [],
    [organizationEditorData.people]
  )
  const allowPeopleCanvasInteraction =
    allowEditing || workspaceDataDrawerCanEdit
  const peoplePlacementState = useWorkspaceCanvasPeoplePlacementController({
    allowPeopleCanvasInteraction,
    enabled: true,
    tutorialActive,
    people: workspaceDataDrawerPeople,
    presentationMode,
    flowInstanceRef,
    uiPreferencesScope,
  })

  return {
    allowPeopleCanvasInteraction,
    workspaceDataDrawerPeople,
    ...peoplePlacementState,
  }
}
