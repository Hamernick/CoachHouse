"use client"

import { createContext, useContext } from "react"
import type { Particle } from "../types"

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

export function useParticleSurface() {
  const particle = useContext(ParticleSurfaceContext)
  return () => particle ? particleInspectionProps(particle) : {}
}
