import { z } from "zod"

export const FORM_GRID_LIMITS = { rows: 20, columns: 10 } as const
const axis = z.strictObject({ id: z.uuid(), label: z.string().max(240) })
const uniqueIds = (items: readonly { id: string }[]) => new Set(items.map(item => item.id)).size === items.length
const publishedAxis = axis.extend({ label: z.string().trim().min(1).max(240) }).readonly()
const uniqueLabels = (items: readonly { label: string }[]) => new Set(items.map(item => item.label.trim().toLowerCase())).size === items.length
export const formGridFields = {
  rows: z.array(axis).max(FORM_GRID_LIMITS.rows).refine(uniqueIds, "Row IDs must be unique."),
  columns: z.array(axis).max(FORM_GRID_LIMITS.columns).refine(uniqueIds, "Column IDs must be unique."),
}
export const formGridSnapshotFields = {
  rows: z.array(publishedAxis).min(1).max(FORM_GRID_LIMITS.rows).refine(uniqueIds).refine(uniqueLabels).readonly(),
  columns: z.array(publishedAxis).min(2).max(FORM_GRID_LIMITS.columns).refine(uniqueIds).refine(uniqueLabels).readonly(),
}
export const formGridAnswerSchema = z.record(z.uuid(), z.union([z.uuid(), z.array(z.uuid()).max(FORM_GRID_LIMITS.columns)]))
  .refine(value => Object.keys(value).length <= FORM_GRID_LIMITS.rows, "Too many grid rows.")
export type FormGridAnswer = z.infer<typeof formGridAnswerSchema>
