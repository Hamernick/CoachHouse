"use client"

import { useCallback, useEffect, useRef } from "react"
import type { ReactFlowInstance } from "@xyflow/react"

import type { WorkspaceOntologyMode, WorkspaceOntologyRootId } from "../types"

type WorkspaceOntologyWayfindingNode = {
  id: string
  data: {
    node: {
      parentId: string
      rootId: string
    }
  }
}

const WORKSPACE_ONTOLOGY_CAMERA_PUNCH_MS = 520

export function useWorkspaceOntologyWayfinding({
  flowInstance,
  isFlowReady,
  layoutAnimating,
  nodes,
  mode,
  activeRootId,
  activeNodeIds,
}: {
  flowInstance: ReactFlowInstance | null
  isFlowReady: boolean
  layoutAnimating: boolean
  nodes: WorkspaceOntologyWayfindingNode[]
  mode: WorkspaceOntologyMode
  activeRootId: WorkspaceOntologyRootId | null
  activeNodeIds: string[]
}) {
  const previousNodeByIdRef = useRef(
    new Map(nodes.map((node) => [node.id, node] as const))
  )
  const fitPendingRef = useRef(false)
  const focusNodeIdRef = useRef<string | null>(null)
  const fitFrameRef = useRef<number | null>(null)
  const previousFocusSignatureRef = useRef("")

  const cancelPendingFit = useCallback(() => {
    fitPendingRef.current = false
    if (fitFrameRef.current === null) return
    window.cancelAnimationFrame(fitFrameRef.current)
    fitFrameRef.current = null
  }, [])

  useEffect(() => {
    const previousNodeById = previousNodeByIdRef.current
    const nextNodeById = new Map(nodes.map((node) => [node.id, node] as const))
    const addedNode = nodes.find((node) => !previousNodeById.has(node.id))
    const removedNode = Array.from(previousNodeById.values()).find(
      (node) => !nextNodeById.has(node.id)
    )
    const focusSignature = `${mode}:${activeRootId ?? ""}:${activeNodeIds.join(",")}`
    if (
      addedNode ||
      removedNode ||
      previousFocusSignatureRef.current !== focusSignature
    ) {
      fitPendingRef.current = true
      focusNodeIdRef.current =
        activeNodeIds[activeNodeIds.length - 1] ??
        addedNode?.id ??
        removedNode?.data.node.parentId ??
        activeRootId
    }
    previousFocusSignatureRef.current = focusSignature
    previousNodeByIdRef.current = nextNodeById
    const opening = Boolean(addedNode)
    if (
      (layoutAnimating && !opening) ||
      !fitPendingRef.current ||
      !isFlowReady
    ) {
      return
    }

    fitPendingRef.current = false
    fitFrameRef.current = window.requestAnimationFrame(() => {
      fitFrameRef.current = null
      if (!flowInstance) return
      const narrowViewport = window.innerWidth < 640
      const focusNodeId = focusNodeIdRef.current
      const focusNodes =
        mode === "map"
          ? nodes
          : activeRootId
            ? nodes.filter((node) => node.data.node.rootId === activeRootId)
            : []
      const sceneIdSet = new Set(focusNodes.map((node) => node.id))
      if (mode === "map") {
        for (const node of nodes) sceneIdSet.add(node.data.node.rootId)
      } else if (activeRootId) {
        sceneIdSet.add(activeRootId)
      }
      const sceneNodes = flowInstance
        .getNodes()
        .filter((node) => sceneIdSet.has(node.id))
      if (sceneNodes.length === 0) return
      const focusNode =
        narrowViewport && mode === "focus"
          ? sceneNodes.find((node) => node.id === focusNodeId)
          : undefined
      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches
      void flowInstance.fitView({
        nodes: focusNode ? [focusNode] : sceneNodes,
        padding: focusNode ? 0.12 : 0.16,
        minZoom: mode === "map" ? 0.2 : narrowViewport ? 0.9 : 0.64,
        maxZoom: mode === "map" ? 0.78 : 1,
        duration: reducedMotion ? 0 : WORKSPACE_ONTOLOGY_CAMERA_PUNCH_MS,
      })
    })
  }, [
    activeNodeIds,
    activeRootId,
    flowInstance,
    isFlowReady,
    layoutAnimating,
    mode,
    nodes,
  ])

  useEffect(
    () => () => {
      if (fitFrameRef.current !== null) {
        window.cancelAnimationFrame(fitFrameRef.current)
      }
    },
    []
  )

  return { cancelPendingFit }
}
