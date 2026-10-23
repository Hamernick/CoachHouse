import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase"
import { allWorkspaceStates } from "@/features/workspace-management"
import { particleSchema, particleRegistry } from "@/features/workspace-particles"
import type { OpportunitySourceOption } from "../lib/opportunity-sources"
import { opportunityProfileSources } from "./opportunity-profile-sources"
import { getWorkspaceDrawerPath } from "@/lib/workspace/routes"

export async function loadOpportunitySourceOptions(supabase: SupabaseClient<Database>, orgId: string): Promise<OpportunitySourceOption[]> {
  const [board, organization, calendar] = await Promise.all([
    supabase.from("organization_workspace_boards").select("state").eq("org_id", orgId).maybeSingle(),
    supabase.from("organizations").select("profile").eq("user_id", orgId).maybeSingle(),
    supabase.from("roadmap_calendar_internal_events").select("id,title,description,starts_at").eq("org_id", orgId).order("starts_at", { ascending: false }).limit(200),
  ])
  if (board.error || organization.error || calendar.error) throw new Error("Sources couldn’t be loaded.")
  const options = new Map<string, OpportunitySourceOption>()
  for (const workspace of allWorkspaceStates(board.data?.state)) {
    const graph = workspace.state.particleGraph
    if (!graph || typeof graph !== "object" || !("particles" in graph) || !Array.isArray(graph.particles)) continue
    for (const raw of graph.particles) {
      const parsed = particleSchema.safeParse(raw)
      if (!parsed.success || parsed.data.workspaceId !== orgId) continue
      const particle = parsed.data
      const widget = particle.type === "activity" ? particle.data.widget : undefined
      const notes = widget?.kind === "notes" && widget.source.kind === "workspace" ? widget.source.content : undefined
      options.set(particle.id, { source: { kind: "particle", id: particle.id }, title: particle.title,
        category: widget?.kind ?? (particle.type === "people" ? "Person" : particleRegistry[particle.type].label),
        description: (particle.description || notes || "").slice(0, 500),
        href: workspace.id ? `/workspace?workspace=${encodeURIComponent(workspace.id)}` : "/workspace",
      })
    }
  }
  return [...opportunityProfileSources(organization.data?.profile), ...(calendar.data ?? []).map(event => ({ source: { kind: "calendar" as const, id: event.id }, title: event.title, category: "Calendar item", description: event.description ?? undefined, startsAt: event.starts_at })), ...options.values(), ...([
    ["organization-overview", "Organization"], ["programs", "Resources"], ["fiscal-sponsorship", "Fiscal Sponsorship"],
  ] as const).map(([id, title]) => ({ source: { kind: "tool" as const, id }, title, category: "Tool", href: getWorkspaceDrawerPath({ tab: id === "organization-overview" ? "organization" : "tools" }) }))]
}
