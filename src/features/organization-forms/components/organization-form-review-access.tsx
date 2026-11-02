"use client"

import { useEffect, useId, useRef, useState } from "react"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { formReviewAccessSchema, formRecoveryReceiptSchema } from "../lib"
import type { FormAccessTarget } from "../lib/form-review-access"
import type { FormIntakeCommand } from "../lib"
import { IntakeRequestError, sendFormCommand } from "../hooks/intake-client"

import { OrganizationFormViewerInvitations } from "./organization-form-viewer-invitations"

type Change = Extract<FormIntakeCommand, { action: "grant_reviewer" | "revoke_reviewer" }>
export function OrganizationFormReviewAccess({ target, disabled, onLockChange, canManageInvitations = false }: {
  target: FormAccessTarget; canManageInvitations?: boolean; disabled: boolean; onLockChange: (locked: boolean) => void
}) {
  const { versionId, organizationId, formId } = target
  const id = useId(); const busy = useRef(false); const input = useRef<HTMLInputElement>(null)
  const [data, setData] = useState<z.infer<typeof formReviewAccessSchema> | null>(null)
  const [role, setRole] = useState<"view" | "edit" | "manage">("view")
  const [email, setEmail] = useState(""); const [pending, setPending] = useState(false)
  const [retry, setRetry] = useState<Change | null>(null)
  const [error, setError] = useState(""); const [notice, setNotice] = useState("")
  const [reload, setReload] = useState(0)
  const [viewersLocked, setViewersLocked] = useState(false)
  const locked = pending || Boolean(retry) || viewersLocked
  useEffect(() => { onLockChange(locked); return () => onLockChange(false) }, [locked, onLockChange])
  useEffect(() => {
    if (!locked) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [locked])
  useEffect(() => {
    let active = true
    setData(null); setError("")
    void sendFormCommand({ action: "review_access", ...(versionId ? { versionId } : { organizationId, formId }) }).then((value) => {
      const result = formReviewAccessSchema.parse(value)
      if (formId && result.formId !== formId) throw new Error("Invalid form access")
      if (active) setData(result)
    }).catch((failure) => { if (active) setError(failure instanceof IntakeRequestError ? failure.message : "Unable to load response access.") })
    return () => { active = false }
  }, [versionId, organizationId, formId, reload])
  useEffect(() => { if (notice && data) input.current?.focus() }, [notice, data])
  async function change(command: Change) {
    if (busy.current || disabled || !data) return
    busy.current = true; setPending(true); setError(""); setNotice("")
    try {
      const receipt = formRecoveryReceiptSchema.parse(await sendFormCommand(command))
      if (receipt.formId !== data.formId || receipt.operationId !== command.operationId || receipt.revision !== command.expectedRevision + 1) throw new Error("Invalid receipt")
      setRetry(null); setEmail(""); setNotice("Access change saved."); setReload((value) => value + 1)

    } catch (failure) {
      const uncertain = !(failure instanceof IntakeRequestError) || failure.uncertain
      setRetry(uncertain ? command : null)
      setError(failure instanceof IntakeRequestError ? failure.message : "Unable to confirm. Retry the same request.")
      if (failure instanceof IntakeRequestError && [401, 403].includes(failure.status)) setData(null)
    } finally { busy.current = false; setPending(false) }
  }
  return <section aria-label={versionId ? "Response access" : "Form access"} className="flex min-w-0 flex-col gap-3 rounded-xl border p-3">
    <h4 className="text-sm font-medium">{versionId ? "Response access" : "Form access"}</h4>
    <p id={`${id}-help`} className="text-muted-foreground text-xs">View reads responses. Edit changes the form and corrects answers. Manage also shares View/Edit access. Publication and removal stay with the primary manager. Choose the organization owner or an existing editor.</p>
    {data && <p className="text-muted-foreground text-xs">{data.canGrantManage
      ? "Removing or downgrading Manage also removes access it granted. Saving a teammate’s access directly keeps it independent."
      : "You can change only access you granted. It ends if your Manage access ends."}</p>}
    <form className="flex min-w-0 flex-col gap-2" onSubmit={(event) => {
      event.preventDefault()
      if (data && !locked && (role !== "manage" || data.canGrantManage)) void change({ action: "grant_reviewer", ...target, email: email.trim(), role, expectedRevision: data.revision, operationId: crypto.randomUUID() })
    }}>
      <label htmlFor={id} className="text-xs">Teammate email</label>
      <Input ref={input} id={id} type="email" required maxLength={320} autoComplete="off" aria-describedby={`${id}-help`} value={email}
        className="min-h-11" disabled={disabled || locked || !data} onChange={(event) => setEmail(event.target.value)} />
      <label htmlFor={`${id}-role`} className="text-xs">Access</label>
      <Select value={role} onValueChange={(value) => { if (value === "view" || value === "edit" || (value === "manage" && data?.canGrantManage)) setRole(value) }} disabled={disabled || locked || !data}>
        <SelectTrigger id={`${id}-role`} className="min-h-11 w-full"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="view">View</SelectItem><SelectItem value="edit">Edit</SelectItem>{data?.canGrantManage && <SelectItem value="manage">Manage</SelectItem>}</SelectContent>
      </Select>
      <Button type="submit" variant="outline" className="min-h-11 rounded-xl" disabled={disabled || locked || !data || !email.trim() || (role === "manage" && !data.canGrantManage)}>Save access</Button>
    </form>
    {notice && <p role="status" className="text-sm">{notice}</p>}
    {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
    {!data && !error && <p role="status" className="text-muted-foreground text-sm">Loading access…</p>}
    {retry ? <Button type="button" variant="outline" className="min-h-11 rounded-xl" disabled={pending || disabled} onClick={() => void change(retry)}>Retry access change</Button>
      : error && <Button type="button" variant="outline" className="min-h-11 rounded-xl" disabled={pending || disabled} onClick={() => setReload((value) => value + 1)}>Reload access</Button>}
    {data?.reviewers.length === 0 && <p className="text-muted-foreground text-xs">{data.canGrantManage ? "No additional collaborators." : "No access granted by you."}</p>}
    {versionId && data && (data.canGrantManage || canManageInvitations) && <OrganizationFormViewerInvitations versionId={versionId} disabled={disabled || pending || Boolean(retry)} onLockChange={setViewersLocked}
      onRevisionChange={(revision) => setData((current) => current ? { ...current, revision } : current)} />}
    {data?.reviewers.map((reviewer) => <div key={reviewer.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2">
      <span className="min-w-0 break-all text-sm">{reviewer.email} <span className="text-muted-foreground">· {reviewer.role === "manage" ? "Manage" : reviewer.role === "edit" ? "Edit" : "View"}</span></span>
      <Button type="button" variant="ghost" className="min-h-11 rounded-xl" disabled={disabled || locked} aria-label={`Change access for ${reviewer.email}`}
        onClick={() => { setEmail(reviewer.email); setRole(reviewer.role); input.current?.focus() }}>Change</Button>
      <Button type="button" variant="ghost" className="min-h-11 rounded-xl" disabled={disabled || locked} aria-label={`Remove access for ${reviewer.email}`}
        onClick={() => void change({ action: "revoke_reviewer", ...target, memberId: reviewer.id, expectedRevision: data.revision, operationId: crypto.randomUUID() })}>Remove access</Button>
    </div>)}
  </section>
}
