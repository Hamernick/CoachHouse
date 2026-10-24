"use client"

import type { Node as ReactFlowNode } from "@xyflow/react"
import Maximize2Icon from "lucide-react/dist/esm/icons/maximize-2"
import MinusIcon from "lucide-react/dist/esm/icons/minus"
import PlusIcon from "lucide-react/dist/esm/icons/plus"
import { useReducedMotion } from "motion/react"
import { useCallback, useMemo, useRef, useState } from "react"
import {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type NodeTypes,
  type ReactFlowInstance,
  useNodesState,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import { Button } from "@/components/ui/button"
import { WorkspaceReactFlowErrorBootstrap } from "@/components/workspace/workspace-reactflow-error-bootstrap"

import type {
  FinanceReleasePlanNodeData,
  FinanceReleasePlanNodeKind,
} from "./finance-release-plan-data"
import { getFinanceReleasePlanNodeColor } from "./finance-release-plan-model"
import { FinanceReleasePlanNode } from "./finance-release-plan-node"
import type {
  FinancePlanningView,
  FinancePlanningViewId,
} from "./finance-plan-diagram-data"
import { FinancePlanReadinessPanel } from "./finance-plan-readiness-navigator"
import { FinancePlanResponseProvider } from "./finance-plan-response-context"
import { FinancePlanResponseDock } from "./finance-plan-response-dock"
import { FinancePlanToolbar } from "./finance-plan-toolbar"
import { getFinancePlanningView } from "./finance-plan-views"
import { useFinancePlanningViewUrlState } from "./use-finance-planning-view-url-state"

const MIN_ZOOM = 0.12
const MAX_ZOOM = 1.15
const TRACKPAD_PAN_SPEED = 1.2
const FINANCE_RELEASE_PLAN_PRO_OPTIONS = Object.freeze({
  hideAttribution: true,
})
const FINANCE_RELEASE_PLAN_NODE_TYPES: NodeTypes = {
  financeReleasePlan: FinanceReleasePlanNode,
}

type FinancePlanNodeTarget = {
  nodeId: string
  viewId: FinancePlanningViewId
}

function getMiniMapColor(node: ReactFlowNode<FinanceReleasePlanNodeData>) {
  return getFinanceReleasePlanNodeColor(
    node.data ?? {
      kind: "lane" as FinanceReleasePlanNodeKind,
    }
  )
}

function FinanceReleasePlanControls({
  onFitAll,
  onZoomIn,
  onZoomOut,
}: {
  onFitAll: () => void
  onZoomIn: () => void
  onZoomOut: () => void
}) {
  return (
    <div className="pointer-events-none absolute bottom-4 left-4 z-30 md:top-4 md:right-4 md:bottom-auto md:left-auto">
      <div className="border-border/70 bg-card pointer-events-auto flex items-center gap-1 rounded-xl border p-1 shadow-sm">
        <Button
          aria-label="Zoom out"
          className="size-11"
          onClick={onZoomOut}
          size="icon"
          title="Zoom out"
          type="button"
          variant="ghost"
        >
          <MinusIcon aria-hidden="true" className="size-4" />
        </Button>
        <Button
          aria-label="Zoom in"
          className="size-11"
          onClick={onZoomIn}
          size="icon"
          title="Zoom in"
          type="button"
          variant="ghost"
        >
          <PlusIcon aria-hidden="true" className="size-4" />
        </Button>
        <Button
          aria-label="Fit full plan"
          className="size-11"
          onClick={onFitAll}
          size="icon"
          title="Fit full plan"
          type="button"
          variant="ghost"
        >
          <Maximize2Icon aria-hidden="true" className="size-4" />
        </Button>
      </div>
    </div>
  )
}

function FinancePlanningViewCanvas({
  activeView,
  initialNodeId,
  onSelectPlanNode,
  onSelectView,
  responseTargetId,
}: {
  activeView: FinancePlanningView
  initialNodeId: string | null
  onSelectPlanNode: (target: FinancePlanNodeTarget) => void
  onSelectView: (viewId: FinancePlanningViewId) => void
  responseTargetId: string | null
}) {
  const reducedMotion = useReducedMotion()
  const flowInstanceRef = useRef<ReactFlowInstance<ReactFlowNode<FinanceReleasePlanNodeData>> | null>(null)
  const initialNodes = useMemo(() => activeView.buildNodes(), [activeView])
  const edges = useMemo(() => activeView.buildEdges(), [activeView])
  const [nodes, , onNodesChange] =
    useNodesState<ReactFlowNode<FinanceReleasePlanNodeData>>(initialNodes)
  const viewportDuration = reducedMotion ? 0 : 180

  const focusNodes = useCallback(
    (nodeIds: readonly string[]) => {
      const instance = flowInstanceRef.current
      if (!instance) return
      const targetNodes = nodeIds
        .map((nodeId) => instance.getNode(nodeId))
        .filter((node) => node !== undefined)
      if (!targetNodes.length) return

      void instance.fitView({
        duration: viewportDuration,
        maxZoom:
          nodeIds.length === 1 ? 0.88 : nodeIds.length <= 3 ? 0.72 : 0.55,
        minZoom: MIN_ZOOM,
        nodes: targetNodes,
        padding: nodeIds.length === 1 ? 0.45 : 0.18,
      })
    },
    [viewportDuration]
  )

  const fitAll = useCallback(() => {
    void flowInstanceRef.current?.fitView({
      duration: viewportDuration,
      maxZoom: activeView.id === "roadmap" ? 0.42 : 0.62,
      minZoom: MIN_ZOOM,
      padding: 0.08,
    })
  }, [activeView.id, viewportDuration])

  return (
    <>
      <FinancePlanToolbar
        activeView={activeView}
        onFocusNodes={focusNodes}
        onSelectPlanNode={onSelectPlanNode}
        onSelectView={onSelectView}
      />
      <FinanceReleasePlanControls
        onFitAll={fitAll}
        onZoomIn={() =>
          void flowInstanceRef.current?.zoomIn({ duration: viewportDuration })
        }
        onZoomOut={() =>
          void flowInstanceRef.current?.zoomOut({ duration: viewportDuration })
        }
      />
      <FinancePlanResponseDock
        key={`response:${responseTargetId ?? "view"}`}
        nodeId={responseTargetId}
        viewId={activeView.id}
      />

      <ReactFlowProvider>
        <WorkspaceReactFlowErrorBootstrap
          onError={(id, message) =>
            console.warn(`[finance-release-plan:${id}] ${message}`)
          }
        >
          {(handleReactFlowError) => (
            <ReactFlow
              edges={edges}
              elementsSelectable={false}
              maxZoom={MAX_ZOOM}
              minZoom={MIN_ZOOM}
              nodeTypes={FINANCE_RELEASE_PLAN_NODE_TYPES}
              nodes={nodes}
              nodesConnectable={false}
              nodesFocusable={false}
              onError={handleReactFlowError}
              onInit={(instance) => {
                flowInstanceRef.current = instance
                window.requestAnimationFrame(() => {
                  focusNodes(
                    initialNodeId ? [initialNodeId] : activeView.initialNodeIds
                  )
                })
              }}
              onNodesChange={onNodesChange}
              onlyRenderVisibleElements
              panOnScroll
              panOnScrollSpeed={TRACKPAD_PAN_SPEED}
              proOptions={FINANCE_RELEASE_PLAN_PRO_OPTIONS}
              selectionOnDrag={false}
              zoomOnDoubleClick={false}
              zoomOnScroll={false}
            >
              <Background
                color="#a1a1aa"
                gap={24}
                size={1}
                variant={BackgroundVariant.Dots}
              />
              <MiniMap
                className="!border-border/70 !bg-card !hidden !border lg:!block"
                maskColor="rgba(24, 24, 27, 0.16)"
                nodeColor={getMiniMapColor}
                pannable
                zoomable
              />
            </ReactFlow>
          )}
        </WorkspaceReactFlowErrorBootstrap>
      </ReactFlowProvider>
    </>
  )
}

export function FinanceReleasePlanCanvas() {
  const { activeNodeId, activeViewId, setActiveNodeLocation, setActiveViewId } =
    useFinancePlanningViewUrlState()
  const [focusRevision, setFocusRevision] = useState(0)
  const [responseTargetId, setResponseTargetId] = useState<string | null>(
    activeNodeId
  )
  const activeView = getFinancePlanningView(activeViewId)
  const handleSelectPlanNode = useCallback(
    (target: FinancePlanNodeTarget) => {
      setActiveNodeLocation(target.viewId, target.nodeId)
      setResponseTargetId(target.nodeId)
      setFocusRevision((revision) => revision + 1)
    },
    [setActiveNodeLocation]
  )

  return (
    <FinancePlanResponseProvider>
      <section
        aria-label="Finance release planning graph"
        className="bg-muted/20 relative flex h-full min-h-[680px] w-full flex-col overflow-hidden lg:flex-row"
        data-finance-release-plan-canvas="react-flow"
        data-finance-release-plan-node={activeNodeId ?? undefined}
        data-finance-release-plan-view={activeView.id}
      >
        <FinancePlanReadinessPanel
          onSelect={handleSelectPlanNode}
          onSelectResponseTarget={setResponseTargetId}
          responseTargetId={responseTargetId}
        />
        <div className="relative min-h-[420px] min-w-0 flex-1 overflow-hidden">
          <FinancePlanningViewCanvas
            activeView={activeView}
            initialNodeId={activeNodeId}
            key={`${activeView.id}:${activeNodeId ?? "initial"}:${focusRevision}`}
            onSelectPlanNode={handleSelectPlanNode}
            onSelectView={setActiveViewId}
            responseTargetId={responseTargetId}
          />
        </div>
      </section>
    </FinancePlanResponseProvider>
  )
}
