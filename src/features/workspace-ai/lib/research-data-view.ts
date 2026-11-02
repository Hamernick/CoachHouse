import { z } from "zod"
import { projectDataViewSourceSchema } from "@/features/workspace-data-views"

export const researchDataViewSchema = projectDataViewSourceSchema
export const researchOutputBindingsSchema = z.array(z.strictObject({
  kind: z.literal("data_view"), itemKey: z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/), viewId: z.uuid(), requestId: z.uuid(),
})).max(12).refine(bindings => ["itemKey", "viewId", "requestId"].every(field =>
  new Set(bindings.map(binding => binding[field as keyof typeof binding])).size === bindings.length), "Output identities must be distinct.")
export type ResearchOutputBinding = z.infer<typeof researchOutputBindingsSchema>[number]
type ViewItem = { key: string; kind: string; title: string; dataView?: z.infer<typeof researchDataViewSchema> | null }

export function validateResearchDataViews(items: readonly ViewItem[]) {
  for (const item of items) {
    if (item.kind === "data_view") {
      researchDataViewSchema.parse(item.dataView)
      if (!item.title.trim() || item.title.length > 100) throw new Error("Give the data view a title of at most 100 characters.")
    } else if (item.dataView !== undefined && item.dataView !== null) throw new Error("Only a data-view item can configure a saved view.")
  }
}

/** Server authoring only. These IDs are absent from every provider schema. */
export function createResearchOutputBindings(items: readonly ViewItem[], uuid: () => string): ResearchOutputBinding[] {
  return researchOutputBindingsSchema.parse(items.filter(item => item.kind === "data_view")
    .map(item => ({ kind: "data_view", itemKey: item.key, viewId: uuid(), requestId: uuid() })))
}

export function researchViewBinding(bindings: ResearchOutputBinding[] | undefined, key: string) {
  const binding = researchOutputBindingsSchema.parse(bindings ?? []).find(value => value.itemKey === key)
  if (!binding) throw new Error("This saved research has no verified data-view identity.")
  return binding
}

export const researchSourceEffectSchema = z.strictObject({
  key: z.string().max(40), kind: z.literal("data_view"),
  status: z.enum(["not_created", "created", "uncertain", "denied", "conflict"]),
  viewId: z.uuid(), name: z.string().max(100).nullable(), message: z.string().max(400),
})
export const researchSourceEffectsSchema = z.strictObject({ effects: z.array(researchSourceEffectSchema).max(12), planApplied: z.boolean() })
export type ResearchSourceEffect = z.infer<typeof researchSourceEffectSchema>
