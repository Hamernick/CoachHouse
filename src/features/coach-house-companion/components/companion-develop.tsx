"use client"

import { useId, useState } from "react"
import { ArrowLeftIcon, ArrowRightIcon, SaveIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import type { CompanionSession } from "../hooks/use-companion-session"
import { PendingIcon } from "./companion-status"

export function CompanionDevelop({ session, onReview }: { session: CompanionSession; onReview: () => void }) {
  const id = useId()
  const [question, setQuestion] = useState(0)
  const [showAll, setShowAll] = useState(false)
  const { snapshot, answers, setAnswers, pending } = session
  const fields = snapshot.lesson.fields
  const current = fields[Math.min(question, Math.max(0, fields.length - 1))]
  const answered = fields.filter((field) => answers[field.name]?.trim()).length
  const visible = showAll ? fields : current ? [current] : []

  return <section className="flex flex-col gap-6" aria-labelledby={`${id}-heading`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground tabular-nums">{answered} of {fields.length} questions answered</p>
        <h2 id={`${id}-heading`} className="text-xl font-semibold tracking-tight">Start with your own words.</h2>
        <p className="text-sm leading-6 text-muted-foreground">Rough answers are welcome. Save your thinking now; shape the document next.</p>
      </div>
      <Button variant="ghost" onClick={() => setShowAll(!showAll)} aria-pressed={showAll}>{showAll ? "One question at a time" : "View all questions"}</Button>
    </div>
    <form className="flex flex-col gap-6" onSubmit={(event) => { event.preventDefault(); void session.saveDraft() }}>
      <FieldGroup className="gap-6">
        {visible.map((field) => <Field key={field.name} className="gap-3">
          <FieldLabel htmlFor={`${id}-${field.name}`}>{field.label}{field.required ? " (required)" : ""}</FieldLabel>
          {field.description && <FieldDescription id={`${id}-${field.name}-description`}>{field.description}</FieldDescription>}
          <Textarea id={`${id}-${field.name}`} name={field.name} value={answers[field.name] ?? ""} rows={5} disabled={Boolean(pending)} aria-describedby={field.description ? `${id}-${field.name}-description` : undefined} placeholder="Write what comes to mind…" onChange={(event) => setAnswers((previous) => ({ ...previous, [field.name]: event.target.value }))} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }} />
        </Field>)}
      </FieldGroup>
      {!fields.length && <p className="text-sm text-muted-foreground">This lesson has no answer fields. Review the document or return to the lesson.</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="submit" variant="outline" disabled={Boolean(pending)}><PendingIcon active={pending === "companion_save_draft"} fallback={SaveIcon} />Save answers</Button>
        {!showAll && fields.length > 0 && <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" disabled={question === 0} onClick={() => setQuestion(question - 1)} aria-label="Previous question"><ArrowLeftIcon data-icon="inline-start" />Back</Button>
          <span className="text-sm text-muted-foreground tabular-nums">{question + 1} / {fields.length}</span>
          {question < fields.length - 1 ? <Button type="button" variant="outline" onClick={() => setQuestion(question + 1)}>Next<ArrowRightIcon data-icon="inline-end" /></Button> : <Button type="button" onClick={onReview}>Review document<ArrowRightIcon data-icon="inline-end" /></Button>}
        </div>}
        {showAll && <Button type="button" onClick={onReview}>Review document<ArrowRightIcon data-icon="inline-end" /></Button>}
      </div>
      <p className="text-xs text-muted-foreground" role="status">{session.answersDirty ? "Unsaved answers. Saving does not submit the assignment." : "Answers match the saved draft. Submission is a separate step."}</p>
    </form>
  </section>
}
