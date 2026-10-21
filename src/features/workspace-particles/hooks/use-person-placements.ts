"use client"

import { useCallback, useMemo } from "react"
import { toast } from "@/lib/toast"
import { personPlacements, planPersonPlacements, type PersonPlacement } from "../lib/person-placement"
import { placeParticle } from "../lib/particle-placement"
import type { ParticleSession } from "./use-particle-session"

/** Uses the caller's shared session. No transport, history, local persistence or
 * intermediate drag state belongs here. Movement uses the canvas move pipeline. */
export function usePersonPlacements(session: ParticleSession) {
  const { graph, editable, getCurrentGraph, commit, edit } = session
  const placements = useMemo(
    () => graph ? [...personPlacements(graph).values()] : [],
    [graph]
  )
  const add = useCallback(async (requested: readonly PersonPlacement[]) => {
    const current = getCurrentGraph()
    if (!editable || !current) return false
    const planned = planPersonPlacements({
      graph: current,
      placements: requested,
      uuid: () => crypto.randomUUID(),
      now: new Date().toISOString(),
    })
    if (!planned.ok) {
      toast.error(planned.error)
      return false
    }
    // Existing placements do not move or create empty history entries.
    if (!planned.value.length) return true
    return commit(planned.value, { optimistic: true })
  }, [editable, getCurrentGraph, commit])

  const remove = useCallback(async (personId: string) => {
    const current = getCurrentGraph()
    if (!editable || !current) return false
    const particle = personPlacements(current).get(personId)
    if (!particle || particle.canvasHidden) return true
    return edit(placeParticle(particle, false), { optimistic: true })
  }, [editable, getCurrentGraph, edit])

  return useMemo(() => ({ placements, add, remove }), [placements, add, remove])
}
