"use client"

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import CopyIcon from "lucide-react/dist/esm/icons/copy"
import XIcon from "lucide-react/dist/esm/icons/x"
import DownloadIcon from "lucide-react/dist/esm/icons/download"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { WorkspaceWindowHeaderPortal, useWorkspaceWindowHeader, useWorkspaceWindowHeaderActive } from "@/components/workspace/workspace-window-header-slots"
import { openDocumentWindowView } from "../actions"
import { createDocumentWindowOwner } from "../lib/window-owner"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { documentSourceSchema } from "../lib/contracts"
import { getDocumentDownload } from "../lib/download-file"
import type { DocumentSource } from "../types"
import { DocumentEditingPanel } from "./document-editing-panel"
import { DocumentSharedEditor } from "./document-shared-editor"

export function DocumentFileWindow({source,label,onClose}: {
  source:DocumentSource;label:string;onClose:()=>void
}) {
  const active=useWorkspaceWindowHeaderActive()
  const inWindow=useWorkspaceWindowHeader()
  const identity=JSON.stringify(source)
  const reader=useMemo(()=>createDocumentWindowOwner({source:documentSourceSchema.parse(JSON.parse(identity)),client:createSupabaseBrowserClient(),load:source=>openDocumentWindowView({source})}),[identity])
  const state=useSyncExternalStore(reader.subscribe,reader.getSnapshot,reader.getSnapshot)
  const [message,setMessage]=useState("")
  const [downloading,setDownloading]=useState(false)
  const download=useRef<AbortController|null>(null)
  useEffect(()=>{const release=reader.retain();return()=>{release();download.current?.abort()}},[reader])
  useEffect(()=>{reader.setActive(active);if(active)void reader.open()},[active,reader])
  useEffect(()=>{if(state.status==="locked")download.current?.abort()},[state.status])
  return (
    <section aria-label={`${label} document`} className="nodrag nopan nowheel flex min-h-0 flex-col">
      {!inWindow ? <h2 className="px-3 pt-3 text-sm font-medium">{label}</h2> : null}
      <WorkspaceWindowHeaderPortal>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="size-7 rounded-full [@media(pointer:coarse)]:size-11" aria-label="Copy saved file text" disabled={!state.snapshot}
            onClick={async()=>{
              if(!state.snapshot)return
              try{await navigator.clipboard.writeText(state.snapshot.content);setMessage("Copied")}
              catch{setMessage("Copy failed. Try again.")}
            }}><CopyIcon aria-hidden /></Button>
          {source.provider==="coach_house" ? <Button variant="ghost" size="icon" className="size-7 rounded-full [@media(pointer:coarse)]:size-11" aria-label="Download original file" disabled={downloading||state.status==="locked"}
            onClick={async()=>{
              setDownloading(true)
              const request=new AbortController();download.current=request
              try{const url=await getDocumentDownload(source,request.signal);if(request.signal.aborted||reader.getSnapshot().status==="locked")return;const link=document.createElement("a");link.href=url;link.download=state.snapshot?.name??label;document.body.append(link);link.click();link.remove()}
              catch{if(!request.signal.aborted)setMessage("Download failed. Try again.")}
              finally{if(!request.signal.aborted)setDownloading(false);if(download.current===request)download.current=null}
            }}><DownloadIcon aria-hidden /></Button> : null}
          <Button variant="ghost" size="icon" className="size-7 rounded-full [@media(pointer:coarse)]:size-11" aria-label="Close document" onClick={onClose}><XIcon aria-hidden /></Button>
        </div>
      </WorkspaceWindowHeaderPortal>
      <WorkspaceWindowHeaderPortal slot="accessory"><span className="text-muted-foreground text-xs">Read only</span></WorkspaceWindowHeaderPortal>
      {message ? <p role="status" className="text-muted-foreground px-3 py-1 text-xs">{message}</p> : null}
      {state.sharedUnavailable ? <div role="status" className="flex items-center justify-between gap-2 px-3 py-1 text-xs"><span className="text-muted-foreground">Showing the saved file. The shared draft is unavailable.</span><Button variant="ghost" size="sm" onClick={()=>void reader.retry()}>Retry</Button></div> : null}
      {state.status==="locked" ? <p role="status" className="text-muted-foreground p-3 text-sm">The account changed. Reopen this file with your current account.</p> : state.status==="error" ? <div role="status" className="flex items-center justify-between gap-2 p-3 text-sm"><span>Couldn’t open this file here. You can download the original.</span><Button variant="ghost" size="sm" onClick={()=>void reader.retry()}>Retry</Button></div>
        : state.session && !state.sharedUnavailable ? <DocumentSharedEditor session={state.session} label={label} active={active}/>
        : state.snapshot ? <DocumentEditingPanel snapshot={state.snapshot} active={active} />
        : <div role="status" aria-label="Loading file" className="flex min-h-80 flex-col gap-3 p-3"><Skeleton className="h-6 w-2/3"/><Skeleton className="h-4 w-full"/><Skeleton className="h-4 w-5/6"/></div>}
    </section>
  )
}
