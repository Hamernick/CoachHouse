"use server"
import { executePageNoteAccess } from "./server/page-note-access"
import { WorkspaceSharingError } from "./server/page-projection"
export async function workspacePageNoteAction(input:unknown){
 try{return {ok:true as const,...await executePageNoteAccess(input)}}
 catch(error){return error instanceof WorkspaceSharingError?{ok:false as const,code:error.code,error:error.message,uncertain:error.uncertain}:{ok:false as const,code:"unavailable" as const,error:"Unable to confirm this note request. Retry the same request.",uncertain:true}}
}
