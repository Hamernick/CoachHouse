"use client"

import { useMemo, useRef, useState } from "react"
import type { ReactFlowInstance } from "@xyflow/react"

import { useWorkspaceAcceleratorDrawer } from "./use-workspace-accelerator-drawer"
import { useWorkspaceOntologyActionRequest } from "./use-workspace-ontology-action-request"
import { WORKSPACE_CANVAS_V2_VAULT_MODE } from "./workspace-canvas-surface-v2-helpers"
import * as Runtime from "./workspace-canvas-surface-v2-runtime"
import type { WorkspaceCanvasSurfaceV2Props } from "./workspace-canvas-surface-v2-types"

type WorkspaceCanvasSurfaceV2BootstrapProps = Pick<
  WorkspaceCanvasSurfaceV2Props,
  | "allowEditing"
  | "boardState"
  | "onAcceleratorStateChange"
  | "onCloseAcceleratorStepNode"
  | "onFocusCard"
  | "onInitialOnboardingSubmit"
  | "onOpenAcceleratorStepNode"
  | "onTutorialNext"
  | "onTutorialShortcutOpened"
  | "organizationEditorData"
  | "presentationMode"
  | "seed"
  | "workspaceDataDrawerCanEdit"
>

export function useWorkspaceCanvasSurfaceV2Bootstrap({
  allowEditing,
  boardState,
  onAcceleratorStateChange,
  onCloseAcceleratorStepNode,
  onFocusCard,
  onInitialOnboardingSubmit,
  onOpenAcceleratorStepNode,
  onTutorialNext,
  onTutorialShortcutOpened,
  organizationEditorData,
  presentationMode,
  seed,
  workspaceDataDrawerCanEdit,
}: WorkspaceCanvasSurfaceV2BootstrapProps) {
  const flowInstanceRef = useRef<ReactFlowInstance | null>(null)
  const [isFlowReady, setIsFlowReady] = useState(false)
  const [vaultViewMode, setVaultViewMode] = useState(
    WORKSPACE_CANVAS_V2_VAULT_MODE
  )
  const {
    request: ontologyActionRequest,
    openAction: handleOpenOntologyAction,
  } = useWorkspaceOntologyActionRequest(onFocusCard)
  const acceleratorDrawer = useWorkspaceAcceleratorDrawer({
    boardState,
    seed,
    organizationEditorData,
    onAcceleratorStateChange,
    onInitialOnboardingSubmit,
  })
  const orgNodePositionFromBoard = useMemo(
    () => Runtime.resolveWorkspaceCanvasOrgNodePosition(boardState.nodes),
    [boardState.nodes]
  )
  const tutorialActiveFromBoard = boardState.onboardingFlow.active
  const viewport = Runtime.useWorkspaceCanvasViewportPreferences({
    flowInstanceRef,
    isFlowReady,
    orgId: seed.orgId,
    tutorialActive: tutorialActiveFromBoard,
    viewerId: seed.viewerId,
  })
  const people = Runtime.useWorkspaceCanvasSurfacePeopleState({
    allowEditing,
    flowInstanceRef,
    organizationEditorData,
    presentationMode,
    tutorialActive: tutorialActiveFromBoard,
    uiPreferencesScope: viewport.uiPreferencesScope,
    workspaceDataDrawerCanEdit,
  })
  const nodeLookups = Runtime.useWorkspaceCanvasSurfaceNodeLookups({
    boardNodes: boardState.nodes,
    orgNodePositionFromBoard,
  })
  const acceleratorStepNodeVisible = boardState.acceleratorUi?.stepOpen === true
  const accelerator = Runtime.useWorkspaceCanvasSurfaceAcceleratorState({
    boardState,
    allowEditing,
    presentationMode,
    tutorialActive: tutorialActiveFromBoard,
    acceleratorWorkspaceNode: nodeLookups.acceleratorWorkspaceNode,
    acceleratorStepNodeVisible,
    onInitialOnboardingSubmit,
    onOpenAcceleratorStepNode,
    onCloseAcceleratorStepNode,
    onTutorialNext,
    onTutorialShortcutOpened,
  })

  return {
    accelerator,
    acceleratorDrawer,
    acceleratorStepNodeVisible,
    flowInstanceRef,
    handleOpenOntologyAction,
    isFlowReady,
    nodeLookups,
    ontologyActionRequest,
    orgNodePositionFromBoard,
    people,
    setIsFlowReady,
    setVaultViewMode,
    tutorialActiveFromBoard,
    vaultViewMode,
    viewport,
  }
}
