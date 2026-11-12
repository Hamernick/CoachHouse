import "server-only"
import { createHash } from "node:crypto"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { readGoogleSheetRange } from "@/features/google-drive"
import { sheetAnalysisSnapshotSchema } from "../lib/table-analysis"
import { metadataSchema } from "./sheet-source"

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex")
/** Called only after authenticated actor verification. Existing Sheet owner remains
 * responsible for organization/closure/view authority, before and after I/O. */
export async function readSheetAnalysisSnapshot(organizationId: string, viewId: string, actorId: string, signal?: AbortSignal) {
  const admin = createSupabaseAdminClient()
  const rpc = admin.rpc.bind(admin) as unknown as (name: string, args: Record<string, unknown>) => { abortSignal(signal: AbortSignal): PromiseLike<{data:unknown;error:unknown}> }
  const read = async () => {
    signal?.throwIfAborted()
    const reply = await rpc("workspace_sheet_view_command", { p_actor_id:actorId,
      p_command:{action:"read",organizationId,viewId,page:0},p_commit:false,p_header_hash:null })
      .abortSignal(signal ? AbortSignal.any([signal,AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000))
    if (reply.error || !reply.data) throw Error("Sheet unavailable")
    const meta = metadataSchema.parse(reply.data)
    if (!meta.view || meta.view.id !== viewId || !meta.headerHash) throw Error("Sheet unavailable")
    return meta
  }
  const meta = await read()
  const sheet = await readGoogleSheetRange(actorId,meta.source,true,signal)
  if (JSON.stringify(await read()) !== JSON.stringify(meta)) throw Error("Sheet changed")
  const values = sheet.typedRows
  if (!values || values.length !== meta.source.rowCount || !meta.view) throw Error("Incomplete Sheet")
  const headers = sheet.rows[0]
  if (!headers || hash(headers) !== meta.headerHash) throw Error("Sheet header changed")
  // Display filtering is the manual view's existing contract. Financial arithmetic
  // uses effective values only; never coerce localized display text to numbers.
  const all = values.slice(1).map((cells,index) => ({ cells,index,display:sheet.rows[index+1] }))
  if (all.some(row => row.display.every(value => value === "") && row.cells.some(value => value !== null && value !== "")))
    throw Error("Ambiguous hidden values")
  const nonblank = all.filter(row => row.display.some(value => value !== ""))
  const filter = meta.view.config.filter
  const keys = headers.map((_,index) => `column_${index+1}`)
  if (filter && !keys.includes(filter.column)) throw Error("Unknown filter column")
  const selected = nonblank.filter(row => !filter || (row.display[keys.indexOf(filter.column)] ?? "").toLowerCase().includes(filter.value.toLowerCase()))
  const columns = headers.map((label,index) => ({key:keys[index],label:label.slice(0,80)||`Column ${meta.source.startColumn+index}`,
    // Mixed/empty columns stay text; the calculation refuses undeclared amounts.
    type:selected.length && selected.every(row=>typeof row.cells[index] === "number") ? "number" : "text",options:[],writable:false}))
  const rows = selected.map(row => {
    const digest = hash({range:meta.source,row:meta.source.startRow+row.index+1})
    return {id:`${digest.slice(0,8)}-${digest.slice(8,12)}-4${digest.slice(13,16)}-8${digest.slice(17,20)}-${digest.slice(20,32)}`,
      revision:sheet.revision,values:Object.fromEntries(keys.map((key,index)=>[key,row.cells[index]]))}
  })
  return sheetAnalysisSnapshotSchema.parse({view:meta.view,columns,rows,total:rows.length,complete:true,
    sheet:{range:meta.source,title:sheet.title,sheetTitle:sheet.sheetTitle,sourceRevision:sheet.revision,
      executionIdentity:sheet.executionIdentity,providerVersion:sheet.providerVersion,rangeRows:values.length-1,
      blankRows:all.length-nonblank.length,filterBasis:"formatted_values",hiddenRows:"included"}})
}
