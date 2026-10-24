import type { ParticleGraph, ParticleResult } from "../types"
import {
  layoutParticleGraph,
  particleMeasurementKey,
  type ParticleLayout,
  type ParticleMeasurement,
  type ParticleLayoutRunner,
} from "./graph-layout"
import {
  routeParticleRelationship,
  segmentCrossesParticle,
} from "./orthogonal-routing"
import { visibleParticleConnections } from "./particle-placement"
import type { ParticleBounds } from "./selection"

export type ParticleLayoutScene = {
  graph: ParticleGraph
  measurements: ParticleMeasurement[]
  obstacles: ParticleBounds[]
}
export type ParticleLayoutRequest = {
  scene: ParticleLayoutScene
  scopeIds: string[]
}

export function particleSceneKey(scene: ParticleLayoutScene) {
  return JSON.stringify([
    scene.graph.workspaceId,
    scene.graph.revision,
    particleMeasurementKey(scene.measurements),
    scene.graph.particles
      .filter((item) => !item.canvasHidden)
      .map(({ id, position }) => ({ id, ...position }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    [...scene.obstacles].sort((a, b) => a.id.localeCompare(b.id)),
  ])
}

export function particleSceneBounds(
  scene: ParticleLayoutScene
): ParticleBounds[] {
  return scene.measurements.flatMap((size) => {
    const particle = scene.graph.particles.find((item) => item.id === size.id)
    return particle && !particle.canvasHidden
      ? [
          {
            id: size.id,
            ...particle.position,
            width: size.width,
            height: size.height,
          },
        ]
      : []
  })
}

export function routeParticleScene(
  scene: ParticleLayoutScene,
  nodes = particleSceneBounds(scene),
  preferred: ParticleLayout["routes"] = []
): ParticleResult<ParticleLayout["routes"]> {
  const boxes = [...nodes, ...scene.obstacles]
  const routes: ParticleLayout["routes"] = []
  for (const edge of visibleParticleConnections(scene.graph)) {
    const source = nodes.find((item) => item.id === edge.source)
    const target = nodes.find((item) => item.id === edge.target)
    const sourcePort = scene.measurements
      .find((item) => item.id === edge.source)
      ?.ports.find((port) => port.id === edge.sourceHandle)
    const targetPort = scene.measurements
      .find((item) => item.id === edge.target)
      ?.ports.find((port) => port.id === edge.targetHandle)
    if (!source || !target || !sourcePort || !targetPort)
      return {
        ok: false,
        code: "invalid",
        error: "Measure connection handles before routing.",
      }
    const candidate = preferred.find((item) => item.id === edge.id)?.points
    const safe = candidate?.every(
      (point, i) =>
        !i ||
        !boxes.some((box) =>
          segmentCrossesParticle(candidate[i - 1], point, box)
        )
    )
    const points = safe
      ? candidate
      : routeParticleRelationship(
          { x: source.x + sourcePort.x, y: source.y + sourcePort.y },
          { x: target.x + targetPort.x, y: target.y + targetPort.y },
          boxes
        )
    if (!points)
      return {
        ok: false,
        code: "unavailable",
        error:
          "Connections need more space. Move overlapping cards apart and try again.",
      }
    routes.push({ id: edge.id, points })
  }
  return { ok: true, value: routes }
}

const overlaps = (a: ParticleBounds, b: ParticleBounds, gap = 48) =>
  a.x < b.x + b.width + gap &&
  a.x + a.width + gap > b.x &&
  a.y < b.y + b.height + gap &&
  a.y + a.height + gap > b.y

export async function layoutParticleScene(
  { scene, scopeIds }: ParticleLayoutRequest,
  runner?: ParticleLayoutRunner
): Promise<ParticleResult<ParticleLayout>> {
  const scope = new Set(scopeIds)
  if (
    !scope.size ||
    scope.size !== scopeIds.length ||
    scopeIds.some((id) => {
      const item = scene.graph.particles.find((particle) => particle.id === id)
      return !item || item.locked || item.canvasHidden
    })
  )
    return {
      ok: false,
      code: "invalid",
      error: "Choose visible, unlocked Particles to arrange.",
    }
  const result = await layoutParticleGraph(
    {
      graph: scene.graph,
      measurements: scene.measurements.filter((item) => scope.has(item.id)),
      scopeIds,
    },
    runner
  )
  if (!result.ok) return result
  const before = particleSceneBounds(scene)
  const fixed = [
    ...scene.obstacles,
    ...before.filter((item) => !scope.has(item.id)),
  ]
  const moving = before.filter((item) => scope.has(item.id))
  const bounds = result.value.nodes
  // ELK owns relative positions. Translate its entire result as one block to
  // preserve that geometry while respecting fixed cards and manual selections.
  const origin = {
    x:
      Math.min(...moving.map((item) => item.x)) -
      Math.min(...bounds.map((item) => item.x)),
    y:
      Math.min(...moving.map((item) => item.y)) -
      Math.min(...bounds.map((item) => item.y)),
  }
  let minimumX = -Infinity,
    maximumX = Infinity
  for (const edge of scene.graph.connections) {
    if (
      edge.relationship === "feedback" ||
      edge.relationship === "related_resource"
    )
      continue
    const fixedSource = fixed.find((item) => item.id === edge.source)
    const fixedTarget = fixed.find((item) => item.id === edge.target)
    const movingSource = bounds.find((item) => item.id === edge.source)
    const movingTarget = bounds.find((item) => item.id === edge.target)
    if (fixedSource && movingTarget)
      minimumX = Math.max(
        minimumX,
        fixedSource.x + fixedSource.width + 112 - movingTarget.x
      )
    if (movingSource && fixedTarget)
      maximumX = Math.min(
        maximumX,
        fixedTarget.x - 112 - movingSource.x - movingSource.width
      )
  }
  if (minimumX > maximumX)
    return {
      ok: false,
      code: "unavailable",
      error:
        "There is not enough room between fixed dependencies. Include more Particles in the selection or move them apart.",
    }
  const anchorX = Math.max(minimumX, Math.min(maximumX, origin.x))
  const candidates = [{ x: anchorX, y: origin.y }]
  if (fixed.length)
    candidates.push(
      {
        x: Math.max(
          anchorX,
          Math.max(...fixed.map((item) => item.x + item.width)) +
            112 -
            Math.min(...bounds.map((item) => item.x))
        ),
        y: origin.y,
      },
      {
        x: anchorX,
        y:
          Math.max(...fixed.map((item) => item.y + item.height)) +
          80 -
          Math.min(...bounds.map((item) => item.y)),
      },
      {
        x: anchorX,
        y:
          Math.min(...fixed.map((item) => item.y)) -
          80 -
          Math.max(...bounds.map((item) => item.y + item.height)),
      }
    )
  const offset = candidates.find(
    (point) =>
      point.x <= maximumX &&
      !bounds.some((item) =>
        fixed.some((obstacle) =>
          overlaps(
            { ...item, x: item.x + point.x, y: item.y + point.y },
            obstacle
          )
        )
      )
  )
  if (!offset)
    return {
      ok: false,
      code: "unavailable",
      error:
        "Fixed cards leave no safe layout. Include more Particles or move them apart.",
    }
  const { x: dx, y: dy } = offset
  const moved = bounds.map((item) => ({
    ...item,
    x: item.x + dx,
    y: item.y + dy,
  }))
  const all = [...before.filter((item) => !scope.has(item.id)), ...moved]
  const preferred = result.value.routes.map((route) => ({
    id: route.id,
    points: route.points.map((point) => ({ x: point.x + dx, y: point.y + dy })),
  }))
  const routes = routeParticleScene(scene, all, preferred)
  if (!routes.ok) return routes
  return {
    ok: true,
    value: {
      ...result.value,
      measurementKey: particleMeasurementKey(scene.measurements),
      nodes: moved,
      routes: routes.value,
    },
  }
}
