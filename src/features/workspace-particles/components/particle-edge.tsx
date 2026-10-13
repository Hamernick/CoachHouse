"use client"

import { memo } from "react"
import {
  BaseEdge,
  SmoothStepEdge,
  useInternalNode,
  type Edge,
  type EdgeProps,
} from "@xyflow/react"
import { resolveParticleEdgeGeometry } from "../lib/particle-handle-geometry"
import type { ParticlePosition } from "../types"
import { roundedParticleRoute } from "../lib/orthogonal-routing"

export type ParticleFlowEdge = Edge<{ points?: ParticlePosition[] }>
export const ParticleEdge = memo(function ParticleEdge(
  original: EdgeProps<ParticleFlowEdge>
) {
  const source = useInternalNode(original.source)
  const target = useInternalNode(original.target)
  const geometry = resolveParticleEdgeGeometry(
    source,
    target,
    original.sourceHandleId ?? "out",
    original.targetHandleId ?? "in"
  )
  const props = geometry ? { ...original, ...geometry } : original
  const points = props.data?.points
  const first = points?.[0],
    last = points?.[points.length - 1]
  // While dragging/animating, React Flow keeps endpoints attached. A stale
  // routed path is never stretched or translated independently from its cards.
  if (
    !points ||
    !first ||
    !last ||
    Math.abs(first.x - props.sourceX) > 8 ||
    Math.abs(first.y - props.sourceY) > 1 ||
    Math.abs(last.x - props.targetX) > 8 ||
    Math.abs(last.y - props.targetY) > 1
  )
    return <SmoothStepEdge {...props} />
  const attached = points.map((point, index) =>
    index === 0
      ? { x: props.sourceX, y: props.sourceY }
      : index === points.length - 1
        ? { x: props.targetX, y: props.targetY }
        : point
  )
  let middle = { x: (first.x + last.x) / 2, y: (first.y + last.y) / 2 }
  let longest = 0
  for (let index = 1; index < attached.length; index += 1) {
    const before = attached[index - 1],
      after = attached[index]
    const length = Math.hypot(after.x - before.x, after.y - before.y)
    if (length > longest) {
      longest = length
      middle = { x: (before.x + after.x) / 2, y: (before.y + after.y) / 2 }
    }
  }
  return (
    <BaseEdge
      interactionWidth={props.interactionWidth ?? 28}
      id={props.id}
      path={roundedParticleRoute(attached)}
      style={props.style}
      markerEnd={props.markerEnd}
      markerStart={props.markerStart}
      label={props.label}
      labelX={middle.x}
      labelY={middle.y}
      labelStyle={{ fill: "var(--foreground)" }}
      labelBgStyle={{ fill: "var(--card)" }}
    />
  )
})
