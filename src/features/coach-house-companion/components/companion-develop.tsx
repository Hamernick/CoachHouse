"use client"

import { useId, useState } from "react"
import { ArrowRightIcon, SaveIcon } from "lucide-react"
import { AssignmentStepNavigation } from "@/components/training/module-detail/assignment-form/assignment-step-navigation"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { WORKSPACE_TEXT_STYLES } from "@/components/workspace/workspace-typography"
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
  const nextField = fields[question + 1]

  return <section className="flex flex-col gap-4" aria-label="Assignment questions">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className={WORKSPACE_TEXT_STYLES.meta}>{answered} of {fields.length} answered</p>
      <Button size="sm" variant="ghost" onClick={() => setShowAll(!showAll)} aria-pressed={showAll}>{showAll ? "One question at a time" : "View all questions"}</Button>
    </div>
    <form className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); void session.saveDraft() }}>
      <FieldGroup className="gap-4">
        {visible.map((field) => <Field key={field.name} className="gap-3">
          <FieldLabel htmlFor={`${id}-${field.name}`} className="text-base font-semibold leading-tight select-text">{field.label}{field.required ? " (required)" : ""}</FieldLabel>
          {field.description && <FieldDescription className="whitespace-pre-line" id={`${id}-${field.name}-description`}>{field.description}</FieldDescription>}
          <Textarea id={`${id}-${field.name}`} name={field.name} value={answers[field.name] ?? ""} rows={4} disabled={Boolean(pending)} aria-describedby={field.description ? `${id}-${field.name}-description` : undefined} onChange={(event) => setAnswers((previous) => ({ ...previous, [field.name]: event.target.value }))} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }} />
        </Field>)}
      </FieldGroup>
      {!fields.length && <p className="text-sm text-muted-foreground">This lesson has no answer fields. Review the document or return to the lesson.</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="submit" variant="outline" disabled={Boolean(pending)}><PendingIcon active={pending === "companion_save_draft"} fallback={SaveIcon} />Save answers</Button>
        {!showAll && fields.length > 0 && <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
          <span className="text-sm text-muted-foreground tabular-nums">{question + 1} / {fields.length}</span>
          <div className="flex-1"><AssignmentStepNavigation placement="footer" canGoPrevious={question > 0} canGoNext={Boolean(nextField)} currentSection={current ? { id: current.name, fields: [{ ...current, type: "long_text" }] } : null} nextSection={nextField ? { id: nextField.name, fields: [{ ...nextField, type: "long_text" }] } : null} onPrevious={() => setQuestion(question - 1)} onNext={() => setQuestion(question + 1)} /></div>
          {!nextField && <Button type="button" size="sm" onClick={onReview}>Review document<ArrowRightIcon data-icon="inline-end" /></Button>}
        </div>}
        {showAll && <Button type="button" onClick={onReview}>Review document<ArrowRightIcon data-icon="inline-end" /></Button>}
      </div>
      <p className={WORKSPACE_TEXT_STYLES.utility} role="status">{session.answersDirty ? "Unsaved answers" : "Answers saved"}. Saving does not submit the assignment.</p>
    </form>
  </section>
}
