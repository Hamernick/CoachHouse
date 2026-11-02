import { z } from "zod"
import { responseViewSourceSchema, responseViewPayloadSchema, responseViewEditCommandSchema, responseViewDirectoryCommandSchema } from "./response-source"

const key = z.string().regex(/^[a-z][a-z0-9_]{0,39}$/)
export const dataColumnSchema = z.strictObject({
  key, label: z.string().trim().min(1).max(80),
  type: z.enum(["text", "number", "boolean", "date", "select"]),
  options: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  writable: z.boolean().default(true),
  queryable: z.boolean().optional(),
}).refine(column => column.type !== "select" || column.options.length > 0, "Selection columns need options.")
export const dataColumnsSchema = z.array(dataColumnSchema).min(1).max(12)
  .refine(columns => new Set(columns.map(column => column.key)).size === columns.length, "Column keys must be unique.")
export const dataCellSchema = z.union([z.string().max(10000), z.number().finite(), z.boolean(), z.null()])
export const dataRowValuesSchema = z.record(key, dataCellSchema)
export const dataViewConfigSchema = z.strictObject({
  columns: z.array(key).min(1).max(12),
  filter: z.strictObject({ column: key, value: z.string().max(120) }).nullable(),
  sort: z.strictObject({ column: key, direction: z.enum(["asc", "desc"]) }),
})
const target = { organizationId: z.uuid(), viewId: z.uuid() }
const mutation = { ...target, requestId: z.uuid() }
export const dataViewCommandSchema = z.discriminatedUnion("action", [
  responseViewEditCommandSchema, responseViewDirectoryCommandSchema,
  z.strictObject({ ...target, action: z.literal("read"), page: z.number().int().min(0).max(400).default(0) }),
  z.strictObject({ ...target, action: z.literal("sources") }),
  z.strictObject({ ...mutation, action: z.literal("create_view"), name: z.string().trim().min(1).max(100),
    source: z.discriminatedUnion("kind", [
      z.strictObject({ kind: z.literal("projects") }),
      responseViewSourceSchema,
      z.strictObject({ kind: z.literal("table"), tableId: z.uuid() }),
      z.strictObject({ kind: z.literal("new_table"), columns: dataColumnsSchema, rows: z.array(dataRowValuesSchema).max(500),
        provenance: z.strictObject({ kind: z.enum(["new", "csv_copy"]), filename: z.string().max(255).nullable(), rowCount: z.number().int().min(0).max(500) }),
        audienceConfirmed: z.literal(true),
      }),
    ]),
  }),
  z.strictObject({ ...mutation, action: z.literal("save_view"), revision: z.number().int().positive(), config: dataViewConfigSchema }),
  z.strictObject({ ...mutation, action: z.literal("edit_cell"), rowId: z.uuid(), revision: z.string().min(1).max(80), column: key, value: dataCellSchema }),
  z.strictObject({ ...mutation, action: z.literal("add_row"), values: dataRowValuesSchema }),
]).refine(command => new TextEncoder().encode(JSON.stringify(command, null, 1)).byteLength <= 1_000_000, "This request exceeds 1 MB. Split the import into a smaller file.")
export const dataViewPageSchema = z.strictObject({
  view: z.strictObject({ id: z.uuid(), name: z.string(), revision: z.number().int().positive(), source: z.enum(["projects", "table", "responses"]), tableId: z.uuid().nullable(), config: dataViewConfigSchema }).nullable(),
  columns: z.array(dataColumnSchema),
  rows: z.array(z.strictObject({ id: z.uuid(), revision: z.string(), values: dataRowValuesSchema })).max(25),
  total: z.number().int().nonnegative(), page: z.number().int().nonnegative(), canEdit: z.boolean(),
  provenance: z.record(z.string(), z.unknown()).nullable(),
  responseSource: responseViewPayloadSchema.optional(),
})
export type DataColumn = z.infer<typeof dataColumnSchema>
export type DataViewCommand = z.infer<typeof dataViewCommandSchema>
export type DataViewPage = z.infer<typeof dataViewPageSchema>
export type DataViewConfig = z.infer<typeof dataViewConfigSchema>
export type DataRowValues = z.infer<typeof dataRowValuesSchema>
export type DataViewResult = { ok: true; data: unknown } | { ok: false; code: "invalid" | "conflict" | "denied" | "unavailable"; error: string }
