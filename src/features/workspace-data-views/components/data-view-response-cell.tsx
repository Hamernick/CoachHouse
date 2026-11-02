"use client"
import { useEffect, useId, useRef, useState } from "react"
import { OrganizationFormAnswerField } from "@/features/organization-forms/client"
import { displayChoiceAnswer, displayGridAnswer } from "@/features/organization-forms"
import type { FormAnswer, FormResponse, FormSnapshotQuestion } from "@/features/organization-forms"
import { ParticleButton as Button } from "@/components/ui/particle-ui"

export function DataViewResponseCell({ question, response, display: fallbackDisplay, writable, pending, canStartEdit = true, onDirty, onSave }: {
  question: FormSnapshotQuestion; response: FormResponse; display: string; writable: boolean; pending: boolean; canStartEdit?: boolean;
  onDirty: (value: boolean) => void; onSave: (value: FormAnswer["value"], revision: number) => Promise<boolean>
}) {
  const savedValue = response.answers.find(answer => answer.questionId === question.id)?.value
  const display = question.type === "single_choice" || question.type === "multiple_choice" || question.type === "dropdown" ? displayChoiceAnswer(question, savedValue) : question.type === "multiple_choice_grid" || question.type === "checkbox_grid" ? displayGridAnswer(question, savedValue) : fallbackDisplay
  const fieldId = useId()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState<FormAnswer["value"]>("")
  const [revision, setRevision] = useState(response.revision)
  const form = useRef<HTMLFormElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const wasEditing = useRef(false)
  useEffect(() => {
    if (editing) form.current?.querySelector<HTMLElement>("input, textarea, [role=combobox], button")?.focus()
    else if (wasEditing.current) trigger.current?.focus()
    wasEditing.current = editing
  }, [editing])
  if (!writable) return <span className="break-words whitespace-pre-wrap">{display || "Empty"}</span>
  if (!editing) return <Button size="lg" color="primary" ref={trigger} variant="ghost" disabled={pending || !canStartEdit} className="h-auto min-h-11 w-full justify-start whitespace-normal text-left" aria-label={`Edit ${question.label}`} onClick={() => {
    setValue(response.answers.find(answer => answer.questionId === question.id)?.value ?? ""); setRevision(response.revision); setEditing(true); onDirty(true)
  }}>{display || "Empty"}</Button>
  return <form ref={form} className="flex min-w-56 flex-col gap-2" onSubmit={async event => { event.preventDefault(); if (await onSave(value, revision)) { setEditing(false); onDirty(false) } }}>
    <OrganizationFormAnswerField id={fieldId} question={question} value={value} onChange={(_id, next) => setValue(next)} />
    {revision !== response.revision && <p role="status" className="text-xs">Saved value: {display}. Your draft is preserved.<Button size="lg" color="primary" variant="ghost" type="button" onClick={() => setRevision(response.revision)}>Use latest response revision</Button></p>}
    <div className="flex gap-2"><Button color="primary" size="md" type="submit" disabled={pending}>Save answer</Button><Button color="primary" size="md" variant="ghost" type="button" disabled={pending} onClick={() => { setEditing(false); onDirty(false) }}>Cancel</Button></div>
  </form>
}
