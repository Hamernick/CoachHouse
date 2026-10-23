import { z } from "zod"
import { DOCUMENTS } from "@/lib/organization/core-document-definitions"
import { resolveRoadmapSections } from "@/lib/roadmap/sections"
import { getDocumentEditorHref } from "@/lib/workspace/editor-navigation"
import { getWorkspaceDrawerPath } from "@/lib/workspace/routes"
import type { OpportunitySourceOption } from "../lib/opportunity-sources"

const profileSchema = z.object({
  org_people: z.array(z.unknown()).optional(),
  documents: z.record(z.string(), z.unknown()).optional(),
  policies: z.array(z.unknown()).optional(),
}).passthrough()
const personSchema = z.object({ id: z.uuid(), name: z.string(), title: z.string().nullish() })
export function opportunityProfileSources(value: unknown): OpportunitySourceOption[] {
  const parsed = profileSchema.safeParse(value)
  if (!parsed.success) return []
  const profile = parsed.data
  const people: OpportunitySourceOption[] = (profile.org_people ?? []).flatMap(raw => {
    const person = personSchema.safeParse(raw)
    return person.success ? [{ source: { kind: "person" as const, id: person.data.id }, title: person.data.name, description: person.data.title ?? undefined, category: "Person", href: getWorkspaceDrawerPath({ tab: "people", focus: person.data.id }) }] : []
  })
  const uploads: OpportunitySourceOption[] = DOCUMENTS.flatMap(definition => {
    const file = z.object({ path: z.string().min(1) }).safeParse(profile.documents?.[definition.key])
    return file.success ? [{ source: { kind: "document" as const, id: `upload:${definition.kind}` }, title: definition.title, category: "Document", description: definition.description, href: getWorkspaceDrawerPath({ tab: "documents", focus: definition.kind }) }] : []
  })
  const core: OpportunitySourceOption[] = resolveRoadmapSections(profile).filter(section => section.content.trim() || section.driveSource).map(section => ({
    source: { kind: "document", id: `roadmap:${section.id}` }, title: section.title, category: "Document",
    description: section.content.replace(/<[^>]*>/g, " ").slice(0, 500), href: getDocumentEditorHref(section.slug),
  }))
  return [...people, ...uploads, ...core]
}
