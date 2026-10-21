"use client"

import { createContext, useContext, useId } from "react"
import type { Particle } from "../types"
import { getReactGrabOwnerProps } from "@/components/dev/react-grab-surface"

export const ParticleSurfaceContext = createContext<Particle | null>(null)

export function particleInspectionProps(particle: Particle) {
  const kind = particle.type === "activity" && particle.data.widget
    ? particle.data.widget.kind
    : particle.type
  return {
    "data-particle-kind": kind,
    "data-particle-id": particle.id,
    "data-particle-title": particle.title,
    "data-particle-storage-type": particle.type,
  }
}

// useId separates repeated records, preset previews and live canvas instances.
export function useParticleSurface(component: string, file: string) {
  const scope = useId()
  const particle = useContext(ParticleSurfaceContext)
  const identity = particle ? particleInspectionProps(particle) : null
  const prefix = identity ? `${identity["data-particle-kind"]}:${identity["data-particle-id"]}:` : ""
  return (slot: string) => ({
    ...identity,
    ...getReactGrabOwnerProps({
      ownerId: `workspace-particle:${prefix}${scope}:${slot}`,
      component,
      source: `src/features/workspace-particles/components/${file}`,
      slot,
    }),
  })
}
