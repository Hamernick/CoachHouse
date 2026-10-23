"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { guestCorrectionDraft, type GuestFollowup } from "../lib/guest-followup"
import { guestFieldLabel, guestFieldName, guestSubmissionInput } from "../lib/guest-submission-input"
import { FiscalSponsorshipApplicationEditorFields } from "./fiscal-sponsorship-application-editor-fields"
import { FiscalFieldErrors } from "./fiscal-public-field-errors"
import { FiscalPublicLeaveDialog } from "./fiscal-public-draft-status"
import { usePublicFiscalNavigation } from "./use-public-fiscal-navigation"

export function FiscalGuestCorrections({ application, onReload }: { application: GuestFollowup; onReload: () => void }) {
  const [draft, setDraft] = useState(() => guestCorrectionDraft(application.application!))
  const [dirty, setDirty] = useState(false)
  const [working, setWorking] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState("")
  const pending = useRef<string | null>(null)
  const busy = useRef(false)
  const form = useRef<HTMLFormElement>(null)
  const navigation = usePublicFiscalNavigation(dirty || uncertain || working)
  useEffect(() => {
    if (Object.keys(errors).length) form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  }, [errors])
  const submit = async () => {
    if (busy.current || conflict) return
    if (!pending.current) {
      let parsed: ReturnType<typeof guestSubmissionInput>
      try { parsed = guestSubmissionInput(draft) }
      catch { setMessage("An answer is too long. Shorten it before submitting."); return }
      if (!parsed.success) {
        setErrors(Object.fromEntries(parsed.error.issues.map((issue) => [guestFieldName(issue.path), issue.code === "custom" ? issue.message : "Check this answer."])))
        return
      }
      pending.current = JSON.stringify({ operation: "resubmit", reference: application.reference,
        requestId: crypto.randomUUID(), version: application.version, application: parsed.data.application })
    }
    busy.current = true; setWorking(true); setMessage(""); setErrors({})
    try {
      const response = await fetch("/api/public/fiscal-sponsorship/application", { method: "POST", credentials: "same-origin", cache: "no-store",
        signal: AbortSignal.timeout(15000), headers: { "Content-Type": "application/json" }, body: pending.current })
      const result = await response.json()
      if (response.status >= 500) throw new Error("uncertain")
      if (!response.ok) {
        pending.current = null; setUncertain(false); setConflict(response.status === 409)
        setMessage(typeof result.error === "string" ? result.error : "Couldn’t send your corrections. Please retry."); return
      }
      if (result.state !== "submitted") throw new Error("invalid_ack")
      pending.current = null; setUncertain(false); setDirty(false); onReload()
    } catch { setUncertain(true); setMessage("We couldn’t confirm the result. Retry the same corrections; this won’t create another application.") }
    finally { busy.current = false; setWorking(false) }
  }
  return <form ref={form} noValidate onSubmit={(event) => { event.preventDefault(); void submit() }} className="mt-5 rounded-3xl border border-border/60 bg-muted/20 p-3 sm:p-5">
    <FiscalPublicLeaveDialog open={navigation.destination !== null} onCancel={navigation.cancel} onLeave={navigation.leave} />
    <h2 className="text-xl font-normal tracking-tight">Update your application</h2>
    <p className="mt-1 mb-4 text-sm leading-5 text-muted-foreground">Your verified email stays the same. Corrections stay in this tab until you submit them.</p>
    {Object.keys(errors).length > 0 && <div role="alert" className="mb-4 text-sm"><p>Check these answers:</p><ul className="list-inside list-disc">{Object.entries(errors).map(([field, value]) => <li key={field}>{guestFieldLabel(field)}: {value}</li>)}</ul></div>}
    <FiscalFieldErrors.Provider value={errors}>
      <fieldset disabled={working || uncertain || conflict} aria-busy={working} className="m-0 min-w-0 border-0 p-0">
        <FiscalSponsorshipApplicationEditorFields guest lockEmail showAllSections={Object.keys(errors).length > 0} applicationReady={false}
          draft={draft} formId="fiscal-corrections" projectId="" onFieldChange={(field, value) => { setDraft((current) => ({ ...current, [field]: value })); setDirty(true) }} />
      </fieldset>
    </FiscalFieldErrors.Provider>
    <p role="status" aria-live="polite" className="mt-4 text-sm text-muted-foreground">{message}</p>
    {!conflict && <Button type="submit" disabled={working} className="mt-3 min-h-11 rounded-full px-5 shadow-none">{working ? "Sending…" : uncertain ? "Retry confirmation" : "Submit corrections"}</Button>}
    {conflict && <AlertDialog><AlertDialogTrigger asChild><Button type="button" variant="outline" className="mt-3 min-h-11 rounded-full shadow-none">Check current status</Button></AlertDialogTrigger>
      <AlertDialogContent className="rounded-2xl shadow-none"><AlertDialogHeader><AlertDialogTitle>Reload this application?</AlertDialogTitle>
        <AlertDialogDescription>Your unsent corrections will be discarded. Copy anything you want to keep first.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Keep my answers</AlertDialogCancel><AlertDialogAction onClick={onReload}>Reload application</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent></AlertDialog>}
  </form>
}
