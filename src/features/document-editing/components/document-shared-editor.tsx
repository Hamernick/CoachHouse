"use client"

import { useEffect, useMemo } from "react"
import { RichTextEditor } from "@/components/rich-text-editor"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { useWorkspaceEditorStatus } from "@/components/workspace/workspace-editor-status"
import { WorkspaceWindowHeaderPortal } from "@/components/workspace/workspace-window-header-slots"
import { documentCollaborationExtensions } from "../lib/document-collaboration"
import { DocumentSaveControl } from "./document-save-control"
import type { DocumentCanonicalWriter } from "../lib/canonical-writer"
import type { DocumentEditorSession } from "../lib/editor-session"
import { useDocumentEditorSession } from "../hooks/use-document-editor-session"

/** Reuses the roadmap editor and toolbar; the parent retains/owns the session
 * and must await close() before removing it. Canonical Save is opt-in through
 * the retained owner command; draft acknowledgements never mark files Saved. */
export function DocumentSharedEditor({session,label,active=true,onDirtyChange,canonicalWriter}: {
  session:DocumentEditorSession;label:string;active?:boolean;onDirtyChange?:(dirty:boolean)=>void;canonicalWriter?:DocumentCanonicalWriter
}) {
  const state=useDocumentEditorSession(session)
  const extensions=useMemo(()=>state.replica ? documentCollaborationExtensions(state.replica.document) : [],[state.replica])
  useEffect(()=>{session.setActive(active);if(active)session.start()},[session,active])
  useEffect(()=>{onDirtyChange?.(state.dirty)},[onDirtyChange,state.dirty])
  useWorkspaceEditorStatus({label,dirty:state.dirty,error:state.status==="blocked"})
  const message=state.status==="blocked" ? "Your draft is retained. Shared editing needs attention."
    : state.status==="offline" ? "Connection interrupted. Your draft is retained."
    : state.pending ? "Syncing draft…" : state.dirty ? "Shared draft" : state.status==="loading" ? "Connecting…" : ""
  if(state.status==="closed") return null
  const locked=state.locked
  return (
    <div className="nodrag nopan nowheel flex min-h-0 flex-col">
      {canonicalWriter?<DocumentSaveControl writer={canonicalWriter} label={label} dirty={state.dirty} editable={state.editable}/>:null}
      <WorkspaceWindowHeaderPortal slot="accessory">
        <span role="status" aria-live="polite" className="text-muted-foreground text-xs">{message}</span>
      </WorkspaceWindowHeaderPortal>
      {state.status==="blocked" || state.status==="offline" ? (
        <div role="status" className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
          <span>{message}</span>{!locked ? <Button variant="ghost" size="sm" onClick={()=>void session.retry()}>Retry</Button> : null}
        </div>
      ) : null}
      {locked ? <p role="status" className="text-muted-foreground p-3 text-sm">Sign in with the original account to recover your draft.</p> : state.replica ? (
        <RichTextEditor value="" onChange={()=>undefined} readOnly={!state.editable}
          ariaLabel={label} preserveImages disableResize
          className="rounded-none border-0 shadow-none" minHeight={320}
          session={{history:"collaborative",active,extensions,onUpdate:()=>undefined}} />
      ) : <div aria-label="Loading shared document" role="status" className="flex min-h-80 flex-col gap-3 p-3"><Skeleton className="h-6 w-2/3" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /></div>}
    </div>
  )
}
