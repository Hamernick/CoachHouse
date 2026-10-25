import type { ParticleLibraryDragRequest } from "@/features/workspace-particles/client"
import type { OpportunitySource, OpportunitySourceOption } from "./opportunity-sources"

export function opportunityDocumentDrop(request: ParticleLibraryDragRequest, organizationId: string, options: OpportunitySourceOption[]): OpportunitySource | null {
  if (request.kind === "existing") return request.drag.workspaceId === organizationId && request.drag.kind === "particle" ? { kind: "particle", id: request.drag.id } : null
  const particle = request.particle
  if (particle.workspaceId !== organizationId || particle.type !== "activity") return null
  const widget = particle.data.widget
  if (widget?.kind === "image" || (widget?.kind === "document" && widget.fileId)) return { kind: "file", id: widget.fileId! }
  if (widget?.kind === "notes" && widget.source.kind === "module") {
    const moduleId = widget.source.moduleId
    return options.find(item => item.source.kind === "document" && item.source.id.startsWith("module:") && item.source.id.endsWith(`:${moduleId}`))?.source ?? null
  }
  if (widget?.kind !== "document" || !widget.source) return null
  const source = widget.source
  if (source.kind === "workspace_note") return { kind: "particle", id: source.id }
  if (source.kind === "drive") return { kind: "link", url: source.webViewLink }
  if (source.kind === "upload") return { kind: "document", id: `upload:${source.documentKind}` }
  if (source.kind === "policy") return { kind: "document", id: `policy:${source.id}` }
  if (source.kind === "roadmap" || source.kind === "roadmap_drive") return { kind: "document", id: `roadmap:${source.sectionId}` }
  return null
}
