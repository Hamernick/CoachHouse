import { z } from "zod"

export const composerContextReferenceSchema = z.strictObject({
  id: z.string().max(200).regex(/^(?:person:(?:team:)?[\w-]+|(?:document|file):[\w-]+|particle:[\w-]+(?::(?:plan|proposal):[\w-]+)?)$/),
  revision: z.string().max(2000).nullable(),
})
export const composerContextReferencesSchema = z.array(composerContextReferenceSchema).max(10)
  .refine(items => new Set(items.map(item => item.id)).size === items.length, "Duplicate context")
export type ComposerContextReference = z.infer<typeof composerContextReferenceSchema>
export const COMPOSER_CONTEXT_GROUPS = ["People", "Particles", "Documents", "Objectives", "Plans"] as const
export type ComposerContextItem = ComposerContextReference & {
  title: string; group: typeof COMPOSER_CONTEXT_GROUPS[number]; detail?: string; avatarUrl?: string; available: boolean
}
export type ComposerContextSelection = ComposerContextItem & { token: string }
export type ComposerContextResult = { items: ComposerContextItem[]; unavailable: string[] }
export type ComposerContextAccess = {
  version: number
  checking: boolean
  allows: (item: ComposerContextSelection) => boolean
  sanitize: (value: string) => string
}
export type ComposerContextControl = {
  access?: ComposerContextAccess
  selected: ComposerContextSelection[]
  search: (query: string) => Promise<ComposerContextResult>
  getCached?: (query: string) => ComposerContextResult | undefined
  select: (item: ComposerContextItem) => ComposerContextSelection
  remove: (id: string) => void
  reconcile: (items: ComposerContextSelection[]) => void
}
