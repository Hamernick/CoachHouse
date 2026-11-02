"use client"

import { useCallback, useRef, type RefObject } from "react"
import type { Particle, ParticleGraph, ParticlePosition, ParticleType } from "../types"
import { isImagePlaceholder } from "../lib/particle-image"
import { createParticle } from "../lib/particle-registry"
import { prepareParticlePlacementReveal, particlePlacementMeasurements, type ParticlePlacementViewport } from "../lib/particle-placement-viewport"
import { particleCreationPosition } from "../lib/particle-creation-placement"
import type { useParticleSession } from "./use-particle-session"

export function useParticleCreate({ add, dirty, getCurrentGraph, flow }: {
  add: ReturnType<typeof useParticleSession>["add"]
  dirty: RefObject<boolean>
  getCurrentGraph: () => ParticleGraph | null
  flow: RefObject<ParticlePlacementViewport | null>
}) {
  const latest = useRef({ add, dirty, getCurrentGraph, flow })
  latest.current = { add, dirty, getCurrentGraph, flow }
  return useCallback(async (type: ParticleType, title: string, prepared?: Particle,
    placement?: { position?: ParticlePosition; inspect?: boolean }) => {
    const { add, dirty, getCurrentGraph, flow } = latest.current
    if (dirty.current && !window.confirm("Discard unsaved Particle changes?")) return Promise.resolve(false)
    const graph = getCurrentGraph()
    if (!graph) return Promise.resolve(false)
    const particle = prepared ?? createParticle(type, { id: crypto.randomUUID(), workspaceId: graph.workspaceId, title, now: new Date().toISOString() })
    const position = placement?.position ?? particleCreationPosition(graph, particle, undefined, particlePlacementMeasurements(flow.current))
    const reveal = prepareParticlePlacementReveal(flow)
    const saved = await add(type, title, position, particle, {
      positionMode: placement?.position ? "manual" : "managed",
      inspect: placement?.inspect ?? (!prepared || !isImagePlaceholder(prepared)),
    })
    if (saved && !placement?.position) reveal({ ...particle, position })
    return saved
  }, [])
}
