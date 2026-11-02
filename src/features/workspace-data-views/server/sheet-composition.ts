import "server-only"
import { createHash } from "node:crypto"
import { z } from "zod"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { GoogleDriveError, readGoogleSheetRange } from "@/features/google-drive"
import { composableDataViewSchema, createExistingDataViewCommandSchema } from "../lib/existing-source"
import { dataViewCreateReceiptSchema } from "../lib/project-source"
import type { DataViewResult } from "../lib/schema"

const recoverySchema=z.strictObject({receipt:dataViewCreateReceiptSchema.nullable(),view:z.strictObject({id:z.uuid(),name:z.string().max(100),revision:z.int().positive()}).nullable()})
type Failure={ok:false;code:"denied"|"conflict"|"invalid"|"unavailable"}
type Reply={data:unknown;error:{code:string}|null}

/** Metadata and receipt reads discard provider cells. Only an explicit Open reads
 * rows into the manual view; Apply reuses that owner's canonical SQL writer. */
async function execute(organizationId:string,viewId:string,expected?:unknown,command?:unknown,commit=false) {
 try {
  z.uuid().parse(organizationId);z.uuid().parse(viewId)
  const binding=expected===undefined?undefined:composableDataViewSchema.parse(expected)
  const create=command===undefined?undefined:createExistingDataViewCommandSchema.parse(command)
  if((binding&&(binding.viewId!==viewId||binding.source.kind!=="sheets")) ||
     (create&&(!binding||create.organizationId!==organizationId||create.source.kind!=="sheets")))return {ok:false as const,code:"invalid" as const}
  const client=await createSupabaseServerClient(),{data,error}=await client.auth.getUser()
  if(error||!data.user)return {ok:false as const,code:"denied" as const}
  const admin=createSupabaseAdminClient()
  const rpc=admin.rpc.bind(admin) as unknown as (name:string,args:Record<string,unknown>)=>{abortSignal:(signal:AbortSignal)=>PromiseLike<Reply>}
  const call=async(verified:unknown,body:unknown=null,write=false)=>{
   const reply=await rpc("workspace_sheet_view_composition",{p_actor_id:data.user!.id,p_org:organizationId,p_source_view:viewId,p_expected:verified??null,p_command:body,p_commit:write}).abortSignal(AbortSignal.timeout(10000))
   if(reply.error)throw reply.error
   return reply.data
  }
  const initial=composableDataViewSchema.parse(await call(binding))
  if(initial.source.kind!=="sheets"||!initial.sheet||initial.viewId!==viewId)throw Error("Unexpected linked source")
  const sheet=await readGoogleSheetRange(data.user.id,initial.source.range)
  const headers=Array.from({length:initial.source.range.columnCount},(_,i)=>sheet.rows[0]?.[i]??"")
  if(createHash("sha256").update(JSON.stringify(headers)).digest("hex")!==initial.sheet.headerHash)
   return {ok:false as const,code:"conflict" as const}
  if(sheet.executionIdentity!==initial.sheet.executionIdentity)return {ok:false as const,code:"denied" as const}
  // Recheck source incarnation, connection identity and workspace/closure after the
  // provider read. The source lock spans the canonical create if explicitly applying.
  const current=await call(initial,create??null,commit)
  if(!create)return {ok:true as const,data:composableDataViewSchema.parse(current)}
  if(commit){const receipt=dataViewCreateReceiptSchema.parse(current);if(receipt.viewId!==create.viewId)throw Error("Receipt identity changed");return {ok:true as const,data:receipt}}
  const receipt=recoverySchema.parse(current)
  if((receipt.receipt&&receipt.receipt.viewId!==create.viewId)||(receipt.view&&receipt.view.id!==create.viewId)||(receipt.view&&!receipt.receipt))throw Error("Receipt identity changed")
  return {ok:true as const,data:receipt}
 }catch(error){
  if(error instanceof GoogleDriveError){
   if(["google_revoked","file_not_authorized","forbidden","unauthorized"].includes(error.code))return {ok:false as const,code:"denied" as const}
   if(["invalid","unsupported_preview"].includes(error.code))return {ok:false as const,code:"conflict" as const}
  }
  const code=(error as {code?:string})?.code
  return {ok:false as const,code:code==="42501"?"denied" as const:["40001","55P03","23505"].includes(code??"")?"conflict" as const:code==="22023"?"invalid" as const:"unavailable" as const}
 }
}

export async function readComposableSheetSource(organizationId:string,viewId:string):Promise<{ok:true;data:z.infer<typeof composableDataViewSchema>}|Failure> {
 const reply=await execute(organizationId,viewId)
 if(!reply.ok)return reply
 return {ok:true,data:composableDataViewSchema.parse(reply.data)}
}
export async function readSheetViewCreation(command:unknown,binding:unknown):Promise<{ok:true;data:z.infer<typeof recoverySchema>}|Failure> {
 const parsed=createExistingDataViewCommandSchema.safeParse(command),source=composableDataViewSchema.safeParse(binding)
 if(!parsed.success||!source.success)return {ok:false,code:"invalid"}
 const reply=await execute(parsed.data.organizationId,source.data.viewId,source.data,parsed.data)
 if(!reply.ok)return reply
 return {ok:true,data:recoverySchema.parse(reply.data)}
}
export async function createLinkedSheetView(command:unknown,binding:unknown):Promise<DataViewResult> {
 const parsed=createExistingDataViewCommandSchema.safeParse(command),source=composableDataViewSchema.safeParse(binding)
 if(!parsed.success||!source.success)return {ok:false,code:"invalid",error:"This saved Sheet binding is invalid."}
 const reply=await execute(parsed.data.organizationId,source.data.viewId,source.data,parsed.data,true)
 if(reply.ok)return reply
 return {...reply,error:reply.code==="denied"?"This linked Sheet is unavailable to your current Google account. Reconnect your own account or open the source.":reply.code==="conflict"?"The linked Sheet, source view or execution identity changed. Generate a new reviewed draft.":"Unable to confirm this view. Check the saved receipt before retrying this same request."}
}
