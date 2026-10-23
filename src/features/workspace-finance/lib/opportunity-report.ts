import { z } from "zod"
import { opportunitySourcesSchema, type OpportunitySource } from "./opportunity-sources"

const base = { id: z.uuid(), title: z.string().trim().max(80) }
export const opportunityReportBlockSchema = z.discriminatedUnion("kind", [
  z.strictObject({ ...base, kind: z.literal("text"), text: z.string().max(6000) }),
  z.strictObject({ ...base, kind: z.literal("facts"), items: z.array(z.strictObject({ id: z.uuid(), label: z.string().trim().max(80), value: z.string().trim().max(500) })).max(12) }),
  z.strictObject({ ...base, kind: z.literal("sources"), sources: opportunitySourcesSchema }),
  z.strictObject({ ...base, kind: z.literal("image"), fileId: z.uuid().nullable(), alt: z.string().max(240) }),
])
export const opportunityReportSchema = z.strictObject({ version: z.literal(1), blocks: z.array(opportunityReportBlockSchema).max(12) }).refine(report => new Set(report.blocks.map(block => block.id)).size === report.blocks.length && report.blocks.every(block => block.kind !== "facts" || new Set(block.items.map(item => item.id)).size === block.items.length), "Each report component needs a unique ID.")
export type OpportunityReport = z.infer<typeof opportunityReportSchema>
export type OpportunityReportBlock = z.infer<typeof opportunityReportBlockSchema>
export const emptyOpportunityReport = (): OpportunityReport => ({ version: 1, blocks: [] })
export function readOpportunityReport(value: unknown): OpportunityReport {
  const result = opportunityReportSchema.safeParse(value)
  return result.success ? result.data : emptyOpportunityReport()
}
export function opportunityReportSources(report: OpportunityReport): OpportunitySource[] {
  return report.blocks.flatMap((block): OpportunitySource[] => block.kind === "sources" ? block.sources : block.kind === "image" && block.fileId ? [{ kind: "file", id: block.fileId }] : [])
}
export function hasReportContent(block: OpportunityReportBlock): boolean {
  return block.kind === "text" ? Boolean(block.text.trim()) : block.kind === "facts" ? block.items.some(item => item.label || item.value) : block.kind === "sources" ? block.sources.length > 0 : Boolean(block.fileId)
}
export const opportunityReportComponents = { text: "Text", facts: "Facts", sources: "People & sources", image: "Image" } as const
export function createOpportunityReportBlock(kind: OpportunityReportBlock["kind"]): OpportunityReportBlock {
  const base = { id: crypto.randomUUID(), title: "" }
  switch (kind) {
    case "text": return { ...base, kind, text: "" }
    case "facts": return { ...base, kind, items: [{ id: crypto.randomUUID(), label: "", value: "" }] }
    case "sources": return { ...base, kind, sources: [] }
    case "image": return { ...base, kind, fileId: null, alt: "" }
  }
}
