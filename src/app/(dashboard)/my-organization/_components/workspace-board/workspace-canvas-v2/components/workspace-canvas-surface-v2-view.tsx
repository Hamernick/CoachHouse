"use client"

import { useWorkspaceParticles } from "@/features/workspace-particles/client"

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type DragEvent,
} from "react"
import RotateCcwIcon from "lucide-react/dist/esm/icons/rotate-ccw"
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
} from "reactflow"

import {
  useRegisterAppShellAccountMenuAction,
  type AppShellAccountMenuAction,
} from "@/components/app-shell/account-menu-actions-context"
import { WorkspaceReactFlowErrorBootstrap } from "@/components/workspace/workspace-reactflow-error-bootstrap"
import { WorkspaceCardShortcutRail } from "../shortcuts/workspace-card-shortcut-rail"
import { WorkspaceCanvasErrorBoundary } from "../runtime/workspace-canvas-error-boundary"
import {
  WORKSPACE_CANVAS_V2_EDGE_TYPES,
  WORKSPACE_CANVAS_V2_NODE_TYPES,
} from "./workspace-canvas-node-types"
import { WorkspaceCanvasEdgeContextMenu } from "./workspace-canvas-edge-context-menu"
import { WorkspaceCanvasSurfaceV2ViewportControls } from "./workspace-canvas-surface-v2-viewport-controls-panel"
import { useWorkspaceCanvasSurfaceGestureGuards } from "./workspace-canvas-surface-v2-gesture-effect"
import { WorkspaceCanvasOverlayDrawerContainerProvider } from "./workspace-canvas-overlay-drawer-container"
import { WorkspaceCanvasOverlayDrawer } from "./workspace-canvas-overlay-drawer"
import { WorkspaceCanvasSurfaceV2MobileShortcutOverlay } from "./workspace-canvas-surface-v2-mobile-shortcut-overlay"
import {
  hasWorkspaceCanvasPersonDragPayload,
  readWorkspaceCanvasPersonDragPayload,
} from "./workspace-canvas-people-dnd"
import type { WorkspaceCanvasSurfaceV2ViewProps } from "./workspace-canvas-surface-v2-view-types"

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
  onNodeDragStart,
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
  const [surfaceContainer, setSurfaceContainer] =
    useState<HTMLDivElement | null>(null)
  const [flowFrameContainer, setFlowFrameContainer] =
    useState<HTMLDivElement | null>(null)
  const particles = useWorkspaceParticles()
  const setParticleCanvas = particles?.setCanvas
  useEffect(() => {
    setParticleCanvas?.(flowFrameContainer)
    return () => setParticleCanvas?.(null)
  }, [setParticleCanvas, flowFrameContainer])
  const nodeTypes = useMemo(() => WORKSPACE_CANVAS_V2_NODE_TYPES, [])
  const edgeTypes = useMemo(() => WORKSPACE_CANVAS_V2_EDGE_TYPES, [])
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
      if (!hasWorkspaceCanvasPersonDragPayload(event.dataTransfer)) return
      if (!peopleCanvasInteractionEnabled) return

      event.preventDefault()
      event.dataTransfer.dropEffect = "copy"
    },
    [peopleCanvasInteractionEnabled]
  )
  const handleCanvasDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
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
        personIds,
        clientX: event.clientX,
        clientY: event.clientY,
      })
    },
    [onAddWorkspacePeopleToCanvas, onWorkspacePersonDropToCanvas]
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

  useRegisterAppShellAccountMenuAction(tutorialRestartAccountMenuAction)

  useWorkspaceCanvasSurfaceGestureGuards({ surfaceContainer })

  return (
    <WorkspaceCanvasErrorBoundary>
      <div
        ref={setSurfaceContainer}
        className="workspace-layout-surface group/workspace-canvas-surface relative min-h-[min(820px,calc(100svh-9.5rem))] w-full max-w-full min-w-0 flex-1 overflow-hidden bg-[#fcfcfc] dark:bg-zinc-800"
        data-layout-animating={layoutAnimating ? "true" : undefined}
      >
        <WorkspaceCanvasOverlayDrawerContainerProvider
          container={flowFrameContainer}
          onOpenDataDrawer={onOpenWorkspaceDataDrawer}
        >
          {shortcutItems.length > 0 ? (
            <WorkspaceCardShortcutRail
              items={shortcutItems}
              dataAction={
                <WorkspaceCanvasOverlayDrawer
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
                  peopleCanvasActions={{
                    add: handleAddWorkspacePeopleToCanvas,
                    remove: onRemoveWorkspacePersonFromCanvas,
                  }}
                />
              }
            />
          ) : null}
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
            className="absolute inset-0 max-w-full min-w-0 overflow-clip"
          >
            <ReactFlowProvider>
              <WorkspaceReactFlowErrorBootstrap onError={onError}>
                {(handleReactFlowError) => (
                  <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    nodesDraggable={nodesDraggable}
                    nodesConnectable={allowEditing && !tutorialActive}
                    nodeDragThreshold={4}
                    elementsSelectable={nodesSelectable}
                    selectionKeyCode="Shift"
                    multiSelectionKeyCode={["Meta", "Control"]}
                    selectionMode={SelectionMode.Partial}
                    selectionOnDrag={false}
                    selectNodesOnDrag={selectNodesOnDrag}
                    onNodesChange={onNodesChange}
                    onNodeClick={onNodeClick}
                    onNodeDoubleClick={onNodeDoubleClick}
                    onKeyDownCapture={onKeyDownCapture}
                    onNodeDragStart={onNodeDragStart}
                    onNodeDragStop={onNodeDragStop}
                    onSelectionDragStop={onSelectionDragStop}
                    onMoveStart={onMoveStart}
                    onMoveEnd={onMoveEnd}
                    onConnect={onConnect}
                    isValidConnection={isValidConnection}
                    onEdgeDoubleClick={onEdgeDoubleClick}
                    onEdgeContextMenu={onEdgeContextMenu}
                    onDragOver={handleCanvasDragOver}
                    onDrop={handleCanvasDrop}
                    zoomOnPinch
                    zoomOnScroll
                    zoomOnDoubleClick={false}
                    panOnDrag
                    panOnScroll
                    panOnScrollSpeed={0.8}
                    preventScrolling
                    minZoom={0.2}
                    maxZoom={1.25}
                    onlyRenderVisibleElements
                    proOptions={WORKSPACE_CANVAS_V2_PRO_OPTIONS}
                    onError={handleReactFlowError}
                    onInit={onInit}
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
                  </ReactFlow>
                )}
              </WorkspaceReactFlowErrorBootstrap>
            </ReactFlowProvider>
          </div>
          {nodes.length === 0 && emptyStateMessage ? (
            <div className="pointer-events-none absolute inset-0 grid place-items-center px-6">
              <p className="border-border/70 bg-card/80 text-muted-foreground rounded-md border px-3 py-2 text-center text-xs shadow-sm backdrop-blur-sm">
                {emptyStateMessage}
              </p>
            </div>
          ) : null}
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
        </WorkspaceCanvasOverlayDrawerContainerProvider>
      </div>
    </WorkspaceCanvasErrorBoundary>
  )
}
