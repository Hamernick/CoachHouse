import "server-only"
import { allWorkspaceStates } from "@/features/workspace-management"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase"
import { workspaceParticleCalendarEvents } from "@/features/workspace-particles"

import { readWorkspaceBoardForProjection } from "@/lib/organization/particle-board-read"
import { projectStoredParticleGraphAudience } from "@/features/workspace-particles/server"

/** Caller must authorize organization/calendar access before supplying scope. */
export async function readWorkspaceParticleCalendar(supabase: SupabaseClient<Database>, orgId: string, actorId: string) {
  const { data, error } = await readWorkspaceBoardForProjection(supabase, orgId, actorId)
  if (error) throw new Error("Unable to load workspace events.")
  const events = []
  for (const { id, state } of allWorkspaceStates(data?.state)) {
    const graph = await projectStoredParticleGraphAudience(state.particleGraph, orgId, actorId)
    events.push(...workspaceParticleCalendarEvents(graph).map((event) => ({
      ...event,
      source: event.source && id ? { ...event.source, workspaceCanvasId: id } : event.source,
    })))
  }
  return events
}
