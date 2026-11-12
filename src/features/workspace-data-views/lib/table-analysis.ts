import { z } from "zod"
import { googleSheetRangeSchema } from "@/features/google-drive/client"
import { parseDataTableCsv } from "./import"
import { dataViewPageSchema } from "./schema"
import { tableAnalysisMaxGroups, tableAnalysisGroupLabelSchema, tableAnalysisRequestSchema, type TableAnalysisRequest } from "@/lib/workspace/table-analysis-schema"

const selectionSchema = z.strictObject({
  view: dataViewPageSchema.shape.view.unwrap(), columns: dataViewPageSchema.shape.columns,
  rows: z.array(dataViewPageSchema.shape.rows.element).max(500),
  total: z.number().int().nonnegative().max(500), complete: z.literal(true),
}).refine(value => value.total === value.rows.length &&
  new Set(value.rows.map(row => row.id)).size === value.rows.length && new Set(value.columns.map(col => col.key)).size === value.columns.length,
"A complete table selection is required")
export const tableAnalysisSnapshotSchema = selectionSchema.safeExtend({sheet:z.never().optional()}).refine(value => value.view.source === "table" && value.view.tableId !== null)
export const sheetAnalysisSnapshotSchema = selectionSchema.safeExtend({
  sheet: z.strictObject({ range: googleSheetRangeSchema, title:z.string().max(1024), sheetTitle:z.string().max(100),
    sourceRevision:z.string().regex(/^[a-f0-9]{64}$/), executionIdentity:z.string().regex(/^[a-f0-9]{64}$/), providerVersion:z.string().regex(/^\d+$/),
    rangeRows:z.int().min(1).max(500), blankRows:z.int().min(0).max(500), filterBasis:z.literal("formatted_values"), hiddenRows:z.literal("included") }),
}).refine(value => value.view.source === "sheets" && value.view.tableId === null && value.sheet.rangeRows === value.sheet.range.rowCount-1)
export const budgetAnalysisSnapshotSchema = z.union([tableAnalysisSnapshotSchema,sheetAnalysisSnapshotSchema])
export type TableAnalysisSnapshot = z.infer<typeof tableAnalysisSnapshotSchema>

function cents(value: unknown): bigint {
  // Canonical JSON numbers only. Reject ambiguous strings, nulls, rounding and
  // exponent/unsafe magnitudes instead of silently coercing financial data.
  if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > 1_000_000_000_000) throw Error("Invalid amount")
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(String(value))
  if (!match) throw Error("Amounts must have at most two decimal places")
  return BigInt(match[1] ? -1 : 1) * (BigInt(match[2]) * BigInt(100) + BigInt((match[3] ?? "").padEnd(2,"0")))
}
const money = (value: bigint) => `${value < BigInt(0) ? "-" : ""}${(value < BigInt(0) ? -value : value) / BigInt(100)}.${String((value < BigInt(0) ? -value : value) % BigInt(100)).padStart(2,"0")}`

export function calculateTableBudget(snapshot: z.infer<typeof budgetAnalysisSnapshotSchema>, request: TableAnalysisRequest) {
  return calculateBudgetSelection(budgetAnalysisSnapshotSchema.parse(snapshot),request)
}

