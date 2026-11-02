"use client"

import { useEffect, useId, useState } from "react"
import LoaderIcon from "lucide-react/dist/esm/icons/loader-circle"
import { ParticleButton as Button } from "@/components/ui/particle-ui"
import { ParticleInput as Input } from "@/components/ui/particle-ui"
import { Field, FieldLabel } from "@/components/ui/field"
import { ParticleSelect as Select } from "@/components/ui/particle-ui"
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from "@/components/ui/alert-dialog"
import { ParticleAlertDialogCancel as AlertDialogCancel, ParticleAlertDialogAction as AlertDialogAction } from "@/components/ui/particle-ui"
import { PageNoteScopes } from "./page-note-scopes"
import { usePageAccess, type PageAccessController } from "../hooks/use-page-access"
import type { PageAccessData } from "../lib/page-access"

const control = "min-h-11 rounded-xl touch-manipulation"
export function PageAccessFeedback({ access, hideReload = false }: { access: PageAccessController; hideReload?: boolean }) {
  if (!access.error) return null
  return <div role="alert" className="space-y-2 text-sm"><p>{access.error}</p>
    {(!hideReload || access.uncertain) && <Button size="lg" color="primary" type="button" variant="outline" className={control} disabled={access.pending} onClick={() => void access.retry()}>{access.uncertain ? "Retry request" : "Reload"}</Button>}</div>
}
export function PageAccessManager({ pageId, onLockChange, disabled = false }: { pageId: string; onLockChange?: (locked: boolean) => void; disabled?: boolean }) {
  const access = usePageAccess(pageId)
  const [noteScopeLocked,setNoteScopeLocked]=useState(false)
  useEffect(() => { onLockChange?.(access.locked || noteScopeLocked) }, [access.locked, noteScopeLocked, onLockChange])
  useEffect(() => () => onLockChange?.(false), [onLockChange])
  return <section aria-label="Page access" aria-busy={access.pending} className="flex flex-col gap-4">
    <fieldset disabled={disabled} className="flex min-w-0 flex-col gap-4">
    <PageAccessFeedback access={access} />
    {access.pending && !access.data && <p role="status" className="text-muted-foreground text-sm">Loading access…</p>}
    <fieldset disabled={noteScopeLocked}>{access.data?.permission === "manage" && <PageInvitationControls access={access} data={access.data} />}</fieldset>
    {access.data?.canGrantManage && <PageNoteScopes pageId={pageId} disabled={disabled || access.locked} onLockChange={setNoteScopeLocked} />}
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
      <Field><FieldLabel htmlFor={`${id}-email`}>Email</FieldLabel><Input size="2xl" id={`${id}-email`} type="email" name="email" autoComplete="email" spellCheck={false} required maxLength={254}
        className="min-h-11 text-base" value={email} disabled={access.locked} placeholder="person@example.org…" onChange={(event) => setEmail(event.target.value)} /></Field>
      <div className="flex flex-wrap items-end gap-2">
        <Field className="min-w-0 flex-1"><FieldLabel htmlFor={`${id}-permission`}>Access</FieldLabel><Select id={`${id}-permission`} className={`${control} w-full`} value={permission} disabled={access.locked} onChange={event => ((value: string) => { if (value === "view" || value === "edit" || value === "manage") setPermission(value) })(event.target.value)}>

            <option value="view">View</option><option value="edit">Edit</option>{data.canGrantManage && <option value="manage">Manage</option>}
          </Select></Field>
        <Button size="lg" color="primary" type="submit" className={control} disabled={access.locked}>{access.pending && <LoaderIcon aria-hidden className="animate-spin motion-reduce:animate-none" />}Create invitation</Button>
      </div>
    </form>
    <p className="text-muted-foreground text-xs">Edit: page title, introduction, and only workspace notes explicitly enabled below by an organization editor. Manage: also invite viewers/editors. Neither grants other workspace data or publication rights.</p>
    {notice && <p role="status" className="text-sm">{notice}</p>}
    {fallback && <Input size="2xl" aria-label="Invitation link" value={fallback} readOnly onFocus={(event) => event.target.select()} />}
    <ul className="flex max-h-80 flex-col gap-3 overflow-y-auto" aria-label="Page invitations">
      {data.invitations.map((invite) => <li key={invite.id} className="flex min-w-0 flex-wrap items-center gap-2 rounded-xl border p-3">
        <div className="min-w-0 flex-1"><p className="break-all text-sm">{invite.email}</p><p className="text-muted-foreground text-xs capitalize">{invite.permission} · {invite.revoked ? "Removed" : invite.accepted ? "Accepted" : Date.parse(invite.expiresAt) <= Date.now() ? "Expired" : "Pending"}</p></div>
        {!invite.revoked && <>
          {!invite.accepted && Date.parse(invite.expiresAt) > Date.now() && <Button size="lg" color="primary" type="button" variant="outline" className={control} disabled={access.locked} onClick={() => void copy(invite.id)}>Copy link</Button>}
          <AlertDialog><AlertDialogTrigger asChild><Button size="lg" color="primary" type="button" variant="ghost" className={control} disabled={access.locked}>Remove</Button></AlertDialogTrigger>
            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remove this access?</AlertDialogTitle><AlertDialogDescription>Removing a manager also disables invitations they created. Other grants and public links stay unchanged.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => void access.send({ action: "revoke", pageId: data.pageId, operationId: crypto.randomUUID(), invitationId: invite.id })}>Remove access</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
        </>}
      </li>)}
    </ul>
  </div>
}
