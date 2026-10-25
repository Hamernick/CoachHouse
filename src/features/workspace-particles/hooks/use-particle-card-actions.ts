"use client"

import { useCallback, useRef, type RefObject } from "react"
import { toast } from "@/lib/toast"
import {
  particleCardOperation,
  type ParticleCardAction,
} from "../lib/particle-card-actions"
import type { useParticleSession } from "./use-particle-session"

type Input = {
  session: ReturnType<typeof useParticleSession>
  flush: () => Promise<boolean>
  dirty: RefObject<boolean>
  blocked: boolean
}

export function useParticleCardActions(input: Input) {
  const latest = useRef(input)
  latest.current = input
  const running = useRef(false)
  return useCallback(async (id: string, action: ParticleCardAction) => {
    const current = latest.current
    if (running.current || current.blocked || !current.session.editable)
      return false
    if (current.dirty.current) {
      toast.error("Save or discard the open Particle edits first.")
      return false
    }
    running.current = true
    try {
      if (!(await current.flush())) return false
      const next = latest.current
      const graph = next.session.getCurrentGraph()
      if (
        next.blocked ||
        next.dirty.current ||
        next.session.error ||
        graph?.workspaceId !== current.session.graph?.workspaceId
      )
        return false
      const particle = graph?.particles.find((item) => item.id === id)
      if (!particle || particle.canvasHidden) return false
      const operation = particleCardOperation(
        particle,
        action,
        () => crypto.randomUUID(),
        new Date().toISOString()
      )
      if (!operation) return false
      const applied = await next.session.commit([operation])
      if (applied && action === "remove" && next.session.selectedId === id)
        next.session.select(null)
      return applied
    } catch {
      toast.error("Could not update this Particle. Try again.")
      return false
    } finally {
      running.current = false
    }
  }, [])
}
