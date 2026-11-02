import { dataColumnsSchema, type DataColumn, type DataRowValues } from "./schema"

/** Explicit bounded copy: quoted CSV and embedded newlines; no formula evaluation. */
export function parseDataTableCsv(text: string): { columns: DataColumn[]; rows: DataRowValues[] } {
  if (text.length > 1_000_000) throw new Error("Use a CSV smaller than 1 MB.")
  const records: string[][] = []
  let record: string[] = [], cell = "", quoted = false, closed = false
  for (let index = 0; index < text.length; index++) {
    const char = text[index]
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { cell += '"'; index++ }
      else if (char === '"') { quoted = false; closed = true }
      else cell += char
    } else if (char === '"' && !cell && !closed) quoted = true
    else if (char === ",") { record.push(cell); cell = ""; closed = false }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index++
      record.push(cell); records.push(record); record = []; cell = ""; closed = false
    } else {
      if (closed || char === '"') throw new Error("CSV quotes are invalid. No rows were imported.")
      cell += char
    }
  }
  if (quoted) throw new Error("CSV has an unclosed quoted cell. No rows were imported.")
  if (cell || record.length || closed) { record.push(cell); records.push(record) }
  const headers = records.shift()
  if (!headers?.length || headers.some(header => !header.trim())) throw new Error("Every column needs a header.")
  if (records.length > 500) throw new Error("Import up to 500 rows at a time.")
  const columns = dataColumnsSchema.parse(headers.map((label, index) => ({ key: `column_${index + 1}`, label: label.replace(/^\uFEFF/, "").trim(), type: "text", options: [], writable: true })))
  const rows = records.map((values, index) => {
    if (values.length !== columns.length || values.some(value => value.length > 4000)) throw new Error(`Row ${index + 2} does not match the columns or exceeds the cell limit. No rows were imported.`)
    return Object.fromEntries(values.map((value, column) => [columns[column].key, value]))
  })
  return { columns, rows }
}

export function parseDataCell(column: DataColumn, input: string) {
  if (!input.trim()) return null
  if (column.type === "number") { const value = Number(input); if (!Number.isFinite(value)) throw new Error("Enter a finite number."); return value }
  if (column.type === "boolean") { if (!["true", "false"].includes(input)) throw new Error("Choose true or false."); return input === "true" }
  if (column.type === "date" && (!/^\d{4}-\d{2}-\d{2}$/.test(input) || Number.isNaN(Date.parse(input)) || new Date(input).toISOString().slice(0, 10) !== input)) throw new Error("Enter a valid date.")
  if (column.type === "select" && !column.options.includes(input)) throw new Error("Choose an available option.")
  if (input.length > 4000) throw new Error("Use 4,000 characters or fewer.")
  return input
}
