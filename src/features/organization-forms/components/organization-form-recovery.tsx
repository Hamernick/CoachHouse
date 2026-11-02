"use client"

import { useEffect, useRef, useState } from "react"
import { z } from "zod"
import LoaderIcon from "lucide-react/dist/esm/icons/loader-circle"
import { Button } from "@/components/ui/button"
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog"
import { formRecoveryListSchema, formRecoveryReceiptSchema } from "../lib"
import type { FormIntakeCommand, FormRecoveryTarget } from "../lib/form-intake"
import { IntakeRequestError, sendFormCommand } from "../hooks/intake-client"

type Recovery = Extract<FormIntakeCommand, { action: "recover_form" }>
type Candidate = z.infer<typeof formRecoveryListSchema>["forms"][number]
export function OrganizationFormRecovery({ target, disabled, onLockChange, onRecovered }: {
  target: FormRecoveryTarget; disabled: boolean; onLockChange: (locked: boolean) => void; onRecovered: () => void
}) {
  const { pageId, organizationId, formId } = target
  const [data, setData] = useState<z.infer<typeof formRecoveryListSchema> | null>(null)
  const [after, setAfter] = useState<string | undefined>()
  const [refresh, setRefresh] = useState(0)
  const [selected, setSelected] = useState<Candidate | null>(null)
  const [request, setRequest] = useState<Recovery | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const busy = useRef(false)
  const returnFocus = useRef<HTMLButtonElement>(null)
  const feedback = useRef<HTMLParagraphElement>(null)
  const locked = Boolean(selected || request || pending)
  useEffect(() => { onLockChange(locked); return () => onLockChange(false) }, [locked, onLockChange])
  useEffect(() => {
    if (!request) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [request])
  useEffect(() => {
    let active = true
    setData(null); setError("")
    void sendFormCommand({ action: "recoverable_forms", ...(pageId ? { pageId } : { organizationId, formId }), ...(after ? { after } : {}) })
      .then((value) => { const result = formRecoveryListSchema.parse(value); if (formId && result.forms.some(form => form.id !== formId)) throw new Error("Unexpected recovery target"); if (active) setData(result) })
      .catch(() => { if (active) setError("Unable to check form recovery.") })
    return () => { active = false }
  }, [pageId, organizationId, formId, after, refresh])
  useEffect(() => { if (error || notice) feedback.current?.focus({ preventScroll: true }) }, [error, notice])
  async function recover(command: Recovery) {
    if (busy.current) return
    busy.current = true; setRequest(command); setPending(true); setError(""); setNotice(""); setSelected(null)
    try {
      const receipt = formRecoveryReceiptSchema.parse(await sendFormCommand(command))
      if (receipt.formId !== command.formId || receipt.operationId !== command.operationId || receipt.revision !== command.expectedRevision + 1)
        throw new Error("Unexpected recovery receipt")
      setRequest(null); setNotice("Form recovered. You now manage it and its responses.")
      setRefresh((value) => value + 1); onRecovered()
    } catch (failure) {
      const uncertain = !(failure instanceof IntakeRequestError) || failure.uncertain
      if (!uncertain) setRequest(null)
      setError(failure instanceof IntakeRequestError ? failure.message : "Unable to confirm. Retry the same request.")
    } finally { busy.current = false; setPending(false) }
  }
  if (!data?.forms.length && !data?.next && !after && !selected && !request && !pending && !error && !notice) return null
  return <div className="flex min-w-0 flex-col gap-3">
    {(error || notice) && <p ref={feedback} tabIndex={-1} role={error ? "alert" : "status"} className="focus-ring text-sm">{error || notice}</p>}
    {error && <Button type="button" variant="outline" className="min-h-11 w-fit rounded-xl" disabled={pending || disabled}
      onClick={() => request ? void recover(request) : setRefresh((value) => value + 1)}>{pending && <LoaderIcon aria-hidden className="animate-spin motion-reduce:animate-none" />}{request ? "Retry recovery" : "Reload access"}</Button>}
    {pending && !error && <p role="status" className="text-muted-foreground text-sm">Recovering form…</p>}
    {Boolean(data?.forms.length) && <section aria-label="Recover form access" className="flex min-w-0 flex-col gap-3 rounded-2xl border p-4">
      <h3 className="text-sm font-medium">Forms without an active manager</h3>
      <p className="text-muted-foreground text-xs">As organization owner, you can take over these forms and their private responses.</p>
      {data?.forms.map((form) => <div key={form.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <span className="min-w-0 break-words text-sm">{form.title}</span>
        <Button type="button" variant="outline" className="min-h-11 rounded-xl" disabled={locked || disabled} onClick={(event) => { returnFocus.current = event.currentTarget; setSelected(form) }} aria-label={`Recover ${form.title}`}>Recover access</Button>
      </div>)}
    </section>}
    {data?.next && <Button type="button" variant="ghost" disabled={locked || disabled} onClick={() => setAfter(data.next ?? undefined)}>More forms</Button>}
    {after && <Button type="button" variant="ghost" disabled={locked || disabled} onClick={() => setAfter(undefined)}>First forms</Button>}
    <AlertDialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null) }}>
      <AlertDialogContent className="rounded-2xl" onCloseAutoFocus={(event) => { event.preventDefault(); returnFocus.current?.focus() }}><AlertDialogHeader>
        <AlertDialogTitle>Recover form access?</AlertDialogTitle>
        <AlertDialogDescription>You will manage “{selected?.title}” and can read and correct its private responses. The original creator stays recorded. This does not publish changes.</AlertDialogDescription>
      </AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction onClick={() => { if (selected) void recover({ action: "recover_form", ...target, formId: selected.id, expectedRevision: selected.revision, operationId: crypto.randomUUID() }) }}>Recover access</AlertDialogAction>
      </AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
  </div>
}
