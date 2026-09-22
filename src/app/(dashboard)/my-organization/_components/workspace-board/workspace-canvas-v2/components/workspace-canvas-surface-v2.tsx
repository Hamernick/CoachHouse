"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { type ReactFlowInstance } from "reactflow"
import "reactflow/dist/style.css"
import { useWorkspaceAcceleratorDrawer } from "./use-workspace-accelerator-drawer"
import { useWorkspaceOntologyActionRequest } from "./use-workspace-ontology-action-request"
import { useWorkspaceParticleSources } from "./use-workspace-particle-sources"
import type { WorkspaceCanvasSurfaceV2Props } from "./workspace-canvas-surface-v2-types"
import { WorkspaceCanvasParticlesSurface } from "./workspace-canvas-particles-surface"
import { WORKSPACE_CANVAS_V2_VAULT_MODE as VAULT_MODE } from "./workspace-canvas-surface-v2-helpers"
import * as Runtime from "./workspace-canvas-surface-v2-runtime"
// eslint-disable-next-line max-lines-per-function
export function WorkspaceCanvasSurfaceV2({
  boardState,
  allowEditing,
  workspaceDataDrawerCanEdit,
  presentationMode,
  seed,
  organizationEditorData,
  financeInput,
  layoutFitRequestKey,
  acceleratorFocusRequestKey,
  tutorialRestartRequestKey,
  onInitialOnboardingSubmit,
  focusCardRequest,
  tutorialCompletionExitRequest,
  journeyGuideState,
  onSizeChange,
  onCommunicationsChange,
  onTrackerChange,
  onAcceleratorStateChange,
  onOpenAcceleratorStepNode,
  onCloseAcceleratorStepNode,
  onTutorialPrevious,
  onTutorialNext,
  onTutorialRestart,
  onTutorialShortcutOpened,
  onFocusCard,
  onParticlesChange,
  onPersistNodePosition,
  onConnectCards,
  onDisconnectConnection,
  onDisconnectAllConnections,
  onToggleCardVisibility,
  onTutorialCompletionExitHandled,
}: WorkspaceCanvasSurfaceV2Props) {
  const flowInstanceRef = useRef<ReactFlowInstance | null>(null)
  const [isFlowReady, setIsFlowReady] = useState(false)
  const [vaultViewMode, setVaultViewMode] = useState(VAULT_MODE)
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
  const programs = organizationEditorData.programs
  const particles = useWorkspaceParticleSources(boardState, programs, seed)
  const orgNodePosition = Runtime.useWorkspaceCanvasOrgNodePosition(
    boardState.nodes
  )
  const tutorialActiveFromBoard = boardState.onboardingFlow.active
  const {
    handleCanvasMoveEnd,
    suppressInitialFit,
    uiPreferencesScope,
    viewportZoom,
  } = Runtime.useWorkspaceCanvasViewportPreferences({
    flowInstanceRef,
    isFlowReady,
    orgId: seed.orgId,
    tutorialActive: tutorialActiveFromBoard,
    viewerId: seed.viewerId,
  })
  const {
    allowPeopleCanvasInteraction: allowPeopleDrag,
    workspaceDataDrawerPeople,
    workspacePersonById,
    workspacePersonPlacements,
    placedWorkspacePersonIds,
    personRelationshipEdges,
    workspacePersonFitRequest,
    clearWorkspacePersonFitRequest,
    handleRemoveWorkspacePersonPlacement,
    handleWorkspacePersonDropToCanvas,
    handleAddWorkspacePeopleToCanvas,
    handleWorkspacePersonNodeDragStop,
    handleWorkspacePersonNodesDragStop,
  } = Runtime.useWorkspaceCanvasSurfacePeopleState({
    allowEditing,
    flowInstanceRef,
    organizationEditorData,
    presentationMode,
    tutorialActive: tutorialActiveFromBoard,
    uiPreferencesScope,
    workspaceDataDrawerCanEdit,
  })
  const {
    acceleratorWorkspaceNode,
    acceleratorWorkspaceNodeId,
    boardNodeLookup,
    initialPositionLookupRef,
  } = Runtime.useWorkspaceCanvasSurfaceNodeLookups({
    boardNodes: boardState.nodes,
    orgNodePositionFromBoard: orgNodePosition,
  })
  const acceleratorStepNodeVisible = boardState.acceleratorUi?.stepOpen === true
  const {
    acceleratorRuntimeSnapshot,
    acceleratorStepNodeData,
    acceleratorTutorialCallout,
    acceleratorTutorialInteractionPolicy,
    handleAcceleratorRuntimeActionsChange,
    handleAcceleratorRuntimeChange,
    handleAcceleratorTutorialActionComplete,
    handleHideStepNode,
    handleOpenStepNode,
    setAcceleratorStepNodePositionOverride,
  } = Runtime.useWorkspaceCanvasSurfaceAcceleratorState({
    boardState,
    allowEditing,
    presentationMode,
    tutorialActive: tutorialActiveFromBoard,
    acceleratorWorkspaceNode,
    acceleratorStepNodeVisible,
    onInitialOnboardingSubmit,
    onOpenAcceleratorStepNode,
    onCloseAcceleratorStepNode,
    onTutorialNext,
    onTutorialShortcutOpened,
  })
  const {
    tutorialActive,
    tutorialSelectedCardId,
    tutorialNodeData,
    tutorialEdgeTargetId,
    tutorialSceneCardPositionOverrides,
    tutorialScenePrimaryCardId,
    tutorialSceneGuideGap,
    tutorialSceneBreakpoint,
    tutorialSceneCameraViewport,
    tutorialSceneNodeIds,
    tutorialPresentationMaskLayout,
    tutorialSceneSignature,
    tutorialLayoutAnimating,
    emptyStateMessage,
    handleTutorialNodeDragStop,
  } = Runtime.useWorkspaceCanvasTutorialScene({
    boardState,
    onPrevious: onTutorialPrevious,
    onNext: onTutorialNext,
    acceleratorModuleViewerOpen:
      acceleratorRuntimeSnapshot?.isModuleViewerOpen === true,
  })
  const {
    tutorialCardMeasuredHeights,
    handleCardMeasuredHeightChange,
    tutorialShellMeasuredHeight,
    handleCurrentTutorialShellMeasuredHeightChange,
  } = Runtime.useWorkspaceTutorialMeasurements({ tutorialSceneSignature })
  const { tutorialCardPositionOverrides, setTutorialCardPositionOverrides } =
    Runtime.useWorkspaceTutorialCardPositionOverrides({
      tutorialActive,
      tutorialSceneSignature,
    })
  const visibleCardIds = Runtime.useWorkspaceCanvasVisibleCardIds({
    tutorialActive,
    hiddenCardIds: boardState.hiddenCardIds,
    tutorialStepIndex: boardState.onboardingFlow.tutorialStepIndex,
    openedTutorialStepIds: boardState.onboardingFlow.openedTutorialStepIds,
  })
  const readinessMap = Runtime.useWorkspaceCardReadinessMap({
    seed,
    boardState,
  })
  const ontology = Runtime.useWorkspaceCanvasOntology({
    boardState,
    seed,
    organizationEditorData,
    visibleCardIds,
    personPlacements: workspacePersonPlacements,
    cardMeasuredHeights: tutorialCardMeasuredHeights,
    enabled: false,
    zoom: viewportZoom,
    onFocusRoot: onFocusCard,
    onOpenAction: handleOpenOntologyAction,
    onOpenDataDrawer: acceleratorDrawer.onOpenWorkspaceDataDrawer,
  })
  const shortcutItems = Runtime.useWorkspaceTutorialAwareShortcutItems({
    boardState,
    visibleCardIds,
    tutorialActive,
    tutorialSelectedCardId,
    focusCardRequest,
    onToggleCardVisibility,
    onFocusCard,
    onTutorialShortcutOpened,
  })
  const { tutorialCallout, handleTutorialActionComplete, handleOpenCard } =
    Runtime.useWorkspaceTutorialActionHandlers({
      tutorialActive,
      tutorialStepIndex: boardState.onboardingFlow.tutorialStepIndex,
      openedTutorialStepIds: boardState.onboardingFlow.openedTutorialStepIds,
      hiddenCardIds: boardState.hiddenCardIds,
      onTutorialNext,
      onTutorialShortcutOpened,
      onConnectCards,
      onToggleCardVisibility,
      onFocusCard,
    })
  const {
    showTutorialRestart,
    tutorialCalendarButtonCallout,
    onTutorialCalendarButtonComplete,
    organizationMapButtonCallout,
    onOrganizationMapButtonTutorialComplete,
  } = Runtime.resolveWorkspaceCanvasTutorialSurfaceProps({
    allowEditing,
    isPlatformAdmin: seed.isPlatformAdmin,
    presentationMode,
    tutorialCallout,
    onTutorialComplete: handleTutorialActionComplete,
  })
  const cardDataLookup = Runtime.useWorkspaceCanvasSurfaceCardDataLookup({
    boardState,
    allowEditing,
    presentationMode,
    seed,
    organizationEditorData,
    onSizeChange,
    onCommunicationsChange,
    onTrackerChange,
    onAcceleratorStateChange,
    onInitialOnboardingSubmit,
    vaultViewMode,
    onVaultViewModeChange: setVaultViewMode,
    acceleratorStepNodeVisible,
    onOpenAcceleratorStepNode: handleOpenStepNode,
    onHideAcceleratorStepNode: handleHideStepNode,
    onAcceleratorRuntimeChange: handleAcceleratorRuntimeChange,
    onAcceleratorRuntimeActionsChange: handleAcceleratorRuntimeActionsChange,
    acceleratorRuntimeSnapshot,
    acceleratorTutorialCallout,
    acceleratorTutorialInteractionPolicy,
    onAcceleratorTutorialActionComplete:
      handleAcceleratorTutorialActionComplete,
    journeyGuideState,
    onFocusCard,
    onOpenCard: handleOpenCard,
    onHideCard: onToggleCardVisibility,
    onCardMeasuredHeightChange: handleCardMeasuredHeightChange,
    organizationShortcutItems: shortcutItems,
    organizationMapButtonCallout,
    onOrganizationMapButtonTutorialComplete,
    tutorialActive,
    tutorialStepIndex: boardState.onboardingFlow.tutorialStepIndex,
    ontologyRootControls: undefined,
    ontologyActionRequest,
  })
  const {
    tutorialNodeData: tutorialNodeWithPresentation,
    tutorialSuppressedNodeIds,
    tutorialDockTargets,
    tutorialDraggableCardIds,
    tutorialSceneNodeIds: resolvedTutorialSceneNodeIds,
    tutorialSceneCameraViewport: resolvedTutorialSceneCameraViewport,
  } = Runtime.useWorkspaceTutorialNodeState({
    tutorialActive,
    tutorialStepIndex: boardState.onboardingFlow.tutorialStepIndex,
    tutorialSceneSignature,
    openedStepIds: boardState.onboardingFlow.openedTutorialStepIds,
    cardDataLookup,
    tutorialNodeData,
    tutorialBreakpoint: tutorialSceneBreakpoint,
    tutorialSceneCardPositionOverrides,
    tutorialScenePrimaryCardId,
    tutorialSceneGuideGap,
    tutorialSceneNodeIds,
    tutorialSceneCameraViewport,
    cardMeasuredHeights: tutorialCardMeasuredHeights,
    tutorialShellMeasuredHeight,
    tutorialPresentationMaskLayout,
    acceleratorRuntimeSnapshot,
    onTutorialShellMeasuredHeightChange:
      handleCurrentTutorialShellMeasuredHeightChange,
  })
  const { resolvedTutorialCardPositionOverrides, setTutorialUndockedCardIds } =
    Runtime.useWorkspaceTutorialDockingState({
      tutorialActive,
      tutorialSceneSignature,
      tutorialCardPositionOverrides,
      tutorialSceneCardPositionOverrides,
      tutorialDockTargets,
    })
  const visibleCardIdSet = Runtime.useVisibleWorkspaceCanvasCardIdSet({
    tutorialSuppressedNodeIds,
    visibleCardIds,
  })
  const { onNodesChange, renderNodes, tutorialSceneFitRequest } =
    Runtime.useWorkspaceCanvasRenderState({
      visibleCardIds,
      boardNodeLookup,
      initialPositionLookupRef,
      cardDataLookup,
      allowEditing,
      allowPeopleCanvasInteraction: allowPeopleDrag,
      tutorialActive,
      acceleratorStepNodeData,
      tutorialNodeData: tutorialNodeWithPresentation,
      workspacePersonPlacements,
      workspacePersonById,
      onRemoveWorkspacePerson: handleRemoveWorkspacePersonPlacement,
      tutorialSceneCardPositionOverrides: resolvedTutorialCardPositionOverrides,
      tutorialDraggableCardIds,
      orgNodePositionFromBoard: orgNodePosition,
      tutorialSceneNodeIds: resolvedTutorialSceneNodeIds,
      tutorialSceneSignature,
      tutorialSceneCameraViewport: resolvedTutorialSceneCameraViewport,
      tutorialSceneRequestSeed: tutorialRestartRequestKey,
    })
  Runtime.useWorkspaceCanvasPersonFitRequest({
    flowInstanceRef,
    isFlowReady,
    renderNodes,
    fitRequest: workspacePersonFitRequest,
    onFitRequestHandled: clearWorkspacePersonFitRequest,
  })
  const handleNodeDragStop = Runtime.useWorkspaceCanvasNodeDragStop({
    allowEditing,
    tutorialActive,
    boardNodeLookup,
    onPersistNodePosition,
    setAcceleratorStepNodePositionOverride,
    setTutorialCardPositionOverrides,
    setTutorialUndockedCardIds,
    tutorialDockTargets,
    onTutorialNodeDragStop: handleTutorialNodeDragStop,
  })
  const { handleCanvasNodeDragStop, handleCanvasSelectionDragStop } =
    Runtime.useWorkspaceCanvasSurfaceDragHandlers({
      handleNodeDragStop,
      handleWorkspacePersonNodeDragStop,
      handleWorkspacePersonNodesDragStop,
    })
  const ontologyInteractions = Runtime.useWorkspaceCanvasOntologyInteractions({
    ontology,
    tutorialActive,
    renderNodes,
    onNodesChange,
    onNodeDragStop: handleCanvasNodeDragStop,
    onSelectionDragStop: handleCanvasSelectionDragStop,
    flowInstanceRef,
    isFlowReady,
  })
  const flowState = Runtime.useWorkspaceCanvasSurfaceFlowState({
    acceleratorFocusRequestKey,
    acceleratorStepNodeActive: Boolean(
      acceleratorStepNodeData && acceleratorWorkspaceNodeId
    ),
    acceleratorWorkspaceNodeId,
    allowEditing,
    autoLayoutMode: boardState.autoLayoutMode,
    connections: boardState.connections,
    flowInstanceRef,
    focusCardRequest,
    isFlowReady,
    layoutFitRequestKey,
    nodeRelationshipEdges: personRelationshipEdges,
    ontologyEdges: [],
    onConnectCards,
    onDisconnectAllConnections,
    onDisconnectConnection,
    onTutorialCompletionExitHandled,
    presentationMode,
    readinessMap,
    renderNodes: ontologyInteractions.nodes,
    setIsFlowReady,
    suppressInitialFit,
    tutorialActive,
    tutorialCompletionExitRequest,
    tutorialEdgeTargetId,
    tutorialSceneFitRequest,
    visibleCardIdSet,
    visibleNodeIds: ontologyInteractions.visibleNodeIds,
  })
  const viewProps = {
    particleBoardState: boardState,
    particleSources: particles,
    onParticlesChange,
    onPersistWorkspaceCardPosition: onPersistNodePosition,
    onToggleWorkspaceCardVisibility: onToggleCardVisibility,
    nodes: ontologyInteractions.nodes,
    edges: flowState.renderEdges,
    allowEditing,
    peopleCanvasInteractionEnabled: allowPeopleDrag,
    workspaceDataDrawerCanEdit,
    nodesDraggable: allowEditing || allowPeopleDrag || tutorialActive,
    tutorialActive,
    layoutAnimating: tutorialLayoutAnimating || ontology.layoutAnimating,
    presentationMode,
    workspaceDataDrawerPeople,
    placedWorkspacePersonIds,
    workspaceDataDrawerViewerId: seed.viewerId,
    workspaceDataDrawerOrganization: organizationEditorData,
    workspaceDataDrawerFinance: financeInput,
    workspaceDataDrawerDocuments: organizationEditorData.documentsTab,
    ...acceleratorDrawer,
    uiPreferencesScope,
    edgeContextMenuState: flowState.edgeContextMenuState,
    shortcutItems,
    tutorialCalendarButtonCallout,
    emptyStateMessage,
    showTutorialRestart,
    onNodesChange: ontologyInteractions.onNodesChange,
    onNodeClick: ontologyInteractions.onNodeClick,
    onNodeDoubleClick: flowState.handleNodeDoubleClick,
    onKeyDownCapture: ontologyInteractions.onKeyDownCapture,
    onNodeDragStop: ontologyInteractions.onNodeDragStop,
    onSelectionDragStop: ontologyInteractions.onSelectionDragStop,
    onMoveStart: ontologyInteractions.onMoveStart,
    onMoveEnd: handleCanvasMoveEnd,
    onConnect: flowState.handleConnect,
    isValidConnection: flowState.handleIsValidConnection,
    onEdgeDoubleClick: flowState.handleEdgeDoubleClick,
    onEdgeContextMenu: flowState.handleEdgeContextMenu,
    onError: Runtime.handleWorkspaceReactFlowError,
    onInit: flowState.handleFlowInit,
    onTutorialRestart,
    onTutorialCalendarButtonComplete,
    onRecenterView: flowState.handleRecenterView,
    onZoomIn: flowState.handleZoomIn,
    onZoomOut: flowState.handleZoomOut,
    onWorkspacePersonDropToCanvas: handleWorkspacePersonDropToCanvas,
    onAddWorkspacePeopleToCanvas: handleAddWorkspacePeopleToCanvas,
    onRemoveWorkspacePersonFromCanvas: handleRemoveWorkspacePersonPlacement,
    onCloseEdgeContextMenu: flowState.closeEdgeContextMenu,
    onDisconnectEdge: flowState.handleContextDisconnectEdge,
    onDisconnectFromSource: flowState.handleContextDisconnectFromSource,
    onDisconnectToTarget: flowState.handleContextDisconnectToTarget,
    onDisconnectAll: flowState.handleContextDisconnectAll,
  }
  return <WorkspaceCanvasParticlesSurface key={seed.orgId} {...viewProps} />
}
