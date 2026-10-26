"use client"

import { useId, useState } from "react"
import { CheckIcon, FileTextIcon, SaveIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldMessage } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { WORKSPACE_TEXT_STYLES } from "@/components/workspace/workspace-typography"
import type { CompanionSession } from "../hooks/use-companion-session"
import { PendingIcon } from "./companion-status"

export function CompanionReview({ session, onReceipt }: { session: CompanionSession; onReceipt: () => void }) {
  const id = useId()
  const [validation, setValidation] = useState("")
  const { snapshot, content, setContent, pending } = session

  async function saveDocument() {
    if (!content.trim()) { setValidation("Add document text before saving."); document.getElementById(`${id}-document`)?.focus(); return }
    setValidation("")
    await session.saveDocument()
  }
  async function submit() {
    if (session.answersDirty) { setValidation("Save your answers above before submitting. Your document is saved separately."); return }
    const success = await session.submit()
    if (success) onReceipt()
  }
  const answerDraft = snapshot.lesson.fields.map((field) => session.answers[field.name]?.trim()).filter(Boolean).join("\n\n")

  return <section className="flex flex-col gap-4" aria-labelledby={`${id}-heading`}>
    <h2 id={`${id}-heading`} className={WORKSPACE_TEXT_STYLES.cardTitle}>{snapshot.document.title}</h2>
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-3">
        <p className={WORKSPACE_TEXT_STYLES.sectionTitle}>Saved document <span className="text-muted-foreground">· Revision {snapshot.document.revision}</span></p>
        <div className="min-h-24 whitespace-pre-wrap break-words rounded-md border bg-muted/15 p-3 text-sm leading-6">{snapshot.document.content || "No document saved yet."}</div>
      </div>
      <form className="flex min-w-0 flex-col gap-4" onSubmit={(event) => { event.preventDefault(); void saveDocument() }}>
        <FieldGroup><Field data-invalid={Boolean(validation)} className="gap-3">
          <FieldLabel htmlFor={`${id}-document`}>Your revision</FieldLabel>
          <Textarea id={`${id}-document`} name="document" value={content} onChange={(event) => { setContent(event.target.value); setValidation("") }} rows={5} disabled={Boolean(pending)} aria-invalid={Boolean(validation)} aria-describedby={`${id}-document-help`} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }} />
          <FieldDescription id={`${id}-document-help`}>Saves this document only. Does not publish or submit the assignment.</FieldDescription>
          {validation && <FieldMessage role="alert">{validation}</FieldMessage>}
        </Field></FieldGroup>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={Boolean(pending)}><PendingIcon active={pending === "companion_save_document"} fallback={SaveIcon} />Save document</Button>
          {!content.trim() && answerDraft && <Button type="button" variant="outline" onClick={() => setContent(answerDraft)}><FileTextIcon data-icon="inline-start" />Start from my answers</Button>}
        </div>
        <p className="text-xs text-muted-foreground">{session.documentDirty ? "Unsaved document changes" : "Document matches the saved version"}</p>
      </form>
    </div>
    <Separator />
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex max-w-xl flex-col gap-1">
        <h3 className={WORKSPACE_TEXT_STYLES.sectionTitle}>Assignment submission</h3>
        <p className={WORKSPACE_TEXT_STYLES.bodyMuted}>Submits saved answers. Completion follows the lesson requirements.</p>
      </div>
      <Button variant="outline" disabled={Boolean(pending)} onClick={() => void submit()}><PendingIcon active={pending === "companion_submit_assignment"} fallback={CheckIcon} />Submit assignment</Button>
    </div>
  </section>
}
