"use client"
import { useEffect, useId, useRef, useState } from "react"
import { ParticleButton as Button } from "@/components/ui/particle-ui"
import { ParticleInput as Input } from "@/components/ui/particle-ui"
import { ParticleTextarea as Textarea } from "@/components/ui/particle-ui"
import { formSourceContentSchema, formSourceReceiptSchema, formSourceSchema } from "../lib/form-source"
import type { FormSource, FormSourceCommand, FormSourceContent } from "../lib/form-source"
import { IntakeRequestError, sendFormCommand } from "../hooks/intake-client"
import { OrganizationFormBuilder } from "./organization-form-builder"
type Save = Extract<FormSourceCommand, { action: "save_form_source" }>
/** Edits the canonical draft only. Published versions remain immutable. */
export function OrganizationFormSourceEditor({ versionId, formId, onClose }: {
  versionId: string; formId: string; onClose: () => void
}) {
  const id = useId(); const busy = useRef(false); const heading = useRef<HTMLHeadingElement>(null)
  const [source, setSource] = useState<FormSource | null>(null)
  const [draft, setDraft] = useState<FormSourceContent | null>(null)
  const [review, setReview] = useState<FormSource | null>(null)
  const [pending, setPending] = useState(false); const [error, setError] = useState("")
  const [retry, setRetry] = useState<Save | null>(null)
  const [conflict, setConflict] = useState(false); const [saved, setSaved] = useState(false)
  const locked = pending || Boolean(retry)
  useEffect(() => { heading.current?.focus() }, [])
  const draftRef = useRef(draft); draftRef.current = draft
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (draftRef.current) { event.preventDefault(); event.returnValue = "" } }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [])
  useEffect(() => {
    let active = true
    void sendFormCommand({ action: "read_form_source", versionId }).then((value) => {
      const next = formSourceSchema.parse(value)
      if (next.formId !== formId) throw new Error("Invalid source")
      if (active) { setSource(next); setDraft({ title: next.title, description: next.description, definition: next.definition }) }
    }).catch((failure) => { if (active) setError(failure instanceof IntakeRequestError ? failure.message : "Unable to load the form.") })
    return () => { active = false }
  }, [versionId, formId])
  async function reload() {
    if (busy.current || retry) return
    busy.current = true; setPending(true); setError("")
    try {
      const next = formSourceSchema.parse(await sendFormCommand({ action: "read_form_source", versionId }))
      if (next.formId !== formId) throw new Error("Invalid source")
      if (draft) setReview(next)
      else { setSource(next); setDraft({ title: next.title, description: next.description, definition: next.definition }); setConflict(false) }
    } catch (failure) { setError(failure instanceof IntakeRequestError ? failure.message : "Unable to load the saved form. Your draft is preserved.") }
    finally { busy.current = false; setPending(false) }
  }
  async function save() {
    if (!draft || !source || busy.current || conflict) return
    const parsed = formSourceContentSchema.safeParse(draft)
    if (!parsed.success) { setError("Enter a title and check the form fields."); return }
    const command: Save = retry ?? { action: "save_form_source", versionId, operationId: crypto.randomUUID(), expectedRevision: source.revision, content: parsed.data }
    busy.current = true; setPending(true); setError("")
    try {
      const receipt = formSourceReceiptSchema.parse(await sendFormCommand(command))
      if (receipt.formId !== formId || receipt.operationId !== command.operationId) throw new Error("Invalid receipt")
      setRetry(null); setSaved(true); setDraft(null)
    } catch (failure) {
      setRetry(!(failure instanceof IntakeRequestError) || failure.uncertain ? command : null)
      setConflict(failure instanceof IntakeRequestError && [401, 403, 409].includes(failure.status))
      setError(failure instanceof IntakeRequestError ? failure.message : "Unable to confirm. Retry the same request.")
    } finally { busy.current = false; setPending(false) }
  }
  if (saved) return <section aria-label="Edit form" className="space-y-3 rounded-xl border p-3">
    <p role="status" className="text-sm">Form saved. Published versions are unchanged.</p>
    <Button size="lg" color="primary" type="button" className="min-h-11 rounded-xl" onClick={onClose}>Done</Button>
  </section>
  return <section aria-label="Edit form" className="flex min-w-0 flex-col gap-3 rounded-xl border p-3">
    <h2 ref={heading} tabIndex={-1} className="text-sm font-medium">Edit form</h2>
    <p className="text-muted-foreground text-xs">Changes update the saved draft across its boards. Publishing requires a separate review.</p>
    {!draft && !error && <p role="status" className="text-sm">Loading form…</p>}
    {draft && <fieldset disabled={locked} className="flex min-w-0 flex-col gap-3">
      <legend className="sr-only">Form draft</legend>
      <label htmlFor={`${id}-title`} className="text-xs">Title</label>
      <Input size="2xl" id={`${id}-title`} value={draft.title} maxLength={240} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
      <label htmlFor={`${id}-description`} className="text-xs">Description</label>
      <Textarea size="2xl" id={`${id}-description`} value={draft.description} maxLength={10000} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
      <OrganizationFormBuilder definition={draft.definition} disabled={locked} onChange={(definition) => setDraft({ ...draft, definition })} />
    </fieldset>}
    {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
    {review && <section aria-label="Saved form review" className="space-y-3 border-t pt-3">
      <h3 className="break-words text-sm font-medium">Saved: {review.title || "Untitled form"}</h3>
      <p className="whitespace-pre-wrap break-words text-sm">{review.description}</p>
      <OrganizationFormBuilder definition={review.definition} disabled onChange={() => {}} />
      <p className="text-muted-foreground text-xs">Review the saved form. Keeping your draft will replace these fields when you save.</p>
      <div className="flex flex-wrap gap-2">
        <Button size="lg" color="primary" type="button" variant="outline" className="min-h-11 rounded-xl" onClick={() => { setSource(review); setReview(null); setConflict(false); setError("") }}>Keep my draft</Button>
        <Button size="lg" color="primary" type="button" variant="ghost" className="min-h-11 rounded-xl" onClick={() => { setSource(review); setDraft({ title: review.title, description: review.description, definition: review.definition }); setReview(null); setConflict(false); setError("") }}>Use saved form</Button>
      </div>
    </section>}
    <div className="flex flex-wrap gap-2">
      {draft && <Button size="lg" color="primary" type="button" className="min-h-11 rounded-xl" disabled={pending || conflict || Boolean(review)} onClick={() => void save()}>{retry ? "Retry save" : pending ? "Saving…" : "Save form"}</Button>}
      {(conflict || (!draft && error)) && <Button size="lg" color="primary" type="button" variant="outline" className="min-h-11 rounded-xl" disabled={locked} onClick={() => void reload()}>Review saved form</Button>}
      <Button size="lg" color="primary" type="button" variant="ghost" className="min-h-11 rounded-xl" disabled={locked} onClick={onClose}>Cancel</Button>
    </div>
  </section>
}
