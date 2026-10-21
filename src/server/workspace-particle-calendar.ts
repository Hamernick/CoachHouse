import "server-only"
import { allWorkspaceStates } from "@/features/workspace-management"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase"
import { readParticleGraph, workspaceParticleCalendarEvents } from "@/features/workspace-particles"

/** Caller must authorize organization/calendar access before supplying scope. */
export async function readWorkspaceParticleCalendar(supabase: SupabaseClient<Database>, orgId: string) {
  const { data, error } = await supabase.from("organization_workspace_boards")
    .select("state").eq("org_id", orgId).maybeSingle()
  if (error) throw new Error("Unable to load workspace events.")
  return allWorkspaceStates(data?.state).flatMap(({ id, state }) => {
    const graph = readParticleGraph(state.particleGraph, orgId)
    if (!graph.ok) throw new Error(graph.error)
    return workspaceParticleCalendarEvents(graph.value).map((event) => ({
      ...event,
      source: event.source && id ? { ...event.source, workspaceCanvasId: id } : event.source,
    }))
  })
}
