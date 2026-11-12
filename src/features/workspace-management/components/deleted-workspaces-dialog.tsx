"use client"
import { useEffect, useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { subscribeWorkspaceAccessChanged } from "@/lib/workspace/access-events"
import { listRetainedWorkspaceAccess } from "../retained-access-actions"
import type { RetainedAccessPage } from "../lib/retained-access"
import { WorkspaceAccessDialog } from "./workspace-access-dialog"

export function DeletedWorkspacesDialog({ orgId, returnFocus, onClose }: {
  orgId: string; returnFocus: HTMLElement; onClose: () => void
}) {
  const closeButton = useRef<HTMLButtonElement>(null)
  const [page, setPage] = useState<RetainedAccessPage | null>(null)
  const [after, setAfter] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [pending, setPending] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<{ canvasId: string; trigger: HTMLButtonElement } | null>(null)
  useEffect(() => subscribeWorkspaceAccessChanged(orgId, () => { setPage(null); setAfter(null); setPending(true); setReload(value => value + 1) }), [orgId])
  useEffect(() => {
    let current = true
    void listRetainedWorkspaceAccess({ orgId, after }).then(result => {
      if (!current) return
      if ("error" in result) { setPage(null); setError(result.error ?? "Unable to load deleted workspaces. Try again.") }
      else { setPage(result.data); setError(null) }
      setPending(false)
    }).catch(() => { if (current) { setPage(null); setError("Unable to load deleted workspaces. Try again."); setPending(false) } })
    return () => { current = false }
  }, [orgId, after, reload])
  return <>
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent showCloseButton={false} className="rounded-3xl border-border/70 bg-background p-5 shadow-none motion-reduce:animate-none sm:max-w-sm"
        onCloseAutoFocus={event => { event.preventDefault(); if (returnFocus.isConnected) returnFocus.focus({ preventScroll: true }) }}>
        <DialogHeader><DialogTitle className="text-base">Deleted workspaces</DialogTitle><DialogDescription>Review retained access. Permissions can only be reduced.</DialogDescription></DialogHeader>
        <div className="max-h-[55dvh] overflow-y-auto overscroll-contain">
          {pending ? <p role="status" className="text-sm text-muted-foreground">Loading…</p> : error ? <div role="alert" className="space-y-2 text-sm"><p>{error}</p><Button variant="outline" size="sm" onClick={() => { setPending(true); setReload(value => value + 1) }}>Retry</Button></div>
            : page?.items.length ? <ul aria-label="Deleted workspaces" className="space-y-1">{page.items.map(item => <li key={item.canvasId}>
              <Button variant="ghost" className="h-11 w-full justify-start rounded-lg px-2 text-sm font-normal sm:h-9" title={item.canvasId}
                onClick={event => setSelected({ canvasId: item.canvasId, trigger: event.currentTarget })}>
                {item.canvasId === "default" ? "Main workspace" : `Deleted workspace · ${item.canvasId.slice(-8)}`}
              </Button>
            </li>)}</ul> : <p className="text-sm text-muted-foreground">No deleted workspaces with access to manage.</p>}
        </div>
        <DialogFooter>
          {after && <Button variant="ghost" disabled={pending} onClick={() => { setPage(null); setAfter(null); setPending(true) }}>First page</Button>}
          {page?.nextAfter && <Button variant="ghost" disabled={pending} onClick={() => { setAfter(page.nextAfter); setPage(null); setPending(true) }}>Next</Button>}
          <Button ref={closeButton} variant="ghost" className="rounded-full" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    {selected && <WorkspaceAccessDialog key={`${orgId}:${selected.canvasId}`} target={{ orgId, canvasId: selected.canvasId === "default" ? null : selected.canvasId }} returnFocus={selected.trigger} fallbackFocus={closeButton.current} onClose={() => setSelected(null)} />}
  </>
}
