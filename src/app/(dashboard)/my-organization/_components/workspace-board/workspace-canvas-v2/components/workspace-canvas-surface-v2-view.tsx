"use client"

import { useSearchParams } from "next/navigation"
import { useCallback, useMemo, useState, type DragEvent } from "react"
import RotateCcwIcon from "lucide-react/dist/esm/icons/rotate-ccw"
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  type Node,
  SelectionMode,
  ConnectionLineType,
} from "@xyflow/react"

import {
  useRegisterAppShellAccountMenuAction,
  type AppShellAccountMenuAction,
} from "@/components/app-shell/account-menu-actions-context"
import { WorkspaceReactFlowErrorBootstrap } from "@/components/workspace/workspace-reactflow-error-bootstrap"
import {
  useParticleFlow,
  useParticleCalendarTarget,
  ParticleGeometryObserver,
} from "@/features/workspace-particles/client"
import { WorkspaceCardShortcutRail } from "../shortcuts/workspace-card-shortcut-rail"
import { WorkspaceCanvasErrorBoundary } from "../runtime/workspace-canvas-error-boundary"
import {
  WORKSPACE_CANVAS_V2_EDGE_TYPES,
  WORKSPACE_CANVAS_V2_NODE_TYPES,
} from "./workspace-canvas-node-types"
import { WorkspaceCanvasEdgeContextMenu } from "./workspace-canvas-edge-context-menu"
import { WorkspaceCanvasSurfaceV2ViewportControls } from "./workspace-canvas-surface-v2-viewport-controls-panel"
import { useWorkspaceCanvasSurfaceGestureGuards } from "./workspace-canvas-surface-v2-gesture-effect"
import { WorkspaceParticleCanvasProviders } from "./workspace-particle-canvas-providers"
import { ObjectivesIsland, ObjectivePlanNode, ObjectivePlanViewport, useObjectiveCanvas, guardObjectivePlanInteractions } from "@/features/workspace-objectives/client"
import { WorkspaceParticleDock } from "./workspace-particle-dock"
import { WorkspaceCanvasSurfaceV2MobileShortcutOverlay } from "./workspace-canvas-surface-v2-mobile-shortcut-overlay"
import {
  hasWorkspaceCanvasPersonDragPayload,
  readWorkspaceCanvasPersonDragPayload,
} from "./workspace-canvas-people-dnd"
import { useWorkspaceParticleLibrary } from "./use-workspace-particle-library"
import { resolveWorkspaceCanvasSelection } from "./use-workspace-canvas-selection"
import { useWorkspaceParticleConnectionLayer } from "./use-workspace-particle-connection-layer"
import { useWorkspaceParticleFlowHandlers } from "./workspace-particle-flow-handlers"
import type { WorkspaceCanvasSurfaceV2ViewProps } from "./workspace-canvas-surface-v2-view-types"

const MULTI_SELECTION_KEYS = ["Shift", "Meta", "Control"]
const CONNECTION_LINE_STYLE = {
  stroke: "var(--muted-foreground)",
  strokeWidth: 2,
}

const WORKSPACE_CANVAS_V2_PRO_OPTIONS = Object.freeze({ hideAttribution: true })

function useWorkspaceTutorialRestartAccountMenuAction({
  showTutorialRestart,
  onTutorialRestart,
}: {
  showTutorialRestart: boolean
  onTutorialRestart: () => void
}) {
  return useMemo<AppShellAccountMenuAction | null>(
    () =>
      showTutorialRestart
        ? {
            id: "workspace-tutorial-restart",
            label: "Restart guide",
            icon: RotateCcwIcon,
            onSelect: onTutorialRestart,
            priority: 20,
            visibility: "platform-admin",
          }
        : null,
    [onTutorialRestart, showTutorialRestart]
  )
}