function calculateBudgetSelection(data: Pick<TableAnalysisSnapshot,"columns"|"rows">, request: TableAnalysisRequest) {
  const input = tableAnalysisRequestSchema.parse(request)
  for (const key of [input.budgetColumn,input.actualColumn]) if (data.columns.find(col => col.key === key)?.type !== "number") throw Error("Amount columns must be numeric")
  for (const key of [input.currencyColumn,input.periodColumn,...(input.groupByColumn ? [input.groupByColumn] : [])]) if (!["text","select"].includes(data.columns.find(col => col.key === key)?.type ?? "")) throw Error("Currency, month and grouping columns must be explicit text or selections")
  const current = { budget: BigInt(0), actual: BigInt(0), matchedRows: 0 }
  const groups = new Map<string,typeof current>()
  const previous = { budget: BigInt(0), actual: BigInt(0), matchedRows: 0 }
  for (const row of data.rows) {
    const currency = row.values[input.currencyColumn], period = row.values[input.periodColumn]
    if (typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency) || typeof period !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw Error("Invalid currency or monthly period")
    const totals = period === input.period ? current : period === input.compareToPeriod ? previous : null
    if (!totals) continue
    // A declared period with mixed currencies needs an explicit separate view,
    // not an implicit exclusion or an exchange-rate guess.
    if (currency !== input.currency) throw Error("Mixed currency in selected period")
    const budget = cents(row.values[input.budgetColumn]), actual = cents(row.values[input.actualColumn])
    if (input.groupByColumn) {
      const label = tableAnalysisGroupLabelSchema.parse(row.values[input.groupByColumn])
      const column = data.columns.find(col => col.key === input.groupByColumn)!
      if (column.type === "select" && !column.options.includes(label)) throw Error("Unknown group selection")
      const group = groups.get(label) ?? { budget: BigInt(0), actual: BigInt(0), matchedRows: 0 }
      group.budget += budget; group.actual += actual; group.matchedRows++
      groups.set(label,group)
      if (groups.size > tableAnalysisMaxGroups) throw Error("Too many groups for a complete calculation")
    }
    totals.budget += budget; totals.actual += actual; totals.matchedRows++
  }
  if (!current.matchedRows || (input.compareToPeriod && !previous.matchedRows)) throw Error("No complete rows for a declared period")
  const totals = (value: typeof current) => ({ matchedRows: value.matchedRows, budget: money(value.budget), actual: money(value.actual), delta: money(value.actual-value.budget), deltaDefinition: "actual_minus_budget" as const })
  return { ...totals(current), ...(input.groupByColumn ? {groups:[...groups].map(([label,value]) => ({label,...totals(value)}))} : {}), ...(input.compareToPeriod ? { comparison: {
    period: input.compareToPeriod, ...totals(previous),
    differences: { budget: money(current.budget-previous.budget), actual: money(current.actual-previous.actual),
      delta: money((current.actual-current.budget)-(previous.actual-previous.budget)), definition: "selected_minus_comparison" as const },
  } } : {}) }
}

/** CSV has no intrinsic numeric types. Only the two explicitly declared amount
 * columns are converted, after a lossless decimal grammar check. Never import. */
export function parseBudgetCsv(text: string) {
  const parsed = parseDataTableCsv(text)
  if (!parsed.rows.length || parsed.columns.length < 4 ||
      new Set(parsed.columns.map(col => col.label.toLowerCase())).size !== parsed.columns.length)
    throw Error("CSV requires data and distinct column headers")
  return parsed
}
export function calculateCsvBudget(text: string, request: TableAnalysisRequest) {
  const input = tableAnalysisRequestSchema.parse(request), parsed = parseBudgetCsv(text)
  if (!input.id.startsWith("file:")) throw Error("CSV requires a file reference")
  const amounts = new Set([input.budgetColumn,input.actualColumn])
  const columns = parsed.columns.map(col => ({...col,type:amounts.has(col.key) ? "number" as const : col.type}))
  const rows = parsed.rows.map(values => {
    const typed = {...values}
    for (const key of amounts) {
      const value = values[key]
      // No whitespace, separators, exponents, currency symbols or formulas.
      if (typeof value !== "string" || !/^-?(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value)) throw Error("Ambiguous CSV amount")
      const numeric = Number(value)
      // The shared numeric calculation applies the same magnitude/scale limits.
      cents(numeric)
      typed[key] = numeric
    }
    return {id:"",revision:"",values:typed}
  })
  return {...calculateBudgetSelection({columns,rows},input),dataRows:rows.length,columns:parsed.columns.map(({key,label})=>({key,label}))}
}
