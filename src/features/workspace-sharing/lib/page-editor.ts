import { z } from "zod"
import { projectParticlePublicContent, type Particle } from "@/features/workspace-particles"
import { workspacePageSchema } from "./page-schema"
import { WORKSPACE_PAGE_PARTICLE_LIMIT } from "./page-draft"

export const pageEditorRequestSchema = z.strictObject({
  canvasId: z.uuid().nullable().optional(),
  workspaceId: z.uuid(), particleId: z.uuid(), pageId: z.uuid().optional(),
  initialParticleIds: z.array(z.uuid()).min(1).max(WORKSPACE_PAGE_PARTICLE_LIMIT).optional(),
})
export const pageSummarySchema = z.strictObject({
  id: z.uuid(), title: z.string().max(240), visibility: z.enum(["private", "public"]),
  particleIds: z.array(z.uuid()),
})
export const pageChoiceSchema = z.strictObject({ id: z.uuid(), title: z.string(), reason: z.string().nullable() })
export const pageEditorDataSchema = z.strictObject({
  canvasId: z.uuid().nullable().optional(),
  workspaceId: z.uuid(), publishingEnabled: z.boolean(), suggestedPageId: z.uuid(),
  page: workspacePageSchema.nullable(), pages: z.array(pageSummarySchema), choices: z.array(pageChoiceSchema),
  initialParticleIds: z.array(z.uuid()).min(1).max(WORKSPACE_PAGE_PARTICLE_LIMIT),
})
export type PageEditorData = z.infer<typeof pageEditorDataSchema>
export type PageChoice = z.infer<typeof pageChoiceSchema>

/** Capability hints only. Review/commit still resolve saved canonical sources. */
export function pageChoice(particle: Particle): PageChoice {
  let reason: string | null = null
  const widget = particle.type === "activity" && !particle.data.source ? particle.data.widget : null
  const drive = widget?.kind === "document" && (widget.source?.kind === "drive" || widget.source?.kind === "roadmap_drive")
  const textDocument = widget?.kind === "document" && !widget.source && !!widget.fileId && ["txt", "md", "csv"].includes(widget.format ?? "")
  const projection = projectParticlePublicContent(particle)
  if (!drive && !textDocument && widget?.kind !== "image" && !projection.ok) {
    reason = widget?.kind === "document"
      ? "Share text, Markdown or CSV. Other files can be linked from Google Drive."
      : widget?.kind === "notes" && widget.source.kind === "module"
        ? "Lesson notes are private. Use a standalone note to share selected text."
        : "This Particle cannot be shared yet."
  }
  return { id: particle.id, title: particle.title, reason }
}