export function WorkspaceCanvasSurfaceV2View({
  particleSession,
  libraryCardData,
  hiddenToolIds,
  onPlaceWorkspaceTool,
  nodes,
  edges,
  allowEditing,
  peopleCanvasInteractionEnabled,
  workspaceDataDrawerCanEdit,
  nodesDraggable,
  tutorialActive,
  layoutAnimating,
  presentationMode,
  workspaceDataDrawerPeople,
  placedWorkspacePersonIds,
  workspaceDataDrawerViewerId,
  workspaceDataDrawerOrganization,
  workspaceDataDrawerFinance,
  workspaceDataDrawerDocuments,
  workspaceAcceleratorDrawerInput,
  workspaceAcceleratorDrawerRoadmapSections,
  workspaceAcceleratorDrawerHasAccess,
  workspaceAcceleratorDrawerPaywallHref,
  workspaceDataDrawerRequest,
  uiPreferencesScope,
  edgeContextMenuState,
  shortcutItems,
  tutorialCalendarButtonCallout,
  emptyStateMessage,
  showTutorialRestart,
  onNodesChange,
  onNodeClick,
  onNodeDoubleClick,
  onKeyDownCapture,
  onNodeDragStop,
  onSelectionDragStop,
  onMoveStart,
  onMoveEnd,
  onConnect,
  isValidConnection,
  onEdgeDoubleClick,
  onEdgeContextMenu,
  onError,
  onInit,
  onTutorialRestart,
  onTutorialCalendarButtonComplete,
  onRecenterView,
  onZoomIn,
  onZoomOut,
  onWorkspacePersonDropToCanvas,
  onAddWorkspacePeopleToCanvas,
  onRemoveWorkspacePersonFromCanvas,
  onOpenWorkspaceDataDrawer,
  onCloseEdgeContextMenu,
  onDisconnectEdge,
  onDisconnectFromSource,
  onDisconnectToTarget,
  onDisconnectAll,
}: WorkspaceCanvasSurfaceV2ViewProps) {
  const visibleToolKey = nodes
    .filter((node) => !node.hidden)
    .map((node) => node.id)
    .join("\0")
  const visibleToolIds = useMemo(
    () => (visibleToolKey ? visibleToolKey.split("\0") : []),
    [visibleToolKey]
  )
  const particles = useParticleFlow({
    workspaceId: uiPreferencesScope.orgId,
    session: particleSession,
    visibleToolIds,
    canEdit: allowEditing && !tutorialActive,
  })
  const particleConnections = useWorkspaceParticleConnectionLayer(
    particles,
    {
      onConnect,
      isValidConnection,
      onEdgeDoubleClick,
      onEdgeContextMenu,
    },
    onCloseEdgeContextMenu
  )
  const library = useWorkspaceParticleLibrary({
    nodes,
    particles,
    workspaceId: uiPreferencesScope.orgId,
    hiddenToolIds,
    onPlaceWorkspaceTool,
    libraryCardData,
    allowEditing,
    tutorialActive,
  })
  const guideParams = useSearchParams()
  useParticleCalendarTarget(guideParams.get("particle"), particles.graph, particles.sourceRevision, uiPreferencesScope.orgId, particles.select)
  const guideStack =
    guideParams.get("guide") === "1" &&
    ["identity", "identity-edit"].includes(guideParams.get("guideStep") ?? "")

  const [surfaceContainer, setSurfaceContainer] =
    useState<HTMLDivElement | null>(null)
  const [flowFrameContainer, setFlowFrameContainer] =
    useState<HTMLDivElement | null>(null)
  const nodeTypes = useMemo(() => ({ ...WORKSPACE_CANVAS_V2_NODE_TYPES, objectivePlanStep: ObjectivePlanNode }), [])
  const edgeTypes = useMemo(() => WORKSPACE_CANVAS_V2_EDGE_TYPES, [])
  const selectionGestures = resolveWorkspaceCanvasSelection(tutorialActive)
  const nodesSelectable = !tutorialActive
  const selectNodesOnDrag =
    !tutorialActive && (allowEditing || peopleCanvasInteractionEnabled)
  const tutorialRestartAccountMenuAction =
    useWorkspaceTutorialRestartAccountMenuAction({
      showTutorialRestart,
      onTutorialRestart,
    })
  const handleCanvasDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (library.dragOver(event)) return
      if (!hasWorkspaceCanvasPersonDragPayload(event.dataTransfer)) return
      if (!peopleCanvasInteractionEnabled) return

      event.preventDefault()
      event.dataTransfer.dropEffect = "copy"
    },
    [peopleCanvasInteractionEnabled, library]
  )
  const handleCanvasDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (library.drop(event)) return
      const personIds = readWorkspaceCanvasPersonDragPayload(event.dataTransfer)
      if (personIds.length === 0) return

      event.preventDefault()
      event.stopPropagation()
      if (personIds.length === 1) {
        const personId = personIds[0]
        if (!personId) return

        onWorkspacePersonDropToCanvas({
          personId,
          clientX: event.clientX,
          clientY: event.clientY,
        })
        return
      }

      onAddWorkspacePeopleToCanvas({
        intent: "drop",
        personIds,
        clientX: event.clientX,
        clientY: event.clientY,
      })
    },
    [onAddWorkspacePeopleToCanvas, onWorkspacePersonDropToCanvas, library]
  )
  const handleAddWorkspacePeopleToCanvas = useCallback(
    (personIds: string[]) => {
      if (
        !peopleCanvasInteractionEnabled ||
        !flowFrameContainer ||
        personIds.length === 0
      ) {
        return 0
      }

      const frameRect = flowFrameContainer.getBoundingClientRect()
      return onAddWorkspacePeopleToCanvas({
        personIds,
        clientX: frameRect.left + frameRect.width / 2,
        clientY: frameRect.top + frameRect.height / 2,
      })
    },
    [
      flowFrameContainer,
      onAddWorkspacePeopleToCanvas,
      peopleCanvasInteractionEnabled,
    ]
  )

  const peopleCanvasActions = useMemo(
    () => ({
      add: handleAddWorkspacePeopleToCanvas,
      remove: onRemoveWorkspacePersonFromCanvas,
    }),
    [handleAddWorkspacePeopleToCanvas, onRemoveWorkspacePersonFromCanvas]
  )
  const objectiveCanvas = useObjectiveCanvas(`${workspaceDataDrawerViewerId}:${uiPreferencesScope.orgId}`, !tutorialActive && !presentationMode, [...library.nodes, ...particles.nodes])
  const flowNodes = useMemo(
    () => [...library.nodes, ...particles.nodes, ...objectiveCanvas.nodes],
    [library.nodes, particles.nodes, objectiveCanvas.nodes]
  )
  const flowEdges = useMemo(
    () => [...edges, ...particles.edges, ...objectiveCanvas.edges],
    [edges, particles.edges, objectiveCanvas.edges]
  )
  const flowHandlers = useWorkspaceParticleFlowHandlers(particles, {
    onNodesChange,
    onNodeClick,
    onKeyDownCapture,
    onNodeDragStop,
    onSelectionDragStop,
    onInit,
  })

  useRegisterAppShellAccountMenuAction(tutorialRestartAccountMenuAction)

  useWorkspaceCanvasSurfaceGestureGuards({ surfaceContainer })

  return (
    <WorkspaceCanvasErrorBoundary>
      <div
        ref={setSurfaceContainer}
        className="workspace-layout-surface group/workspace-canvas-surface relative min-h-[min(820px,calc(100svh-9.5rem))] w-full max-w-full min-w-0 flex-1 overflow-hidden bg-zinc-50 dark:bg-zinc-800"
        data-layout-animating={layoutAnimating ? "true" : undefined}
      >
        <WorkspaceParticleCanvasProviders
          workspaceId={uiPreferencesScope.orgId}
          canPlaceParticles={
            allowEditing && !tutorialActive && particles.editable
          }
          onPlaceParticle={library.placeDragged}
          container={flowFrameContainer}
          onOpenDataDrawer={onOpenWorkspaceDataDrawer}
        >
          <WorkspaceCardShortcutRail
            items={shortcutItems}
            dataAction={
              <WorkspaceParticleDock
                particles={particles.controls}
                tools={library.tools}
                tutorialActive={tutorialActive}
                people={workspaceDataDrawerPeople}
                placedPersonIds={placedWorkspacePersonIds}
                viewerId={workspaceDataDrawerViewerId}
                organizationEditorData={workspaceDataDrawerOrganization}
                financeInput={workspaceDataDrawerFinance}
                documentsTab={workspaceDataDrawerDocuments}
                acceleratorInput={workspaceAcceleratorDrawerInput}
                acceleratorRoadmapSections={
                  workspaceAcceleratorDrawerRoadmapSections
                }
                acceleratorHasAccess={workspaceAcceleratorDrawerHasAccess}
                acceleratorPaywallHref={workspaceAcceleratorDrawerPaywallHref}
                request={workspaceDataDrawerRequest}
                canEdit={workspaceDataDrawerCanEdit}
                uiPreferencesScope={uiPreferencesScope}
                peopleCanvasActions={peopleCanvasActions}
              />
            }
          />
          {!tutorialActive && !presentationMode && (
            <div className="pointer-events-none absolute inset-x-2 top-14 z-10 flex justify-center xl:top-2">
              <ObjectivesIsland particles={particles.controls} finance={workspaceDataDrawerFinance} scope={{ userId: workspaceDataDrawerViewerId, organizationId: uiPreferencesScope.orgId }} />
            </div>
          )}
          <WorkspaceCanvasSurfaceV2ViewportControls
            tutorialCalendarButtonCallout={
              tutorialCalendarButtonCallout ?? null
            }
            onTutorialCalendarButtonComplete={onTutorialCalendarButtonComplete}
            onZoomOut={onZoomOut}
            onZoomIn={onZoomIn}
            onRecenterView={onRecenterView}
          />
          <div
            ref={setFlowFrameContainer}
            data-workspace-canvas-flow-frame="true"
            className="absolute inset-0 max-w-full min-w-0 overflow-hidden"
          >
            <ReactFlowProvider>
              <WorkspaceReactFlowErrorBootstrap onError={onError}>
                {(handleReactFlowError) => (
                  <ReactFlow<Node>
                    nodes={flowNodes}
                    edges={flowEdges}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    nodesDraggable={nodesDraggable}
                    nodesConnectable={allowEditing && !tutorialActive}
                    nodeDragThreshold={4}
                    connectionRadius={32}
                    connectionLineType={ConnectionLineType.SmoothStep}
                    connectionLineStyle={CONNECTION_LINE_STYLE}
                    elementsSelectable={nodesSelectable}
                    multiSelectionKeyCode={MULTI_SELECTION_KEYS}
                    selectionMode={SelectionMode.Partial}
                    {...selectionGestures}
                    panActivationKeyCode="Space"
                    selectNodesOnDrag={selectNodesOnDrag}
                    {...flowHandlers}
                    onMoveStart={onMoveStart}
                    onMoveEnd={onMoveEnd}
                    {...guardObjectivePlanInteractions({ ...flowHandlers, onNodeDoubleClick, ...particleConnections.handlers })}
                    onDragOver={handleCanvasDragOver}
                    onDrop={handleCanvasDrop}
                    onPaste={library.paste}
                    zoomOnPinch
                    zoomOnScroll
                    zoomOnDoubleClick={false}
                    panOnScroll
                    panOnScrollSpeed={0.8}
                    preventScrolling
                    minZoom={guideStack ? 0.05 : 0.2}
                    maxZoom={1.25}
                    onlyRenderVisibleElements={!particles.layout.measureAll}
                    proOptions={WORKSPACE_CANVAS_V2_PRO_OPTIONS}
                    onError={handleReactFlowError}
                    className="org-flow workspace-flow"
                  >
                    <Background
                      id="workspace-v2-dot-grid"
                      variant={BackgroundVariant.Dots}
                      gap={20}
                      size={1.6}
                      color={
                        presentationMode
                          ? "rgba(148, 163, 184, 0.42)"
                          : "rgba(148, 163, 184, 0.64)"
                      }
                    />
                    <ObjectivePlanViewport focusKey={objectiveCanvas.focusKey} />
                    <ParticleGeometryObserver
                      onChange={particles.layout.geometryChanged}
                    />
                  </ReactFlow>
                )}
              </WorkspaceReactFlowErrorBootstrap>
            </ReactFlowProvider>
          </div>
          {nodes.length === 0 &&
          particles.nodes.length === 0 &&
          objectiveCanvas.nodes.length === 0 &&
          emptyStateMessage ? (
            <div className="pointer-events-none absolute inset-0 grid place-items-center px-6">
              <p className="border-border/70 bg-card/80 text-muted-foreground rounded-md border px-3 py-2 text-center text-xs shadow-sm backdrop-blur-sm">
                {emptyStateMessage}
              </p>
            </div>
          ) : null}
          {particleConnections.menu}
          {edgeContextMenuState ? (
            <WorkspaceCanvasEdgeContextMenu
              state={edgeContextMenuState}
              onClose={onCloseEdgeContextMenu}
              onDisconnectEdge={onDisconnectEdge}
              onDisconnectFromSource={onDisconnectFromSource}
              onDisconnectToTarget={onDisconnectToTarget}
              onDisconnectAll={onDisconnectAll}
            />
          ) : null}
          {shortcutItems.length > 0 ? (
            <WorkspaceCanvasSurfaceV2MobileShortcutOverlay
              items={shortcutItems}
            />
          ) : null}
        </WorkspaceParticleCanvasProviders>
      </div>
    </WorkspaceCanvasErrorBoundary>
  )
}
