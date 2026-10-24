"use client"

import { useEffect, useRef } from "react"
import { calendarParticleId } from "@/lib/roadmap/calendar-particle-link"
import { toast } from "@/lib/toast"
import type { ParticleGraph } from "../types"

/** Resolve only against this authorized workspace. Hidden cards can be edited
 * in the inspector without restoring their saved canvas placement. */
export function useParticleCalendarTarget(target: string | null, graph: ParticleGraph | null, sourceRevision: number | null, workspaceId: string, select: (id: string) => boolean) {
  const handled = useRef<string | null>(null)
  useEffect(() => {
    if (!target) { handled.current = null; return }
    const id = calendarParticleId(target)
    if (!id || !graph || sourceRevision === null || graph.workspaceId !== workspaceId || graph.revision < sourceRevision || handled.current === target) return
    const particle = graph.particles.find(item => item.id === id)
    // Session adoption follows incoming server props in an effect. Keep the
    // request until the current authorized graph adopts the source; a stale
    // retained graph must not consume a valid calendar navigation.
    handled.current = target
    if (!particle || particle.type !== "activity" || particle.data.widget?.kind !== "event")
      toast.error("This Event is unavailable in the current organization.")
    else if (!select(id)) return
    // Consume the one-shot request without another server render. This also
    // allows the same calendar entry to be opened again after closing it.
    const url = new URL(window.location.href)
    if (url.searchParams.get("particle") === target) {
      url.searchParams.delete("particle")
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`)
    }
  }, [target, graph, sourceRevision, workspaceId, select])
}
