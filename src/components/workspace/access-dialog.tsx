"use client"

import { useEffect, useRef, useState } from "react"
import LoaderIcon from "lucide-react/dist/esm/icons/loader-circle"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ParticleSelect as NativeSelect } from "@/components/ui/particle-ui"
import { AccessWorkspaceRows } from "./access-workspace-rows"
import type { AccessData, AccessChange, AccessResult } from "@/lib/workspace/access"
import { notifyWorkspaceAccessChanged } from "@/lib/workspace/access-events"

type Member = AccessData["members"][number]
const label = { view: "View", edit: "Edit", manage: "Manage" }

export function AccessDialog({ orgId, kind, load, saveChange, returnFocus, fallbackFocus, onClose, onChanged }: {
  orgId: string; kind: "Workspace" | "Folder"; load: () => Promise<AccessResult>;
  saveChange: (change: AccessChange) => Promise<AccessResult>;
  returnFocus: HTMLElement; fallbackFocus?: HTMLElement | null; onClose: () => void; onChanged?: () => void
}) {
  const [data, setData] = useState<AccessData | null>(null)
  const [workspaces, setWorkspaces] = useState<NonNullable<AccessData["workspaces"]>>([])
  const [members, setMembers] = useState<Member[]>([])
  const [pending, setPending] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [needsReload, setNeedsReload] = useState(false)
  const [discard, setDiscard] = useState(false)
  const [query, setQuery] = useState("")
  const [reload, setReload] = useState(0)
  const active = useRef(false)
  const saving = useRef(false)
  const dirty = data !== null && (JSON.stringify(members) !== JSON.stringify(data.members) || JSON.stringify(workspaces) !== JSON.stringify(data.workspaces ?? []))
  useEffect(() => {
    let current = true
    active.current = true
    void load().then(result => {
      if (!current) return
      if ("error" in result) { setData(null); setMembers([]); setWorkspaces([]); setError(result.error ?? "Unable to confirm access. Reload and try again.") }
      else { setData(result.data); setMembers(result.data.members); setWorkspaces(result.data.workspaces ?? []); setError(null); setNeedsReload(false) }
      setPending(false)
    }).catch(() => {
      if (!current) return
      setData(null); setMembers([]); setWorkspaces([]); setError("Unable to load access. Try again."); setPending(false)
    })
    return () => { current = false; active.current = false }
  }, [load, reload])
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])
  function close() { if (!pending) { if (dirty) setDiscard(true); else onClose() } }
  async function save() {
    if (!data || saving.current || needsReload) return
    saving.current = true; setPending(true); setError(null)
    try {
      const result = await saveChange({ revision: data.revision,
        ...(data.workspaces ? { workspaceChanges: workspaces.flatMap(workspace => {
          const prior = data.workspaces?.find(row => row.id === workspace.id)
          return workspace.canManage && prior && prior.capability !== workspace.capability
            ? [{ canvasId: workspace.id, revision: prior.revision, capability: workspace.capability }] : []
        }) } : {}),
        members: members.flatMap(member => member.owner || member.retained || !member.capability ? [] : [{ memberId: member.id, capability: member.capability }]),
      })
      if (!active.current) return
      if ("error" in result) {
        setError(result.error ?? "Unable to confirm access. Reload and try again."); setNeedsReload(true)
        if (result.code === "denied") { setData(null); setMembers([]); setWorkspaces([]) }
      } else { setData(result.data); setMembers(result.data.members); setWorkspaces(result.data.workspaces ?? []); onClose() }
    } catch {
      if (active.current) { setError("Unable to confirm the save. Reload access before retrying."); setNeedsReload(true) }
    } finally {
      // Unknown outcomes may have committed. Evict picker metadata in either case.
      notifyWorkspaceAccessChanged(orgId)
      onChanged?.()
      saving.current = false
      if (active.current) setPending(false)
    }
  }
  const visible = members.filter(member => member.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())).slice(0, 50)
  return <>
    <Dialog open onOpenChange={open => { if (!open) close() }}>
      <DialogContent className="rounded-3xl border-border/70 bg-background p-5 shadow-none motion-reduce:animate-none sm:max-w-sm"
        onCloseAutoFocus={event => { event.preventDefault(); (returnFocus.isConnected ? returnFocus : fallbackFocus)?.focus({ preventScroll: true }) }}
        onEscapeKeyDown={event => { if (pending) event.preventDefault() }} onPointerDownOutside={event => { if (pending) event.preventDefault() }}>
        <DialogHeader>
          <DialogTitle className="text-base">{data?.name ? `${data.name} access` : `${kind} access`}</DialogTitle>
          <DialogDescription>{data?.restricted ? data.deleted ? "Retained access. Permissions can only be reduced." : kind === "Folder" ? "Direct access and retained permissions. The owner keeps access." : "Only these people. The organization owner retains access." : "Access follows your organization’s team permissions."}</DialogDescription>
        </DialogHeader>
        {pending && !data && <p role="status" className="text-sm text-muted-foreground">Loading access…</p>}
        {data && <div className="max-h-[55dvh] overflow-y-auto overscroll-contain">
          {members.length > 8 && <Input type="search" aria-label="Find a team member" placeholder="Find a team member…" className="rounded-full" value={query} onChange={event => setQuery(event.target.value)} />}
          <ul aria-label={`${kind} access`} className="flex flex-col gap-1">
            {visible.map(member => <li key={member.id} className="flex min-w-0 items-center gap-2 py-1">
              <Avatar className="size-7 shrink-0"><AvatarFallback className="text-xs">{member.name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join("")}</AvatarFallback></Avatar>
              <div className="min-w-0 flex-1"><p className="truncate text-sm" title={member.name}>{member.name}</p>{member.inheritedCapability && <p className="text-xs text-muted-foreground">{label[member.inheritedCapability]} via workspace</p>}</div>
              {data.canManage && !member.owner && !member.retained ? <NativeSelect aria-label={`${kind === "Folder" ? "Direct access" : "Access"} for ${member.name}`} value={member.capability ?? "none"} disabled={pending || needsReload}
                className={kind === "Folder" ? "h-11 w-36 text-base sm:h-9 sm:text-sm" : "h-11 w-28 text-base sm:h-9 sm:text-sm"} onChange={event => {
                  const value = event.target.value
                  if (value === "none" || value === "view" || value === "edit" || value === "manage") setMembers(rows => rows.map(row => row.id === member.id ? { ...row, capability: value === "none" ? null : value } : row))
                }}>
                <option value="none">{kind === "Folder" ? "None" : "No access"}</option>
                {(["view", "edit", "manage"] as const).map(value => <option key={value} value={value}
                  disabled={data.deleted && (!data.members.find(row => row.id === member.id)?.capability || ["view", "edit", "manage"].indexOf(value) > ["view", "edit", "manage"].indexOf(data.members.find(row => row.id === member.id)!.capability!))}>{label[value]}</option>)}
              </NativeSelect> : <span className="shrink-0 text-xs text-muted-foreground">{member.owner ? "Owner" : member.retained ? member.retained : member.capability ? label[member.capability] : member.inheritedCapability ? label[member.inheritedCapability] : "No access"}</span>}
            </li>)}
          </ul>
          {members.length > 50 && <p className="text-xs text-muted-foreground">Search to find another team member.</p>}
          {!visible.length && <p className="text-sm text-muted-foreground">No matching people</p>}
          {kind === "Folder" && workspaces.length > 0 && <AccessWorkspaceRows rows={workspaces} disabled={pending || needsReload || !data.canManage} onChange={setWorkspaces} />}
        </div>}
        {error && <div role="alert" className="flex flex-col gap-2 text-sm"><p>{error}</p><Button variant="outline" size="sm" disabled={pending} onClick={() => { setPending(true); setData(null); setMembers([]); setWorkspaces([]); setReload(value => value + 1) }}>Reload access</Button></div>}
        <DialogFooter>
          <Button variant="ghost" className="rounded-full" disabled={pending} onClick={close}>{dirty ? "Cancel" : "Close"}</Button>
          {data?.canManage && <Button className="rounded-full" disabled={pending || !dirty || needsReload} onClick={() => void save()}>{pending && <LoaderIcon aria-hidden className="animate-spin motion-reduce:animate-none" />}Save access</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <AlertDialog open={discard} onOpenChange={setDiscard}><AlertDialogContent className="shadow-none"><AlertDialogHeader><AlertDialogTitle>Discard access changes?</AlertDialogTitle><AlertDialogDescription>Your changes haven’t been saved.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep editing</AlertDialogCancel><AlertDialogAction onClick={onClose}>Discard changes</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>
}
