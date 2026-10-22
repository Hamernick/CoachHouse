"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle,DialogTrigger } from "@/components/ui/dialog"
import { RichTextEditor } from "@/components/rich-text-editor"
import type { RoadmapDraft } from "../types"
import type { RoadmapSaveConflict } from "../hooks/use-roadmap-save"

export function RoadmapConflictReview({conflict,draft,onResolve}: {
  conflict:RoadmapSaveConflict | null; draft:RoadmapDraft
  onResolve:(choice:"saved" | "reviewed" | "retry")=>void
}) {
  const [open,setOpen]=useState(false)
  if (!conflict) return null
  const latest=conflict.section
  const actionClass="rounded-full [@media(pointer:coarse)]:min-h-11"
  return <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-muted/40 px-3 py-2">
    <p className="text-sm" role="status">Document changed. Saving is paused.</p>
    {!latest ? <Button variant="secondary" className={actionClass} onClick={()=>onResolve("retry")}>Check saved version</Button> :
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button variant="secondary" className={actionClass}>Review changes</Button></DialogTrigger>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-2xl p-4 shadow-none sm:max-w-3xl motion-reduce:animate-none">
          <DialogHeader>
            <DialogTitle>Review {latest.title}</DialogTitle>
            <DialogDescription>
              Compare both versions before saving. Saving your reviewed draft replaces the version shown here and keeps it private.
            </DialogDescription>
          </DialogHeader>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            {[{label:"Saved version",value:latest},{label:"Your draft",value:draft}].map(({label,value})=><section key={label} className="min-w-0 space-y-2" aria-label={label}>
              <h3 className="text-sm font-medium">{label}</h3>
              <div className="rounded-xl border border-border/60 p-2">
                <p className="break-words text-sm font-medium">{value.title}</p>
                {value.subtitle ? <p className="break-words text-xs text-muted-foreground">{value.subtitle}</p> : null}
                <RichTextEditor value={value.content} onChange={()=>undefined} readOnly hideLinkPreviews
                  ariaLabel={`${label} content`} minHeight={100} maxHeight={280} countClassName="hidden" />
                {value.budgetRows?.length ? <pre className="overflow-auto text-xs">{JSON.stringify(value.budgetRows,null,2)}</pre> : null}
                {value.imageUrl ? <p className="break-all text-xs text-muted-foreground">Image: {value.imageUrl}</p> : null}
              </div>
            </section>)}
          </div>
          <DialogFooter className="flex-wrap">
            <Button variant="ghost" className={actionClass} onClick={()=>setOpen(false)}>Keep editing</Button>
            <Button variant="secondary" className={actionClass} onClick={()=>{onResolve("saved");setOpen(false)}}>Discard draft and use saved</Button>
            <Button className={actionClass} disabled={Boolean(latest.driveSource)} onClick={()=>{onResolve("reviewed");setOpen(false)}}>Save reviewed draft</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>}
  </div>
}
