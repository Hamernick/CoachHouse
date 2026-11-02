"use client"
import {useCallback,useEffect,useId} from "react"
import dynamic from "next/dynamic"
import {Button} from "@/components/ui/button"
import {usePageNoteAccess} from "../hooks/use-page-note-access"
const NotesRichEditor=dynamic(()=>import("@/features/workspace-particles/client").then(module=>module.NotesRichEditor),{ssr:false,loading:()=> <p role="status" className="text-sm">Loading note editor…</p>})
export function PageNoteScopes({pageId,disabled,onLockChange}:{pageId:string;disabled:boolean;onLockChange:(locked:boolean)=>void}){
 const {data,pending,error,uncertain,send}=usePageNoteAccess(),toolbar=useId()
 const noChange=useCallback(()=>{},[])
 useEffect(()=>{void send({action:"list",pageId})},[pageId,send])
 useEffect(()=>{onLockChange(pending||Boolean(uncertain));return()=>onLockChange(false)},[pending,uncertain,onLockChange])
 async function apply(command:Parameters<typeof send>[0]){if(await send(command))await send({action:"list",pageId})}
 if(!data?.canManage&&!error)return null
 return <section aria-label="Selected note editing" className="flex flex-col gap-3 rounded-xl border p-3">
  <h3 className="text-sm font-medium">Selected note editing</h3>
  <p className="text-muted-foreground text-xs">Optional: allow current and future invited Edit or Manage collaborators to read and edit each enabled note’s full content, formatting and links. Changes affect every reference to the same note. Public and guest previews stay unchanged until you review and share again.</p>
  {error&&<p role="alert" className="text-destructive text-sm">{error}</p>}
  {uncertain&&<Button variant="outline" disabled={pending} onClick={()=>void apply(uncertain)}>Retry same note access request</Button>}
  {data?.notes.map(note=><div key={note.id} className="flex flex-wrap items-center gap-2"><span className="min-w-0 flex-1 break-words text-sm">{note.title}</span><Button variant="outline" disabled={disabled||pending||Boolean(uncertain)} onClick={()=>void (note.enabled?apply({action:"set_scope",pageId,particleId:note.id,operationId:crypto.randomUUID(),expectedPageRevision:data.pageRevision,expectedNoteRevision:note.revision,enabled:false}):send({action:"review_scope",pageId,particleId:note.id}))}>{note.enabled?"Remove note editing":"Review note editing"}</Button></div>)}
  {data?.note&&<div className="flex min-w-0 flex-col gap-3 rounded-xl border p-3"><h4 className="text-sm font-medium">Review full source: {data.note.title}</h4><div id={toolbar} className="hidden"/><div className="max-h-80 overflow-auto"><NotesRichEditor key={`${data.note.id}:${data.note.revision}`} initialBody={data.note} onChange={noChange} toolbarId={toolbar} readOnly/></div><p className="text-muted-foreground text-xs">Allow invited Edit and Manage collaborators to read and change this note’s full current and future content, including formatting and links.</p><Button disabled={disabled||pending||Boolean(uncertain)} onClick={()=>void apply({action:"set_scope",pageId,particleId:data.note!.id,operationId:crypto.randomUUID(),expectedPageRevision:data.pageRevision,expectedNoteRevision:data.note!.revision,enabled:true})}>Allow note editing</Button></div>}
  {data?.notes.length===0&&<p className="text-muted-foreground text-xs">Review and share a selected workspace note before enabling source editing.</p>}
 </section>
}
