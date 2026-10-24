import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase"
import { allWorkspaceStates } from "@/features/workspace-management"
import { particleSchema, particleRegistry } from "@/features/workspace-particles"
import type { OpportunitySourceOption } from "../lib/opportunity-sources"
import { opportunityProfileSources } from "./opportunity-profile-sources"
import { getWorkspaceDrawerPath } from "@/lib/workspace/routes"
import { listUserModuleNotesIndex } from "@/lib/modules/notes-index"

export async function loadOpportunitySourceOptions(supabase: SupabaseClient<Database>, orgId: string, userId?: string): Promise<OpportunitySourceOption[]> {
  const [board, organization, calendar, files, notes] = await Promise.all([
    supabase.from("organization_workspace_boards").select("state").eq("org_id", orgId).maybeSingle(),
    supabase.from("organizations").select("profile").eq("user_id", orgId).maybeSingle(),
    supabase.from("roadmap_calendar_internal_events").select("id,title,description,starts_at").eq("org_id", orgId).order("starts_at", { ascending: false }).limit(200),
    supabase.from("organization_document_files").select("id,name,mime_type,size_bytes,storage_path").eq("org_id", orgId).is("deleted_at", null).is("document_kind", null).order("created_at", { ascending: false }).limit(1000),
    userId ? listUserModuleNotesIndex({ supabase, userId, limit: 200 }) : Promise.resolve([]),
  ])
  if (board.error || organization.error || calendar.error || files.error) throw new Error("Sources couldn’t be loaded.")
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
  const fileOptions: OpportunitySourceOption[] = (files.data ?? []).filter(file => file.storage_path.startsWith(`${orgId}/library/`) && !file.storage_path.split("/").includes("..")).map(file => ({ source: { kind: "file", id: file.id }, title: file.name, mimeType: file.mime_type, category: "Document", description: `${file.mime_type} · ${Math.ceil(file.size_bytes / 1024)} KB` }))
  const noteOptions: OpportunitySourceOption[] = notes.map(note => ({ source: { kind: "document", id: `module:${userId}:${note.moduleId}` }, title: `${note.moduleTitle} notes`, category: "Document", description: note.content.slice(0, 500), href: note.href ?? undefined }))
  return [...fileOptions, ...noteOptions, ...opportunityProfileSources(organization.data?.profile), ...(calendar.data ?? []).map(event => ({ source: { kind: "calendar" as const, id: event.id }, title: event.title, category: "Calendar item", description: event.description ?? undefined, startsAt: event.starts_at })), ...options.values(), ...([
    ["organization-overview", "Organization"], ["programs", "Resources"], ["fiscal-sponsorship", "Fiscal Sponsorship"],
  ] as const).map(([id, title]) => ({ source: { kind: "tool" as const, id }, title, category: "Tool", href: getWorkspaceDrawerPath({ tab: id === "organization-overview" ? "organization" : "tools" }) }))]
}
