"use client"

import { useEffect, useId, useState } from "react"
import { MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { changePersonalMemory, loadPersonalMemory, changeOrganizationMemory, loadOrganizationMemory } from "../memory-actions"
import type { WorkspaceMemory, PersonalMemoryMutation, MemoryScope } from "../lib/personal-memory"

type Change = PersonalMemoryMutation extends infer M ? M extends PersonalMemoryMutation ? Omit<M, "organizationId" | "revision"> : never : never
type Editor = { id: string; value: string; original: string }

export function PersonalMemorySettings() {
  const id = useId()
  const [scope, setScope] = useState<MemoryScope>("personal")
  const shared = scope === "organization"
  const load = shared ? loadOrganizationMemory : loadPersonalMemory
  const write = shared ? changeOrganizationMemory : changePersonalMemory
  const [memory, setMemory] = useState<WorkspaceMemory | null>(null)
  const [organization, setOrganization] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [needsReload, setNeedsReload] = useState(false)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [confirm, setConfirm] = useState<"clear" | "discard" | { id: string } | null>(null)
  const [about, setAbout] = useState(false)
  useEffect(() => {
    if (!editor || editor.value === editor.original) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [editor])
  useEffect(() => {
    let active = true
    const loader = scope === "organization" ? loadOrganizationMemory : loadPersonalMemory
    loader().then(result => { if (active) { setMemory(result.memory); setOrganization(result.organizationName) } })
      .catch(() => { if (active) setError("Memory is unavailable. Reload to try again.") })
    return () => { active = false }
  }, [scope])
  async function reload() {
    setBusy(true)
    try {
      const result = await load()
      // Never carry a draft across an account/organization switch.
      if (memory && (memory.organizationId !== result.memory.organizationId || ("userId" in memory ? memory.userId : memory.actorId) !== ("userId" in result.memory ? result.memory.userId : result.memory.actorId))) setEditor(null)
      setMemory(result.memory); setOrganization(result.organizationName); setError(""); setNeedsReload(false)
    } catch { setMemory(null); setEditor(null); setError("Memory is unavailable. Reload to try again.") }
    finally { setBusy(false) }
  }
  async function change(change: Change) {
    if (!memory || busy || needsReload) return false
    setBusy(true); setError("")
    try {
      const result = await write({ ...change, organizationId: memory.organizationId, revision: memory.revision })
      if (!result.ok) throw new Error(result.error)
      setMemory(result.memory)
      return true
    } catch (cause) {
      setNeedsReload(true)
      setError(cause instanceof Error ? cause.message : "Save could not be confirmed. Reload before trying again.")
      return false
    } finally { setBusy(false) }
  }
  function closeEditor() {
    if (busy) return
    if (editor && editor.value !== editor.original) setConfirm("discard")
    else setEditor(null)
  }
  const feedback = error && <div role="alert" className="space-y-2 text-sm"><p>{error}</p><Button variant="outline" size="sm" disabled={busy} onClick={reload}>Reload memory</Button></div>
  const canManage = Boolean(memory && (!("canManage" in memory) || memory.canManage))
  const disabled = busy || needsReload || !canManage
  const audience = `${shared ? "Organization" : "Only you"} · ${organization}`
  return <div className="max-w-xl space-y-5">
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-base font-semibold">Memory</h3>
      <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="Memory options"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => setAbout(true)}>About memory</DropdownMenuItem>
          <DropdownMenuItem disabled={!memory || disabled} onSelect={() => setConfirm("clear")}>Delete and turn off memory</DropdownMenuItem>
        </DropdownMenuContent></DropdownMenu>
    </div>
    <div className="space-y-2"><Label htmlFor={`${id}-scope`}>Guidance scope</Label>
      <Select value={scope} disabled={busy || Boolean(editor)} onValueChange={value => {
        setMemory(null); setError(""); setNeedsReload(false); setConfirm(null); setScope(value as MemoryScope)
      }}><SelectTrigger id={`${id}-scope`}><SelectValue /></SelectTrigger><SelectContent>
        <SelectItem value="personal">Only you</SelectItem><SelectItem value="organization">Organization</SelectItem>
      </SelectContent></Select>
    </div>
    {memory ? <>
      <p className="text-sm text-muted-foreground">{audience}</p>
      {shared && !canManage && <p className="text-sm text-muted-foreground">Only the organization owner can change shared guidance.</p>}
      <div className="flex items-center justify-between gap-4"><Label htmlFor={id}>Enable memory</Label><Switch id={id} checked={memory.enabled} disabled={disabled} onCheckedChange={enabled => void change({ action: "enable", enabled })} /></div>
      <p className="text-sm text-muted-foreground">{memory.enabled ? shared ? "Shared guidance is used in eligible members’ chats in this organization." : "Your saved guidance is used in your private chats in this organization." : "Memory is off. Saved guidance is kept, but is not used or added to."}</p>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3"><h4 className="text-sm font-medium">Memory summary</h4><Button size="sm" variant="outline" disabled={disabled || !memory.enabled || memory.entries.length >= 20} onClick={() => setEditor({ id: crypto.randomUUID(), value: "", original: "" })}>Add guidance</Button></div>
        {memory.updatedAt && <p className="text-xs text-muted-foreground">Updated {new Date(memory.updatedAt).toLocaleString()}</p>}
        {!memory.entries.length && <p className="text-sm text-muted-foreground">No saved guidance. Add a preference you want to keep using.</p>}
        <ul className="divide-y">{memory.entries.map(entry => <li key={entry.id} className="space-y-2 py-3">
          <p className="whitespace-pre-wrap break-words text-sm">{entry.value}</p>
          <div className="flex gap-2"><Button variant="ghost" size="sm" disabled={disabled || !memory.enabled} onClick={() => setEditor({ id: entry.id, value: entry.value, original: entry.value })}>Edit</Button><Button variant="ghost" size="sm" disabled={disabled} onClick={() => setConfirm({ id: entry.id })}>Delete</Button></div>
        </li>)}</ul>
      </div>
    </> : !error && <p role="status" className="text-sm text-muted-foreground">Loading memory…</p>}
    {!editor && feedback}
    <Dialog open={Boolean(editor)} onOpenChange={open => { if (!open) closeEditor() }}><DialogContent className="sm:max-w-lg">
      <DialogHeader><DialogTitle>{editor?.original ? "Edit guidance" : "Add guidance"}</DialogTitle><DialogDescription>{audience}. {shared ? "Save guidance for eligible members’ chats. This does not change permissions or verified organization facts." : "Save a preference, not a copy of organization facts."}</DialogDescription></DialogHeader>
      <form onSubmit={async event => { event.preventDefault(); if (editor && await change({ action: "save", id: editor.id, value: editor.value })) setEditor(null) }} className="space-y-4">
        <Label htmlFor={`${id}-value`}>Guidance</Label>
        <Textarea id={`${id}-value`} name="guidance" required maxLength={500} value={editor?.value ?? ""} disabled={busy} onChange={event => setEditor(current => current && ({ ...current, value: event.target.value }))} onKeyDown={event => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }} className="min-h-28 text-base" placeholder="For example, keep answers concise…" />
        {feedback}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={closeEditor}>Cancel</Button><Button type="submit" disabled={disabled || !memory?.enabled}>{busy ? "Saving…" : "Save guidance"}</Button></div>
      </form>
    </DialogContent></Dialog>
    <Dialog open={about} onOpenChange={setAbout}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>About memory</DialogTitle><DialogDescription>Memory contains only guidance you explicitly save. Only you keeps guidance private to your account and organization. Organization shares explicitly saved guidance with eligible members; only the owner can manage it. Personal guidance never becomes shared automatically. It stays until you delete it. Turning it off stops use and saving; Delete and turn off removes the entries. Chats, accepted work and billing records stay separate. Changes apply to new chats; older drafts that used changed guidance may be unavailable.</DialogDescription></DialogHeader><Button variant="outline" onClick={() => setAbout(false)}>Close</Button></DialogContent></Dialog>
    <AlertDialog open={Boolean(confirm)} onOpenChange={open => { if (!open) setConfirm(null) }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{confirm === "discard" ? "Discard unsaved guidance?" : confirm === "clear" ? "Delete and turn off memory?" : "Delete this guidance?"}</AlertDialogTitle><AlertDialogDescription>{confirm === "discard" ? "Your saved guidance will stay unchanged." : shared ? "This removes the selected shared guidance for this organization. Personal guidance, chats and accepted work stay unchanged." : "This removes the selected personal guidance. Chats, accepted work and team data stay unchanged."}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { if (confirm === "discard") setEditor(null); else if (confirm === "clear") void change({ action: "clear" }); else if (confirm) void change({ action: "delete", id: confirm.id }) }}>Continue</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>
}
