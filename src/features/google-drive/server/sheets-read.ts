import "server-only"
import { createHash } from "node:crypto"
import { z } from "zod"
import { GoogleDriveError } from "../types"
import { googleSheetRangeSchema, type GoogleSheetRange } from "../sheets"

const cells = z.object({ formattedValue: z.string().max(10000).optional() })
const responseSchema = z.object({
  spreadsheetId: z.string(), properties: z.object({ title: z.string().max(1024) }),
  sheets: z.array(z.object({ properties: z.object({ sheetId: z.number().int(), title: z.string().max(100) }),
    data: z.array(z.object({ startRow: z.number().int().default(0), startColumn: z.number().int().default(0),
      rowData: z.array(z.object({ values: z.array(cells).max(12).optional() })).max(501).optional(),
    })).max(1).optional(),
  })).max(1),
})

// This is the provider's read operation (POST by API design), never a mutation.
export async function readGoogleSheetGrid(accessToken: string, input: GoogleSheetRange) {
  const range = googleSheetRangeSchema.parse(input)
  const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${range.spreadsheetId}:getByDataFilter`)
  url.searchParams.set("fields", "spreadsheetId,properties(title),sheets(properties(sheetId,title),data(startRow,startColumn,rowData(values(formattedValue))))")
  const response = await fetch(url, { method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000),
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ dataFilters: [{ gridRange: { sheetId: range.sheetId, startRowIndex: range.startRow - 1,
      endRowIndex: range.startRow - 1 + range.rowCount, startColumnIndex: range.startColumn - 1, endColumnIndex: range.startColumn - 1 + range.columnCount } }], includeGridData: true }),
  })
  if ([401,403,404].includes(response.status)) throw new GoogleDriveError("file_not_authorized",403)
  if (!response.ok || !response.body) throw new GoogleDriveError("provider_unavailable",503)
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0
  try { while (true) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.byteLength
    if (size > 1_000_000) throw new GoogleDriveError("unsupported_preview",400); chunks.push(chunk.value)
  } } finally { await reader.cancel() }
  const parsed = responseSchema.safeParse(JSON.parse(Buffer.concat(chunks).toString("utf8")))
  if (!parsed.success) throw new GoogleDriveError("unsupported_preview",400)
  const file=parsed.data, sheet=file.sheets[0], grid=sheet?.data?.[0]
  if (file.spreadsheetId!==range.spreadsheetId || !sheet || sheet.properties.sheetId!==range.sheetId
    || (grid && (grid.startRow!==range.startRow-1 || grid.startColumn!==range.startColumn-1))) throw new GoogleDriveError("file_not_authorized",403)
  if ((grid?.rowData?.length ?? 0)>range.rowCount || grid?.rowData?.some(row=>(row.values?.length??0)>range.columnCount)) throw new GoogleDriveError("unsupported_preview",400)
  const rows = (grid?.rowData ?? []).map(row=>Array.from({length:range.columnCount},(_,i)=>row.values?.[i]?.formattedValue??""))
  return { title:file.properties.title, sheetTitle:sheet.properties.title, rows,
    // A read snapshot fingerprint, NOT a provider write precondition/CAS token.
    revision:createHash("sha256").update(JSON.stringify({range,rows})).digest("hex") }
}
