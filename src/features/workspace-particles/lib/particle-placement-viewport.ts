import { beginWorkspaceCameraIntent, captureWorkspaceCameraIntent } from "@/lib/workspace-canvas/camera-intent"
import type { ReactFlowInstance } from "@xyflow/react"
import type { Particle } from "../types"
import { particlePlacementBounds } from "./particle-creation-placement"

export type ParticlePlacementViewport = Pick<ReactFlowInstance, "setCenter" | "getZoom" | "getViewport" | "getNodes">

const activeReveals = new WeakMap<object, () => boolean>()

/** Reveal a new location only when it lies outside the current canvas view. */
export function revealParticlePlacement(flow: ParticlePlacementViewport | null, particle: Particle) {
  if (!flow) return
  const bounds = particlePlacementBounds(particle)
  const canvas = document.querySelector("[data-workspace-canvas-flow-frame]")?.getBoundingClientRect()
  const viewport = flow.getViewport()
  const x = bounds.x * viewport.zoom + viewport.x
  const y = bounds.y * viewport.zoom + viewport.y
  if (!activeReveals.get(flow)?.() && canvas && x >= 32 && y >= 32 && x + bounds.width * viewport.zoom <= canvas.width - 32 && y + bounds.height * viewport.zoom <= canvas.height - 96) return
  const ticket = beginWorkspaceCameraIntent(flow)
  activeReveals.set(flow, ticket)
  const settled = () => { if (activeReveals.get(flow) === ticket) activeReveals.delete(flow) }
  void flow.setCenter(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, {
    zoom: Math.min(1, flow.getZoom()),
    duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 240,
    ease: t => t * t * (3 - 2 * t), interpolate: "linear",
  }).then(settled, settled)
}

export function particlePlacementMeasurements(flow: Pick<ReactFlowInstance, "getNodes"> | null) {
  return (flow?.getNodes() ?? []).flatMap(node => node.measured?.width && node.measured.height
    ? [{ id: node.id, ...node.position, width: node.measured.width, height: node.measured.height }] : [])
}


/** Capture before saving/uploading so a late success cannot move a newer view. */
export function prepareParticlePlacementReveal(ref: { readonly current: ParticlePlacementViewport | null }) {
  const canvas = ref.current
  const isCurrent = canvas ? captureWorkspaceCameraIntent(canvas) : () => false
  return (particle: Particle) => {
    if (canvas && ref.current === canvas && isCurrent()) revealParticlePlacement(canvas, particle)
  }
}
