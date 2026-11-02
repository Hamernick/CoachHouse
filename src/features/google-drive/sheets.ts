import { z } from "zod"

// One fixed, bounded grid. Row 1 of this range supplies display labels.
export const googleSheetRangeSchema = z.strictObject({
  spreadsheetId: z.string().regex(/^[A-Za-z0-9_-]{10,200}$/),
  sheetId: z.number().int().min(0).max(2147483647),
  startRow: z.number().int().min(1).max(1000000),
  rowCount: z.number().int().min(2).max(501),
  startColumn: z.number().int().min(1).max(18278),
  columnCount: z.number().int().min(1).max(12),
}).refine(range => range.startRow + range.rowCount <= 1000001 && range.startColumn + range.columnCount <= 18279, "Choose a bounded sheet range.")
export type GoogleSheetRange = z.infer<typeof googleSheetRangeSchema>
export type GoogleSheetRead = {
  title: string; sheetTitle: string; email: string; revision: string; rows: string[][]
}
