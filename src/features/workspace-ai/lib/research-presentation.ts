import { defineCatalog, validateSpec } from "@json-render/core"
import { schema } from "@json-render/react/schema"
import { z } from "zod"
import { formDefinitionSchema } from "@/features/organization-forms"
import { getParticleCapabilityCatalog } from "@/features/workspace-particles"
import { researchResultSchema, type ResearchResult } from "../research-types"
import { researchItemPreviewSchema, type ResearchItemPreview } from "./research-item-preview"
import { validateResearchRelationships } from "./research-relationships"
import { assertResearchCapabilities } from "./research-capabilities"
import { validateResearchForms } from "./research-form"
import { researchDataViewSchema, validateResearchDataViews } from "./research-data-view"

export const researchPresentationEnabled = process.env.NEXT_PUBLIC_WORKSPACE_AI_PRESENTATION === "1"
export type ResearchPlanContext = { title: string; members: { id: string; title: string }[] }
const keySchema = z.string().regex(/^item_[a-z][a-z0-9_-]{0,39}$/)
const rowsProps = z.strictObject({ label: z.enum(["Proposed plan items", "Incoming plan items"]) })
const itemProps = z.strictObject({
  title: z.string().min(1).max(240), content: z.string().max(1800).nullable(),
  membership: z.enum(["Existing", "Add to plan"]).nullable(),
  prerequisites: z.string().max(2100).nullable(),
  outcomes: z.array(z.strictObject({ key: z.string().max(48), label: z.string().max(240), next: z.string().max(3000) })).max(12),
})
const formProps = itemProps.extend({ definition: formDefinitionSchema })
const dataViewProps = itemProps.extend({ source: researchDataViewSchema, sourceName:z.string().max(240).optional() })

/** The manual registry is the capability authority. This catalog only projects
 * its qualified plan/note subset; it contains no source commands or state paths. */
export function researchPresentationCatalog(capabilities = getParticleCapabilityCatalog()) {
  assertResearchCapabilities(capabilities)
  return researchRenderCatalog
}
export const researchRenderCatalog = defineCatalog(schema, { components: {
    PlanRows: { props: rowsProps, description: "Inert, bounded proposed plan rows" },
    PlanItem: { props: itemProps, description: "Proposed work or existing reference; no external action" },
    WorkspaceNote: { props: itemProps, description: "Actual editable workspace note draft text" },
    WorkspaceForm: { props: formProps, description: "Actual private form definition, with no publication or intake" },
    ProjectDataView: { props: dataViewProps, description: "Declared existing-source view; rows, answers and counts are unavailable before an authorized saved-source read" },
}, actions: {} })
const elementSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("PlanRows"), props: rowsProps, children: z.array(keySchema).max(12) }),
  z.strictObject({ type: z.enum(["PlanItem", "WorkspaceNote"]), props: itemProps }),
  z.strictObject({ type: z.literal("WorkspaceForm"), props: formProps }),
  z.strictObject({ type: z.literal("ProjectDataView"), props: dataViewProps }),
])
const presentationSchema = z.strictObject({
  version: z.literal(1), capabilityVersion: z.literal(1),
  spec: z.strictObject({ root: z.literal("plan"), elements: z.record(z.union([z.literal("plan"), keySchema]), elementSchema) }),
})
export type ResearchPresentation = z.infer<typeof presentationSchema>

/** No arbitrary expressions, bindings, slots, watchers, actions or recursive
 * containers. Reject the whole preview, including orphaned/unknown elements. */
export function validateResearchPresentation(input: unknown, capabilities = getParticleCapabilityCatalog()): ResearchPresentation {
  researchPresentationCatalog(capabilities)
  if (new TextEncoder().encode(JSON.stringify(input)).byteLength > 96_000) throw new Error("Plan preview is too large.")
  const value = presentationSchema.parse(input)
  assertResearchCapabilities(capabilities, Object.values(value.spec.elements).some(element => element.type === "WorkspaceForm"),
    Object.values(value.spec.elements).some(element => element.type === "ProjectDataView"),Object.values(value.spec.elements).some(element=>element.type==="ProjectDataView"&&element.props.source.kind!=="projects"))
  const root = value.spec.elements.plan
  if (root?.type !== "PlanRows" || Object.keys(value.spec.elements).length !== root.children.length + 1 ||
      new Set(root.children).size !== root.children.length ||
      root.children.some(key => !value.spec.elements[key] || value.spec.elements[key].type === "PlanRows"))
    throw new Error("Invalid plan preview structure.")
  const structural = validateSpec(value.spec, { checkOrphans: true })
  if (!structural.valid || structural.issues.length) throw new Error("Invalid plan preview structure.")
  return value
}

