"use client"

import type { Node as ReactFlowNode } from "@xyflow/react"
import Maximize2Icon from "lucide-react/dist/esm/icons/maximize-2"
import MinusIcon from "lucide-react/dist/esm/icons/minus"
import PlusIcon from "lucide-react/dist/esm/icons/plus"
import { useCallback, useEffect, useMemo, useRef } from "react"
import {
  Background,
  BackgroundVariant,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
  type ReactFlowInstance,
  useNodesState,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import { Button } from "@/components/ui/button"

import type {
  UserJourneyAtlasInput,
  UserJourneyAtlasNode,
} from "../types"
import {
  getUserJourneyHealthStatusStyle,
  getUserJourneySurfaceKindStyle,
  UserJourneyAtlasNodeCard,
} from "./user-journey-atlas-node-card"
import {
  buildUserJourneyOutlineEdges,
  buildUserJourneyOutlineNodes,
  UserJourneyOutlineNode,
  type UserJourneyOutlineNodeData,
} from "./user-journey-atlas-outline"

type UserJourneyAtlasPanelProps = {
  input: UserJourneyAtlasInput
}

type UserJourneyFlowNodeData = {
  node: UserJourneyAtlasNode
}

type UserJourneyFlowNodeDataByType =
  | UserJourneyFlowNodeData
  | UserJourneyOutlineNodeData

const MIN_ZOOM = 0.08
const MAX_ZOOM = 1.25
const USER_JOURNEY_ATLAS_PRO_OPTIONS = Object.freeze({ hideAttribution: true })
const USER_JOURNEY_ATLAS_FIT_VIEW_OPTIONS = Object.freeze({
  duration: 180,
  maxZoom: 0.74,
  minZoom: MIN_ZOOM,
  padding: 0.24,
})
const USER_JOURNEY_ATLAS_NODE_TYPES: NodeTypes = {
  userJourneyFile: UserJourneyFlowNode,
  userJourneyOutline: UserJourneyOutlineNode,
}

function shouldPreventUserJourneyAtlasWheelZoom(ctrlKey: boolean) {
  return ctrlKey
}

function shouldPreventUserJourneyAtlasTouchZoom(touchCount: number) {
  return touchCount > 1
}

function UserJourneyFlowNode({
  data,
  isConnectable,
}: NodeProps<ReactFlowNode<UserJourneyFlowNodeData>>) {
  const { node } = data

  return (
    <UserJourneyAtlasNodeCard
      isConnectable={isConnectable}
      node={node}
    />
  )
}

function UserJourneyAtlasViewportControls({
  onFitView,
  onZoomIn,
  onZoomOut,
}: {
  onFitView: () => void
  onZoomIn: () => void
  onZoomOut: () => void
}) {
  return (
    <div className="pointer-events-none absolute right-4 top-4 z-30 flex items-start justify-end">
      <div className="pointer-events-auto flex items-center gap-1 rounded-lg border border-border bg-card p-1 shadow-sm">
        <Button
          aria-label="Zoom out"
          className="h-9 w-9 rounded-md"
          onClick={onZoomOut}
          size="icon"
          title="Zoom out"
          type="button"
          variant="ghost"
        >
          <MinusIcon aria-hidden="true" className="h-4 w-4" />
        </Button>
        <Button
          aria-label="Zoom in"
          className="h-9 w-9 rounded-md"
          onClick={onZoomIn}
          size="icon"
          title="Zoom in"
          type="button"
          variant="ghost"
        >
          <PlusIcon aria-hidden="true" className="h-4 w-4" />
        </Button>
        <Button
          aria-label="Fit view"
          className="h-9 w-9 rounded-md"
          onClick={onFitView}
          size="icon"
          title="Fit view"
          type="button"
          variant="ghost"
        >
          <Maximize2Icon aria-hidden="true" className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function buildUserJourneyFlowNodes(
  input: UserJourneyAtlasInput,
): Array<Node<UserJourneyFlowNodeDataByType>> {
  const fileNodes = input.nodes.map(
    (node): Node<UserJourneyFlowNodeData> => ({
      data: { node },
      draggable: true,
      id: node.id,
      position: { x: node.x, y: node.y },
      selectable: false,
      sourcePosition: Position.Right,
      style: {
        height: node.height,
        width: node.width,
      },
      targetPosition: Position.Left,
      type: "userJourneyFile",
      zIndex: 10,
    }),
  )

  return [...buildUserJourneyOutlineNodes(), ...fileNodes]
}

function buildUserJourneyFileEdges(input: UserJourneyAtlasInput): Edge[] {
  const nodeById = new Map(input.nodes.map((node) => [node.id, node]))

  return input.edges.map((edge) => {
    const sourceNode = nodeById.get(edge.from)
    const edgeColor = sourceNode
      ? getUserJourneySurfaceKindStyle(sourceNode.surfaceKind).edge
      : getUserJourneySurfaceKindStyle("system").edge
    const healthColor = sourceNode
      ? getUserJourneyHealthStatusStyle(sourceNode.healthStatus).color
      : edgeColor
    const hasGap =
      sourceNode?.healthStatus !== undefined &&
      sourceNode.healthStatus !== "live" &&
      sourceNode.healthStatus !== "admin-reference"

    return {
      id: edge.id,
      interactionWidth: 20,
      markerEnd: {
        color: hasGap ? healthColor : edgeColor,
        type: MarkerType.ArrowClosed,
      },
      selectable: false,
      source: edge.from,
      sourceHandle: "source",
      style: {
        stroke: hasGap ? healthColor : edgeColor,
        strokeDasharray: hasGap ? "7 7" : undefined,
        strokeOpacity: hasGap ? 0.92 : 0.82,
        strokeWidth: hasGap ? 2.8 : 2.4,
      },
      target: edge.to,
      targetHandle: "target",
      type: "smoothstep",
    }
  })
}

function buildUserJourneyFlowEdges(input: UserJourneyAtlasInput): Edge[] {
  return [
    ...buildUserJourneyOutlineEdges(),
    ...buildUserJourneyFileEdges(input),
  ]
}

export function UserJourneyAtlasPanel({ input }: UserJourneyAtlasPanelProps) {
  const surfaceRef = useRef<HTMLElement | null>(null)
  const flowInstanceRef = useRef<ReactFlowInstance<ReactFlowNode<UserJourneyFlowNodeDataByType>> | null>(null)
  const initialNodes = useMemo(() => buildUserJourneyFlowNodes(input), [input])
  const [nodes, setNodes, onNodesChange] =
    useNodesState<ReactFlowNode<UserJourneyFlowNodeDataByType>>(initialNodes)
  const edges = useMemo(() => buildUserJourneyFlowEdges(input), [input])

  useEffect(() => {
    setNodes(initialNodes)
    window.requestAnimationFrame(() => {
      void flowInstanceRef.current?.fitView(USER_JOURNEY_ATLAS_FIT_VIEW_OPTIONS)
    })
  }, [initialNodes, setNodes])

  useEffect(() => {
    const surface = surfaceRef.current
    if (!surface) return

    const handleWheel = (event: WheelEvent) => {
      if (shouldPreventUserJourneyAtlasWheelZoom(event.ctrlKey)) {
        event.preventDefault()
      }
    }
    const handleTouchMove = (event: TouchEvent) => {
      if (shouldPreventUserJourneyAtlasTouchZoom(event.touches.length)) {
        event.preventDefault()
      }
    }
    const handleGestureEvent = (event: Event) => {
      event.preventDefault()
    }
    const listenerOptions = { passive: false, capture: true } as const

    surface.addEventListener("wheel", handleWheel, listenerOptions)
    surface.addEventListener("touchmove", handleTouchMove, listenerOptions)
    surface.addEventListener("gesturestart", handleGestureEvent, listenerOptions)
    surface.addEventListener("gesturechange", handleGestureEvent, listenerOptions)
    surface.addEventListener("gestureend", handleGestureEvent, listenerOptions)

    return () => {
      surface.removeEventListener("wheel", handleWheel, listenerOptions)
      surface.removeEventListener("touchmove", handleTouchMove, listenerOptions)
      surface.removeEventListener("gesturestart", handleGestureEvent, listenerOptions)
      surface.removeEventListener("gesturechange", handleGestureEvent, listenerOptions)
      surface.removeEventListener("gestureend", handleGestureEvent, listenerOptions)
    }
  }, [])

  const fitView = useCallback(() => {
    void flowInstanceRef.current?.fitView(USER_JOURNEY_ATLAS_FIT_VIEW_OPTIONS)
  }, [])

  const handleFlowInit = useCallback((instance: ReactFlowInstance<ReactFlowNode<UserJourneyFlowNodeDataByType>>) => {
    flowInstanceRef.current = instance
    window.requestAnimationFrame(() => {
      void instance.fitView(USER_JOURNEY_ATLAS_FIT_VIEW_OPTIONS)
    })
  }, [])

  const handleZoomIn = useCallback(() => {
    void flowInstanceRef.current?.zoomIn({ duration: 180 })
  }, [])

  const handleZoomOut = useCallback(() => {
    void flowInstanceRef.current?.zoomOut({ duration: 180 })
  }, [])

  return (
    <section
      ref={surfaceRef}
      aria-label={input.title}
      className="relative flex h-full min-h-0 flex-1 touch-none overflow-hidden overscroll-contain bg-zinc-100 dark:bg-zinc-800"
      data-user-journey-atlas-flow="react-flow"
    >
      <UserJourneyAtlasViewportControls
        onFitView={fitView}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
      />
      <ReactFlow
        className="org-flow workspace-flow"
        edges={edges}
        edgesFocusable={false}
        elementsSelectable={false}
        fitView
        fitViewOptions={USER_JOURNEY_ATLAS_FIT_VIEW_OPTIONS}
        maxZoom={MAX_ZOOM}
        minZoom={MIN_ZOOM}
        nodes={nodes}
        nodesConnectable={false}
        nodesDraggable
        nodesFocusable={false}
        nodeTypes={USER_JOURNEY_ATLAS_NODE_TYPES}
        onInit={handleFlowInit}
        onNodesChange={onNodesChange}
        panOnDrag
        preventScrolling
        proOptions={USER_JOURNEY_ATLAS_PRO_OPTIONS}
        zoomOnDoubleClick={false}
        zoomOnPinch
        zoomOnScroll
      >
        <Background
          color="rgba(148, 163, 184, 0.64)"
          gap={20}
          id="user-journey-atlas-dot-grid"
          size={1.6}
          variant={BackgroundVariant.Dots}
        />
      </ReactFlow>
    </section>
  )
}
