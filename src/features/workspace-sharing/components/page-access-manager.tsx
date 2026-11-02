"use client"

import { useEffect, useId, useState } from "react"
import LoaderIcon from "lucide-react/dist/esm/icons/loader-circle"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog"
import { usePageAccess, type PageAccessController } from "../hooks/use-page-access"
import type { PageAccessData } from "../lib/page-access"

const control = "min-h-11 rounded-xl touch-manipulation"
export function PageAccessFeedback({ access, hideReload = false }: { access: PageAccessController; hideReload?: boolean }) {
  if (!access.error) return null
  return <div role="alert" className="space-y-2 text-sm"><p>{access.error}</p>
    {(!hideReload || access.uncertain) && <Button type="button" variant="outline" className={control} disabled={access.pending} onClick={() => void access.retry()}>{access.uncertain ? "Retry request" : "Reload"}</Button>}</div>
}
export function PageAccessManager({ pageId, onLockChange, disabled = false }: { pageId: string; onLockChange?: (locked: boolean) => void; disabled?: boolean }) {
  const access = usePageAccess(pageId)
  useEffect(() => { onLockChange?.(access.locked) }, [access.locked, onLockChange])
  useEffect(() => () => onLockChange?.(false), [onLockChange])
  return <section aria-label="Page access" aria-busy={access.pending} className="flex flex-col gap-4">
    <fieldset disabled={disabled} className="flex min-w-0 flex-col gap-4">
    <PageAccessFeedback access={access} />
    {access.pending && !access.data && <p role="status" className="text-muted-foreground text-sm">Loading access…</p>}
    {access.data?.permission === "manage" && <PageInvitationControls access={access} data={access.data} />}
    </fieldset>
  </section>
}
export function PageInvitationControls({ access, data }: { access: PageAccessController; data: PageAccessData }) {
  const id = useId()
  const [email, setEmail] = useState("")
  const [permission, setPermission] = useState<"view" | "edit" | "manage">("view")
  const [notice, setNotice] = useState<string | null>(null)
  async function copy(invitationId: string) {
    const link = new URL(`/public/pages/${data.pageId}?invite=${invitationId}`, window.location.origin).href
    try { await navigator.clipboard.writeText(link); setNotice("Invitation link copied.") }
    catch { setNotice("Copy this invitation link:"); setFallback(link) }
  }
  const [fallback, setFallback] = useState<string | null>(null)
  return <div className="flex flex-col gap-4">
    <h3 className="text-sm font-medium">People</h3>
    <p className="text-muted-foreground text-xs">Invited accounts only. Invitations expire after 7 days. Accepted access lasts until removed.</p>
    <form className="flex flex-col gap-3" onSubmit={(event) => {
      event.preventDefault(); setNotice(null); setFallback(null)
      const invitationId = crypto.randomUUID()
      void access.send({ action: "invite", pageId: data.pageId, operationId: crypto.randomUUID(), invitationId, email, permission })
        .then((ok) => { if (ok) { setEmail(""); setNotice("Invitation created. Copy its link to share.") } })
    }}>
      <Field><FieldLabel htmlFor={`${id}-email`}>Email</FieldLabel><Input id={`${id}-email`} type="email" name="email" autoComplete="email" spellCheck={false} required maxLength={254}
        className="min-h-11 text-base" value={email} disabled={access.locked} placeholder="person@example.org…" onChange={(event) => setEmail(event.target.value)} /></Field>
      <div className="flex flex-wrap items-end gap-2">
        <Field className="min-w-0 flex-1"><FieldLabel htmlFor={`${id}-permission`}>Access</FieldLabel><Select value={permission} disabled={access.locked} onValueChange={(value) => { if (value === "view" || value === "edit" || value === "manage") setPermission(value) }}>
          <SelectTrigger id={`${id}-permission`} className={`${control} w-full`}><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="view">View</SelectItem><SelectItem value="edit">Edit</SelectItem>{data.canGrantManage && <SelectItem value="manage">Manage</SelectItem>}
          </SelectContent></Select></Field>
        <Button type="submit" className={control} disabled={access.locked}>{access.pending && <LoaderIcon aria-hidden className="animate-spin motion-reduce:animate-none" />}Create invitation</Button>
      </div>
    </form>
    <p className="text-muted-foreground text-xs">Edit: page title and introduction. Manage: also invite viewers/editors. Neither publishes or opens workspace data.</p>
    {notice && <p role="status" className="text-sm">{notice}</p>}
    {fallback && <Input aria-label="Invitation link" value={fallback} readOnly onFocus={(event) => event.target.select()} />}
    <ul className="flex max-h-80 flex-col gap-3 overflow-y-auto" aria-label="Page invitations">
      {data.invitations.map((invite) => <li key={invite.id} className="flex min-w-0 flex-wrap items-center gap-2 rounded-xl border p-3">
        <div className="min-w-0 flex-1"><p className="break-all text-sm">{invite.email}</p><p className="text-muted-foreground text-xs capitalize">{invite.permission} · {invite.revoked ? "Removed" : invite.accepted ? "Accepted" : Date.parse(invite.expiresAt) <= Date.now() ? "Expired" : "Pending"}</p></div>
        {!invite.revoked && <>
          {!invite.accepted && Date.parse(invite.expiresAt) > Date.now() && <Button type="button" variant="outline" className={control} disabled={access.locked} onClick={() => void copy(invite.id)}>Copy link</Button>}
          <AlertDialog><AlertDialogTrigger asChild><Button type="button" variant="ghost" className={control} disabled={access.locked}>Remove</Button></AlertDialogTrigger>
            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remove this access?</AlertDialogTitle><AlertDialogDescription>Removing a manager also disables invitations they created. Other grants and public links stay unchanged.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => void access.send({ action: "revoke", pageId: data.pageId, operationId: crypto.randomUUID(), invitationId: invite.id })}>Remove access</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
        </>}
      </li>)}
    </ul>
  </div>
}
