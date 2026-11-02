"use client"
import {useCallback,useEffect,useId,useRef,useState} from "react"
import {Button} from "@/components/ui/button"
import dynamic from "next/dynamic"
import {AlertDialog,AlertDialogTrigger,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from "@/components/ui/alert-dialog"
import type {NoteContent} from "@/lib/modules/note-content"
import type {PageNoteData,PageNoteCommand} from "../lib/page-note-access"
import {usePageNoteAccess} from "../hooks/use-page-note-access"

type Note=NonNullable<PageNoteData["note"]>
const NotesRichEditor=dynamic(()=>import("@/features/workspace-particles/client").then(module=>module.NotesRichEditor),{ssr:false,loading:()=> <p role="status" className="text-sm">Loading note editor…</p>})
export function GuestPageNoteEditor({pageId,disabled,onLockChange}:{pageId:string;disabled:boolean;onLockChange:(locked:boolean)=>void}){
 const {data,pending,error,uncertain,send}=usePageNoteAccess(),toolbar=useId()
 const [selected,setSelected]=useState<string|null>(null),[baseline,setBaseline]=useState<Note|null>(null),[body,setBody]=useState<NoteContent>({content:""}),[notice,setNotice]=useState("")
 const [initialBody,setInitialBody]=useState<NoteContent>({content:""}),[editorVersion,setEditorVersion]=useState(0)
 const triggers=useRef(new Map<string,HTMLButtonElement>()),heading=useRef<HTMLHeadingElement>(null)
 const changed=useCallback((value:NoteContent)=>setBody(value),[])
 const dirty=Boolean(baseline&&(body.content!==baseline.content||body.html!==baseline.html))
 useEffect(()=>{void send({action:"list",pageId})},[pageId,send])
 useEffect(()=>{if(!selected)return;const timer=setInterval(()=>{void send({action:"read",pageId,particleId:selected})},5000);return()=>clearInterval(timer)},[pageId,selected,send])
 useEffect(()=>{onLockChange(Boolean(selected)||pending||Boolean(uncertain));return()=>onLockChange(false)},[selected,pending,uncertain,onLockChange])
 useEffect(()=>{if(!dirty&&!uncertain)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue=""};window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn)},[dirty,uncertain])
 async function open(id:string){const value=await send({action:"read",pageId,particleId:id});if(value?.note){setSelected(id);setBaseline(value.note);setBody(value.note);setInitialBody(value.note);setEditorVersion(value=>value+1);setNotice("")}}
 async function save(command:PageNoteCommand){const value=await send(command);if(value?.note){setBaseline(value.note);setBody(value.note);setInitialBody(value.note);setEditorVersion(value=>value+1);setNotice(value.replayed?"Earlier save confirmed. Current source loaded.":"Note saved. Reviewed page previews are unchanged.")}}
 function close(){const previous=selected;setSelected(null);setBaseline(null);setBody({content:""});void send({action:"list",pageId});requestAnimationFrame(()=>{(previous?triggers.current.get(previous):null)?.focus();if(!previous||!triggers.current.has(previous))heading.current?.focus()})}
 const latest=data?.note?.id===selected?data.note:null
 const stale=Boolean(latest&&baseline&&latest.revision!==baseline.revision)
 if(!selected&&!data?.notes.length&&!error)return null
 return <section aria-label="Shared note source editor" className="flex min-w-0 flex-col gap-3 rounded-2xl border p-4">
  <h2 ref={heading} tabIndex={-1} className="text-sm font-medium">Shared notes</h2>
  <p className="text-muted-foreground text-xs">Only explicitly enabled notes can be edited. Edits change the same canonical note in every workspace reference. Public and guest previews change only after an organization editor reviews and shares them again.</p>
  {error&&<p role="alert" className="text-destructive text-sm">{error}</p>}
  {notice&&<p role="status" className="text-sm">{notice}</p>}
  {uncertain&&<Button disabled={pending} onClick={()=>void save(uncertain)}>Retry same note save</Button>}
  {!selected?data?.notes.filter(note=>note.enabled).map(note=><Button key={note.id} ref={element=>{if(element)triggers.current.set(note.id,element);else triggers.current.delete(note.id)}} variant="outline" disabled={disabled||pending} onClick={()=>void open(note.id)}>Edit shared note: {note.title}</Button>):<>
   {baseline&&latest&&<><h3 className="text-sm font-medium">{baseline.title}</h3><div id={toolbar} className="flex min-h-11 flex-wrap gap-1"/><div className="min-w-0 rounded-xl border"><NotesRichEditor key={`${selected}:${editorVersion}`} initialBody={initialBody} onChange={changed} toolbarId={toolbar} autoFocus readOnly={pending||Boolean(uncertain)}/></div>
    {stale&&<div role="status" className="flex flex-col gap-2 text-sm"><p>The saved note changed. Your draft is preserved. Current saved content:</p><p className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border p-2">{latest.content}</p><Button variant="outline" disabled={pending||Boolean(uncertain)} onClick={()=>setBaseline(current=>current?{...current,revision:latest.revision}:current)}>Use latest note revision</Button></div>}
    <Button disabled={pending||Boolean(uncertain)||stale||!dirty} onClick={()=>void save({action:"write",pageId,particleId:selected,operationId:crypto.randomUUID(),expectedNoteRevision:baseline.revision,...body})}>Save shared note</Button></>}
   <AlertDialog><AlertDialogTrigger asChild><Button variant="outline" disabled={pending||Boolean(uncertain)}>Close note</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Close this note?</AlertDialogTitle><AlertDialogDescription>{dirty?"Unsaved changes will be discarded.":"Your saved source is unchanged."}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep editing</AlertDialogCancel><AlertDialogAction onClick={close}>Close note</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
   {dirty&&<p role="status" className="text-muted-foreground text-xs">Unsaved note changes</p>}
  </>}
 </section>
}
