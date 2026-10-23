import { z } from "zod"

export const opportunitySourceSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("particle"), id: z.uuid() }),
  z.strictObject({ kind: z.literal("file"), id: z.uuid() }),
  z.strictObject({ kind: z.literal("person"), id: z.uuid() }),
  z.strictObject({ kind: z.literal("calendar"), id: z.uuid() }),
  z.strictObject({ kind: z.literal("document"), id: z.string().min(1).max(240) }),
  z.strictObject({ kind: z.literal("tool"), id: z.enum(["organization-overview", "programs", "fiscal-sponsorship"]) }),
  z.strictObject({ kind: z.literal("link"), url: z.url({ protocol: /^https?$/ }).max(2048).refine(value => { try { const url = new URL(value); return !url.username && !url.password } catch { return false } }, "Use a valid link without credentials.") }),
  z.strictObject({ kind: z.literal("text"), label: z.string().trim().min(1).max(120) }),
])
export const opportunitySourcesSchema = z.array(opportunitySourceSchema).max(20).refine(items => new Set(items.map(sourceKey)).size === items.length, "Source already added.")
export type OpportunitySource = z.infer<typeof opportunitySourceSchema>
export type OpportunitySourceOption = { source: OpportunitySource; title: string; category: string; description?: string; href?: string; startsAt?: string }
export function sourceKey(source: OpportunitySource): string {
  return source.kind === "link" ? `link:${source.url}` : source.kind === "text" ? `text:${source.label}` : `${source.kind}:${source.id}`
}
export function readOpportunitySources(value: unknown): OpportunitySource[] {
  const parsed = opportunitySourcesSchema.safeParse(value)
  return parsed.success ? parsed.data : []
}
