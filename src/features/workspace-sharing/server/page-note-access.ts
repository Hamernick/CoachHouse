import "server-only"
import { ZodError } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { sanitizeNoteContent } from "@/lib/modules/note-content-server"
import { prepareAuthorizedParticleMutation, readParticleGraph, getParticleNotes, ParticleMutationError } from "@/features/workspace-particles"
import type { Json } from "@/lib/supabase"
import { pageNoteCommandSchema,pageNoteDataSchema,type PageNoteCommand } from "../lib/page-note-access"
import { publicationHash,WorkspaceSharingError } from "./page-projection"

type Reply={data:unknown;error:{code:string}|null}
export async function executePageNoteAccess(input:unknown){
 const parsed=pageNoteCommandSchema.safeParse(input)
 if(!parsed.success)throw new WorkspaceSharingError("invalid","Review the selected note and its content.")
 const session=await createSupabaseServerClient();const {data:{user},error}=await session.auth.getUser()
 if(error||!user)return {signInRequired:true as const}
 return {signInRequired:false as const,value:await runPageNoteCommand(user.id,parsed.data)}
}
// Actor is supplied only after verified authentication. No route resolves an
// active org and no page grant is converted into general board authority.
export async function runPageNoteCommand(actorId:string,input:PageNoteCommand){
 let command:PageNoteCommand=input
 try{if(input.action==="write")command={...input,...sanitizeNoteContent(input)}}
 catch(error){if(error instanceof ZodError)throw new WorkspaceSharingError("invalid","Keep the note within 20,000 characters.");throw error}
 const admin=createSupabaseAdminClient({actorId,requestTimeoutMs:15000})
 const rpc=admin.rpc.bind(admin) as unknown as(name:string,args:Record<string,unknown>)=>PromiseLike<Reply>
 const call=async(value:PageNoteCommand,expected?:unknown,next?:unknown)=>{
  const {pageId,...body}=value
  const result=await rpc("workspace_page_note_command",{p_actor_id:actorId,p_page_id:pageId,p_command:body,p_hash:publicationHash(body),p_expected_graph:expected??null,p_next_graph:next??null})
  if(result.error){const code=result.error.code
   if(code==="42501")throw new WorkspaceSharingError("scope","This selected note is unavailable or its editing access changed.")
   if(["40001","55P03"].includes(code))throw new WorkspaceSharingError("conflict","The note or shared page changed. Reload the saved source before trying again.")
   if(["22023","23505"].includes(code))throw new WorkspaceSharingError("invalid","This note request cannot be applied. Review its fields.")
   throw new WorkspaceSharingError("unavailable","Unable to confirm this note request. Retry the same request.",true)
  }
  return result.data as Record<string,unknown>
 }
 let result:Record<string,unknown>
 if(command.action==="write"){
  const current=await call({action:"read",pageId:command.pageId,particleId:command.particleId})
  const graphValue=current.graph as Json
  const orgId=(graphValue as {workspaceId:string}).workspaceId
  const graph=readParticleGraph(graphValue,orgId)
  if(!graph.ok)throw new WorkspaceSharingError("invalid","The selected source needs review.")
  const particle=graph.value.particles.find(item=>item.id===command.particleId)
  if(!particle||particle.type!=="activity"||particle.data.source||getParticleNotes(particle)?.kind!=="workspace")throw new WorkspaceSharingError("scope","The selected workspace note is unavailable.")
  if(particle.revision!==command.expectedNoteRevision){
   // A previous write may have committed before its reply was lost. The canonical
   // receipt owner distinguishes identical recovery from an actually stale edit.
   result=await call(command)
  }else{
   const note={...particle,data:{...particle.data,widget:{kind:"notes" as const,source:{kind:"workspace" as const,...sanitizeNoteContent(command)}}}}
   const prepared=await prepareAuthorizedParticleMutation({workspaceId:orgId,canEdit:true,now:new Date().toISOString(),input:{id:command.operationId,workspaceId:orgId,baseRevision:graph.value.revision,requireExactRevision:true,operations:[{kind:"put_particle",expectedRevision:command.expectedNoteRevision,particle:note}]}})
   if(!prepared.ok)throw new WorkspaceSharingError("invalid",prepared.error)
   let commit
   try{commit=prepared.value(graphValue)}
   catch(error){if(error instanceof ParticleMutationError)throw new WorkspaceSharingError(error.code==="scope"||error.code==="conflict"?error.code:"invalid",error.message);throw error}
   result=await call(command,graphValue,commit.graph)
  }
 }else result=await call(command)
 // Never return the private board graph, unrelated particles or graph receipts.
 const {graph: _graph,...publicValue}=result
 void _graph
 const value=pageNoteDataSchema.parse(publicValue)
 if(value.pageId!==command.pageId)throw new WorkspaceSharingError("scope","The selected page changed.")
 if(value.note)value.note={...value.note,...sanitizeNoteContent(value.note)}
 return value
}
