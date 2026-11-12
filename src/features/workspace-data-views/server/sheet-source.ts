import "server-only"
import { createHash } from "node:crypto"
import { z } from "zod"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { readGoogleSheetRange, GoogleDriveError } from "@/features/google-drive"
import { googleSheetRangeSchema } from "@/features/google-drive/client"
import { dataViewConfigSchema, type DataViewCommand, type DataViewPage, type DataViewResult } from "../lib/schema"

export const metadataSchema=z.object({source:googleSheetRangeSchema, headerHash:z.string().nullable(),canEdit:z.boolean(),view:z.object({id:z.uuid(),name:z.string(),revision:z.number().int(),source:z.literal("sheets"),tableId:z.null(),config:dataViewConfigSchema}).nullable()})
type RpcResult={data:unknown;error:{code:string}|null}
function denied():DataViewResult{return {ok:false,code:"denied",error:"This linked Sheet is unavailable to your current Google account. Reconnect your own Google account or open the source."}}
function invalid():DataViewResult{return {ok:false,code:"invalid",error:"The linked range or its header changed. Create a new view for the current source."}}
function rowId(source:string,index:number){const hash=createHash("sha256").update(`${source}:${index}`).digest("hex");return `${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-8${hash.slice(17,20)}-${hash.slice(20,32)}`}

export async function runSheetDataView(actorId:string,command:DataViewCommand):Promise<DataViewResult|null>{
 if(!["read","save_view","create_view"].includes(command.action))return null
 const admin=createSupabaseAdminClient()
 const rpc=admin.rpc.bind(admin) as unknown as (name:string,args:Record<string,unknown>)=>{abortSignal:(signal:AbortSignal)=>PromiseLike<RpcResult>}
 const call=async(commit=false,headerHash?:string)=>{
  const result=await rpc("workspace_sheet_view_command",{p_actor_id:actorId,p_command:command,p_commit:commit,p_header_hash:headerHash??null}).abortSignal(AbortSignal.timeout(10000))
  if(result.error)throw result.error
  return result.data
 }
 try{
  const initial=await call();if(initial===null)return null
  const meta=metadataSchema.parse(initial)
  const sheet=await readGoogleSheetRange(actorId,meta.source)
  const headers=Array.from({length:meta.source.columnCount},(_,i)=>sheet.rows[0]?.[i]??"")
  const headerHash=createHash("sha256").update(JSON.stringify(headers)).digest("hex")
  if(meta.headerHash&&meta.headerHash!==headerHash)return invalid()
  // Fresh workspace/closure authority after provider dispatch; immutable source binding.
  const fresh=metadataSchema.parse(await call())
  if(JSON.stringify(fresh)!==JSON.stringify(meta))return {ok:false,code:"conflict",error:"The view or its permissions changed. Refresh before continuing."}
  if(command.action!=="read")return {ok:true,data:await call(true,headerHash)}
  if(!meta.view)return denied()
  if(command.sourceRevision&&command.sourceRevision!==sheet.revision)return {ok:false,code:"conflict",error:"The Sheet changed between pages. Refresh from the first page."}
  const columns=headers.map((label,i)=>({key:`column_${i+1}`,label:label.slice(0,80)||`Column ${meta.source.startColumn+i}`,type:"text" as const,options:[],writable:false}))
  const {config}=meta.view
  const sourceKey=JSON.stringify(meta.source)
  const rows=sheet.rows.slice(1).map((cells,i)=>({id:rowId(sourceKey,meta.source.startRow+i+1),revision:sheet.revision,values:Object.fromEntries(columns.map((col,j)=>[col.key,cells[j]??""]))})).filter(row=>Object.values(row.values).some(value=>value!==""))
  const filtered=rows.filter(row=>!config.filter||String(row.values[config.filter.column]??"").toLowerCase().includes(config.filter.value.toLowerCase()))
  filtered.sort((a,b)=>{const left=a.values[config.sort.column]??"",right=b.values[config.sort.column]??"";const order=left===right?0:left<right?-1:1;return (config.sort.direction==="asc"?order:-order)||(a.id<b.id?-1:a.id>b.id?1:0)})
  const page:DataViewPage={view:meta.view,columns,rows:filtered.slice(command.page*25,(command.page+1)*25),total:filtered.length,page:command.page,canEdit:meta.canEdit,provenance:null,
   sheetSource:{title:sheet.title,sheetTitle:sheet.sheetTitle,email:sheet.email,range:meta.source,revision:sheet.revision,url:`https://docs.google.com/spreadsheets/d/${meta.source.spreadsheetId}/edit#gid=${meta.source.sheetId}`}}
  return {ok:true,data:page}
 }catch(error){
  if(error instanceof GoogleDriveError){if(["google_revoked","file_not_authorized","forbidden","unauthorized"].includes(error.code))return denied();if(["invalid","unsupported_preview"].includes(error.code))return invalid()}
  const code=(error as {code?:string})?.code
  if(code==="42501")return denied()
  if(["40001","23505","55P03"].includes(code??""))return {ok:false,code:"conflict",error:"The source or view changed. Refresh before saving again."}
  if(["22023","23514"].includes(code??""))return invalid()
  return {ok:false,code:"unavailable",error:"Unable to confirm the linked Sheet. Nothing was written to Google. Retry this same request."}
 }
}
