import "server-only"
import { z } from "zod"
import type { PostgrestSingleResponse } from "@supabase/supabase-js"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { Json } from "@/lib/supabase"
import { composableDataViewSchema,createExistingDataViewCommandSchema } from "../lib/existing-source"
import { dataViewCreateReceiptSchema } from "../lib/project-source"
const recovery=z.strictObject({receipt:dataViewCreateReceiptSchema.nullable(),view:z.strictObject({id:z.uuid(),name:z.string().max(100),revision:z.int().positive()}).nullable()})
async function read(name:"read_composable_data_view_source"|"read_existing_data_view_creation",args:Record<string,Json>) {
 const client=await createSupabaseServerClient(),{data,error}=await client.auth.getUser()
 if(error||!data.user)return {ok:false as const,code:"denied" as const}
 const rpc=client.rpc.bind(client) as unknown as (name:string,args:Record<string,Json>)=>{abortSignal:(signal:AbortSignal)=>PromiseLike<PostgrestSingleResponse<Json>>}
 const reply=await rpc(name,args).abortSignal(AbortSignal.timeout(10000))
 if(reply.error)return {ok:false as const,code:reply.error.code==="42501"?"denied" as const:["40001","55P03"].includes(reply.error.code)?"conflict" as const:"unavailable" as const}
 return {ok:true as const,data:reply.data}
}
export async function readComposableDataViewSource(organizationId:string,viewId:string) {
 try {z.uuid().parse(organizationId);z.uuid().parse(viewId);const reply=await read("read_composable_data_view_source",{p_org:organizationId,p_view:viewId});if(!reply.ok)return reply
 const data=composableDataViewSchema.parse(reply.data);if(data.viewId!==viewId)throw Error("Source identity changed")
 return {ok:true as const,data}
 }catch{return {ok:false as const,code:"unavailable" as const}}
}
export async function readExistingDataViewCreation(input:unknown) {
 const command=createExistingDataViewCommandSchema.safeParse(input)
 if(!command.success)return {ok:false as const,code:"invalid" as const}
 try {const reply=await read("read_existing_data_view_creation",{p_command:command.data as Json});if(!reply.ok)return reply
 const data=recovery.parse(reply.data)
 if((data.receipt&&data.receipt.viewId!==command.data.viewId)||(data.view&&data.view.id!==command.data.viewId)||(data.view&&!data.receipt))throw Error("Receipt identity changed")
 return {ok:true as const,data}
 }catch{return {ok:false as const,code:"unavailable" as const}}
}
