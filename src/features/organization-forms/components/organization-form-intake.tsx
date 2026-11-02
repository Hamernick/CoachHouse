"use client"

import { useEffect, useId, useRef, useState } from "react"
import LoaderIcon from "lucide-react/dist/esm/icons/loader-circle"
import { ParticleButton as Button } from "@/components/ui/particle-ui"
import { createFormSnapshot, formReceiptSchema, normalizeFormAnswerInputs, validateFormAnswers } from "../lib"
import type { FormAnswer, FormAnswerIssue, FormIntakeCommand } from "../lib"
import type { FormDefinition } from "../types"
import { IntakeRequestError, sendFormCommand } from "../hooks/intake-client"
import { OrganizationFormAnswerField } from "./organization-form-answer-field"

export function OrganizationFormIntake({ formId, versionId, definition, organization, audience = "public" }: {
  formId: string; versionId: string; definition: FormDefinition; organization: string; audience?: "public" | "guest"
}) {
  const id = useId(); const root = useRef<HTMLFormElement>(null); const busy = useRef(false)
  const [answers, setAnswers] = useState<FormAnswer[]>([])
  const [issues, setIssues] = useState<FormAnswerIssue[]>([])
  const [deleted, setDeleted] = useState(false)
  const [pending, setPending] = useState(false)
  const [retry, setRetry] = useState<FormIntakeCommand | null>(null)
  const [error, setError] = useState(""); const [done, setDone] = useState(false)
  const snapshot = createFormSnapshot(definition)
  useEffect(() => {
    if (done || (!answers.length && !retry)) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [answers.length, done, retry])
  async function submit() {
    if (busy.current || done || deleted) return
    const checked = validateFormAnswers(snapshot, normalizeFormAnswerInputs(snapshot, answers))
    if (!retry && !checked.ok) {
      setIssues(checked.issues)
      const first = checked.issues.find((issue) => issue.questionId)?.questionId
      root.current?.querySelector<HTMLElement>(`[id="${id}-${first}"]`)?.focus()
      return
    }
    const command: FormIntakeCommand = retry ?? { action: "submit", audience,
      submission: { id: crypto.randomUUID(), formId, versionId, answers: checked.ok ? checked.answers : [] } }
    busy.current = true; setPending(true); setError("")
    try {
      const receipt = formReceiptSchema.parse(await sendFormCommand(command))
      if (command.action !== "submit" || receipt.id !== command.submission.id || receipt.versionId !== versionId) throw new Error("Invalid receipt")
      setDone(true); setRetry(null); setAnswers([])
    } catch (failure) {
      if (failure instanceof IntakeRequestError && failure.status === 410) {
        setDeleted(true); setAnswers([]); setIssues([]); setRetry(null); return
      }
      const uncertain = !(failure instanceof IntakeRequestError) || failure.uncertain
      setRetry(uncertain ? command : null)
      setError(failure instanceof IntakeRequestError ? failure.message : "Unable to confirm. Retry the same request.")
    } finally { busy.current = false; setPending(false) }
  }
  if (deleted) return <p role="alert" className="py-3 text-sm">This submission was deleted. Contact the organization about your response.</p>
  if (done) return <p role="status" className="py-3 text-sm">Response received. Thank you.</p>
  return <form ref={root} aria-label="Submit form" className="flex min-w-0 flex-col gap-5" noValidate
    onSubmit={(event) => { event.preventDefault(); void submit() }}>
    <fieldset disabled={pending || Boolean(retry)} className="flex min-w-0 flex-col gap-5">
      <legend className="sr-only">Your answers</legend>
      {snapshot.questions.map((question) => <OrganizationFormAnswerField key={question.id} id={`${id}-${question.id}`}
        question={question} value={answers.find((answer) => answer.questionId === question.id)?.value}
        error={issues.find((issue) => issue.questionId === question.id)?.message}
        onChange={(questionId, value) => {
          setAnswers((current) => [...current.filter((answer) => answer.questionId !== questionId), { questionId, value }])
          setIssues((current) => current.filter((issue) => issue.questionId !== questionId)); setError("")
        }} />)}
    </fieldset>
    <p className="text-muted-foreground text-xs leading-relaxed">{organization} receives your answers privately in Coach House and keeps them until deleted. Contact the organization about your response.</p>
    {error && <p role="alert" className="text-destructive text-sm">{error}{retry && " Keep this page open while retrying."}</p>}
    {issues.some((issue) => !issue.questionId) && <p role="alert" className="text-destructive text-sm">{issues.find((issue) => !issue.questionId)?.message}</p>}
    <Button size="lg" color="primary" type="submit" className="min-h-11 w-fit rounded-xl" disabled={pending}>{pending && <LoaderIcon aria-hidden className="animate-spin motion-reduce:animate-none" />}{retry ? "Retry submission" : "Submit"}</Button>
  </form>
}
