import type { ReactFlowInstance } from "@xyflow/react"
import type { ParticleGraph, ParticleResult } from "../types"
import { getParticleHandles } from "./particle-registry"
import type { ParticleMeasurement } from "./graph-layout"
import type { ParticleLayoutScene } from "./layout-scene"

export function captureParticleScene(
  graph: ParticleGraph,
  flow: Pick<ReactFlowInstance, "getNodes" | "getInternalNode">
): ParticleResult<ParticleLayoutScene> {
  const measurements: ParticleMeasurement[] = []
  const obstacles: ParticleLayoutScene["obstacles"] = []
  const visible = new Set(
    graph.particles.filter((item) => !item.canvasHidden).map((item) => item.id)
  )
  const positions = new Map<string, { x: number; y: number }>()
  for (const node of flow.getNodes().filter((item) => !item.hidden)) {
    const internal = flow.getInternalNode(node.id)
    const width = internal?.measured.width
    const height = internal?.measured.height
    const position = internal?.internals.positionAbsolute
    if (
      !width ||
      !height ||
      !position ||
      node.dragging ||
      width < 0 ||
      height < 0 ||
      ![width, height, position.x, position.y].every(Number.isFinite)
    )
      return {
        ok: false,
        code: "unavailable",
        error: "Waiting for card measurements. Finish dragging and try again.",
      }
    if (!visible.has(node.id)) {
      obstacles.push({ id: node.id, ...position, width, height })
      continue
    }
    const particle = graph.particles.find((item) => item.id === node.id)
    if (!particle) continue
    const handles = getParticleHandles(particle)
    const ports: ParticleMeasurement["ports"] = []
    for (const [side, ids, measured] of [
      ["WEST", handles.inputs, internal.internals.handleBounds?.target],
      ["EAST", handles.outputs, internal.internals.handleBounds?.source],
    ] as const) {
      for (const id of ids) {
        const handle = measured?.find((item) => item.id === id)
        if (!handle)
          return {
            ok: false,
            code: "unavailable",
            error: "Waiting for connection handle measurements.",
          }
        ports.push({
          id,
          side,
          x: side === "WEST" ? 0 : width,
          y: handle.y + handle.height / 2,
        })
      }
    }
    measurements.push({ id: node.id, width, height, ports })
    positions.set(node.id, position)
  }
  if (measurements.length !== visible.size)
    return {
      ok: false,
      code: "unavailable",
      error: "Waiting for all visible Particles to mount.",
    }
  return {
    ok: true,
    value: {
      graph: {
        ...graph,
        particles: graph.particles.map((item) => {
          const position = positions.get(item.id)
          return position ? { ...item, position } : item
        }),
      },
      measurements,
      obstacles,
    },
  }
}
