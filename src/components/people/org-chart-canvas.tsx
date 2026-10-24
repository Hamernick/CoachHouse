"use client"

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ReactFlow,
  applyNodeChanges,
  Background,
  Controls,
  MiniMap,
  type NodeChange,
  type OnNodeDrag,
  type ReactFlowInstance,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import { toast } from "@/lib/toast"
import { useTheme } from "next-themes"
import { SAVE_DEBOUNCE_MS } from "@/components/people/org-chart-canvas/constants"
import { PersonNode } from "@/components/people/org-chart-canvas/components"
import {
  buildGraphLayout,
  getPositionExtent,
} from "@/components/people/org-chart-canvas/helpers"
import type {
  FlowNode,
  OrgChartCanvasProps as Props,
  PositionPayload,
} from "@/components/people/org-chart-canvas/types"

const ORG_NODE_TYPES = Object.freeze({ person: PersonNode })
const ORG_EDGE_TYPES = Object.freeze({})
const ORG_DEFAULT_VIEWPORT = Object.freeze({ x: 0, y: 0, zoom: 0.38 })
const ORG_PRO_OPTIONS = Object.freeze({ hideAttribution: true })
const ORG_DEFAULT_EDGE_OPTIONS = Object.freeze({
  type: "smoothstep" as const,
  style: Object.freeze({ strokeWidth: 1.4 }),
})

function OrgChartCanvasComponent({ people, extras = false, canEdit = true }: Props) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [reactFlow, setReactFlow] = useState<ReactFlowInstance | null>(null)
  const [pendingFit, setPendingFit] = useState(true)
  const [nodes, setNodes] = useState<FlowNode[]>([])

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingUpdatesRef = useRef<Map<string, PositionPayload>>(new Map())

  const theme = mounted && resolvedTheme ? resolvedTheme : "light"
  const isDark = theme === "dark"

  const graph = useMemo(() => buildGraphLayout(people), [people])
  const translateExtent = useMemo(() => getPositionExtent(nodes), [nodes])
  const showMiniMap = extras && nodes.length > 24

  const flushPositionUpdates = useCallback(async () => {
    if (pendingUpdatesRef.current.size === 0) return
    const payload = Array.from(pendingUpdatesRef.current.values())
    pendingUpdatesRef.current.clear()
    try {
      const response = await fetch("/api/people/position", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ positions: payload }),
      })
      if (!response.ok) {
        throw new Error("Unable to save chart layout.")
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save chart layout."
      toast.error(message)
    }
  }, [])

  const queuePositionPersist = useCallback((updates: PositionPayload[]) => {
    if (updates.length === 0) return
    for (const update of updates) {
      pendingUpdatesRef.current.set(update.id, update)
    }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      void flushPositionUpdates()
    }, SAVE_DEBOUNCE_MS)
  }, [flushPositionUpdates])

  const handleReactFlowError = useCallback((errorCode: string, message: string) => {
    console.warn(`[org-chart][reactflow:${errorCode}] ${message}`)
  }, [])

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((previousNodes) => applyNodeChanges(changes, previousNodes) as FlowNode[])
  }, [])

  const onNodeDragStop = useCallback<OnNodeDrag>(
    (_, node) => {
      if (!canEdit) return
      setNodes((previousNodes) => {
        const nextNodes = previousNodes.map((item) => {
          if (item.id !== node.id) return item
          return {
            ...item,
            position: {
              x: Math.round(node.position.x),
              y: Math.round(node.position.y),
            },
          }
        })
        queuePositionPersist([
          {
            id: node.id,
            x: Math.round(node.position.x),
            y: Math.round(node.position.y),
          },
        ])
        return nextNodes
      })
    },
    [canEdit, queuePositionPersist],
  )

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setNodes(graph.nodes)
    setPendingFit(true)
  }, [graph.nodes])

  useEffect(() => {
    if (!reactFlow || !pendingFit) return
    const frame = window.requestAnimationFrame(() => {
      reactFlow.fitView({
        padding: 0.3,
        minZoom: 0.14,
        maxZoom: 0.9,
        duration: 160,
      })
      setPendingFit(false)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [pendingFit, reactFlow])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      void flushPositionUpdates()
    }
  }, [flushPositionUpdates])

  return (
    <div className="space-y-3">
      <div
        className="h-[min(64vh,720px)] w-full rounded-2xl border border-border/60 bg-card/60 shadow-sm"
        style={{ contain: "layout paint" }}
      >
        {!mounted ? (
          <div className="h-full w-full" />
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={graph.edges}
            defaultViewport={ORG_DEFAULT_VIEWPORT}
            minZoom={0.12}
            maxZoom={1}
            zoomOnPinch
            zoomOnScroll
            panOnDrag
            panOnScroll={false}
            nodesDraggable={canEdit}
            nodesConnectable={false}
            elementsSelectable={canEdit}
            selectionOnDrag={false}
            selectNodesOnDrag={false}
            onlyRenderVisibleElements
            proOptions={ORG_PRO_OPTIONS}
            defaultEdgeOptions={ORG_DEFAULT_EDGE_OPTIONS}
            nodeTypes={ORG_NODE_TYPES}
            edgeTypes={ORG_EDGE_TYPES}
            translateExtent={translateExtent}
            onError={handleReactFlowError}
            className="org-flow"
            style={{ width: "100%", height: "100%" }}
            onInit={setReactFlow}
            onNodesChange={onNodesChange}
            onNodeDragStop={onNodeDragStop}
          >
            <Controls position="top-right" showInteractive={false} />
            {showMiniMap ? <MiniMap pannable zoomable /> : null}
            <Background color={isDark ? "#1f2937" : "#e5e7eb"} gap={18} />
          </ReactFlow>
        )}
      </div>
    </div>
  )
}

export const OrgChartCanvas = memo(OrgChartCanvasComponent)
