import { z } from "zod"

import { googleSheetRangeSchema } from "@/features/google-drive/client"

const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)
const column = z.string().regex(/^[a-z][a-z0-9_]{0,39}$/)
export const tableAnalysisMaxGroups = 20
export const tableAnalysisGroupLabelSchema = z.string().min(1).max(120).refine(
  value => value.trim() === value && value.normalize("NFC") === value && !/[\p{Cc}\p{Cf}]/u.test(value),
  "Group labels must be explicit, unambiguous text")
/** Explicit monthly, major-unit amounts. No guessed locale, FX or period coercion. */
export const tableAnalysisRequestSchema = z.strictObject({
  id: z.string().regex(/^(?:particle|file):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
  budgetColumn: column, actualColumn: column, currencyColumn: column, periodColumn: column,
  currency: z.enum(["USD", "EUR", "GBP", "CAD", "AUD"]), amountUnit: z.literal("major"),
  period: month,
  compareToPeriod: month.nullable().optional(),
  groupByColumn: column.nullable().optional(),
}).refine(value => new Set([value.budgetColumn,value.actualColumn,value.currencyColumn,value.periodColumn]).size === 4, "Choose four distinct typed columns")
  .refine(value => !value.compareToPeriod || value.compareToPeriod < value.period, "Comparison month must precede the selected month")
  .refine(value => !value.groupByColumn || (![value.budgetColumn,value.actualColumn,value.currencyColumn,value.periodColumn].includes(value.groupByColumn) && !value.compareToPeriod), "Grouping requires a distinct column and one month")
export type TableAnalysisRequest = z.infer<typeof tableAnalysisRequestSchema>
export const tableAnalysisEvidenceSchema = z.strictObject({
  request: tableAnalysisRequestSchema,
  viewId: z.uuid().nullable(), tableId: z.uuid().nullable(), viewRevision: z.number().int().positive().nullable(),
  sourceRevision: z.string().regex(/^[a-f0-9]{64}$/),
  filter: z.strictObject({ column, value: z.string().max(120) }).nullable(),
  filterOperator: z.literal("case_insensitive_contains"),
  selectedRows: z.number().int().nonnegative().max(500), matchedRows: z.number().int().positive().max(500),
  groups: z.array(z.strictObject({ label: tableAnalysisGroupLabelSchema, matchedRows: z.int().positive().max(500) })).min(1).max(tableAnalysisMaxGroups).optional(),
  comparisonMatchedRows: z.number().int().positive().max(500).optional(),
  csv: z.strictObject({ fileId:z.uuid(), revision:z.string().min(1).max(2000), byteLength:z.int().positive().max(256000),
    contentHash:z.string().regex(/^[a-f0-9]{64}$/), encoding:z.literal("utf-8"), delimiter:z.literal(","), headerRows:z.literal(1),
    dataRows:z.int().min(1).max(500), columns:z.array(z.strictObject({key:column,label:z.string().min(1).max(80)})).min(4).max(12) }).optional(),
  sheet: z.strictObject({range:googleSheetRangeSchema,title:z.string().max(1024),sheetTitle:z.string().max(100),
    sourceRevision:z.string().regex(/^[a-f0-9]{64}$/),providerVersion:z.string().regex(/^\d+$/),
    rangeRows:z.int().min(1).max(500),blankRows:z.int().min(0).max(500),filterBasis:z.literal("formatted_values"),hiddenRows:z.literal("included")}).optional(),
  complete: z.literal(true), amountUnit: z.literal("major"), scale: z.literal(2),
}).refine(value => {
  if (Boolean(value.request.groupByColumn) !== (value.groups !== undefined)) return false
  if (value.groups && (new Set(value.groups.map(group => group.label)).size !== value.groups.length || value.groups.reduce((sum,group) => sum+group.matchedRows,0) !== value.matchedRows)) return false
  if (Boolean(value.request.compareToPeriod) !== (value.comparisonMatchedRows !== undefined)) return false
  if (value.matchedRows + (value.comparisonMatchedRows ?? 0) > value.selectedRows) return false
  if (value.csv) return !value.sheet && value.request.id === `file:${value.csv.fileId}` && value.viewId === null && value.tableId === null && value.viewRevision === null && value.filter === null && value.selectedRows === value.csv.dataRows &&
    new Set(value.csv.columns.map(col => col.key)).size === value.csv.columns.length &&
    [value.request.budgetColumn,value.request.actualColumn,value.request.currencyColumn,value.request.periodColumn,...(value.request.groupByColumn ? [value.request.groupByColumn] : [])].every(key => value.csv!.columns.some(col => col.key === key))
  return value.request.id.startsWith("particle:") && value.viewId !== null && value.viewRevision !== null && (value.tableId === null) === Boolean(value.sheet) &&
    (!value.sheet || (value.sheet.rangeRows === value.sheet.range.rowCount-1 && value.selectedRows+value.sheet.blankRows <= value.sheet.rangeRows))
})
export const tableAnalysisDependencySchema = z.strictObject({ request: tableAnalysisRequestSchema, fingerprint: z.string().regex(/^[a-f0-9]{64}$/) })
