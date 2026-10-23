"use client"

import { createContext } from "react"
import type { ReactNode } from "react"
import type { Particle } from "../types"
import type { ParticleDrag } from "../lib/particle-placement"
import type { ParticleDragPoint } from "../lib/particle-drag-gesture"
import type { ParticlePlacementPhase } from "../lib/particle-stack"

export type ParticleLibraryDragRequest =
  | { kind: "existing"; drag: ParticleDrag }
  | { kind: "preset"; particle: Particle }
export type ParticleLibraryDragItem = {
  request: ParticleLibraryDragRequest
  title: string
  preview: ReactNode
  width?: number
  onPlacement?: (phase: ParticlePlacementPhase) => void
}
export function notifyParticleLibraryPlacement(
  item: ParticleLibraryDragItem,
  phase: ParticlePlacementPhase
) {
  try {
    item.onPlacement?.(phase)
  } catch {
    /* Animation failures cannot change a confirmed graph operation. */
  }
}
export function particleLibraryDragId(request: ParticleLibraryDragRequest) {
  return request.kind === "preset" ? request.particle.id : request.drag.id
}
export type ParticleLibraryDragController = {
  registerDropTarget?: (element: HTMLElement, handler: (item: ParticleLibraryDragItem) => Promise<boolean> | boolean) => () => void
  workspaceId?: string
  enabled?: boolean
  place?: (request: ParticleLibraryDragRequest) => Promise<boolean>
  begin: (
    item: ParticleLibraryDragItem,
    source: HTMLElement,
    point: ParticleDragPoint
  ) => boolean
  move: (point: ParticleDragPoint) => void
  drop: (point: ParticleDragPoint) => void
  cancel: () => void
}
export const ParticleLibraryDragContext =
  createContext<ParticleLibraryDragController | null>(null)
