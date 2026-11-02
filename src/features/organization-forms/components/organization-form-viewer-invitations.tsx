"use client"
import { useEffect, useId, useMemo, useRef, useState } from "react"
import { z } from "zod"
import { ParticleButton as Button } from "@/components/ui/particle-ui"
import { ParticleSelect as Select } from "@/components/ui/particle-ui"
import { ParticleInput as Input } from "@/components/ui/particle-ui"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { formViewerListSchema, formViewerReceiptSchema } from "../lib/form-viewer-access"
import type { FormViewerCommand } from "../lib/form-viewer-access"
import { IntakeRequestError, sendFormCommand } from "../hooks/intake-client"
import { OrganizationFormResponseLink } from "./organization-form-response-link"
import type { FormAccessTarget } from "../lib/form-review-access"
type Change = Extract<FormViewerCommand, { action: "invite_viewer" | "revoke_viewer" }>
export function OrganizationFormViewerInvitations({ versionId, target, disabled, onLockChange, onRevisionChange }: {
  versionId?: string; target?: FormAccessTarget; disabled: boolean; onLockChange: (locked: boolean) => void; onRevisionChange: (revision: number) => void
}) {
  const address = useMemo(() => target ?? { versionId: versionId! }, [target, versionId])
  const draftEntry = Boolean(target?.organizationId)
  const [responsePermission, setResponsePermission] = useState<"view" | "correct" | "edit" | "manage">(draftEntry ? "edit" : "view")
  const id = useId(); const busy = useRef(false)
  const [open, setOpen] = useState(false); const [email, setEmail] = useState("")
  const [data, setData] = useState<z.infer<typeof formViewerListSchema> | null>(null)
  const [pending, setPending] = useState(false); const [retry, setRetry] = useState<Change | null>(null)
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [reload, setReload] = useState(0)
  const locked = pending || Boolean(retry)
  useEffect(() => { onLockChange(locked); return () => onLockChange(false) }, [locked, onLockChange])
  useEffect(() => {
    if (!locked) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [locked])
  useEffect(() => {
    if (!open) return
    let active = true
    setData(null); setError("")
    void sendFormCommand({ action: "viewer_invitations", ...address }).then((value) => {
      const next = formViewerListSchema.parse(value)
      if (active) setData(next)
    }).catch((failure) => { if (active) setError(failure instanceof IntakeRequestError ? failure.message : "Unable to load invitations.") })
    return () => { active = false }
  }, [open, reload, address])
  async function change(command: Change) {
    if (busy.current || disabled || !data) return
    busy.current = true; setPending(true); setError(""); setNotice("")
    try {
      const receipt = formViewerReceiptSchema.parse(await sendFormCommand(command))
      if (receipt.formId !== data.formId || receipt.operationId !== command.operationId || receipt.revision !== command.expectedRevision + 1) throw new Error("Invalid receipt")
      setRetry(null); setEmail(""); onRevisionChange(receipt.revision)
      setNotice(command.action === "invite_viewer" ? (draftEntry ? "Invitation saved. Copy and share the form link." : "Invitation saved. Copy and share the response link.") : "Response access removed.")
      setReload((value) => value + 1)
    } catch (failure) {
      setRetry(!(failure instanceof IntakeRequestError) || failure.uncertain ? command : null)
      setError(failure instanceof IntakeRequestError ? failure.message : "Unable to confirm. Retry the same request.")
      if (failure instanceof IntakeRequestError && [401, 403].includes(failure.status)) setData(null)
    } finally { busy.current = false; setPending(false) }
  }
  return <Collapsible open={open} onOpenChange={(value) => { if (!locked) setOpen(value) }} className="border-t pt-3">
    <CollapsibleTrigger asChild><Button size="lg" color="primary" type="button" variant="ghost" className="min-h-11 w-full justify-start rounded-xl" disabled={disabled || locked}>{draftEntry ? "Invited form collaborators" : "Invited response collaborators"}</Button></CollapsibleTrigger>
    <CollapsibleContent className="space-y-3 pt-3">
      <p className="text-muted-foreground text-xs">View reads responses. Edit changes the form and corrects answers. Manage also invites View/Edit collaborators. No workspace access, publication or removal rights. Recipients accept within seven days. No email is sent. Reinviting requires acceptance again.</p>
      {data && <p className="text-muted-foreground text-xs">{data.canGrantManage
        ? "Removing or replacing Manage also removes access it granted. Reinvite a collaborator directly to keep their access independent."
        : "You can change only invitations you created. Their access ends when yours ends."}</p>}
      <form className="flex min-w-0 flex-col gap-2" onSubmit={(event) => {
        event.preventDefault()
        if (data && !locked && (responsePermission !== "manage" || data.canGrantManage)) void change({ action: "invite_viewer", ...address, email: email.trim(), responsePermission, expectedRevision: data.revision, operationId: crypto.randomUUID() })
      }}>
        <label htmlFor={id} className="text-xs">Invitee email</label>
        <Input size="2xl" id={id} type="email" autoComplete="off" required maxLength={320} value={email} onChange={(event) => setEmail(event.target.value)} className="min-h-11" disabled={disabled || locked || !data} />
        <label htmlFor={`${id}-permission`} className="text-xs">{draftEntry ? "Form access" : "Response access"}</label>
        <Select id={`${id}-permission`} className="min-h-11 w-full" value={responsePermission} onChange={event => ((value: string) => { if (value === "view" || value === "correct" || value === "edit" || (value === "manage" && data?.canGrantManage)) setResponsePermission(value) })(event.target.value)} disabled={disabled || locked || !data}>

          {!draftEntry && <><option value="view">View responses</option><option value="correct">Correct responses</option></>}<option value="edit">Edit form and responses</option>{data?.canGrantManage && <option value="manage">Manage form access</option>}
        </Select>
        <Button size="lg" color="primary" type="submit" variant="outline" className="min-h-11 rounded-xl" disabled={disabled || locked || !data || !email.trim() || (responsePermission === "manage" && !data.canGrantManage)}>{draftEntry ? "Create form invitation" : "Create response invitation"}</Button>
      </form>
      {notice && <p role="status" className="text-sm">{notice}</p>}
      {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
      {!data && !error && <p role="status" className="text-muted-foreground text-sm">Loading invitations…</p>}
      {retry ? <Button size="lg" color="primary" type="button" variant="outline" className="min-h-11 rounded-xl" disabled={pending || disabled} onClick={() => void change(retry)}>Retry invitation change</Button>
        : error && <Button size="lg" color="primary" type="button" variant="outline" className="min-h-11 rounded-xl" disabled={pending || disabled} onClick={() => setReload((value) => value + 1)}>Reload invitations</Button>}
      {data && <OrganizationFormResponseLink forInvitation versionId={versionId} target={target} disabled={disabled || locked} />}
      {data?.invitations.map((invitation) => <div key={invitation.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 break-all text-sm">{invitation.email}<span className="text-muted-foreground"> · {invitation.responsePermission === "manage" ? "Manage form access" : invitation.responsePermission === "edit" ? "Edit form and responses" : invitation.responsePermission === "correct" ? "Correct responses" : "View responses"} · {invitation.accepted ? "Accepted" : "Awaiting acceptance"}</span></p>
        <Button size="lg" color="primary" type="button" variant="ghost" className="min-h-11 rounded-xl" disabled={disabled || locked} aria-label={`Revoke response invitation for ${invitation.email}`}
          onClick={() => void change({ action: "revoke_viewer", ...address, invitationId: invitation.id, operationId: crypto.randomUUID(), expectedRevision: data.revision })}>Revoke</Button>
      </div>)}
      {data?.invitations.length === 0 && <p className="text-muted-foreground text-xs">No invited collaborators.</p>}
    </CollapsibleContent>
  </Collapsible>
}
