"use client"
import { useEffect, useRef } from "react"
import { useNodes, useReactFlow } from "@xyflow/react"
import { useReducedMotion } from "framer-motion"
import { isObjectivePlanNode } from "../lib/plan-projection"
export function ObjectivePlanViewport({ focusKey }: { focusKey: string }) {
  const nodes = useNodes().filter(node => isObjectivePlanNode(node.id))
  const { fitBounds, viewportInitialized } = useReactFlow()
  const reduced = useReducedMotion()
  const focused = useRef("")
  useEffect(() => {
    if (!focusKey) { focused.current = ""; return }
    if (!viewportInitialized || !nodes.length) return
    const key = `${focusKey}/${nodes.map(node => node.id).sort().join(":")}`
    if (focused.current === key) return
    focused.current = key
    // The canvas virtualizes offscreen nodes. Use known layout bounds rather than
    // waiting for DOM measurement of nodes that cannot mount until we pan to them.
    const x = Math.min(...nodes.map(node => node.position.x))
    const y = Math.min(...nodes.map(node => node.position.y))
    const right = Math.max(...nodes.map(node => node.position.x + (node.width ?? 260)))
    const bottom = Math.max(...nodes.map(node => node.position.y + (node.height ?? 120)))
    void fitBounds({ x, y, width: right - x, height: bottom - y }, { padding: 0.3, duration: reduced ? 0 : 200 })
  }, [nodes, focusKey, viewportInitialized, fitBounds, reduced])
  return null
}
