import { allWorkspaceStates } from "@/features/workspace-management"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase"
import { readParticleGraph } from "../lib/graph-validation"
import { getParticleNotes, workspaceNoteDocuments } from "../lib/particle-notes"

/** Caller resolves organization access before providing its scoped client. */
export async function readWorkspaceNoteDocuments(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  id?: string,
  query = ""
) {
  const { data, error } = await supabase
    .from("organization_workspace_boards")
    .select("state")
    .eq("org_id", workspaceId)
    .maybeSingle()
  if (error) throw new Error("Unable to load workspace notes.")
  const graphs = allWorkspaceStates(data?.state).map(({ id: canvasId, state }) => {
    const graph = readParticleGraph("particleGraph" in state ? state.particleGraph : undefined, workspaceId)
    if (!graph.ok) throw new Error(graph.error)
    return { canvasId, graph: graph.value }
  })
  if (id) {
    for (const { canvasId, graph } of graphs) {
      const particle = graph.particles.find((item) => item.id === id)
      if (particle && getParticleNotes(particle)?.kind === "workspace")
        return { particle, revision: graph.revision, ...(canvasId ? { workspaceCanvasId: canvasId } : {}) }
    }
    return null
  }
  return graphs.flatMap(({ graph }) => workspaceNoteDocuments(graph.particles.filter((particle) => {
      const note = getParticleNotes(particle)
      return !query || (note?.kind === "workspace" && note.content.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
    })))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

}
