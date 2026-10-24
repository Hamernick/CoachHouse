"use client"

import { useState,useSyncExternalStore } from "react"
import LoaderCircleIcon from "lucide-react/dist/esm/icons/loader-circle"
import { Button } from "@/components/ui/button"
import { useWorkspaceEditorStatus } from "@/components/workspace/workspace-editor-status"
import { WORKSPACE_HEADER_BUTTON,WorkspaceWindowHeaderPortal } from "@/components/workspace/workspace-window-header-slots"
import type { DocumentCanonicalWriter } from "../lib/canonical-writer"

/** Existing window header owns the control's DOM. The retained file session
 * owns its command and retry identity; hiding a window never reconstructs it. */
export function DocumentSaveControl({writer,label,dirty,editable}: {
  writer:DocumentCanonicalWriter;label:string;dirty:boolean;editable:boolean
}) {
  const state=useSyncExternalStore(writer.subscribe,writer.getSnapshot,writer.getSnapshot)
  const [error,setError]=useState("")
  const pending=state.status==="saving"
  const retry=state.status==="error"
  useWorkspaceEditorStatus({label,dirty,pending,error:state.status==="error"||Boolean(error)})
  return <>
    <WorkspaceWindowHeaderPortal>
      <Button variant="ghost" size="sm" className={WORKSPACE_HEADER_BUTTON}
        disabled={!editable||pending||(!dirty&&!retry)} aria-busy={pending}
        onClick={()=>{setError("");void (retry?writer.retry():writer.save()).catch(value=>setError(value instanceof Error?value.message:"Could not save. Your draft is retained."))}}>
        {pending?<LoaderCircleIcon aria-hidden className="size-3.5 animate-spin motion-reduce:animate-none"/>:null}
        {pending?(state.operation==="restore"?"Restoring…":"Saving…"):retry?(state.operation==="restore"?"Retry restore":"Retry save"):"Save"}
      </Button>
    </WorkspaceWindowHeaderPortal>
    {error||state.message?<p role="alert" className="text-muted-foreground px-3 py-2 text-xs">{error||state.message}</p>:null}
  </>
}