export function projectResearchPresentation(input: ResearchResult, plan?: ResearchPlanContext): ResearchPresentation {
  const result = researchResultSchema.parse(input)
  validateResearchForms(result.items)
  validateResearchDataViews(result.items)
  validateResearchRelationships(result)
  if (new Set(result.items.map(item => item.key)).size !== result.items.length) throw new Error("Repeated preview item.")
  const referenceTitle = (reference: string) => plan?.members.find(member => `particle:${member.id}` === reference)?.title
    ?? result.sources.find(source => source.id === reference)?.title ?? "Existing item"
  const itemTitle = (key: string) => {
    const item = result.items.find(item => item.key === key)
    return item?.kind === "reference" && item.referenceId ? referenceTitle(item.referenceId) : item?.title ?? key
  }
  const elements: ResearchPresentation["spec"]["elements"] = {
    plan: { type: "PlanRows", props: { label: "Proposed plan items" }, children: result.items.map(item => `item_${item.key}`) },
  }
  for (const item of result.items) elements[`item_${item.key}`] = elementSchema.parse({
    type: item.kind === "data_view" ? "ProjectDataView" : item.kind === "form" ? "WorkspaceForm" : item.kind === "note" ? "WorkspaceNote" : "PlanItem",
    props: {
      title: itemTitle(item.key), content: item.kind === "reference" ? null : item.description,
      membership: plan ? item.kind === "reference" && plan.members.some(member => `particle:${member.id}` === item.referenceId) ? "Existing" : "Add to plan" : null,
      prerequisites: item.dependsOn.length ? `After: ${item.dependsOn.map(itemTitle).join(", ")}` : plan ? "No unconditional prerequisites" : null,
      outcomes: result.decisions?.find(decision => decision.itemKey === item.key)?.outcomes.map(outcome => ({
        key: outcome.key, label: outcome.label, next: outcome.next.length ? outcome.next.map(itemTitle).join(", ") : "No further action proposed",
      })) ?? [],
      ...(item.form ? { definition: item.form } : {}),
      ...(item.dataView ? { source: item.dataView,...(result.outputBindings?.find(binding=>binding.itemKey===item.key)?.existingSource ? {sourceName:result.outputBindings.find(binding=>binding.itemKey===item.key)!.existingSource!.sourceTitle}:{}) } : {}),
    },
  })
  return validateResearchPresentation({ version: 1, capabilityVersion: 1, spec: { root: "plan", elements } })
}

/** Completed streamed domain units only. Relationships and canonical bindings
 * remain absent until the saved result has passed full semantic validation. */
export function projectIncomingResearchPresentation(input: ResearchItemPreview[]): ResearchPresentation {
  const items = z.array(researchItemPreviewSchema).max(12).parse(input)
  if (new Set(items.map(item => item.key)).size !== items.length) throw new Error("Repeated preview item.")
  const elements: ResearchPresentation["spec"]["elements"] = {
    plan: { type: "PlanRows", props: { label: "Incoming plan items" }, children: items.map(item => `item_${item.key}`) },
  }
  for (const item of items) elements[`item_${item.key}`] = elementSchema.parse({
    type: item.kind === "data_view" ? "ProjectDataView" : item.kind === "form" ? "WorkspaceForm" : item.kind === "note" ? "WorkspaceNote" : "PlanItem",
    props: { title: item.title, content: item.description, membership: null, prerequisites: null, outcomes: [], ...(item.form ? { definition: item.form } : {}), ...(item.dataView ? { source: item.dataView } : {}) },
  })
  return validateResearchPresentation({ version: 1, capabilityVersion: 1, spec: { root: "plan", elements } })
}
